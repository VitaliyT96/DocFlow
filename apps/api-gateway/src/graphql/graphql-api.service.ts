import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Document,
  ProcessingJob,
  DocumentStatus,
  ProcessingJobStatus,
} from '@docflow/database';
import { DocumentProcessingClient } from '../grpc/document-processing.client';
import {
  DocumentNotFoundException,
  ProcessingJobNotFoundException,
  DocumentOwnershipException,
  RetryNotAllowedException,
} from './exceptions/graphql-api.exceptions';

/**
 * GraphqlApiService — business logic for GraphQL queries and mutations.
 *
 * All read operations are scoped to the authenticated user's documents
 * to enforce data isolation. Mutations verify ownership before executing.
 *
 * This service is the single source of truth for document/job access
 * from the GraphQL layer. It does NOT duplicate the REST upload logic
 * in DocumentsService — each transport has its own service.
 */
@Injectable()
export class GraphqlApiService {
  private readonly logger = new Logger(GraphqlApiService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(ProcessingJob)
    private readonly jobRepository: Repository<ProcessingJob>,
    private readonly dataSource: DataSource,
    private readonly grpcClient: DocumentProcessingClient,
  ) {}

  // ── Queries ─────────────────────────────────────────────────

  /**
   * Retrieve all documents owned by the authenticated user.
   * Ordered by creation time (newest first).
   */
  async findDocumentsByOwner(userId: string): Promise<Document[]> {
    this.logger.debug(`Fetching documents for user ${userId}`);

    return this.documentRepository.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieve a single document by ID, enforcing ownership.
   *
   * @throws DocumentNotFoundException if the document does not exist
   * @throws DocumentOwnershipException if the document belongs to another user
   */
  async findDocumentById(
    documentId: string,
    userId: string,
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new DocumentNotFoundException(documentId);
    }

    if (document.ownerId !== userId) {
      throw new DocumentOwnershipException(documentId);
    }

    return document;
  }

  /**
   * Retrieve a single processing job by ID, enforcing ownership
   * via the parent document.
   *
   * @throws ProcessingJobNotFoundException if the job does not exist
   * @throws DocumentOwnershipException if the parent document belongs to another user
   */
  async findProcessingJobById(
    jobId: string,
    userId: string,
  ): Promise<ProcessingJob> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new ProcessingJobNotFoundException(jobId);
    }

    // Verify the user owns the parent document
    const document = await this.documentRepository.findOne({
      where: { id: job.documentId },
    });

    if (!document || document.ownerId !== userId) {
      throw new DocumentOwnershipException(job.documentId);
    }

    return job;
  }

  // ── Mutations ───────────────────────────────────────────────

  /**
   * Delete a document and cascade to all related jobs and annotations.
   *
   * TypeORM cascading is configured on the entity level (onDelete: CASCADE),
   * so deletion of the document record automatically removes children.
   *
   * @throws DocumentNotFoundException if the document does not exist
   * @throws DocumentOwnershipException if the document belongs to another user
   */
  async deleteDocument(
    documentId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Verify existence and ownership first
    const document = await this.findDocumentById(documentId, userId);

    await this.documentRepository.remove(document);

    this.logger.log(
      `Document ${documentId} deleted by user ${userId} (cascade to jobs/annotations)`,
    );

    return {
      success: true,
      message: `Document "${document.title}" has been deleted successfully`,
    };
  }

  /**
   * Retry a failed processing job.
   *
   * Business rules:
   * 1. Only jobs in FAILED status can be retried
   * 2. The parent document must be owned by the requesting user
   * 3. Job is reset to PENDING, document status is set back to UPLOADED
   * 4. A gRPC call is dispatched to the worker (non-fatal if it fails)
   *
   * Both the job and document updates happen inside a transaction to
   * maintain consistency.
   *
   * @throws ProcessingJobNotFoundException if the job does not exist
   * @throws DocumentOwnershipException if the parent document is not owned by the user
   * @throws RetryNotAllowedException if the job is not in FAILED status
   */
  async retryProcessing(
    jobId: string,
    userId: string,
  ): Promise<ProcessingJob> {
    // Step 1: Find the job and verify ownership
    const job = await this.findProcessingJobById(jobId, userId);

    // Step 2: Validate the job is in a retryable state
    if (job.status !== ProcessingJobStatus.FAILED) {
      throw new RetryNotAllowedException(jobId, job.status);
    }

    // Step 3: Reset job and document status in a transaction
    const updatedJob = await this.dataSource.transaction(async (manager) => {
      // Reset the job
      job.status = ProcessingJobStatus.PENDING;
      job.progress = 0;
      job.errorMessage = null;
      job.startedAt = null;
      job.completedAt = null;
      const savedJob = await manager.save(ProcessingJob, job);

      // Reset the parent document status back to UPLOADED
      await manager.update(Document, job.documentId, {
        status: DocumentStatus.UPLOADED,
      });

      return savedJob;
    });

    this.logger.log(
      `Job ${jobId} reset to PENDING by user ${userId}, dispatching to worker`,
    );

    // Step 4: Dispatch gRPC call to worker (non-fatal)
    const document = await this.documentRepository.findOne({
      where: { id: job.documentId },
    });

    if (document) {
      try {
        await this.grpcClient.processDocument({
          documentId: document.id,
          userId,
          filePath: document.fileUrl,
          mimeType: document.mimeType,
        });
        this.logger.log(`Worker accepted retry for document ${document.id}`);
      } catch (error) {
        const cause =
          error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Worker gRPC dispatch failed on retry for document ${document.id}: ${cause.message}. ` +
            `Job reset to PENDING — worker will pick it up later.`,
        );
      }
    }

    return updatedJob;
  }
}
