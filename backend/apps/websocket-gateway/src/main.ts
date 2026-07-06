import { bootstrapGateway } from './gateway';
import { logger } from '@libs/common';

bootstrapGateway().catch((err) => {
  logger.error('Failed to bootstrap WebSocket Gateway', { error: err.stack || err.message });
  process.exit(1);
});
