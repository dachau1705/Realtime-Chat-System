import express from 'express';
import { dbPool, logger } from '@libs/common';
import { RedisService } from '@libs/redis';
import crypto from 'crypto';
import path from 'path';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const PORT = parseInt(process.env.API_PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

const redisService = new RedisService();

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function comparePassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = hash.split(':');
    if (parts.length !== 2) {
      // Fallback for legacy sha256 hashes if any exist
      const fallbackHash = crypto.createHash('sha256').update(password).digest('hex');
      return resolve(hash === fallbackHash);
    }
    const [salt, key] = parts;
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

function createRateLimiter(redisService: RedisService, limit: number, windowSeconds: number) {
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

const authLimiter = createRateLimiter(redisService, 15, 60);

export interface AuthenticatedRequest extends express.Request {
  user?: {
    userId: string;
    username: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded as { userId: string; username: string };
    next();
  });
}

// 1. User Registration (Public)
app.post('/api/users', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing username, email, or password' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await dbPool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );
    
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    logger.error('Failed to create user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2. User Login (Public)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const result = await dbPool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    logger.error('Failed to log in', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Fetch Users (Protected)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await dbPool.query('SELECT id, username, email, created_at FROM users ORDER BY username ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 4. Fetch User's Conversations (Protected)
app.get('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  try {
    const result = await dbPool.query(
      `SELECT c.id, c.name, c.is_group, c.created_at,
              COALESCE(array_agg(u.username) FILTER (WHERE u.id != $1), '{}') as member_usernames,
              COALESCE(array_agg(u.id) FILTER (WHERE u.id != $1), '{}') as member_ids
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       JOIN users u ON cm.user_id = u.id
       WHERE c.id IN (
         SELECT conversation_id FROM conversation_members WHERE user_id = $1
       )
       GROUP BY c.id, c.name, c.is_group, c.created_at`,
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch user conversations', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 5. Create Conversation (Protected)
app.post('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { name, isGroup, memberIds } = req.body;
  const currentUserId = req.user!.userId;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds array is required' });
  }

  // Ensure the current user is added to the conversation members
  const uniqueMemberIds = Array.from(new Set([...memberIds, currentUserId]));

  // Deduplicate: If it's a 1-1 conversation, check if one already exists
  if (!isGroup && uniqueMemberIds.length === 2) {
    try {
      const existCheck = await dbPool.query(
        `SELECT c.id, c.name, c.is_group, c.created_at FROM conversations c
         JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
         JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
         WHERE c.is_group = false LIMIT 1`,
        [uniqueMemberIds[0], uniqueMemberIds[1]]
      );
      if (existCheck.rows.length > 0) {
        return res.status(200).json({ ...existCheck.rows[0], memberIds: uniqueMemberIds });
      }
    } catch (err) {
      logger.error('Failed to check existing conversation', { error: (err as Error).message });
    }
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    // Create conversation record
    const convRes = await client.query(
      `INSERT INTO conversations (name, is_group)
       VALUES ($1, $2)
       RETURNING id, name, is_group, created_at`,
      [name || null, !!isGroup]
    );
    const conversation = convRes.rows[0];

    // Insert memberships
    for (const userId of uniqueMemberIds) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2)`,
        [conversation.id, userId]
      );
    }

    await client.query('COMMIT');

    // Publish new conversation event to Redis Pub/Sub
    try {
      const memberUsersRes = await dbPool.query(
        'SELECT id, username FROM users WHERE id = ANY($1)',
        [uniqueMemberIds]
      );

      await redisService.publish('chat:events', {
        type: 'new_conversation',
        data: {
          id: conversation.id,
          name: conversation.name,
          is_group: conversation.is_group,
          created_at: conversation.created_at,
          memberIds: uniqueMemberIds,
          members: memberUsersRes.rows
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish new_conversation event to Redis', { error: (redisErr as Error).message });
    }

    res.status(201).json({ ...conversation, memberIds: uniqueMemberIds });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to create conversation', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// 5. Fetch Conversation Messages (Protected & Authorized)
app.get('/api/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const conversationId = req.params.id;
  const currentUserId = req.user!.userId;
  const limit = parseInt(req.query.limit as string || '50', 10);
  const before = req.query.before as string;
  const beforeId = req.query.beforeId as string;

  try {
    // Authorization check: Verify that the current user is a member of the conversation
    const membershipCheck = await dbPool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, currentUserId]
    );
    
    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to view messages in this conversation' });
    }

    let query = `
      SELECT m.*, u.username as sender_username 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const params: any[] = [conversationId];

    if (before && beforeId) {
      query += ` AND (m.created_at < $2 OR (m.created_at = $2 AND m.id < $3))`;
      params.push(new Date(before), beforeId);
    } else if (before) {
      query += ` AND m.created_at < $2`;
      params.push(new Date(before));
    }

    query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await dbPool.query(query, params);
    
    // Return chronological order (reverse our DESC fetch)
    res.json(result.rows.reverse());
  } catch (err) {
    logger.error('Failed to fetch messages', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 6. Database Seeding endpoint (Public, returns JWT tokens for tests)
app.post('/api/seed', async (req, res) => {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const hashedPassword = await hashPassword('password');
    
    const user1Res = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('alice', 'alice@example.com', $1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [hashedPassword]
    );
    const alice = user1Res.rows[0];

    const user2Res = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('bob', 'bob@example.com', $1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [hashedPassword]
    );
    const bob = user2Res.rows[0];

    // Check if a direct 1-1 conversation already exists
    const existCheck = await client.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
       WHERE c.is_group = false LIMIT 1`,
      [alice.id, bob.id]
    );

    let conversationId;
    if (existCheck.rows.length > 0) {
      conversationId = existCheck.rows[0].id;
    } else {
      const convRes = await client.query(
        `INSERT INTO conversations (name, is_group)
         VALUES ($1, false)
         RETURNING id`,
        ['Alice and Bob']
      );
      conversationId = convRes.rows[0].id;
      
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversationId, alice.id, bob.id]
      );
    }

    await client.query('COMMIT');

    const aliceToken = jwt.sign(
      { userId: alice.id, username: alice.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const bobToken = jwt.sign(
      { userId: bob.id, username: bob.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      alice,
      aliceToken,
      bob,
      bobToken,
      conversationId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to seed DB', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  logger.info(`API Gateway REST server running on port ${PORT}`);
});
