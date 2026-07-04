import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { NotificationType, ViewRequest, ViewRequestStatus } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { PasswordService } from '../auth/password.service';
import { ViewRequestRepository } from './view-request.repository';
import {
  ApproveViewRequestDto,
  CreateViewRequestDto,
  ListViewRequestsDto,
} from './dto/view-request.dto';

@Injectable()
export class ViewRequestService {
  constructor(
    private readonly repo: ViewRequestRepository,
    private readonly notifications: NotificationService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  /** PUBLIC — no auth; tenant resolved from slug. */
  async create(dto: CreateViewRequestDto): Promise<ViewRequest> {
    const tenant = await this.repo.findTenantBySlug(dto.tenantSlug);
    if (!tenant) {
      throw AppException.notFound(ErrorKeys.TENANT_NOT_FOUND, { slug: dto.tenantSlug });
    }
    const settings = await this.repo.visibilitySettings(tenant.id);
    if (settings?.requireIdForViewRequest && !dto.idAttachmentKey) {
      throw AppException.badRequest(ErrorKeys.VIEW_REQUEST_ID_REQUIRED);
    }

    const request = await this.repo.create({
      tenantId: tenant.id,
      fullName: dto.fullName,
      phone: dto.phone,
      allegedBranch: dto.allegedBranch ?? null,
      reason: dto.reason,
      idAttachmentKey: dto.idAttachmentKey ?? null,
      status: ViewRequestStatus.pending,
    });

    // Notify admins (owner-client persistence + WS emit + email).
    const adminIds = await this.repo.adminUserIds(tenant.id);
    await this.notifications.notifyMany(
      tenant.id,
      adminIds,
      NotificationType.view_request_submitted,
      { viewRequestId: request.id, fullName: dto.fullName },
    );
    return request;
  }

  list(dto: ListViewRequestsDto, _user: AuthenticatedUser): Promise<ViewRequest[]> {
    return this.repo.list(dto.status);
  }

  async approve(
    id: string,
    dto: ApproveViewRequestDto,
    user: AuthenticatedUser,
  ): Promise<ViewRequest> {
    const request = await this.getPending(id);
    const tenantId = user.tenantId as string;
    const validTo = new Date(dto.validTo);

    const settings = await this.repo.visibilitySettings(tenantId);
    const scope = settings?.defaultMemberScope ?? 'tribe';

    // Create/link a temporary Viewer user (random credential; a real login flow
    // for granted viewers is an M4/onboarding concern — see DECISIONS D-309).
    const email = `viewer-${randomBytes(6).toString('hex')}@view.${tenantId}.local`;
    const passwordHash = await this.passwords.hash(randomBytes(24).toString('hex'));
    const grantedUserId = await this.repo.grantViewer(
      tenantId,
      email,
      request.fullName,
      passwordHash,
      validTo,
      scope,
    );

    const updated = await this.repo.update(id, {
      status: ViewRequestStatus.approved,
      reviewedBy: user.id,
      grantedUserId,
      validTo,
    });
    await this.audit.record({
      action: 'viewRequest.approve',
      entityType: 'ViewRequest',
      entityId: id,
      before: request,
      after: updated,
    });
    return updated;
  }

  async reject(id: string, user: AuthenticatedUser): Promise<ViewRequest> {
    const request = await this.getPending(id);
    const updated = await this.repo.update(id, {
      status: ViewRequestStatus.rejected,
      reviewedBy: user.id,
    });
    await this.audit.record({
      action: 'viewRequest.reject',
      entityType: 'ViewRequest',
      entityId: id,
      before: request,
      after: updated,
    });
    return updated;
  }

  private async getPending(id: string): Promise<ViewRequest> {
    const request = await this.repo.findById(id);
    if (!request) {
      throw AppException.notFound(ErrorKeys.VIEW_REQUEST_NOT_FOUND, { id });
    }
    if (request.status !== ViewRequestStatus.pending) {
      throw AppException.badRequest(ErrorKeys.VIEW_REQUEST_INVALID_STATE, {
        status: request.status,
      });
    }
    return request;
  }
}
