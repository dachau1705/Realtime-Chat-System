import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as conversationService from '../services/conversation.service';
import { logger } from '@libs/common';

export async function getConversations(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  try {
    const result = await conversationService.getConversations(currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to fetch user conversations', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function createConversation(req: AuthenticatedRequest, res: Response) {
  let { name, isGroup, memberIds } = req.body;
  const currentUserId = req.user!.userId;

  if (typeof memberIds === 'string') {
    try {
      memberIds = JSON.parse(memberIds);
    } catch (e) {
      // Ignore
    }
  }

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds array is required' });
  }

  try {
    const conversation = await conversationService.createConversation(name, isGroup, memberIds, currentUserId);
    res.status(201).json(conversation);
  } catch (err) {
    logger.error('Failed to create conversation', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  const conversationId = req.params.id;
  const currentUserId = req.user!.userId;
  const limit = parseInt(req.query.limit as string || '50', 10);
  const before = req.query.before as string;
  const beforeId = req.query.beforeId as string;

  try {
    const messages = await conversationService.getMessages(conversationId, currentUserId, limit, before, beforeId);
    res.json(messages);
  } catch (err) {
    logger.error('Failed to fetch conversation messages', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('authorized') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function markAsRead(req: AuthenticatedRequest, res: Response) {
  const conversationId = req.params.id;
  const currentUserId = req.user!.userId;

  try {
    const result = await conversationService.markAsRead(conversationId, currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to mark conversation messages as read', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('authorized') ? 403 : 500).json({ error: (err as Error).message });
  }
}
