/**
 * @docflow/redis
 *
 * Shared Redis PubSub infrastructure for the DocFlow platform.
 *
 * Exports:
 *   - RedisModule.forRoot()     — import into any NestJS module
 *   - RedisPublisherService     — publish events to channels
 *   - RedisSubscriberService    — subscribe to channels as Observables
 *   - REDIS_PUBLISHER_CLIENT    — ioredis injection token (publisher)
 *   - REDIS_SUBSCRIBER_CLIENT   — ioredis injection token (subscriber)
 */
export { RedisModule } from './redis.module';
export { RedisPublisherService } from './redis-publisher.service';
export { RedisSubscriberService } from './redis-subscriber.service';
export {
  REDIS_PUBLISHER_CLIENT,
  REDIS_SUBSCRIBER_CLIENT,
} from './redis.constants';
