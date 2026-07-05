/** M4 — Per-person documents (Spec §3·M4.3). */

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

/**
 * Upload flow: request a presigned PUT (15-min TTL) → PUT the file to MinIO →
 * confirm to register the document row. Magic-byte type check on confirm;
 * **SVG is rejected outright** (XSS); max 10 MB.
 */
export interface RequestUploadDto {
  personId: string;
  filename: string;
  contentType: string; // must resolve to image/* or application/pdf; never image/svg+xml
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

/** GET returns a short-lived presigned download URL (never a public URL). */
export interface DocumentWithUrl extends PersonDocument {
  downloadUrl: string; // presigned GET, 15-min TTL
}
