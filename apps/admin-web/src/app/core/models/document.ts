// Local mirror of packages/shared-types/src/document.ts (M4 — DECISIONS D-202 mirror policy).
export type DocumentKind = 'image' | 'pdf';

export interface PersonDocument {
  id: string;
  tenantId: string;
  personId: string;
  kind: DocumentKind;
  objectKey: string; // MinIO
  filename: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface RequestUploadDto {
  personId: string;
  filename: string;
  contentType: string; // image/* or application/pdf; never image/svg+xml
  sizeBytes: number;
}

export interface PresignedUpload {
  uploadUrl: string; // presigned PUT, expires in 15 min
  objectKey: string;
}

export interface ConfirmUploadDto {
  personId: string;
  objectKey: string;
  filename: string;
}

export interface DocumentWithUrl extends PersonDocument {
  downloadUrl: string; // presigned GET, 15-min TTL
}

/** Client-side guards (server is authoritative — magic bytes, 10MB, SVG rejection). */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';
