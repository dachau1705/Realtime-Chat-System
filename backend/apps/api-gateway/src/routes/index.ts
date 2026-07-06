import express from 'express';
import pagesRouter from './pages.routes';

const router = express.Router();

// Register module sub-routers
router.use(pagesRouter);

export default router;
