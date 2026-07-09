import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as reelsService from '../services/reels.service';
import { logger } from '@libs/common';

export async function create(req: AuthenticatedRequest, res: Response) {
  const { video_url, caption = null } = req.body;
  const userId = req.user!.userId;

  if (!video_url) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  try {
    const reel = await reelsService.create(userId, video_url, caption);
    res.status(201).json(reel);
  } catch (err) {
    logger.error('Failed to create reel', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getFeed(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const limit = parseInt(req.query.limit as string || '10', 10);
  const offset = parseInt(req.query.offset as string || '0', 10);

  try {
    const feed = await reelsService.getFeed(currentUserId, limit, offset);
    res.json(feed);
  } catch (err) {
    logger.error('Failed to get reels feed', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function toggleLike(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;
  const reelId = req.params.id;

  try {
    const status = await reelsService.toggleLike(reelId, userId);
    res.json(status);
  } catch (err) {
    logger.error('Failed to toggle reel reaction', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function addComment(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;
  const reelId = req.params.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  try {
    const comment = await reelsService.addComment(reelId, userId, content);
    res.status(201).json(comment);
  } catch (err) {
    logger.error('Failed to add comment to reel', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getComments(req: AuthenticatedRequest, res: Response) {
  const reelId = req.params.id;

  try {
    const comments = await reelsService.getComments(reelId);
    res.json(comments);
  } catch (err) {
    logger.error('Failed to get reel comments', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getByUser(req: AuthenticatedRequest, res: Response) {
  const targetUserId = req.params.id;
  const currentUserId = req.user!.userId;

  try {
    const reels = await reelsService.getByUser(targetUserId, currentUserId);
    res.json(reels);
  } catch (err) {
    logger.error('Failed to get user reels', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;
  const reelId = req.params.id;

  try {
    const status = await reelsService.remove(reelId, userId);
    res.json(status);
  } catch (err) {
    logger.error('Failed to delete reel', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('authorized') ? 403 : 500).json({ error: (err as Error).message });
  }
}
