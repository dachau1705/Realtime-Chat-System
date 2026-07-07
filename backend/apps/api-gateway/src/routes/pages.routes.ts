import express from 'express';
import * as pageController from '../controllers/page.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/page-categories', authenticateToken, pageController.getCategories);
router.post('/pages', authenticateToken, pageController.createPage);
router.get('/pages/my', authenticateToken, pageController.getMyPages);
router.get('/pages/detail/:id', authenticateToken, pageController.getPageDetail);
router.get('/pages/:id/settings', authenticateToken, pageController.getSettings);
router.put('/pages/:id/settings', authenticateToken, pageController.updateSettings);
router.post('/pages/:id/members', authenticateToken, pageController.assignMember);
router.get('/pages/:id/members', authenticateToken, pageController.getMembers);
router.delete('/pages/:id/members/:userId', authenticateToken, pageController.removeMember);
router.post('/pages/:id/follow', authenticateToken, pageController.follow);
router.post('/pages/:id/unfollow', authenticateToken, pageController.unfollow);
router.post('/pages/:id/posts', authenticateToken, pageController.createPost);
router.get('/pages/:id/posts', authenticateToken, pageController.getPosts);
router.post('/pages/:id/reviews', authenticateToken, pageController.createReview);
router.get('/pages/:id/reviews', authenticateToken, pageController.getReviews);
router.get('/pages/:id/insights', authenticateToken, pageController.getInsights);

export default router;
