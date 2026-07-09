import { Pool } from 'pg';
import * as winston from 'winston';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Resolve environment variables from the root folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config(); // Also check current dir

// Logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // support request_id if available
      const reqId = meta.request_id ? ` [Req: ${meta.request_id}]` : '';
      delete meta.request_id;
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}${reqId}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Database pool configuration
export const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres_password',
  database: process.env.DB_NAME || 'chat_db',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

dbPool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
});

// Shared Type Definitions
export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  privacy_is_public?: boolean;
  created_at: Date;
}

export interface Conversation {
  id: string;
  name?: string;
  is_group: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  client_message_id: string;
  type: 'text' | 'image' | 'sticker';
  media_url?: string;
  created_at: Date;
}

export interface MessageReceipt {
  id: string;
  message_id: string;
  user_id: string;
  status: 'sent' | 'delivered' | 'seen';
  updated_at: Date;
}

export interface TypingEvent {
  conversation_id: string;
  user_id: string;
  username: string;
  is_typing: boolean;
}

export interface ReceiptEvent {
  conversation_id: string;
  message_id: string;
  user_id: string;
  status: 'delivered' | 'seen';
}

export * from './modelBase';
