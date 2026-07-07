import express from 'express';
import * as authController from '../controllers/auth.controller';
import { createRateLimiter } from '../middleware/rate-limiter';
import { redisService } from '../config/services';

const router = express.Router();
const authLimiter = createRateLimiter(redisService, 15, 60);

router.post('/users', authLimiter, authController.register);
router.post('/auth/login', authLimiter, authController.login);

export default router;
