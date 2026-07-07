import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { logger } from '@libs/common';

export async function register(req: Request, res: Response) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing username, email, or password' });
  }

  try {
    const result = await authService.register(username, email, password);
    res.status(201).json(result);
  } catch (err) {
    logger.error('Failed to create user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err) {
    logger.error('Failed to log in', { error: (err as Error).message });
    res.status(401).json({ error: (err as Error).message });
  }
}
