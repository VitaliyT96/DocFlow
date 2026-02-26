import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Observable, Observer, Subject } from 'rxjs';
import { REDIS_SUBSCRIBER_CLIENT } from './redis.constants';

/**
 * RedisSubscriberService — manages a dedicated ioredis subscriber connection.
 *
 * Design notes:
 * - ioredis requires a **separate** Redis connection once subscribe() is called,
 *   because the connection enters "subscriber mode" and can only issue
 *   SUBSCRIBE / UNSUBSCRIBE / PSUBSCRIBE / PUNSUBSCRIBE / PING / QUIT.
 *   We therefore inject a second ioredis instance (REDIS_SUBSCRIBER_CLIENT)
 *   that is exclusively used for subscriptions.
 *
 * - Multiple callers can subscribe to the same channel concurrently.
 *   Each call creates an independent Subject that receives messages until
 *   explicitly unsubscribed.
 *
 * - The `unsubscribe()` call decrements ioredis's internal reference count.
 *   When the count for a channel reaches zero, ioredis sends UNSUBSCRIBE.
 */
@Injectable()
export class RedisSubscriberService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);

  /** Map of channel → active Subject array (multiple subscribers per channel) */
  private readonly subjects = new Map<string, Set<Subject<string>>>();

  constructor(
    @Inject(REDIS_SUBSCRIBER_CLIENT)
    private readonly client: Redis,
  ) {
    // Central message handler: fan-out to all subjects for that channel
    this.client.on('message', (channel: string, message: string) => {
      const channelSubjects = this.subjects.get(channel);
      if (!channelSubjects) return;

      for (const subject of channelSubjects) {
        subject.next(message);
      }
    });
  }

  /**
   * Returns an Observable that emits raw JSON strings published to `channel`.
   *
   * The caller is responsible for parsing the JSON. The Observable completes
   * when `channel` is unsubscribed (i.e., when the returned cleanup function
   * is called — typically by an RxJS operator like `takeUntil`).
   *
   * @param channel - Redis PubSub channel name, e.g. `doc:abc-123:progress`
   */
  subscribe(channel: string): Observable<string> {
    const subject = new Subject<string>();

    // Register the subject for this channel
    if (!this.subjects.has(channel)) {
      this.subjects.set(channel, new Set());
    }
    this.subjects.get(channel)!.add(subject);

    // Tell Redis to start delivering messages for this channel
    this.client.subscribe(channel).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to subscribe to channel "${channel}": ${message}`);
      subject.error(new Error(`Redis subscribe failed: ${message}`));
    });

    this.logger.debug(`Subscribed to channel "${channel}"`);

    return new Observable<string>((observer: Observer<string>) => {
      const subscription = subject.subscribe(observer);

      // Cleanup when the consumer unsubscribes (e.g., client disconnect)
      return () => {
        subscription.unsubscribe();
        this.unsubscribeSubject(channel, subject);
      };
    });
  }

  /**
   * Subscribes to `channel` and automatically parses each message as JSON.
   * Emits `T` values; logs and skips malformed JSON rather than throwing.
   */
  subscribeJson<T>(channel: string): Observable<T> {
    return new Observable<T>((observer: Observer<T>) => {
      const subscription = this.subscribe(channel).subscribe({
        next: (raw: string) => {
          try {
            observer.next(JSON.parse(raw) as T);
          } catch {
            this.logger.warn(
              `Malformed JSON on channel "${channel}": ${raw.slice(0, 120)}`,
            );
          }
        },
        error: (err: Error) => observer.error(err),
        complete: () => observer.complete(),
      });

      return () => subscription.unsubscribe();
    });
  }

  // ── Private helpers ──────────────────────────────────────

  private unsubscribeSubject(channel: string, subject: Subject<string>): void {
    const channelSubjects = this.subjects.get(channel);
    if (!channelSubjects) return;

    subject.complete();
    channelSubjects.delete(subject);

    if (channelSubjects.size === 0) {
      this.subjects.delete(channel);
      // Tell Redis we no longer need messages for this channel
      this.client.unsubscribe(channel).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to unsubscribe from channel "${channel}": ${message}`,
        );
      });
      this.logger.debug(`Unsubscribed from channel "${channel}"`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis subscriber connection');
    // Complete all open subjects so consumers receive a completion signal
    for (const [, channelSubjects] of this.subjects) {
      for (const subject of channelSubjects) {
        subject.complete();
      }
    }
    this.subjects.clear();
    await this.client.quit();
  }
}
