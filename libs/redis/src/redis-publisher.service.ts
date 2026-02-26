import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PUBLISHER_CLIENT } from './redis.constants';

/**
 * RedisPublisherService — thin wrapper around the ioredis publisher connection.
 *
 * Responsibilities:
 * - Publish JSON-serialized payloads to named Redis PubSub channels
 * - Enforce the channel naming convention: {domain}:{id}:{type}
 * - Graceful disconnect on application shutdown
 *
 * Design note:
 *   ioredis requires a **separate** connection for subscribe/psubscribe
 *   commands. This service owns the "normal" connection used only for
 *   publish() calls, keeping it free for other commands if needed.
 */
@Injectable()
export class RedisPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);

  constructor(
    @Inject(REDIS_PUBLISHER_CLIENT)
    private readonly client: Redis,
  ) {}

  /**
   * Publishes a JSON-serialized payload to a Redis PubSub channel.
   *
   * @param channel - channel key, e.g. `doc:abc-123:progress`
   * @param payload - arbitrary object; will be JSON.stringify'd
   * @returns number of subscribers that received the message
   */
  async publish<T extends object>(channel: string, payload: T): Promise<number> {
    const message = JSON.stringify(payload);
    const receiverCount = await this.client.publish(channel, message);

    this.logger.debug(
      `Published to channel "${channel}" — ${receiverCount} receiver(s)`,
    );

    return receiverCount;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis publisher connection');
    await this.client.quit();
  }
}
