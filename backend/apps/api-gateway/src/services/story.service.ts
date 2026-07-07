import * as storyRepo from '../repositories/story.repository';
import * as userRepo from '../repositories/user.repository';
import { dbPool } from '@libs/common';

export async function create(userId: string, mediaUrl: string) {
  const story = await storyRepo.createStory(userId, mediaUrl);
  const user = await userRepo.findUserById(userId);

  return {
    ...story,
    username: user.username,
    avatar_url: user.avatar_url
  };
}

export async function getActive(currentUserId: string) {
  // Get friend and following user IDs + currentUserId
  const userIdsRes = await dbPool.query(
    `SELECT following_id AS user_id FROM follows WHERE follower_id = $1
     UNION
     SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
     FROM friendships 
     WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'
     UNION
     SELECT $1 AS user_id`,
    [currentUserId]
  );
  const userIds = userIdsRes.rows.map(r => r.user_id);

  return await storyRepo.getActiveStories(userIds);
}
