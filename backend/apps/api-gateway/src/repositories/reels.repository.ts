import { dbPool } from '@libs/common';
import { reelModel } from '../models';

export async function createReel(userId: string, videoUrl: string, caption: string | null) {
  return reelModel.create({
    user_id: userId,
    video_url: videoUrl,
    caption
  });
}

export async function getReelsFeed(currentUserId: string, limit: number = 10, offset: number = 0) {
  return reelModel.query(
    `SELECT r.*, u.username, u.full_name, u.avatar_url,
            EXISTS (SELECT 1 FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = $1) AS has_liked
     FROM reels r
     JOIN users u ON r.user_id = u.id
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [currentUserId, limit, offset]
  );
}

export async function findReelById(reelId: string, currentUserId: string) {
  const rows = await reelModel.query(
    `SELECT r.*, u.username, u.full_name, u.avatar_url,
            EXISTS (SELECT 1 FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = $2) AS has_liked
     FROM reels r
     JOIN users u ON r.user_id = u.id
     WHERE r.id = $1`,
    [reelId, currentUserId]
  );
  return rows[0] || null;
}

export async function getUserReels(targetUserId: string, currentUserId: string) {
  return reelModel.query(
    `SELECT r.*, u.username, u.full_name, u.avatar_url,
            EXISTS (SELECT 1 FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = $2) AS has_liked
     FROM reels r
     JOIN users u ON r.user_id = u.id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [targetUserId, currentUserId]
  );
}

export async function deleteReel(reelId: string, userId: string) {
  const result = await reelModel.query(
    'DELETE FROM reels WHERE id = $1 AND user_id = $2 RETURNING *',
    [reelId, userId]
  );
  return result.length > 0;
}

export async function toggleReelLike(reelId: string, userId: string) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if like exists
    const checkRes = await client.query(
      'SELECT 1 FROM reel_likes WHERE reel_id = $1 AND user_id = $2',
      [reelId, userId]
    );
    
    let liked = false;
    if ((checkRes.rowCount ?? 0) > 0) {
      // Remove like
      await client.query(
        'DELETE FROM reel_likes WHERE reel_id = $1 AND user_id = $2',
        [reelId, userId]
      );
      await client.query(
        'UPDATE reels SET likes_count = GREATEST(0, likes_count - 1), updated_at = NOW() WHERE id = $1',
        [reelId]
      );
    } else {
      // Add like
      await client.query(
        'INSERT INTO reel_likes (reel_id, user_id) VALUES ($1, $2)',
        [reelId, userId]
      );
      await client.query(
        'UPDATE reels SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = $1',
        [reelId]
      );
      liked = true;
    }
    
    await client.query('COMMIT');
    
    // Get updated counts
    const countRes = await client.query(
      'SELECT likes_count FROM reels WHERE id = $1',
      [reelId]
    );
    
    return {
      liked,
      likes_count: countRes.rows[0]?.likes_count || 0
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function insertReelComment(reelId: string, userId: string, content: string) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const commentRes = await client.query(
      `INSERT INTO reel_comments (reel_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [reelId, userId, content]
    );
    
    await client.query(
      'UPDATE reels SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = $1',
      [reelId]
    );
    
    await client.query('COMMIT');
    
    // Fetch comment with user metadata
    const finalRes = await client.query(
      `SELECT rc.*, u.username, u.full_name, u.avatar_url
       FROM reel_comments rc
       JOIN users u ON rc.user_id = u.id
       WHERE rc.id = $1`,
      [commentRes.rows[0].id]
    );
    
    return finalRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getReelComments(reelId: string) {
  return reelModel.query(
    `SELECT rc.*, u.username, u.full_name, u.avatar_url
     FROM reel_comments rc
     JOIN users u ON rc.user_id = u.id
     WHERE rc.reel_id = $1
     ORDER BY rc.created_at ASC`,
    [reelId]
  );
}
