import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as storyService from '../services/story.service';
import { logger } from '@libs/common';

export async function create(req: AuthenticatedRequest, res: Response) {
  const { media_url } = req.body;
  const currentUserId = req.user!.userId;

  if (!media_url) {
    return res.status(400).json({ error: 'Media URL is required' });
  }

  try {
    const result = await storyService.create(currentUserId, media_url);
    res.status(201).json(result);
  } catch (err) {
    logger.error('Failed to create story', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getActive(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;

  try {
    const stories = await storyService.getActive(currentUserId);
    res.json(stories);
  } catch (err) {
    logger.error('Failed to fetch active stories', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}
