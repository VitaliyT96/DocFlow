/**
 * Injection tokens for the Redis module.
 *
 * Using string-based tokens (not class references) so both the publisher
 * and subscriber connections can be provided as separate ioredis instances
 * without NestJS confusing them with a single provider.
 */
export const REDIS_PUBLISHER_CLIENT = 'REDIS_PUBLISHER_CLIENT';
export const REDIS_SUBSCRIBER_CLIENT = 'REDIS_SUBSCRIBER_CLIENT';
