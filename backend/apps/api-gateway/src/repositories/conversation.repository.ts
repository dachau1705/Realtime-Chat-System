import { dbPool } from '@libs/common';

export async function getUserConversations(userId: string) {
  const result = await dbPool.query(
    `SELECT c.id, c.name, c.is_group, c.avatar_url, c.created_at,
            COALESCE(array_agg(distinct u.username) FILTER (WHERE u.id != $1), '{}') as member_usernames,
            COALESCE(array_agg(distinct u.id) FILTER (WHERE u.id != $1), '{}') as member_ids,
            COALESCE(array_agg(distinct u.avatar_url) FILTER (WHERE u.id != $1), '{}') as member_avatar_urls,
            COALESCE(array_agg(distinct u.full_name) FILTER (WHERE u.id != $1), '{}') as member_full_names,
            lm.content as last_message_content,
            lm.content as last_message,
            lm.type as last_message_type,
            lm.sender_id as last_message_sender_id,
            lm.sender_username as last_message_sender_username,
            lm.created_at as last_message_created_at,
            lm.created_at as last_message_time
     FROM conversations c
     JOIN conversation_members cm ON c.id = cm.conversation_id
     JOIN users u ON cm.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT m.content, m.type, m.sender_id, m.created_at, mu.username as sender_username
       FROM messages m
       JOIN users mu ON m.sender_id = mu.id
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 1
     ) lm ON true
     WHERE c.id IN (
       SELECT conversation_id FROM conversation_members WHERE user_id = $1
     )
     GROUP BY c.id, c.name, c.is_group, c.avatar_url, c.created_at,
              lm.content, lm.type, lm.sender_id, lm.sender_username, lm.created_at
     ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [userId]
  );
  return result.rows;
}

export async function checkExisting1to1Conversation(user1: string, user2: string) {
  const existCheck = await dbPool.query(
    `SELECT c.id, c.name, c.is_group, c.avatar_url, c.created_at FROM conversations c
     JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
     JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
     WHERE c.is_group = false LIMIT 1`,
    [user1, user2]
  );
  return existCheck.rows[0] || null;
}

export async function verifyConversationMembership(conversationId: string, userId: string) {
  const result = await dbPool.query(
    'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return result.rows.length > 0;
}

export async function createConversationTransaction(
  name: string | null,
  isGroup: boolean,
  memberIds: string[],
  avatarUrl: string | null
) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const convRes = await client.query(
      `INSERT INTO conversations (name, is_group, avatar_url)
       VALUES ($1, $2, $3)
       RETURNING id, name, is_group, avatar_url, created_at`,
      [name || null, isGroup, avatarUrl || null]
    );
    const conversation = convRes.rows[0];

    for (const userId of memberIds) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2)`,
        [conversation.id, userId]
      );
    }

    await client.query('COMMIT');
    return conversation;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getConversationMessages(
  conversationId: string,
  limit: number,
  before?: string,
  beforeId?: string
) {
  let query = `
    SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar_url, u.full_name as sender_full_name,
           COALESCE((
             SELECT status FROM message_receipts mr 
             WHERE mr.message_id = m.id AND mr.user_id != m.sender_id
             LIMIT 1
           ), 'sent') as status
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
  return result.rows.reverse();
}

export async function markConversationMessagesAsRead(conversationId: string, userId: string) {
  await dbPool.query(
    `INSERT INTO message_receipts (message_id, user_id, status, updated_at)
     SELECT m.id, $1, 'seen', NOW()
     FROM messages m
     WHERE m.conversation_id = $2 AND m.sender_id != $1
     ON CONFLICT (message_id, user_id) 
     DO UPDATE SET status = 'seen', updated_at = NOW()
     WHERE message_receipts.status != 'seen'`,
    [userId, conversationId]
  );
}
