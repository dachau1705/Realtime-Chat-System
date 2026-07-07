import express from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/notifications', authenticateToken, notificationController.getNotifications);
router.post('/notifications/read', authenticateToken, notificationController.markRead);

export default router;
