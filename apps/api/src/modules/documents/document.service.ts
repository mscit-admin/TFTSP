import { Injectable } from '@nestjs/common';
import { DocumentKind, PersonDocument } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { MinioService } from '../../common/minio/minio.service';
import { TenantContext } from '../../common/tenant/tenant-context';
import { detectFileKind } from '../../common/util/file-type';
import { AuditService } from '../audit/audit.service';
import { PersonsService } from '../persons/persons.service';
import { DocumentRepository } from './document.repository';
import { ConfirmUploadDto, MAX_DOCUMENT_BYTES, RequestUploadDto } from './dto/document.dto';

export interface DocumentWithUrl extends PersonDocument {
  downloadUrl: string;
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly repo: DocumentRepository,
    private readonly minio: MinioService,
    private readonly persons: PersonsService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Presigned PUT (15-min). Rejects SVG/oversize by declared metadata early. */
  async presign(dto: RequestUploadDto): Promise<{ uploadUrl: string; objectKey: string }> {
    await this.assertPersonVisible(dto.personId);
    if (dto.contentType.toLowerCase().includes('svg')) {
      throw AppException.badRequest(ErrorKeys.UPLOAD_SVG_REJECTED);
    }
    if (!/^image\//i.test(dto.contentType) && dto.contentType !== 'application/pdf') {
      throw AppException.badRequest(ErrorKeys.UPLOAD_UNSUPPORTED_TYPE, {
        contentType: dto.contentType,
      });
    }
    if (dto.sizeBytes > MAX_DOCUMENT_BYTES) {
      throw AppException.badRequest(ErrorKeys.UPLOAD_FILE_TOO_LARGE);
    }
    const tenantId = this.tenantContext.requireTenantId();
    const objectKey = `documents/${tenantId}/${dto.personId}/${uuidv4()}`;
    const uploadUrl = await this.minio.presignedPut(objectKey, 900);
    return { uploadUrl, objectKey };
  }

  /**
   * Confirm: fetch the ACTUAL uploaded bytes, magic-byte check (SVG rejected),
   * enforce the 10 MB cap on the real size, then register the document row.
   */
  async confirm(dto: ConfirmUploadDto, user: AuthenticatedUser): Promise<PersonDocument> {
    await this.assertPersonVisible(dto.personId);

    const head = await this.minio.getFirstBytes(dto.objectKey, 512).catch(() => {
      throw AppException.badRequest(ErrorKeys.DOCUMENT_NOT_FOUND, { objectKey: dto.objectKey });
    });
    const kind = detectFileKind(head);
    if (kind === 'svg') {
      await this.minio.remove(dto.objectKey).catch(() => undefined);
      throw AppException.badRequest(ErrorKeys.UPLOAD_SVG_REJECTED);
    }
    if (kind === 'unsupported') {
      await this.minio.remove(dto.objectKey).catch(() => undefined);
      throw AppException.badRequest(ErrorKeys.UPLOAD_UNSUPPORTED_TYPE);
    }
    const { size } = await this.minio.stat(dto.objectKey);
    if (size > MAX_DOCUMENT_BYTES) {
      await this.minio.remove(dto.objectKey).catch(() => undefined);
      throw AppException.badRequest(ErrorKeys.UPLOAD_FILE_TOO_LARGE);
    }

    const doc = await this.repo.create({
      personId: dto.personId,
      kind: kind === 'pdf' ? DocumentKind.pdf : DocumentKind.image,
      objectKey: dto.objectKey,
      filename: dto.filename,
      sizeBytes: size,
      uploadedBy: user.id,
    });
    await this.audit.record({
      action: 'document.create',
      entityType: 'PersonDocument',
      entityId: doc.id,
      after: { personId: dto.personId, kind: doc.kind, filename: doc.filename },
    });
    return doc;
  }

  /** List a person's documents with short-lived presigned GET URLs (15-min). */
  async listForPerson(personId: string): Promise<DocumentWithUrl[]> {
    await this.assertPersonVisible(personId);
    const docs = await this.repo.listForPerson(personId);
    return Promise.all(
      docs.map(async (d) => ({
        ...d,
        downloadUrl: await this.minio.presignedGet(d.objectKey, 900),
      })),
    );
  }

  async remove(id: string): Promise<void> {
    const doc = await this.repo.findById(id);
    if (!doc) {
      throw AppException.notFound(ErrorKeys.DOCUMENT_NOT_FOUND, { id });
    }
    await this.repo.softDelete(id);
    await this.audit.record({
      action: 'document.delete',
      entityType: 'PersonDocument',
      entityId: id,
      before: doc,
    });
  }

  /** Visibility gate: an out-of-scope person is 404 (M3 resolver). */
  private async assertPersonVisible(personId: string): Promise<void> {
    await this.persons.findOne(personId); // throws PERSON_NOT_FOUND if not visible
  }
}
