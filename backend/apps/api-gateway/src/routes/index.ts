import express from 'express';
import generalRouter from './general.routes';
import authRouter from './auth.routes';
import userRouter from './user.routes';
import friendRouter from './friend.routes';
import conversationRouter from './conversation.routes';
import postRouter from './post.routes';
import storyRouter from './story.routes';
import notificationRouter from './notification.routes';
import pagesRouter from './pages.routes';
import reelsRouter from './reels.routes';

const router = express.Router();

router.use(generalRouter);
router.use(authRouter);
router.use(userRouter);
router.use(friendRouter);
router.use(conversationRouter);
router.use(postRouter);
router.use(storyRouter);
router.use(notificationRouter);
router.use(pagesRouter);
router.use(reelsRouter);

export default router;
