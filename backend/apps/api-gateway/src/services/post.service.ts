import * as postRepo from '../repositories/post.repository';
import * as userRepo from '../repositories/user.repository';
import * as friendRepo from '../repositories/friend.repository';
import { createNotification } from '../helpers/notification.helper';
import { redisService } from '../config/services';
import { logger, dbPool } from '@libs/common';

export async function create(
  userId: string,
  content: string | null,
  mediaUrls: string[],
  visibility: string,
  allowedUserIds: string[],
  blockedUserIds: string[]
) {
  const post = await postRepo.createPost(userId, content, mediaUrls, visibility, allowedUserIds, blockedUserIds);
  const user = await userRepo.findUserById(userId);

  // Run Hybrid Fan-out distribution
  const timestamp = new Date(post.created_at).getTime();
  await pushPostToFollowers(userId, post.id, timestamp, post, user);

  return {
    ...post,
    username: user.username,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    comment_count: 0,
    reaction_count: 0,
    has_reacted: false,
    reaction_type: null
  };
}

export async function getFeed(currentUserId: string, limit: number, before?: string) {
  const redisClient = redisService.getClient();
  const cacheKey = `feed:user:${currentUserId}`;

  // 1. Get friend and following user IDs + currentUserId
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

  // 2. Check if cache exists. If not, rebuild it (Fan-out on Read backfill)
  const cacheExists = await redisClient.exists(cacheKey);
  if (!cacheExists && userIds.length > 0) {
    const buildRes = await postRepo.getFeedPostsList(userIds);

    if (buildRes.length > 0) {
      const pipeline = redisClient.pipeline();
      for (const row of buildRes) {
        pipeline.zadd(cacheKey, new Date(row.created_at).getTime(), row.id);
      }
      pipeline.expire(cacheKey, 24 * 3600); // Cache warm for 24h
      await pipeline.exec();
    }
  }

  // 3. Query post IDs from Sorted Set
  const maxScore = before ? new Date(before).getTime() - 1 : '+inf';
  const standardPostIds = await redisClient.zrevrangebyscore(
    cacheKey,
    maxScore,
    '-inf',
    'LIMIT',
    0,
    limit
  );

  // 4. Fetch VIPs (celebrities) whom we follow
  const vipIds = await postRepo.getVIPFollowings(currentUserId);

  // Fetch VIP post IDs from their celebrity cache
  let vipPostIds: string[] = [];
  for (const vipId of vipIds) {
    const vipPosts = await redisClient.zrevrangebyscore(
      `celebrity_posts:${vipId}`,
      maxScore,
      '-inf',
      'LIMIT',
      0,
      limit
    );
    vipPostIds = [...vipPostIds, ...vipPosts];
  }

  // 5. Merge standard posts and celebrity posts, then deduplicate
  const allPostIds = Array.from(new Set([...standardPostIds, ...vipPostIds]));

  if (allPostIds.length === 0) {
    return [];
  }

  const posts: any[] = [];
  for (const postId of allPostIds) {
    const cached = await redisClient.get(`post:${postId}`);
    let details;
    if (cached) {
      details = JSON.parse(cached);
    } else {
      details = await postRepo.findPostById(postId);
      if (details) {
        await redisClient.set(`post:${postId}`, JSON.stringify(details), 'EX', 24 * 3600);
      }
    }

    if (!details) continue;

    // Check visibility
    const isAuthor = details.user_id === currentUserId;
    const isPublic = details.visibility === 'public' || !details.visibility;
    const isOnlyMe = details.visibility === 'only_me';

    let allowed = isAuthor || isPublic;
    if (!allowed && !isOnlyMe) {
      if (details.visibility === 'specific_friends') {
        const allowedIds = Array.isArray(details.allowed_user_ids) ? details.allowed_user_ids : [];
        if (allowedIds.includes(currentUserId)) allowed = true;
      } else if (details.visibility === 'friends' || details.visibility === 'except_friends') {
        const friendship = await friendRepo.findFriendship(currentUserId, details.user_id);
        const isFriend = friendship && friendship.status === 'accepted';

        if (details.visibility === 'friends' && isFriend) allowed = true;
        if (details.visibility === 'except_friends' && isFriend) {
          const blockedIds = Array.isArray(details.blocked_user_ids) ? details.blocked_user_ids : [];
          if (!blockedIds.includes(currentUserId)) allowed = true;
        }
      }
    }

    if (allowed) {
      posts.push(details);
    }
  }

  // 6. Rank Feed Items (Decay-based scoring)
  const now = Date.now();
  const rankedPosts = posts.map(post => {
    const createdTime = new Date(post.created_at).getTime();
    const hoursSinceCreated = (now - createdTime) / (1000 * 3600);
    
    const affinity = post.user_id === currentUserId ? 1.2 : 1.0;
    const weight = (post.reaction_count * 1) + (post.comment_count * 3) + 1;
    const decay = Math.pow(hoursSinceCreated + 2, 1.5);
    const score = (affinity * weight) / decay;
    
    return { post, score };
  })
  .sort((a, b) => b.score - a.score)
  .map(x => x.post);

  return rankedPosts;
}

export async function getPost(postId: string, currentUserId: string) {
  const redisClient = redisService.getClient();
  const cached = await redisClient.get(`post:${postId}`);
  let details;
  if (cached) {
    details = JSON.parse(cached);
  } else {
    details = await postRepo.findPostById(postId);
    if (details) {
      await redisClient.set(`post:${postId}`, JSON.stringify(details), 'EX', 24 * 3600);
    }
  }

  if (!details) {
    throw new Error('Post not found');
  }

  const isAuthor = details.user_id === currentUserId;
  const isPublic = details.visibility === 'public' || !details.visibility;
  const isOnlyMe = details.visibility === 'only_me';

  let allowed = isAuthor || isPublic;
  if (!allowed && !isOnlyMe) {
    if (details.visibility === 'specific_friends') {
      const allowedIds = Array.isArray(details.allowed_user_ids) ? details.allowed_user_ids : [];
      if (allowedIds.includes(currentUserId)) allowed = true;
    } else if (details.visibility === 'friends' || details.visibility === 'except_friends') {
      const friendship = await friendRepo.findFriendship(currentUserId, details.user_id);
      const isFriend = friendship && friendship.status === 'accepted';

      if (details.visibility === 'friends' && isFriend) allowed = true;
      if (details.visibility === 'except_friends' && isFriend) {
        const blockedIds = Array.isArray(details.blocked_user_ids) ? details.blocked_user_ids : [];
        if (!blockedIds.includes(currentUserId)) allowed = true;
      }
    }
  }

  if (!allowed) {
    throw new Error('You are not authorized to view this post');
  }

  return details;
}

export async function update(
  postId: string,
  currentUserId: string,
  content: string | null,
  mediaUrls: string[],
  visibility?: string,
  allowedUserIds?: string[],
  blockedUserIds?: string[]
) {
  const post = await postRepo.findRawPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  if (post.user_id !== currentUserId) {
    throw new Error('You are not authorized to edit this post');
  }

  const finalVisibility = visibility !== undefined ? visibility : post.visibility;
  const finalAllowed = allowedUserIds !== undefined ? allowedUserIds : post.allowed_user_ids;
  const finalBlocked = blockedUserIds !== undefined ? blockedUserIds : post.blocked_user_ids;

  const result = await postRepo.updatePost(postId, content, mediaUrls, finalVisibility, finalAllowed, finalBlocked);

  // Del cache
  await redisService.getClient().del(`post:${postId}`);

  return result;
}

export async function remove(postId: string, currentUserId: string) {
  const post = await postRepo.findRawPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  if (post.user_id !== currentUserId) {
    throw new Error('You are not authorized to delete this post');
  }

  await postRepo.deletePost(postId);
  await removePostFromFeeds(currentUserId, postId);

  return { message: 'Post deleted successfully' };
}

export async function getPostsByUser(targetUserId: string, currentUserId: string) {
  const user = await userRepo.findUserById(targetUserId);
  if (!user) {
    throw new Error('User not found');
  }

  const isOwner = currentUserId === targetUserId;
  const friendship = await friendRepo.findFriendship(currentUserId, targetUserId);
  const isFriend = friendship && friendship.status === 'accepted';

  if (!user.privacy_is_public && !isOwner && !isFriend) {
    return [];
  }

  return await postRepo.getUserPosts(targetUserId);
}

export async function react(postId: string, currentUserId: string, currentUsername: string, type?: string) {
  const post = await postRepo.findRawPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  if (!type) {
    await postRepo.deleteReaction(postId, currentUserId);
  } else {
    await postRepo.upsertReaction(postId, currentUserId, type);
    if (post.user_id !== currentUserId) {
      await createNotification(post.user_id, currentUserId, 'like', postId, null);
    }
  }

  const status = await postRepo.getReactionStatus(postId, currentUserId);

  // Del cache
  await redisService.getClient().del(`post:${postId}`);

  return status;
}

export async function addComment(postId: string, currentUserId: string, currentUsername: string, content: string, parentId: string | null) {
  const post = await postRepo.findRawPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  const comment = await postRepo.insertComment(postId, currentUserId, content, parentId);

  if (post.user_id !== currentUserId) {
    await createNotification(post.user_id, currentUserId, 'comment', postId, comment.id);
  }

  const user = await userRepo.findUserById(currentUserId);

  // Del cache
  await redisService.getClient().del(`post:${postId}`);

  // Broadcast comment event
  const commentPayload = {
    ...comment,
    username: user.username,
    full_name: user.full_name,
    avatar_url: user.avatar_url
  };

  try {
    await redisService.publish('chat:events', {
      type: 'new_comment',
      data: {
        comment: commentPayload
      }
    });
  } catch (redisErr) {
    logger.error('Failed to publish new_comment event to Redis', { error: (redisErr as Error).message });
  }

  return commentPayload;
}

export async function getComments(postId: string) {
  const post = await postRepo.findRawPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }
  return await postRepo.getPostComments(postId);
}

// Private helper logic
async function pushPostToFollowers(userId: string, postId: string, timestamp: number, post: any, user: any) {
  try {
    const client = redisService.getClient();

    const postDetails = {
      ...post,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      comment_count: 0,
      reaction_count: 0,
      has_reacted: false,
      reaction_type: null
    };
    await client.set(`post:${postId}`, JSON.stringify(postDetails), 'EX', 24 * 3600);

    const ownFeedKey = `feed:user:${userId}`;
    await client.zadd(ownFeedKey, timestamp, postId);
    await client.zremrangebyrank(ownFeedKey, 0, -501);

    const relationsRes = await dbPool.query(
      `SELECT follower_id AS user_id FROM follows WHERE following_id = $1
       UNION
       SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
      [userId]
    );

    let targetUserIds = relationsRes.rows.map(r => r.user_id);

    const visibility = post.visibility || 'public';
    if (visibility === 'only_me') {
      targetUserIds = [];
    } else if (visibility === 'specific_friends') {
      const allowed = Array.isArray(post.allowed_user_ids) ? post.allowed_user_ids : [];
      targetUserIds = targetUserIds.filter(uid => allowed.includes(uid));
    } else if (visibility === 'except_friends') {
      const blocked = Array.isArray(post.blocked_user_ids) ? post.blocked_user_ids : [];
      targetUserIds = targetUserIds.filter(uid => !blocked.includes(uid));

      const friendsRes = await dbPool.query(
        `SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
         FROM friendships 
         WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
        [userId]
      );
      const friendIds = friendsRes.rows.map(r => r.user_id);
      targetUserIds = targetUserIds.filter(uid => friendIds.includes(uid));
    } else if (visibility === 'friends') {
      const friendsRes = await dbPool.query(
        `SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
         FROM friendships 
         WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
        [userId]
      );
      const friendIds = friendsRes.rows.map(r => r.user_id);
      targetUserIds = targetUserIds.filter(uid => friendIds.includes(uid));
    }

    const followersCount = targetUserIds.length;

    if (followersCount > 100) {
      const celebrityKey = `celebrity_posts:${userId}`;
      await client.zadd(celebrityKey, timestamp, postId);
      await client.zremrangebyrank(celebrityKey, 0, -101);
      await client.expire(celebrityKey, 7 * 24 * 3600);

      setTimeout(async () => {
        for (const followerId of targetUserIds) {
          await redisService.publish('chat:events', {
            type: 'new_feed_item',
            data: { followerId, post: postDetails }
          });
        }
      }, 0);
    } else {
      for (const followerId of targetUserIds) {
        const key = `feed:user:${followerId}`;
        const cacheExists = await client.exists(key);
        if (cacheExists) {
          await client.zadd(key, timestamp, postId);
          await client.zremrangebyrank(key, 0, -501);
        }

        await redisService.publish('chat:events', {
          type: 'new_feed_item',
          data: { followerId, post: postDetails }
        });
      }
    }
  } catch (err) {
    logger.error('Failed to distribute post in hybrid fan-out', { userId, postId, error: (err as Error).message });
  }
}

async function removePostFromFeeds(userId: string, postId: string) {
  try {
    const client = redisService.getClient();
    await client.del(`post:${postId}`);
    await client.zrem(`feed:user:${userId}`, postId);
    await client.zrem(`celebrity_posts:${userId}`, postId);

    const relationsRes = await dbPool.query(
      `SELECT follower_id AS user_id FROM follows WHERE following_id = $1
       UNION
       SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
      [userId]
    );

    for (const row of relationsRes.rows) {
      await client.zrem(`feed:user:${row.user_id}`, postId);
    }
  } catch (err) {
    logger.error('Failed to remove post from feeds', { userId, postId, error: (err as Error).message });
  }
}
