import express from 'express';
import { dbPool, logger } from '@libs/common';
import crypto from 'crypto';
import path from 'path';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const PORT = parseInt(process.env.API_PORT || '3000', 10);

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 1. Create User
app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing username, email, or password' });
  }

  try {
    const passwordHash = hashPassword(password);
    const result = await dbPool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to create user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2. Fetch Users
app.get('/api/users', async (req, res) => {
  try {
    const result = await dbPool.query('SELECT id, username, email, created_at FROM users ORDER BY username ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Create Conversation
app.post('/api/conversations', async (req, res) => {
  const { name, isGroup, memberIds } = req.body;
  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds array is required' });
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
    for (const userId of memberIds) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2)`,
        [conversation.id, userId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...conversation, memberIds });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to create conversation', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// 4. Fetch Conversation Messages (paginated, sorted chronologically)
app.get('/api/conversations/:id/messages', async (req, res) => {
  const conversationId = req.params.id;
  const limit = parseInt(req.query.limit as string || '50', 10);
  const before = req.query.before as string;

  try {
    let query = `
      SELECT m.*, u.username as sender_username 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const params: any[] = [conversationId];

    if (before) {
      query += ` AND m.created_at < $2`;
      params.push(new Date(before));
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await dbPool.query(query, params);
    
    // Return chronological order (reverse our DESC fetch)
    res.json(result.rows.reverse());
  } catch (err) {
    logger.error('Failed to fetch messages', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 5. Database Seeding endpoint
app.post('/api/seed', async (req, res) => {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const user1Res = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('alice', 'alice@example.com', $1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [hashPassword('password')]
    );
    const alice = user1Res.rows[0];

    const user2Res = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('bob', 'bob@example.com', $1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [hashPassword('password')]
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
    res.json({
      alice,
      bob,
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
