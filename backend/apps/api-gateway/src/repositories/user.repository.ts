import { dbPool } from '@libs/common';

export async function createUser(username: string, email: string, passwordHash: string) {
  const result = await dbPool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, created_at`,
    [username, email, passwordHash]
  );
  return result.rows[0];
}

export async function findUserByUsername(username: string) {
  const result = await dbPool.query(
    'SELECT id, username, email, full_name, avatar_url, password_hash FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const result = await dbPool.query(
    'SELECT id, username FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

export async function searchUsers(q: string, currentUserId: string) {
  const result = await dbPool.query(
    `SELECT id, username, email, full_name, avatar_url 
     FROM users 
     WHERE (username ILIKE $1 OR email ILIKE $1 OR full_name ILIKE $1)
       AND id != $2
     LIMIT 10`,
    [`%${q}%`, currentUserId]
  );
  return result.rows;
}

export async function findUserById(id: string) {
  const result = await dbPool.query(
    `SELECT id, username, email, created_at, full_name, avatar_url, cover_url, bio, privacy_is_public 
     FROM users 
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function updateUserProfile(id: string, fullName: string, phone: string, bio: string, privacyIsPublic: boolean) {
  const result = await dbPool.query(
    `UPDATE users 
     SET full_name = $1, phone = $2, bio = $3, privacy_is_public = $4
     WHERE id = $5
     RETURNING id, username, email, full_name, phone, bio, privacy_is_public`,
    [fullName, phone, bio, privacyIsPublic, id]
  );
  return result.rows[0];
}

export async function updateUserAvatar(id: string, avatarUrl: string) {
  const result = await dbPool.query(
    'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, username, avatar_url',
    [avatarUrl, id]
  );
  return result.rows[0];
}

export async function updateUserCover(id: string, coverUrl: string) {
  const result = await dbPool.query(
    'UPDATE users SET cover_url = $1 WHERE id = $2 RETURNING id, username, cover_url',
    [coverUrl, id]
  );
  return result.rows[0];
}

export async function getFollowRelation(followerId: string, followingId: string) {
  const result = await dbPool.query(
    'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );
  return result.rows.length > 0;
}

export async function createFollowRelation(followerId: string, followingId: string) {
  await dbPool.query(
    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
    [followerId, followingId]
  );
}

export async function deleteFollowRelation(followerId: string, followingId: string) {
  await dbPool.query(
    'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );
}
