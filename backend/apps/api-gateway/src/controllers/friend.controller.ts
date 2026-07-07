import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as friendService from '../services/friend.service';
import { logger } from '@libs/common';

export async function manageRequest(req: AuthenticatedRequest, res: Response) {
  const { email } = req.body;
  const currentUserId = req.user!.userId;
  const currentUsername = req.user!.username;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await friendService.manageFriendRequest(currentUserId, currentUsername, email);
    res.status(result.status === 'accepted' ? 200 : 201).json(result);
  } catch (err) {
    logger.error('Failed to process friend request', { error: (err as Error).message });
    const status = (err instanceof Error && err.message.includes('not found')) ? 404 : 400;
    res.status(status).json({ error: (err as Error).message });
  }
}

export async function getPending(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  try {
    const result = await friendService.getPendingRequests(currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to fetch friend requests', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getSentRequests(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  try {
    const result = await friendService.getSentRequests(currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to fetch sent friend requests', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function accept(req: AuthenticatedRequest, res: Response) {
  const { senderId } = req.body;
  const currentUserId = req.user!.userId;
  const currentUsername = req.user!.username;

  if (!senderId) {
    return res.status(400).json({ error: 'Sender ID is required' });
  }

  try {
    const result = await friendService.acceptFriendRequest(currentUserId, currentUsername, senderId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to accept friend request', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function decline(req: AuthenticatedRequest, res: Response) {
  const { senderId } = req.body;
  const currentUserId = req.user!.userId;

  if (!senderId) {
    return res.status(400).json({ error: 'Sender ID is required' });
  }

  try {
    const result = await friendService.declineFriendRequest(currentUserId, senderId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to decline friend request', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getFriends(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const friends = await friendService.getFriendsList(targetUserId, currentUserId);
    res.json(friends);
  } catch (err) {
    logger.error('Failed to fetch user friends list', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('private') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function getSuggestions(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  try {
    const result = await friendService.getSuggestions(currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to load friend suggestions', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}
