import express from 'express';
import * as conversationController from '../controllers/conversation.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/conversations', authenticateToken, conversationController.getConversations);
router.post('/conversations', authenticateToken, conversationController.createConversation);
router.get('/conversations/:id/messages', authenticateToken, conversationController.getMessages);
router.post('/conversations/:id/read', authenticateToken, conversationController.markAsRead);

export default router;
