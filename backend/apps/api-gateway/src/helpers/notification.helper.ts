import { dbPool, logger } from '@libs/common';
import crypto from 'crypto';
import { kafkaService, redisService, isKafkaAvailable, setKafkaAvailable } from '../config/services';

export async function createNotification(
  userId: string,
  actorId: string,
  type: string,
  postId?: string | null,
  commentId?: string | null
) {
  if (userId === actorId) return; // Don't notify self

  const notificationPayload = {
    id: crypto.randomUUID(),
    user_id: userId,
    actor_id: actorId,
    type,
    post_id: postId || null,
    comment_id: commentId || null,
    is_read: false,
    created_at: new Date()
  };

  let processed = false;
  if (isKafkaAvailable) {
    try {
      await kafkaService.publishMessage('social.notifications', userId, notificationPayload);
      processed = true;
    } catch (err) {
      logger.error('Failed to publish notification to Kafka, falling back to direct write', { error: (err as Error).message });
      setKafkaAvailable(false);
    }
  }

  if (!processed) {
    // Direct SQL insert fallback
    try {
      await dbPool.query(
        `INSERT INTO notifications (id, user_id, actor_id, type, post_id, comment_id, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          notificationPayload.id,
          notificationPayload.user_id,
          notificationPayload.actor_id,
          notificationPayload.type,
          notificationPayload.post_id,
          notificationPayload.comment_id,
          notificationPayload.is_read,
          notificationPayload.created_at
        ]
      );

      // Publish directly to Redis so websocket server forwards it in real-time
      const actorRes = await dbPool.query('SELECT username, avatar_url FROM users WHERE id = $1', [actorId]);
      const actorInfo = actorRes.rows[0] || {};
      
      await redisService.publish('chat:events', {
        type: 'notification',
        data: {
          ...notificationPayload,
          actor_username: actorInfo.username,
          actor_avatar_url: actorInfo.avatar_url
        }
      });
    } catch (err) {
      logger.error('Failed to save fallback notification to database', { error: (err as Error).message });
    }
  }
}
