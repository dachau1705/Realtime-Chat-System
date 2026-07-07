import { dbPool } from '@libs/common';

export async function createStory(userId: string, mediaUrl: string) {
  const result = await dbPool.query(
    `INSERT INTO stories (user_id, media_url, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '24 hours')
     RETURNING id, user_id, media_url, created_at, expires_at`,
    [userId, mediaUrl]
  );
  return result.rows[0];
}

export async function getActiveStories(userIds: string[]) {
  const result = await dbPool.query(
    `SELECT s.id, s.user_id, s.media_url as thumbnail_url, s.created_at, u.username, u.avatar_url as user_avatar
     FROM stories s
     JOIN users u ON s.user_id = u.id
     WHERE s.user_id = ANY($1) AND s.expires_at > NOW()
     ORDER BY s.created_at DESC`,
    [userIds]
  );
  return result.rows;
}
