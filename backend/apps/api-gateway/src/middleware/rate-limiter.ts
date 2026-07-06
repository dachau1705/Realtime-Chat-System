import express from 'express';
import { RedisService } from '@libs/redis';
import { logger } from '@libs/common';

export function createRateLimiter(redisService: RedisService, limit: number, windowSeconds: number) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `ratelimit:${ip}`;
    try {
      const client = redisService.getClient();
      const current = await client.incr(key);
      if (current === 1) {
        await client.expire(key, windowSeconds);
      }
      if (current > limit) {
        logger.warn('Rate limit exceeded', { ip, limit, current });
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
      }
      next();
    } catch (err) {
      logger.warn('Rate limiter Redis error, failing open', { error: (err as Error).message });
      next();
    }
  };
}
