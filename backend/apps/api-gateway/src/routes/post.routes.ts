import express from 'express';
import * as postController from '../controllers/post.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/posts', authenticateToken, postController.create);
router.get('/feed', authenticateToken, postController.getFeed);
router.get('/posts/:id', authenticateToken, postController.getPost);
router.put('/posts/:id', authenticateToken, postController.update);
router.delete('/posts/:id', authenticateToken, postController.remove);
router.get('/users/:id/posts', authenticateToken, postController.getByUser);
router.post('/posts/:id/react', authenticateToken, postController.react);
router.post('/posts/:id/comments', authenticateToken, postController.addComment);
router.get('/posts/:id/comments', authenticateToken, postController.getComments);

export default router;
