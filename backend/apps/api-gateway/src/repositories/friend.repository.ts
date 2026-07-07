import { dbPool } from '@libs/common';

export async function findFriendship(userId1: string, userId2: string) {
  const result = await dbPool.query(
    `SELECT * FROM friendships 
     WHERE (user_id_1 = $1 AND user_id_2 = $2) 
        OR (user_id_1 = $2 AND user_id_2 = $1)`,
    [userId1, userId2]
  );
  return result.rows[0] || null;
}

export async function createFriendshipRequest(senderId: string, receiverId: string) {
  await dbPool.query(
    `INSERT INTO friendships (user_id_1, user_id_2, status, created_at, updated_at)
     VALUES ($1, $2, 'pending', NOW(), NOW())`,
    [senderId, receiverId]
  );
}

export async function acceptFriendshipRequest(senderId: string, receiverId: string) {
  const result = await dbPool.query(
    `UPDATE friendships 
     SET status = 'accepted', updated_at = NOW() 
     WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'pending'
     RETURNING *`,
    [senderId, receiverId]
  );
  return result.rows[0] || null;
}

export async function deleteFriendship(userId1: string, userId2: string) {
  const result = await dbPool.query(
    `DELETE FROM friendships 
     WHERE (user_id_1 = $1 AND user_id_2 = $2) 
        OR (user_id_1 = $2 AND user_id_2 = $1)`,
    [userId1, userId2]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getPendingRequests(userId: string) {
  const result = await dbPool.query(
    `SELECT f.user_id_1 as sender_id, u.username as sender_username, u.email as sender_email, u.avatar_url as sender_avatar_url, f.created_at
     FROM friendships f
     JOIN users u ON f.user_id_1 = u.id
     WHERE f.user_id_2 = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getFriendsList(targetUserId: string, currentUserId: string) {
  const result = await dbPool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, u.email,
            EXISTS (
              SELECT 1 FROM friendships mf
              WHERE ((mf.user_id_1 = u.id AND mf.user_id_2 = $2) OR (mf.user_id_1 = $2 AND mf.user_id_2 = u.id))
                AND mf.status = 'accepted'
            ) as is_mutual
     FROM users u
     JOIN friendships f ON (f.user_id_1 = u.id OR f.user_id_2 = u.id)
     WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
       AND f.status = 'accepted'
       AND u.id != $1
     ORDER BY u.username ASC`,
    [targetUserId, currentUserId]
  );
  return result.rows;
}

export async function getFriendSuggestions(currentUserId: string) {
  const result = await dbPool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url,
           (
             SELECT COUNT(*)::int FROM friendships f1
             JOIN friendships f2 ON (
               (((f1.user_id_1 = $1 AND f1.user_id_2 = f2.user_id_1) OR (f1.user_id_2 = $1 AND f1.user_id_1 = f2.user_id_1) OR
                (f1.user_id_1 = $1 AND f1.user_id_2 = f2.user_id_2) OR (f1.user_id_2 = $1 AND f1.user_id_1 = f2.user_id_2))
               AND (f2.user_id_1 = u.id OR f2.user_id_2 = u.id))
             )
             WHERE f1.status = 'accepted' AND f2.status = 'accepted'
               AND f1.user_id_1 != u.id AND f1.user_id_2 != u.id
               AND f2.user_id_1 != $1 AND f2.user_id_2 != $1
           ) AS mutual_friends_count
    FROM users u
    WHERE u.id != $1
      -- Exclude accepted friends
      AND NOT EXISTS (
        SELECT 1 FROM friendships f
        WHERE ((f.user_id_1 = $1 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = $1))
          AND f.status = 'accepted'
      )
      -- Exclude already followed users
      AND NOT EXISTS (
        SELECT 1 FROM follows fol
        WHERE fol.follower_id = $1 AND fol.following_id = u.id
      )
    ORDER BY mutual_friends_count DESC, u.username ASC
    LIMIT 10`,
    [currentUserId]
  );
  return result.rows;
}
