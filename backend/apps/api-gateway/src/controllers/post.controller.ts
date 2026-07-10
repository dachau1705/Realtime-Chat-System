import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as postService from '../services/post.service';
import { logger } from '@libs/common';

function parseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore
    }
  }
  return [];
}

export async function create(req: AuthenticatedRequest, res: Response) {
  let { content, media_urls, visibility = 'public', allowed_user_ids, blocked_user_ids } = req.body;
  const userId = req.user!.userId;

  media_urls = parseArray(media_urls);
  allowed_user_ids = parseArray(allowed_user_ids);
  blocked_user_ids = parseArray(blocked_user_ids);

  if (!content && (!media_urls || media_urls.length === 0)) {
    return res.status(400).json({ error: 'Post must contain text content or media' });
  }

  try {
    const post = await postService.create(userId, content, media_urls, visibility, allowed_user_ids, blocked_user_ids);
    res.status(201).json(post);
  } catch (err) {
    logger.error('Failed to create post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getFeed(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const limit = parseInt(req.query.limit as string || '20', 10);
  const before = req.query.before as string;

  try {
    const feed = await postService.getFeed(currentUserId, limit, before);
    res.json(feed);
  } catch (err) {
    logger.error('Failed to load news feed', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getPost(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;

  try {
    const post = await postService.getPost(postId, currentUserId);
    res.json(post);
  } catch (err) {
    logger.error('Failed to fetch post details', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('authorized') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;
  let { content, media_urls, visibility, allowed_user_ids, blocked_user_ids } = req.body;

  if (media_urls !== undefined) media_urls = parseArray(media_urls);
  if (allowed_user_ids !== undefined) allowed_user_ids = parseArray(allowed_user_ids);
  if (blocked_user_ids !== undefined) blocked_user_ids = parseArray(blocked_user_ids);

  try {
    const post = await postService.update(postId, currentUserId, content, media_urls, visibility, allowed_user_ids, blocked_user_ids);
    res.json(post);
  } catch (err) {
    logger.error('Failed to update post', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('authorized') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;

  try {
    const result = await postService.remove(postId, currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to delete post', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('authorized') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function getByUser(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const posts = await postService.getPostsByUser(targetUserId, currentUserId);
    res.json(posts);
  } catch (err) {
    logger.error('Failed to fetch user posts', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function react(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const currentUsername = req.user!.username;
  const postId = req.params.id;
  const { type = 'like' } = req.body;

  try {
    const status = await postService.react(postId, currentUserId, currentUsername, type);
    res.json(status);
  } catch (err) {
    logger.error('Failed to toggle post reaction', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function addComment(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const currentUsername = req.user!.username;
  const postId = req.params.id;
  const { content, parent_id = null } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const comment = await postService.addComment(postId, currentUserId, currentUsername, content, parent_id);
    res.status(201).json(comment);
  } catch (err) {
    logger.error('Failed to add comment to post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getComments(req: AuthenticatedRequest, res: Response) {
  const postId = req.params.id;
  try {
    const comments = await postService.getComments(postId);
    res.json(comments);
  } catch (err) {
    logger.error('Failed to fetch post comments', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}
