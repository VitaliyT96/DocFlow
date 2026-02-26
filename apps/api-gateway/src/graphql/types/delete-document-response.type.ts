import { ObjectType, Field } from '@nestjs/graphql';

/**
 * Response type for mutations that don't return a domain entity
 * (e.g. deleteDocument).
 */
@ObjectType('DeleteDocumentResponse')
export class DeleteDocumentResponseType {
  @Field(() => Boolean, { description: 'Whether the operation succeeded' })
  success!: boolean;

  @Field(() => String, { description: 'Human-readable result message' })
  message!: string;
}
