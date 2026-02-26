import { Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import DataLoader from 'dataloader';
import { Document } from '@docflow/database';

/**
 * Request-scoped DataLoader that batches documentId → Document lookups.
 *
 * Used by the ProcessingJobResolver to resolve the parent `document`
 * field on a ProcessingJob without N+1 queries.
 *
 * Scope.REQUEST ensures each HTTP request gets a fresh DataLoader
 * with an empty cache, preventing cross-request data leakage.
 */
@Injectable({ scope: Scope.REQUEST })
export class DocumentLoader {
  private readonly loader: DataLoader<string, Document | null>;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {
    this.loader = new DataLoader<string, Document | null>(
      (documentIds) => this.batchLoadByIds(documentIds),
    );
  }

  /**
   * Load a single document by its ID.
   * DataLoader handles deduplication and batching automatically.
   */
  async loadById(documentId: string): Promise<Document | null> {
    return this.loader.load(documentId);
  }

  /**
   * Batch function: fetches all documents for the provided IDs
   * in a single query, then maps them back to match DataLoader's
   * expected return shape (same order as input).
   *
   * Returns null for any ID that doesn't match a document.
   */
  private async batchLoadByIds(
    documentIds: readonly string[],
  ): Promise<(Document | null)[]> {
    const documents = await this.documentRepository.find({
      where: { id: In([...documentIds]) },
    });

    // Index by ID for O(1) lookups
    const documentMap = new Map<string, Document>();
    for (const doc of documents) {
      documentMap.set(doc.id, doc);
    }

    // Return in the same order as the input IDs
    return documentIds.map((id) => documentMap.get(id) ?? null);
  }
}
