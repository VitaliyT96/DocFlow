import { registerEnumType } from '@nestjs/graphql';
import { ProcessingJobStatus } from '@docflow/database';

registerEnumType(ProcessingJobStatus, {
  name: 'ProcessingJobStatus',
  description: 'Status of an individual processing job executed by the worker',
  valuesMap: {
    PENDING: { description: 'Job created and waiting to be picked up by worker' },
    RUNNING: { description: 'Worker is actively processing this job' },
    COMPLETED: { description: 'Job completed successfully' },
    FAILED: { description: 'Job failed (see errorMessage for details)' },
  },
});
