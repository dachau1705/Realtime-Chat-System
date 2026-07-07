import { dbPool } from '@libs/common';

export async function getUserNotifications(userId: string) {
  const result = await dbPool.query(
    `SELECT n.*, u.username as actor_username, u.full_name as actor_full_name, u.avatar_url as actor_avatar_url
     FROM notifications n
     JOIN users u ON n.actor_id = u.id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function markAllNotificationsRead(userId: string) {
  await dbPool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1',
    [userId]
  );
}
