import express from 'express';
import * as storyController from '../controllers/story.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/stories', authenticateToken, storyController.create);
router.get('/stories', authenticateToken, storyController.getActive);

export default router;
