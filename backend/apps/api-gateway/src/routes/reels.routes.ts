import express from 'express';
import * as reelsController from '../controllers/reels.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/reels', authenticateToken, reelsController.create);
router.get('/reels', authenticateToken, reelsController.getFeed);
router.post('/reels/:id/like', authenticateToken, reelsController.toggleLike);
router.post('/reels/:id/comments', authenticateToken, reelsController.addComment);
router.get('/reels/:id/comments', authenticateToken, reelsController.getComments);
router.get('/users/:id/reels', authenticateToken, reelsController.getByUser);
router.delete('/reels/:id', authenticateToken, reelsController.remove);

export default router;
