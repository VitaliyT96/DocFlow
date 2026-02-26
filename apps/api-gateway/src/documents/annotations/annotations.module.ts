import { Module } from '@nestjs/common';
import { AnnotationsGateway } from './annotations.gateway';

@Module({
  providers: [AnnotationsGateway],
  // If AnnotationsGateway requires a service (like DocumentService or AnnotationService)
  // to save data directly, import the respective module here and inject the service.
})
export class AnnotationsModule {}
