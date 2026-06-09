import { dbPool, logger } from '@libs/common';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  logger.info('Running database migrations...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Migration schema file not found at: ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  
  const client = await dbPool.connect();
  try {
    logger.info('Applying migration script...');
    await client.query(sql);
    logger.info('Migrations applied successfully!');
  } catch (err) {
    logger.error('Failed to apply migrations', { error: (err as Error).message });
    throw err;
  } finally {
    client.release();
    await dbPool.end();
  }
}

runMigrations().catch((err) => {
  logger.error('Migration execution failed', { error: err.stack || err.message });
  process.exit(1);
});
