import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for the multipart form fields that accompany the file upload.
 *
 * The file itself is handled by Multer via @UploadedFile() — it is NOT
 * part of this DTO. NestJS ValidationPipe handles coercion of the
 * form-data text fields.
 */
export class UploadDocumentDto {
  /**
   * Optional human-readable title for the document.
   * If omitted, the controller falls back to the original filename.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;
}
