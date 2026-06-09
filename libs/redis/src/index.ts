import Redis from 'ioredis';
import { logger } from '@libs/common';

export class RedisService {
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private handlers: Map<string, ((msg: any) => void)[]> = new Map();

  constructor() {
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // Keep reconnecting forever without crashing the process
      enableOfflineQueue: false,  // Fail fast on commands instead of buffering in memory
    };

    logger.info('Initializing Redis Service', { host: config.host, port: config.port });

    this.client = new Redis(config);
    this.pubClient = new Redis(config);
    this.subClient = new Redis(config);

    this.client.on('error', (err) => logger.error('Redis Client Error', { err: err.message }));
    this.pubClient.on('error', (err) => logger.error('Redis Pub Client Error', { err: err.message }));
    this.subClient.on('error', (err) => logger.error('Redis Sub Client Error', { err: err.message }));

    // Register single message listener mapping to handlers
    this.subClient.on('message', (chan, message) => {
      const chanHandlers = this.handlers.get(chan);
      if (chanHandlers) {
        try {
          const parsed = JSON.parse(message);
          for (const handler of chanHandlers) {
            handler(parsed);
          }
        } catch (e) {
          logger.error('Failed to parse Pub/Sub message', { error: (e as Error).message, message });
        }
      }
    });
  }

  getClient() { return this.client; }
  getPubClient() { return this.pubClient; }
  getSubClient() { return this.subClient; }

  // 1. Presence System (Online/Offline)
  async setUserOnline(userId: string, socketId: string, nodeName: string): Promise<void> {
    const key = `user:presence:${userId}`;
    // Store mapping: where the user is connected (socketId and nodeName)
    await this.client.hset(key, {
      status: 'online',
      socketId,
      node: nodeName,
      lastSeen: Date.now().toString()
    });
    // Set expiry to 45 seconds (we'll run a 15-second heartbeat)
    await this.client.expire(key, 45);
  }

  async setUserOffline(userId: string): Promise<void> {
    const key = `user:presence:${userId}`;
    await this.client.del(key);
  }

  async getUserPresence(userId: string): Promise<{ status: string; socketId?: string; node?: string } | null> {
    const key = `user:presence:${userId}`;
    const data = await this.client.hgetall(key);
    if (!data || !data.status) return null;
    return {
      status: data.status,
      socketId: data.socketId,
      node: data.node,
    };
  }

  // 2. Typing State (auto-timeout 3s)
  async setTyping(conversationId: string, userId: string, username: string, isTyping: boolean): Promise<void> {
    const key = `typing:${conversationId}:${userId}`;
    if (isTyping) {
      await this.client.set(key, username, 'EX', 3);
    } else {
      await this.client.del(key);
    }
  }

  // Find all users typing in a conversation
  async getTypingUsers(conversationId: string): Promise<{ userId: string; username: string }[]> {
    const pattern = `typing:${conversationId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) return [];
    
    const results: { userId: string; username: string }[] = [];
    for (const key of keys) {
      const parts = key.split(':');
      const userId = parts[parts.length - 1];
      const username = await this.client.get(key);
      if (username) {
        results.push({ userId, username });
      }
    }
    return results;
  }

  // 3. Message Idempotency (Deduplication)
  async checkAndSetIdempotency(clientMessageId: string, serverMessageId: string): Promise<boolean> {
    const key = `idempotency:msg:${clientMessageId}`;
    // NX: Set if not exists, EX: Set expiry in seconds (24 hours = 86400)
    const result = await this.client.set(key, serverMessageId, 'EX', 86400, 'NX');
    return result === 'OK';
  }

  async getMessageIdFromIdempotency(clientMessageId: string): Promise<string | null> {
    const key = `idempotency:msg:${clientMessageId}`;
    return this.client.get(key);
  }

  // 4. Redis Pub/Sub Wrapper
  async publish(channel: string, message: any): Promise<number> {
    return this.pubClient.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (msg: any) => void): Promise<void> {
    await this.subClient.subscribe(channel);
    let chanHandlers = this.handlers.get(channel);
    if (!chanHandlers) {
      chanHandlers = [];
      this.handlers.set(channel, chanHandlers);
    }
    if (!chanHandlers.includes(handler)) {
      chanHandlers.push(handler);
    }
  }

  // Shutdown connections gracefully
  async close(): Promise<void> {
    await this.client.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
  }
}
export { Redis } from 'ioredis';
