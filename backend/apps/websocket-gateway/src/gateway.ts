import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { logger, dbPool, Message, TypingEvent, ReceiptEvent } from '@libs/common';
import { RedisService } from '@libs/redis';
import { KafkaService } from '@libs/kafka';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
const NODE_NAME = process.env.NODE_NAME || `gateway-${uuidv4().substring(0, 8)}`;
const KAFKA_TOPIC = 'chat.messages';
const REDIS_EVENT_CHANNEL = 'chat:events';

export async function bootstrapGateway() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const redisService = new RedisService();
  const kafkaService = new KafkaService();

  // Connect Kafka Producer
  let isKafkaAvailable = true;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function triggerKafkaReconnection() {
    if (reconnectTimer) return;
    logger.warn('Kafka offline. Initializing background reconnection loop...');
    reconnectTimer = setInterval(async () => {
      try {
        logger.info('Attempting to reconnect to Kafka broker...');
        await kafkaService.getProducer();
        isKafkaAvailable = true;
        logger.info('Successfully reconnected to Kafka! Resuming primary queue pathway.');
        if (reconnectTimer) {
          clearInterval(reconnectTimer);
          reconnectTimer = null;
        }
      } catch (err) {
        logger.debug('Kafka broker reconnect attempt failed', { error: (err as Error).message });
      }
    }, 15000); // Retry every 15 seconds
  }

  try {
    await kafkaService.getProducer();
    await kafkaService.ensureTopics(['chat.messages', 'chat.receipts']);
    logger.info('Successfully connected to primary Kafka cluster and verified topics.');
  } catch (err) {
    logger.warn('Kafka broker is offline/unreachable on bootstrap. Running in DATABASE FALLBACK mode.', {
      error: (err as Error).message
    });
    isKafkaAvailable = false;
    triggerKafkaReconnection();
  }

  // Subscribe to Redis Pub/Sub channel for cluster-wide events
  const registerSub = async () => {
    try {
      await redisService.subscribe(REDIS_EVENT_CHANNEL, async (event: any) => {
        logger.info(`Received event from Redis Pub/Sub on node ${NODE_NAME}`, { type: event.type });

        if (event.type === 'message') {
          const msg = event.data as Message;
          io.to(`conversation:${msg.conversation_id}`).emit('message', msg);
        } else if (event.type === 'typing') {
          const typing = event.data as TypingEvent;
          io.to(`conversation:${typing.conversation_id}`).emit('typing', typing);
        } else if (event.type === 'receipt') {
          const receipt = event.data as ReceiptEvent;
          io.to(`conversation:${receipt.conversation_id}`).emit('receipt', receipt);
        } else if (event.type === 'new_conversation') {
          const conversationId = event.data.id || event.data.conversation_id;
          const { memberIds } = event.data;
          for (const userId of memberIds) {
            const userSockets = await io.in(`user:${userId}`).fetchSockets();
            for (const s of userSockets) {
              await s.join(`conversation:${conversationId}`);
              logger.info(`Locally connected user ${userId} joined room conversation:${conversationId} on new_conversation event`);
              s.emit('new_conversation', event.data);
            }
          }
        } else if (event.type === 'friend_request') {
          const { receiverId, senderUsername } = event.data;
          io.to(`user:${receiverId}`).emit('friend_request', { senderUsername });
          logger.info(`Forwarded friend_request event to user:${receiverId} for sender ${senderUsername}`);
        } else if (event.type === 'friend_accept') {
          const { receiverId, senderUsername } = event.data;
          io.to(`user:${receiverId}`).emit('friend_accepted', { senderUsername });
          logger.info(`Forwarded friend_accept event to user:${receiverId} for sender ${senderUsername}`);
        } else if (event.type === 'profile_update') {
          const { userId, username, fullName, avatarUrl } = event.data;
          io.emit('profile_updated', { userId, username, fullName, avatarUrl });
          logger.info(`Broadcasted profile_update event for user ${userId}`);
        } else if (event.type === 'notification') {
          const notif = event.data;
          io.to(`user:${notif.user_id}`).emit('notification', notif);
          logger.info(`Forwarded notification of type ${notif.type} to user:${notif.user_id}`);
        } else if (event.type === 'new_feed_item') {
          const { followerId, post } = event.data;
          io.to(`user:${followerId}`).emit('NEW_FEED_ITEM', post);
          logger.info(`Forwarded NEW_FEED_ITEM event to user:${followerId} for post ${post.id}`);
        } else if (event.type === 'update_reaction') {
          const { postId, reactionCount } = event.data;
          io.emit('UPDATE_REACTION', { postId, reactionCount });
          logger.info(`Broadcasted UPDATE_REACTION event for post ${postId}`);
        } else if (event.type === 'new_comment') {
          const { comment } = event.data;
          io.emit('NEW_COMMENT', comment);
          logger.info(`Broadcasted NEW_COMMENT event for post ${comment.post_id}`);
        }
      });
      logger.info('Successfully subscribed to Redis Pub/Sub channel.');
    } catch (err) {
      logger.warn('Failed to subscribe to Redis Pub/Sub on startup. Will retry automatically when Redis reconnects.', {
        error: (err as Error).message
      });
    }
  };

  // Execute initial subscription registration
  await registerSub();

  // Listen to connection recovery to register/re-register
  redisService.getSubClient().on('connect', () => {
    logger.info('Redis sub client connected. Registering/refreshing pub/sub channels...');
    registerSub().catch((err) =>
      logger.error('Failed to register subscription on connect event', { error: err.message })
    );
  });

  // Socket.io Middleware for JWT verification
  io.use(async (socket: Socket, next) => {
    const token = (socket.handshake.auth?.token || socket.handshake.query?.token) as string;

    if (!token) {
      return next(new Error('Authentication failed: token is required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key') as {
        userId: string;
        username: string;
        conversationIds?: string[];
      };
      
      // Store user info on socket
      socket.data = {
        userId: decoded.userId,
        username: decoded.username,
        conversationIds: decoded.conversationIds
      };
      next();
    } catch (err) {
      logger.error('WebSocket Authentication failed', { error: (err as Error).message });
      return next(new Error('Authentication failed: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const { userId, username, conversationIds } = socket.data;
    logger.info(`User connected: ${username} (${userId}) on ${NODE_NAME}`, { socketId: socket.id });

    // Join user-specific channel for targeted messages
    await socket.join(`user:${userId}`);

    // Join conversation rooms from token (mock/fallback mode support)
    if (Array.isArray(conversationIds)) {
      for (const convId of conversationIds) {
        const roomName = `conversation:${convId}`;
        await socket.join(roomName);
        logger.info(`User ${userId} joined room ${roomName} from token payload`);
      }
    }

    // Helper function to check/authorize conversation access
    const authorizeUserForConversation = async (conversationId: string): Promise<boolean> => {
      const roomName = `conversation:${conversationId}`;
      if (socket.rooms.has(roomName)) {
        return true;
      }
      
      // Lazy load from database
      try {
        const result = await dbPool.query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, userId]
        );
        if (result.rows.length > 0) {
          await socket.join(roomName);
          logger.info(`User ${userId} lazy-joined room ${roomName} after authorization check`);
          return true;
        }
      } catch (err) {
        logger.error('Failed to query conversation membership for authorization', { userId, conversationId, error: (err as Error).message });
      }
      return false;
    };

    // Fetch user's conversation memberships and join rooms
    try {
      const result = await dbPool.query(
        'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
        [userId]
      );
      
      for (const row of result.rows) {
        const roomName = `conversation:${row.conversation_id}`;
        await socket.join(roomName);
        logger.debug(`User ${userId} joined room ${roomName}`);
      }
    } catch (err) {
      logger.error('Failed to load user rooms from database', { userId, error: (err as Error).message });
    }

    // Set online presence in Redis & start heartbeat
    try {
      await redisService.setUserOnline(userId, socket.id, NODE_NAME);
    } catch (err) {
      logger.warn('Failed to set online presence in Redis on connect', { userId, error: (err as Error).message });
    }

    const presenceHeartbeat = setInterval(async () => {
      try {
        await redisService.setUserOnline(userId, socket.id, NODE_NAME);
      } catch (err) {
        logger.error('Failed to update presence heartbeat', { userId, error: (err as Error).message });
      }
    }, 15000); // 15s heartbeat

    // Handle Client Events

    // 1. Messaging Event
    socket.on('send_message', async (data: { conversationId: string; clientMessageId: string; content: string; type?: 'text' | 'image' | 'sticker'; mediaUrl?: string }, ack) => {
      const { conversationId, clientMessageId, content, type = 'text', mediaUrl } = data;
      
      const messageContent = content || (type === 'image' ? '[Image]' : type === 'sticker' ? '[Sticker]' : '');
      
      if (!conversationId || !clientMessageId || !messageContent) {
        logger.warn('Received invalid send_message payload', { userId, data });
        if (ack) ack({ status: 'error', message: 'Invalid payload' });
        return;
      }

      // Check Authorization
      const isAuthorized = await authorizeUserForConversation(conversationId);
      if (!isAuthorized) {
        logger.warn('Unauthorized send_message attempt', { userId, conversationId });
        if (ack) ack({ status: 'error', message: 'Unauthorized' });
        return;
      }

      try {
        let existingServerId: string | null = null;
        let unique = true;
        const serverMessageId = uuidv4();

        try {
          // Idempotency: Check if clientMessageId already has a mapped server message id
          existingServerId = await redisService.getMessageIdFromIdempotency(clientMessageId);
          if (existingServerId) {
            logger.info('Duplicate message detected (idempotent path)', { clientMessageId, existingServerId });
            if (ack) ack({ status: 'sent', id: existingServerId, clientMessageId });
            return;
          }

          // Lock/Save idempotency key
          unique = await redisService.checkAndSetIdempotency(clientMessageId, serverMessageId);
          if (!unique) {
            // Double check if we lost a race
            const reCheckId = await redisService.getMessageIdFromIdempotency(clientMessageId);
            if (ack) ack({ status: 'sent', id: reCheckId || serverMessageId, clientMessageId });
            return;
          }
        } catch (redisErr) {
          logger.warn('Redis offline: skipping memory-level idempotency checks', { error: (redisErr as Error).message });
          // Note: PostgreSQL has a UNIQUE constraint on client_message_id, so DB-level deduplication still works!
        }

        // Fetch sender details
        const senderRes = await dbPool.query('SELECT username, full_name FROM users WHERE id = $1', [userId]);
        const senderUser = senderRes.rows[0] || { username, full_name: null };

        // Build message payload
        const msgPayload = {
          id: serverMessageId,
          conversation_id: conversationId,
          sender_id: userId,
          content: messageContent,
          client_message_id: clientMessageId,
          type,
          media_url: mediaUrl || null,
          created_at: new Date(),
          sender_username: senderUser.username,
          sender_full_name: senderUser.full_name
        };

        let processed = false;

        if (isKafkaAvailable) {
          try {
            logger.info('Publishing message to Kafka', { conversationId, serverMessageId, clientMessageId });
            await kafkaService.publishMessage(KAFKA_TOPIC, conversationId, msgPayload);
            processed = true;
          } catch (err) {
            logger.error('Failed to publish message to Kafka, falling back to direct DB write', { error: (err as Error).message });
            isKafkaAvailable = false;
            triggerKafkaReconnection();
          }
        }

        // Fallback Direct Database Write
        if (!processed) {
          logger.info('Executing database fallback write for message', { serverMessageId, clientMessageId });
          const dbClient = await dbPool.connect();
          try {
            await dbClient.query('BEGIN');
            
            // Insert message
            await dbClient.query(
              `INSERT INTO messages (id, conversation_id, sender_id, content, client_message_id, type, media_url, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (client_message_id) DO NOTHING`,
              [msgPayload.id, msgPayload.conversation_id, msgPayload.sender_id, msgPayload.content, msgPayload.client_message_id, msgPayload.type, msgPayload.media_url, msgPayload.created_at]
            );

            // Fetch other conversation members
            const membersRes = await dbClient.query(
              'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
              [conversationId, userId]
            );

            // Create default receipts
            for (const memberRow of membersRes.rows) {
              const recipientId = memberRow.user_id;
              const presence = await redisService.getUserPresence(recipientId);
              const status = presence?.status === 'online' ? 'delivered' : 'sent';

              await dbClient.query(
                `INSERT INTO message_receipts (message_id, user_id, status, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (message_id, user_id) DO NOTHING`,
                [msgPayload.id, recipientId, status]
              );

              // Broadcast recipient receipt update immediately
              if (status === 'delivered') {
                await redisService.publish(REDIS_EVENT_CHANNEL, {
                  type: 'receipt',
                  data: {
                    conversation_id: conversationId,
                    message_id: msgPayload.id,
                    user_id: recipientId,
                    status: 'delivered'
                  }
                });
              }
            }

            await dbClient.query('COMMIT');

            // Broadcast real-time message event directly via Redis Pub/Sub (since worker is bypassed)
            await redisService.publish(REDIS_EVENT_CHANNEL, {
              type: 'message',
              data: msgPayload
            });

            processed = true;
          } catch (dbErr) {
            await dbClient.query('ROLLBACK');
            logger.error('Database fallback write failed', { error: (dbErr as Error).message });
            throw dbErr; // Trigger catch block to send error to client
          } finally {
            dbClient.release();
          }
        }

        // Send ACK only after successful queuing or DB write
        if (ack) {
          ack({ status: 'sent', id: serverMessageId, clientMessageId });
        }

      } catch (err) {
        logger.error('Error handling send_message', { userId, error: (err as Error).message });
        if (ack) ack({ status: 'error', message: 'Internal server error' });
      }
    });

    // 2. Typing Indicator Event
    socket.on('typing_start', async (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      // Check Authorization
      const isAuthorized = await authorizeUserForConversation(conversationId);
      if (!isAuthorized) {
        logger.warn('Unauthorized typing_start attempt', { userId, conversationId });
        return;
      }

      try {
        await redisService.setTyping(conversationId, userId, username, true);
        
        // Broadcast typing status to Redis Pub/Sub
        const typingEvent: TypingEvent = {
          conversation_id: conversationId,
          user_id: userId,
          username,
          is_typing: true
        };
        await redisService.publish(REDIS_EVENT_CHANNEL, {
          type: 'typing',
          data: typingEvent
        });
      } catch (err) {
        logger.error('Error handling typing_start', { userId, error: (err as Error).message });
      }
    });

    socket.on('typing_stop', async (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      // Check Authorization
      const isAuthorized = await authorizeUserForConversation(conversationId);
      if (!isAuthorized) {
        logger.warn('Unauthorized typing_stop attempt', { userId, conversationId });
        return;
      }

      try {
        await redisService.setTyping(conversationId, userId, username, false);
        
        const typingEvent: TypingEvent = {
          conversation_id: conversationId,
          user_id: userId,
          username,
          is_typing: false
        };
        await redisService.publish(REDIS_EVENT_CHANNEL, {
          type: 'typing',
          data: typingEvent
        });
      } catch (err) {
        logger.error('Error handling typing_stop', { userId, error: (err as Error).message });
      }
    });

    // 3. Read Receipt Event
    socket.on('read_receipt', async (data: { conversationId: string; messageId: string; status: 'delivered' | 'seen' }) => {
      const { conversationId, messageId, status } = data;
      if (!conversationId || !messageId || !status) return;

      // Check Authorization
      const isAuthorized = await authorizeUserForConversation(conversationId);
      if (!isAuthorized) {
        logger.warn('Unauthorized read_receipt attempt', { userId, conversationId });
        return;
      }

      try {
        // Broadcast receipt event to Redis Pub/Sub (and publish to Kafka for DB update in worker)
        const receiptEvent: ReceiptEvent = {
          conversation_id: conversationId,
          message_id: messageId,
          user_id: userId,
          status
        };

        // Emit local update immediately to speed up receipt UI rendering
        io.to(`conversation:${conversationId}`).emit('receipt', receiptEvent);

        let processedReceipt = false;
        if (isKafkaAvailable) {
          try {
            // Send read receipts update to Kafka so worker updates the database
            await kafkaService.publishMessage('chat.receipts', conversationId, {
              message_id: messageId,
              user_id: userId,
              status,
              conversation_id: conversationId,
              updated_at: new Date()
            });
            processedReceipt = true;
          } catch (err) {
            logger.error('Failed to publish receipt to Kafka, falling back to direct DB write', { error: (err as Error).message });
            isKafkaAvailable = false;
            triggerKafkaReconnection();
          }
        }

        if (!processedReceipt) {
          logger.info('Executing database fallback write for receipt', { messageId, userId, status });
          const dbClient = await dbPool.connect();
          try {
            await dbClient.query('BEGIN');
            
            await dbClient.query(
              `INSERT INTO message_receipts (message_id, user_id, status, updated_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (message_id, user_id) 
               DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
               WHERE message_receipts.status != 'seen'`,
              [messageId, userId, status]
            );

            await dbClient.query('COMMIT');
            
            // Broadcast receipt event directly to Redis Pub/Sub (since worker is bypassed)
            await redisService.publish(REDIS_EVENT_CHANNEL, {
              type: 'receipt',
              data: {
                conversation_id: conversationId,
                message_id: messageId,
                user_id: userId,
                status
              }
            });
          } catch (dbErr) {
            await dbClient.query('ROLLBACK');
            logger.error('Database receipt fallback write failed', { error: (dbErr as Error).message });
          } finally {
            dbClient.release();
          }
        }

      } catch (err) {
        logger.error('Error handling read_receipt', { userId, error: (err as Error).message });
      }
    });

    // 4. Disconnect Event
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${username} (${userId})`, { socketId: socket.id });
      clearInterval(presenceHeartbeat);
      
      try {
        await redisService.setUserOffline(userId);
      } catch (err) {
        logger.error('Failed to set user offline in Redis', { userId, error: (err as Error).message });
      }
    });
  });

  httpServer.listen(PORT, () => {
    logger.info(`WebSocket Gateway listening on port ${PORT} as node ${NODE_NAME}`);
  });

  return { io, httpServer, redisService, kafkaService };
}
