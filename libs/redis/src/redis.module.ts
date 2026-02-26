import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER_CLIENT, REDIS_SUBSCRIBER_CLIENT } from './redis.constants';
import { RedisPublisherService } from './redis-publisher.service';
import { RedisSubscriberService } from './redis-subscriber.service';

/**
 * RedisModule — async dynamic module providing PubSub infrastructure.
 *
 * Usage:
 *   RedisModule.forRoot()  — in AppModule or any feature module
 *
 * Exports:
 *   - RedisPublisherService: publish(channel, payload)
 *   - RedisSubscriberService: subscribe(channel), subscribeJson<T>(channel)
 *
 * Two separate ioredis connections are created because ioredis enters
 * a locked "subscriber mode" once subscribe() is called. Using a single
 * connection for both publish() and subscribe() would cause runtime errors.
 */
@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    const publisherProvider = {
      provide: REDIS_PUBLISHER_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          // Retry strategy: exponential back-off capped at 10 s
          retryStrategy: (times: number) => Math.min(times * 100, 10_000),
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });
      },
    };

    const subscriberProvider = {
      provide: REDIS_SUBSCRIBER_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          retryStrategy: (times: number) => Math.min(times * 100, 10_000),
          enableReadyCheck: true,
          // Subscriber connections do not send commands so no
          // retries-per-request limit applies; set to null to disable.
          maxRetriesPerRequest: null,
          lazyConnect: false,
        });
      },
    };

    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        publisherProvider,
        subscriberProvider,
        RedisPublisherService,
        RedisSubscriberService,
      ],
      exports: [RedisPublisherService, RedisSubscriberService],
      global: false,
    };
  }
}
