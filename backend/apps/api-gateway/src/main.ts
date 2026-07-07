import express from 'express';
import cors from 'cors';
import { dbPool, logger } from '@libs/common';
import path from 'path';
import fs from 'fs';

// Modular Configurations, Middlewares, and Utilities
import { initKafka } from './config/services';

const app = express();
app.disable('etag');
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const PORT = parseInt(process.env.API_PORT || '3000', 10);

// Initialize Kafka social events pipeline
initKafka();

// Mount modular routers
import mainRouter from './routes';
app.use('/api', mainRouter);

// SPA client-side routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API 404 Fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

async function runStartupMigrations() {
  try {
    await dbPool.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public' NOT NULL;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS allowed_user_ids UUID[] DEFAULT '{}'::UUID[] NOT NULL;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS blocked_user_ids UUID[] DEFAULT '{}'::UUID[] NOT NULL;
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024) NULL;
    `);
    logger.info('Database visibility and group avatar columns verified successfully!');
  } catch (err) {
    logger.error('Failed to run visibility and group avatar startup migration', { error: (err as Error).message });
  }
}

runStartupMigrations().then(() => {
  app.listen(PORT, () => {
    logger.info(`API Gateway REST server running on port ${PORT}`);
  });
});
