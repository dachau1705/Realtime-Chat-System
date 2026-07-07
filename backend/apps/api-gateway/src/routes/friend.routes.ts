import express from 'express';
import * as friendController from '../controllers/friend.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/users/:id/friends', authenticateToken, friendController.getFriends);
router.post('/friends', authenticateToken, friendController.manageRequest);
router.get('/friends/requests/sent', authenticateToken, friendController.getSentRequests);
router.get('/friends/requests', authenticateToken, friendController.getPending);
router.post('/friends/accept', authenticateToken, friendController.accept);
router.post('/friends/decline', authenticateToken, friendController.decline);
router.get('/friends/suggestions', authenticateToken, friendController.getSuggestions);

export default router;
