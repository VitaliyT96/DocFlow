import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import DataLoader from 'dataloader';
import { ProcessingJob } from '@docflow/database';

/**
 * Request-scoped DataLoader that batches document → jobs lookups.
 *
 * When a GraphQL query requests `processingJobs` on multiple documents
 * in a single request, this loader collects all documentIds and fetches
 * them in a single `WHERE document_id IN (...)` query instead of N
 * separate queries.
 *
 * Scope.REQUEST ensures each HTTP request gets a fresh DataLoader
 * with an empty cache, preventing cross-request data leakage.
 */
@Injectable({ scope: Scope.REQUEST })
export class ProcessingJobLoader {
  private readonly loader: DataLoader<string, ProcessingJob[]>;

  constructor(
    @InjectRepository(ProcessingJob)
    private readonly jobRepository: Repository<ProcessingJob>,
  ) {
    this.loader = new DataLoader<string, ProcessingJob[]>(
      (documentIds) => this.batchLoadByDocumentIds(documentIds),
    );
  }

  /**
   * Load processing jobs for a single document.
   * DataLoader handles deduplication and batching automatically.
   */
  async loadByDocumentId(documentId: string): Promise<ProcessingJob[]> {
    return this.loader.load(documentId);
  }

  /**
   * Batch function: fetches all jobs for the provided document IDs
   * in a single query, then groups them by documentId to match
   * DataLoader's expected return shape.
   *
   * Invariant: the returned array must have the same length and order
   * as the input `documentIds` array. Missing entries get empty arrays.
   */
  private async batchLoadByDocumentIds(
    documentIds: readonly string[],
  ): Promise<ProcessingJob[][]> {
    const jobs = await this.jobRepository.find({
      where: { documentId: In([...documentIds]) },
      order: { createdAt: 'DESC' },
    });

    // Group jobs by documentId
    const jobsByDocumentId = new Map<string, ProcessingJob[]>();
    for (const job of jobs) {
      const existing = jobsByDocumentId.get(job.documentId) ?? [];
      existing.push(job);
      jobsByDocumentId.set(job.documentId, existing);
    }

    // Return in the same order as the input documentIds
    return documentIds.map((id) => jobsByDocumentId.get(id) ?? []);
  }
}
