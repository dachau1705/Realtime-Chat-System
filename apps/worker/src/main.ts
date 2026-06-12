import { KafkaService } from '@libs/kafka';
import { RedisService } from '@libs/redis';
import { logger, dbPool } from '@libs/common';
import { EachBatchPayload } from 'kafkajs';

async function bootstrap() {
  logger.info('Starting Worker Service...');

  const kafkaService = new KafkaService();
  const redisService = new RedisService();

  // Ensure required Kafka topics exist before subscribing consumers
  await kafkaService.ensureTopics(['chat.messages', 'chat.receipts', 'social.notifications']);

  // Topic 1: chat.messages Consumer
  await kafkaService.startConsumer(
    'chat-messages-worker-group',
    'chat.messages',
    async (batchPayload: EachBatchPayload) => {
      const { batch } = batchPayload;

      // Group messages by conversation_id to process them concurrently across conversations
      // but sequentially within the same conversation to preserve sequence order.
      const groups = new Map<string, any[]>();
      for (const record of batch.messages) {
        if (!record.value) continue;
        const msg = JSON.parse(record.value.toString());
        let list = groups.get(msg.conversation_id);
        if (!list) {
          list = [];
          groups.set(msg.conversation_id, list);
        }
        list.push(msg);
      }

      try {
        await Promise.all(
          Array.from(groups.entries()).map(async ([conversationId, messages]) => {
            const client = await dbPool.connect();
            try {
              for (const msg of messages) {
                logger.info('Worker processing message (parallel group path)', { 
                  id: msg.id, 
                  conversation_id: conversationId,
                  client_message_id: msg.client_message_id 
                });

                await client.query('BEGIN');
                try {
                  // 1. Insert message
                  const insertMsgQuery = `
                    INSERT INTO messages (id, conversation_id, sender_id, content, client_message_id, type, media_url, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (client_message_id) DO NOTHING
                    RETURNING id;
                  `;
                  const res = await client.query(insertMsgQuery, [
                    msg.id,
                    msg.conversation_id,
                    msg.sender_id,
                    msg.content,
                    msg.client_message_id,
                    msg.type || 'text',
                    msg.media_url || null,
                    msg.created_at
                  ]);

                  const messageWasInserted = res.rowCount && res.rowCount > 0;
                  
                  if (messageWasInserted) {
                    // 2. Fetch conversation members to create receipts
                    const membersRes = await client.query(
                      'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
                      [msg.conversation_id, msg.sender_id]
                    );

                    // 3. Create default receipts ('sent'/'delivered') for other members
                    for (const memberRow of membersRes.rows) {
                      const recipientId = memberRow.user_id;
                      
                      // Let's check if recipient is online in Redis to optimize receipt delivery
                      const presence = await redisService.getUserPresence(recipientId);
                      const status = presence?.status === 'online' ? 'delivered' : 'sent';

                      await client.query(
                        `INSERT INTO message_receipts (message_id, user_id, status, updated_at)
                         VALUES ($1, $2, $3, NOW())
                         ON CONFLICT (message_id, user_id) DO NOTHING`,
                        [msg.id, recipientId, status]
                      );

                      // If recipient is online, notify them via Redis Pub/Sub immediately about receipt status change
                      if (status === 'delivered') {
                        await redisService.publish('chat:events', {
                          type: 'receipt',
                          data: {
                            conversation_id: msg.conversation_id,
                            message_id: msg.id,
                            user_id: recipientId,
                            status: 'delivered'
                          }
                        });
                      }
                    }

                    // 4. Publish real-time message event to Redis Pub/Sub
                    await redisService.publish('chat:events', {
                      type: 'message',
                      data: msg
                    });
                  }
                  await client.query('COMMIT');
                } catch (msgErr) {
                  await client.query('ROLLBACK');
                  const pgErr = msgErr as any;
                  
                  // Check if this is a permanent data integrity violation (class 23)
                  const isDataValidationError = pgErr.code && pgErr.code.startsWith('23');
                  
                  if (isDataValidationError) {
                    logger.error('Validation error processing message (Skipping message and routing to DLQ)', {
                      id: msg.id,
                      code: pgErr.code,
                      detail: pgErr.detail,
                      message: pgErr.message
                    });
                    
                    // Route this message to DLQ topic manually
                    try {
                      await kafkaService.publishMessage('chat.messages.dlq', msg.conversation_id, {
                        ...msg,
                        x_error_code: pgErr.code,
                        x_error_detail: pgErr.detail,
                        x_error_message: pgErr.message,
                        failed_at: new Date()
                      });
                    } catch (dlqErr) {
                      logger.error('Failed to publish invalid message to DLQ topic', { error: (dlqErr as Error).message });
                    }
                  } else {
                    // Re-throw transient infrastructure errors to retry the batch
                    throw msgErr;
                  }
                }
              }
            } finally {
              client.release();
            }
          })
        );
      } catch (batchErr) {
        logger.error('Failed to process message batch (retrying...)', { error: (batchErr as Error).message });
        throw batchErr;
      }
    }
  );

  // Topic 2: chat.receipts Consumer
  await kafkaService.startConsumer(
    'chat-receipts-worker-group',
    'chat.receipts',
    async (batchPayload: EachBatchPayload) => {
      const { batch } = batchPayload;
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        for (const record of batch.messages) {
          if (!record.value) continue;
          const receipt = JSON.parse(record.value.toString());
          
          logger.info('Worker processing receipt', { message_id: receipt.message_id, user_id: receipt.user_id, status: receipt.status });

          const upsertReceiptQuery = `
            INSERT INTO message_receipts (message_id, user_id, status, updated_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (message_id, user_id) 
            DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
            WHERE message_receipts.status != 'seen'; -- Don't downgrade 'seen' status to 'delivered'
          `;

          await client.query(upsertReceiptQuery, [
            receipt.message_id,
            receipt.user_id,
            receipt.status,
            receipt.updated_at
          ]);

          // Broadcast receipt update to Redis Pub/Sub
          await redisService.publish('chat:events', {
            type: 'receipt',
            data: {
              conversation_id: receipt.conversation_id,
              message_id: receipt.message_id,
              user_id: receipt.user_id,
              status: receipt.status
            }
          });
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Failed to commit receipt batch', { error: (err as Error).message });
        throw err;
      } finally {
        client.release();
      }
    }
  );

  // Topic 3: social.notifications Consumer
  await kafkaService.startConsumer(
    'social-notifications-worker-group',
    'social.notifications',
    async (batchPayload: EachBatchPayload) => {
      const { batch } = batchPayload;
      const client = await dbPool.connect();
      try {
        await client.query('BEGIN');

        for (const record of batch.messages) {
          if (!record.value) continue;
          const notif = JSON.parse(record.value.toString());

          logger.info('Worker processing notification', { id: notif.id, user_id: notif.user_id, type: notif.type });

          // Insert into database
          await client.query(
            `INSERT INTO notifications (id, user_id, actor_id, type, post_id, comment_id, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              notif.id,
              notif.user_id,
              notif.actor_id,
              notif.type,
              notif.post_id,
              notif.comment_id,
              notif.is_read,
              notif.created_at
            ]
          );

          // Fetch actor username and avatar for realtime display
          const actorRes = await client.query('SELECT username, avatar_url FROM users WHERE id = $1', [notif.actor_id]);
          const actorInfo = actorRes.rows[0] || {};

          // Publish to Redis Pub/Sub for realtime websocket forwarding
          await redisService.publish('chat:events', {
            type: 'notification',
            data: {
              ...notif,
              actor_username: actorInfo.username,
              actor_avatar_url: actorInfo.avatar_url
            }
          });
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Failed to process notification batch', { error: (err as Error).message });
        throw err;
      } finally {
        client.release();
      }
    }
  );

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Shutting down worker service...');
    await kafkaService.close();
    await redisService.close();
    await dbPool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.error('Error starting Worker Service', { error: err.stack || err.message });
  process.exit(1);
});
