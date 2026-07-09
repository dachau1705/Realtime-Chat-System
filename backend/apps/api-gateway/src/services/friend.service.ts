import * as friendRepo from '../repositories/friend.repository';
import * as userRepo from '../repositories/user.repository';
import * as conversationService from './conversation.service';
import { createNotification } from '../helpers/notification.helper';
import { redisService } from '../config/services';
import { logger } from '@libs/common';

export async function manageFriendRequest(currentUserId: string, currentUsername: string, email: string) {
  const targetUser = await userRepo.findUserByEmail(email.trim().toLowerCase());
  if (!targetUser) {
    throw new Error('User with this email not found');
  }

  const targetUserId = targetUser.id;
  if (targetUserId === currentUserId) {
    throw new Error('You cannot add yourself as a friend');
  }

  const friendship = await friendRepo.findFriendship(currentUserId, targetUserId);

  if (friendship) {
    if (friendship.status === 'accepted') {
      throw new Error('You are already friends with this user');
    }

    if (friendship.user_id_1 === currentUserId) {
      throw new Error('Friend request already sent and pending');
    } else {
      // Accept request
      await friendRepo.acceptFriendshipRequest(friendship.user_id_1, friendship.user_id_2);

      // Auto-create 1-to-1 conversation if it doesn't exist
      try {
        await conversationService.createConversation(null, false, [friendship.user_id_1, friendship.user_id_2], friendship.user_id_1);
      } catch (convErr: any) {
        logger.error('Failed to auto-create conversation on friend request acceptance in manageFriendRequest', { error: convErr.message });
      }

      // Notify target user
      try {
        await redisService.publish('chat:events', {
          type: 'friend_accept',
          data: {
            receiverId: targetUserId,
            senderUsername: currentUsername
          }
        });
      } catch (redisErr) {
        logger.error('Failed to publish friend_accept event to Redis', { error: (redisErr as Error).message });
      }

      return {
        message: `You are now friends with ${targetUser.username}!`,
        status: 'accepted'
      };
    }
  }

  // Create pending request
  await friendRepo.createFriendshipRequest(currentUserId, targetUserId);

  // Notify target user
  try {
    await redisService.publish('chat:events', {
      type: 'friend_request',
      data: {
        receiverId: targetUserId,
        senderUsername: currentUsername
      }
    });
  } catch (redisErr) {
    logger.error('Failed to publish friend_request event to Redis', { error: (redisErr as Error).message });
  }

  return {
    message: `Friend request sent to ${targetUser.username}`,
    status: 'pending'
  };
}

export async function getPendingRequests(userId: string) {
  return await friendRepo.getPendingRequests(userId);
}

export async function getSentRequests(userId: string) {
  return await friendRepo.getSentRequests(userId);
}

export async function acceptFriendRequest(currentUserId: string, currentUsername: string, senderId: string) {
  const friendship = await friendRepo.acceptFriendshipRequest(senderId, currentUserId);
  if (!friendship) {
    throw new Error('Pending friend request not found');
  }

  // Auto-create 1-to-1 conversation if it doesn't exist
  try {
    await conversationService.createConversation(null, false, [senderId, currentUserId], currentUserId);
  } catch (convErr: any) {
    logger.error('Failed to auto-create conversation on friend request acceptance in acceptFriendRequest', { error: convErr.message });
  }

  // Notify original sender that their request was accepted!
  try {
    await redisService.publish('chat:events', {
      type: 'friend_accept',
      data: {
        receiverId: senderId,
        senderUsername: currentUsername
      }
    });
  } catch (redisErr) {
    logger.error('Failed to publish friend_accept event to Redis', { error: (redisErr as Error).message });
  }

  await createNotification(senderId, currentUserId, 'friend_accept', null, null);

  return { message: 'Friend request accepted' };
}

export async function declineFriendRequest(currentUserId: string, senderId: string) {
  const success = await friendRepo.deleteFriendship(senderId, currentUserId);
  if (!success) {
    throw new Error('Friend request relationship not found');
  }
  return { message: 'Friend request declined successfully' };
}

export async function getFriendsList(targetUserId: string, currentUserId: string) {
  const targetUser = await userRepo.findUserById(targetUserId);
  if (!targetUser) {
    throw new Error('User not found');
  }

  const friendship = await friendRepo.findFriendship(currentUserId, targetUserId);
  const isOwner = currentUserId === targetUserId;
  const isFriend = friendship && friendship.status === 'accepted';

  if (!targetUser.privacy_is_public && !isOwner && !isFriend) {
    throw new Error("This user's friend list is private");
  }

  const friends = await friendRepo.getFriendsList(targetUserId, currentUserId);
  const enrichedFriends = await Promise.all(
    friends.map(async (f: any) => {
      try {
        const presence = await redisService.getUserPresence(f.id);
        return {
          ...f,
          is_online: presence?.status === 'online'
        };
      } catch (err) {
        logger.warn('Failed to fetch user presence from Redis', { userId: f.id, error: (err as Error).message });
        return { ...f, is_online: false };
      }
    })
  );

  return enrichedFriends;
}

export async function getSuggestions(currentUserId: string) {
  return await friendRepo.getFriendSuggestions(currentUserId);
}
