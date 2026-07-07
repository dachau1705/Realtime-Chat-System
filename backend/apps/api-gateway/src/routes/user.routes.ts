import express from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { upload } from '../helpers/upload.helper';

const router = express.Router();

router.get('/search/users', authenticateToken, userController.search);
router.get('/users/:id', authenticateToken, userController.getProfile);
router.put('/users/:id', authenticateToken, userController.update);
router.post('/upload/avatar', authenticateToken, upload.single('file'), userController.uploadAvatar);
router.post('/upload/cover', authenticateToken, upload.single('file'), userController.uploadCover);
router.post('/users/:id/follow', authenticateToken, userController.follow);
router.post('/users/:id/unfollow', authenticateToken, userController.unfollow);
router.get('/users/:id/follow-status', authenticateToken, userController.getFollowStatus);

export default router;
