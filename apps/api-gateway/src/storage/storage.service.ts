import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';
import { StorageUploadException } from './storage.exceptions';

/** Max length of the sanitized file name suffix in the object key */
const MAX_FILENAME_LENGTH = 100;

/**
 * StorageService — abstracts all object storage operations.
 *
 * Currently backed by MinIO (S3-compatible). The interface is intentionally
 * narrow so it can be swapped for AWS S3 without touching callers.
 *
 * Object key pattern:  {YYYY}/{uuid}-{sanitized-filename}
 * Example:             2024/f3a2b1c0-my-report.pdf
 *
 * Redis key pattern (if used for upload tracking): storage:{objectKey}:meta
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: Minio.Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    this.port = this.configService.get<number>('MINIO_PORT', 9000);
    this.useSSL =
      this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    this.bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'docflow-documents',
    );
  }

  /**
   * Initializes the MinIO client and ensures the bucket exists.
   * Called once when the module bootstraps.
   */
  async onModuleInit(): Promise<void> {
    const accessKey = this.configService.get<string>(
      'MINIO_ACCESS_KEY',
      'minioadmin',
    );
    const secretKey = this.configService.get<string>(
      'MINIO_SECRET_KEY',
      'minioadmin_secret',
    );

    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });

    await this.ensureBucketExists();
    this.logger.log(
      `StorageService ready — bucket: "${this.bucket}" @ ${this.endpoint}:${this.port}`,
    );
  }

  /**
   * Uploads a file buffer to the object store and returns the object key.
   *
   * @param buffer       — Raw file bytes (from Multer memoryStorage)
   * @param originalName — Original filename from the HTTP upload (used as suffix in key)
   * @param mimeType     — MIME type to set on the stored object
   * @returns The object key (e.g. "2024/f3a2b1c0-report.pdf")
   * @throws StorageUploadException on any MinIO error
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<string> {
    const objectKey = this.buildObjectKey(originalName);
    const metadata = { 'Content-Type': mimeType };

    this.logger.debug(`Uploading ${objectKey} (${buffer.length} bytes)`);

    try {
      await this.client.putObject(
        this.bucket,
        objectKey,
        buffer,
        buffer.length,
        metadata,
      );
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to upload "${objectKey}" to MinIO: ${cause.message}`,
      );
      throw new StorageUploadException(originalName, cause);
    }

    this.logger.log(`Uploaded "${objectKey}" (${buffer.length} bytes)`);
    return objectKey;
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Builds a unique, URL-safe object key.
   * Pattern: {YYYY}/{uuid}-{sanitized-filename}
   */
  private buildObjectKey(originalName: string): string {
    const year = new Date().getFullYear();
    const uuid = randomUUID();
    const sanitized = this.sanitizeFilename(originalName);
    return `${year}/${uuid}-${sanitized}`;
  }

  /**
   * Strips path traversal characters and whitespace, and truncates
   * to MAX_FILENAME_LENGTH characters.
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, MAX_FILENAME_LENGTH)
      .toLowerCase();
  }

  /**
   * Creates the upload bucket if it does not already exist.
   * MinIO is idempotent — creating an existing bucket is a no-op.
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created bucket "${this.bucket}"`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to ensure bucket "${this.bucket}" exists: ${message}`,
      );
      // Non-fatal during init — upload attempts will fail fast with StorageUploadException
    }
  }
}
