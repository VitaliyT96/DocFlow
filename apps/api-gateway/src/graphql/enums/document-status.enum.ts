import { registerEnumType } from '@nestjs/graphql';
import { DocumentStatus } from '@docflow/database';

registerEnumType(DocumentStatus, {
  name: 'DocumentStatus',
  description: 'Lifecycle status of a document in the processing pipeline',
  valuesMap: {
    UPLOADED: { description: 'Document uploaded but not yet queued for processing' },
    PROCESSING: { description: 'Document is actively being processed by a worker' },
    COMPLETED: { description: 'Processing finished successfully' },
    FAILED: { description: 'Processing failed (see job errorMessage for details)' },
  },
});
