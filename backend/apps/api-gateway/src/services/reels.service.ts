import * as reelsRepo from '../repositories/reels.repository';
import * as userRepo from '../repositories/user.repository';

export async function create(userId: string, videoUrl: string, caption: string | null) {
  const reel = await reelsRepo.createReel(userId, videoUrl, caption);
  const user = await userRepo.findUserById(userId);
  return {
    ...reel,
    username: user.username,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    has_liked: false
  };
}

export async function getFeed(currentUserId: string, limit: number, offset: number) {
  return await reelsRepo.getReelsFeed(currentUserId, limit, offset);
}

export async function toggleLike(reelId: string, userId: string) {
  return await reelsRepo.toggleReelLike(reelId, userId);
}

export async function addComment(reelId: string, userId: string, content: string) {
  return await reelsRepo.insertReelComment(reelId, userId, content);
}

export async function getComments(reelId: string) {
  return await reelsRepo.getReelComments(reelId);
}

export async function getByUser(targetUserId: string, currentUserId: string) {
  return await reelsRepo.getUserReels(targetUserId, currentUserId);
}

export async function remove(reelId: string, userId: string) {
  const deleted = await reelsRepo.deleteReel(reelId, userId);
  if (!deleted) {
    throw new Error('Reel not found or not authorized');
  }
  return { message: 'Reel deleted successfully' };
}
