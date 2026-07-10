import sharp from 'sharp';
import { uploadToCloudinary } from '../helpers/cloudinary.helper';
import { createNotification } from '../helpers/notification.helper';
import { redisService } from '../config/services';
import { logger } from '@libs/common';
import * as userRepo from '../repositories/user.repository';
import * as friendRepo from '../repositories/friend.repository';

export async function search(q: string, currentUserId: string) {
  return await userRepo.searchUsers(q, currentUserId);
}

export async function getProfile(targetUserId: string, currentUserId: string) {
  const user = await userRepo.findUserById(targetUserId);
  if (!user) {
    throw new Error('User not found');
  }

  const friendship = await friendRepo.findFriendship(currentUserId, targetUserId);
  let friendshipStatus = 'none';

  if (currentUserId === targetUserId) {
    friendshipStatus = 'self';
  } else if (friendship) {
    if (friendship.status === 'accepted') {
      friendshipStatus = 'friends';
    } else if (friendship.status === 'pending') {
      if (friendship.user_id_1 === currentUserId) {
        friendshipStatus = 'request_sent';
      } else {
        friendshipStatus = 'request_received';
      }
    }
  }

  const isOwner = currentUserId === targetUserId;
  const isFriend = friendshipStatus === 'friends';

  // Hide contact details if profile is private and we aren't owner or friends
  if (!user.privacy_is_public && !isOwner && !isFriend) {
    user.email = null;
    user.phone = null;
  }

  return {
    ...user,
    friendshipStatus
  };
}

export async function updateProfile(id: string, fullName: string, phone: string, bio: string, privacyIsPublic: boolean, aboutInfo?: any) {
  const result = await userRepo.updateUserProfile(id, fullName, phone, bio, privacyIsPublic, aboutInfo);
  if (result.newFamilyRequests && result.newFamilyRequests.length > 0) {
    for (const req of result.newFamilyRequests) {
      await createNotification(req.relative_user_id, id, 'family_request', null, null);
    }
  }
  return await userRepo.findUserById(id);
}

export async function uploadAvatar(userId: string, fileBuffer: Buffer) {
  // Optimize and crop to 300x300px
  const optimizedBuffer = await sharp(fileBuffer)
    .resize({ width: 300, height: 300, fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  const fileId = `avatar_${userId}`;
  const uploadResult = await uploadToCloudinary(optimizedBuffer, fileId, 'avatars');
  const avatarUrl = uploadResult.secure_url;

  // Save url and retrieve user info for broadcast
  const user = await userRepo.updateUserAvatar(userId, avatarUrl);

  // Broadcast update
  try {
    await redisService.publish('chat:events', {
      type: 'profile_update',
      data: {
        userId: userId,
        username: user.username,
        fullName: user.full_name,
        avatarUrl: avatarUrl
      }
    });
  } catch (redisErr) {
    logger.error('Failed to publish profile_update event to Redis', { error: (redisErr as Error).message });
  }

  return { avatarUrl };
}

export async function uploadCover(userId: string, fileBuffer: Buffer) {
  // Optimize and crop to cover banner aspect ratio
  const optimizedBuffer = await sharp(fileBuffer)
    .resize({ width: 1200, height: 450, fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  const fileId = `cover_${userId}`;
  const uploadResult = await uploadToCloudinary(optimizedBuffer, fileId, 'covers');
  const coverUrl = uploadResult.secure_url;

  // Save url
  await userRepo.updateUserCover(userId, coverUrl);

  return { coverUrl };
}

export async function follow(currentUserId: string, targetUserId: string) {
  await userRepo.createFollowRelation(currentUserId, targetUserId);
  await redisService.getClient().del(`feed:user:${currentUserId}`);
  await createNotification(targetUserId, currentUserId, 'follow', null, null);
  return { message: 'Successfully followed user', is_following: true };
}

export async function unfollow(currentUserId: string, targetUserId: string) {
  await userRepo.deleteFollowRelation(currentUserId, targetUserId);
  await redisService.getClient().del(`feed:user:${currentUserId}`);
  return { message: 'Successfully unfollowed user', is_following: false };
}

export async function getFollowStatus(currentUserId: string, targetUserId: string) {
  const isFollowing = await userRepo.getFollowRelation(currentUserId, targetUserId);
  const isFollower = await userRepo.getFollowRelation(targetUserId, currentUserId);
  return { is_following: isFollowing, is_follower: isFollower };
}

export async function searchLocations(q: string) {
  return await userRepo.searchLocations(q);
}

export async function searchLanguages(q: string) {
  return await userRepo.searchLanguages(q);
}

export async function acceptFamilyRequest(userId: string, requestId: string) {
  const result = await userRepo.acceptFamilyRequest(userId, requestId);
  if (result) {
    await createNotification(result.initiatorId, userId, 'family_accept', null, null);
  }
  return result;
}

