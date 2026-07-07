import { dbPool } from '@libs/common';

export async function createPost(
  userId: string,
  content: string | null,
  mediaUrls: string[],
  visibility: string,
  allowedUserIds: string[],
  blockedUserIds: string[]
) {
  const result = await dbPool.query(
    `INSERT INTO posts (user_id, content, media_urls, visibility, allowed_user_ids, blocked_user_ids)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, content, mediaUrls, visibility, allowedUserIds, blockedUserIds]
  );
  return result.rows[0];
}

export async function findPostById(postId: string) {
  const result = await dbPool.query(
    `SELECT p.*, u.username, u.full_name, u.avatar_url,
            (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
            (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) AS reaction_count
     FROM posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [postId]
  );
  return result.rows[0] || null;
}

export async function findRawPostById(postId: string) {
  const result = await dbPool.query(
    'SELECT user_id, visibility, allowed_user_ids, blocked_user_ids FROM posts WHERE id = $1',
    [postId]
  );
  return result.rows[0] || null;
}

export async function updatePost(
  postId: string,
  content: string | null,
  mediaUrls: string[],
  visibility: string,
  allowedUserIds: string[],
  blockedUserIds: string[]
) {
  const result = await dbPool.query(
    `UPDATE posts 
     SET content = $1, media_urls = $2, visibility = $3, allowed_user_ids = $4, blocked_user_ids = $5, updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [content, mediaUrls, visibility, allowedUserIds, blockedUserIds, postId]
  );
  return result.rows[0];
}

export async function deletePost(postId: string) {
  await dbPool.query('DELETE FROM posts WHERE id = $1', [postId]);
}

export async function getUserPosts(targetUserId: string) {
  const result = await dbPool.query(
    `SELECT p.*, u.username, u.full_name, u.avatar_url,
            (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
            (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) AS reaction_count
     FROM posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [targetUserId]
  );
  return result.rows;
}

export async function getVIPFollowings(currentUserId: string) {
  const result = await dbPool.query(
    `SELECT following_id FROM follows 
     WHERE follower_id = $1 AND following_id IN (
       SELECT following_id FROM follows GROUP BY following_id HAVING COUNT(*) > 100
     )`,
    [currentUserId]
  );
  return result.rows.map(r => r.following_id);
}

export async function getFeedPostsList(userIds: string[]) {
  const result = await dbPool.query(
    `SELECT id, created_at FROM posts 
     WHERE user_id = ANY($1) 
     ORDER BY created_at DESC LIMIT 200`,
    [userIds]
  );
  return result.rows;
}

export async function deleteReaction(postId: string, userId: string) {
  await dbPool.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [postId, userId]);
}

export async function upsertReaction(postId: string, userId: string, type: string) {
  await dbPool.query(
    `INSERT INTO reactions (post_id, user_id, type)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, user_id) 
     DO UPDATE SET type = EXCLUDED.type`,
    [postId, userId, type]
  );
}

export async function getReactionStatus(postId: string, userId: string) {
  const result = await dbPool.query(
    `SELECT COUNT(*)::int as count,
            EXISTS (SELECT 1 FROM reactions WHERE post_id = $1 AND user_id = $2) as has_reacted,
            (SELECT type FROM reactions WHERE post_id = $1 AND user_id = $2) as reaction_type
     FROM reactions WHERE post_id = $1`,
    [postId, userId]
  );
  return result.rows[0];
}

export async function insertComment(postId: string, userId: string, content: string, parentId: string | null) {
  const result = await dbPool.query(
    `INSERT INTO comments (post_id, user_id, content, parent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [postId, userId, content, parentId]
  );
  return result.rows[0];
}

export async function getPostComments(postId: string) {
  const result = await dbPool.query(
    `SELECT c.*, u.username, u.full_name, u.avatar_url 
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId]
  );
  return result.rows;
}
