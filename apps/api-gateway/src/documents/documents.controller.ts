import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Body,
  Logger,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UploadDocumentResponseDto } from './dto/upload-document-response.dto';

/**
 * Multer configuration: memory storage so the buffer stays in RAM and
 * flows directly to MinIO without writing a temp file to disk.
 *
 * File size limit here is a secondary guard — the primary limit is
 * enforced in DocumentsService.validateFile() with a descriptive error.
 * Multer's limit is set to 100MB to allow the service-level limit (50MB)
 * to produce the better error message.
 */
const MULTER_OPTIONS = {
  storage: memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB hard cap at Multer layer
  },
};

/**
 * REST controller for document management.
 *
 * Routes:
 *   POST /documents/upload — Upload a document and trigger processing
 *
 * All routes require a valid JWT access token (Authorization: Bearer <token>).
 */
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * POST /documents/upload
   *
   * Accepts a multipart/form-data request with:
   *   - file:  The document file (required) — field name must be "file"
   *   - title: Optional display name for the document (text field)
   *
   * Flow:
   *   1. JWT guard validates the Bearer token
   *   2. Multer extracts the file into memory (buffer)
   *   3. DocumentsService validates, stores, persists, and dispatches to worker
   *   4. Returns 201 Created with documentId, jobId, and metadata
   *
   * Error responses:
   *   400 — No file attached
   *   401 — Missing or invalid JWT
   *   413 — File exceeds size limit
   *   415 — Unsupported MIME type
   *   500 — DB transaction failure
   *   502 — MinIO upload failure
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UploadDocumentResponseDto> {
    const { userId } = req.user;

    this.logger.log(
      `Upload request from user ${userId}: ` +
        `file="${file?.originalname ?? 'none'}", size=${file?.size ?? 0}`,
    );

    return this.documentsService.uploadDocument(file, dto, userId);
  }
}
