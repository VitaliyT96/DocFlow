/**
 * Custom gRPC exception classes.
 *
 * These wrap RpcException with proper gRPC status codes so that both
 * server and client share the same error contract. Each exception
 * carries a human-readable message and the appropriate gRPC status.
 *
 * @see https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';

export class GrpcNotFoundException extends RpcException {
  constructor(message: string) {
    super({
      code: GrpcStatus.NOT_FOUND,
      message,
    });
  }
}

export class GrpcInvalidArgumentException extends RpcException {
  constructor(message: string) {
    super({
      code: GrpcStatus.INVALID_ARGUMENT,
      message,
    });
  }
}

export class GrpcInternalException extends RpcException {
  constructor(message: string) {
    super({
      code: GrpcStatus.INTERNAL,
      message,
    });
  }
}

export class GrpcAlreadyExistsException extends RpcException {
  constructor(message: string) {
    super({
      code: GrpcStatus.ALREADY_EXISTS,
      message,
    });
  }
}

export class GrpcUnavailableException extends RpcException {
  constructor(message: string) {
    super({
      code: GrpcStatus.UNAVAILABLE,
      message,
    });
  }
}
