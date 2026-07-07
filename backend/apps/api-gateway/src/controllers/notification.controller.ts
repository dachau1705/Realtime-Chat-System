import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as notificationService from '../services/notification.service';
import { logger } from '@libs/common';

export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  try {
    const result = await notificationService.getNotifications(currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to fetch notifications', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function markRead(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  try {
    const result = await notificationService.markAsRead(currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to mark notifications as read', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}
