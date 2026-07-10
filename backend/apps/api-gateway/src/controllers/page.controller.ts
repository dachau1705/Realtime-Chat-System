import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as pageService from '../services/page.service';
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

export async function getCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const categories = await pageService.getCategories();
    res.json(categories);
  } catch (err) {
    logger.error('Failed to load page categories', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function createPage(req: AuthenticatedRequest, res: Response) {
  const ownerId = req.user!.userId;
  const {
    pageName,
    username,
    categoryId,
    description = '',
    phone = '',
    email = '',
    website = '',
    location = '',
    latitude = null,
    longitude = null,
    avatar = '',
    coverPhoto = ''
  } = req.body;

  try {
    const page = await pageService.createPage(ownerId, {
      pageName,
      username,
      categoryId,
      description,
      phone,
      email,
      website,
      location,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      avatar,
      coverPhoto
    });
    res.status(201).json(page);
  } catch (err) {
    logger.error('Failed to create page', { error: (err as Error).message });
    res.status(400).json({ error: (err as Error).message });
  }
}

export async function getMyPages(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;
  try {
    const pages = await pageService.getPagesForUser(userId);
    res.json(pages);
  } catch (err) {
    logger.error('Failed to fetch my pages list', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getPageDetail(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  try {
    const details = await pageService.getPageDetail(pageId, userId);
    res.json(details);
  } catch (err) {
    logger.error('Failed to fetch page profile', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('not found') ? 404 : 500).json({ error: (err as Error).message });
  }
}

export async function getSettings(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  try {
    const settings = await pageService.getSettings(pageId, userId);
    res.json(settings);
  } catch (err) {
    logger.error('Failed to fetch page settings', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('denied') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function updateSettings(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  const {
    allowVisitorPosts,
    allowTagging,
    allowMentions,
    profanityFilterLevel,
    ageRestriction,
    countryRestrictions,
    autoReplyEnabled,
    autoReplyMessage,
    autoReplyKeywords
  } = req.body;

  try {
    const result = await pageService.updateSettings(pageId, userId, {
      allowVisitorPosts,
      allowTagging,
      allowMentions,
      profanityFilterLevel,
      ageRestriction: ageRestriction ? parseInt(ageRestriction, 10) : 0,
      countryRestrictions,
      autoReplyEnabled,
      autoReplyMessage,
      autoReplyKeywords
    });
    res.json(result);
  } catch (err) {
    logger.error('Failed to update page settings', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('denied') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function getMembers(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  try {
    const members = await pageService.getMembers(pageId, userId);
    res.json(members);
  } catch (err) {
    logger.error('Failed to list page members', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('denied') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function assignMember(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  const { targetEmail, role } = req.body;

  try {
    const result = await pageService.assignMember(pageId, userId, targetEmail, role);
    res.json(result);
  } catch (err) {
    logger.error('Failed to assign page member role', { error: (err as Error).message });
    const status = err instanceof Error && err.message.includes('denied') ? 403 : (err instanceof Error && err.message.includes('not found') ? 404 : 500);
    res.status(status).json({ error: (err as Error).message });
  }
}

export async function removeMember(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.params.userId;
  const currentUserId = req.user!.userId;

  try {
    const result = await pageService.removeMember(pageId, currentUserId, userId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to revoke page member access', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('denied') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function follow(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  try {
    const result = await pageService.followPage(pageId, userId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to follow page', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function unfollow(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  try {
    const result = await pageService.unfollowPage(pageId, userId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to unfollow page', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function createPost(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  let { content, postType, mediaUrls } = req.body;

  mediaUrls = parseArray(mediaUrls);

  try {
    const post = await pageService.createPost(pageId, userId, content, postType, mediaUrls);
    res.status(201).json(post);
  } catch (err) {
    logger.error('Failed to create page post', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('denied') ? 403 : 500).json({ error: (err as Error).message });
  }
}

export async function getPosts(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const limit = parseInt(req.query.limit as string || '10', 10);
  const offset = parseInt(req.query.offset as string || '0', 10);

  try {
    const posts = await pageService.getPosts(pageId, limit, offset);
    res.json(posts);
  } catch (err) {
    logger.error('Failed to fetch page posts list', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function createReview(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  const { rating, reviewText } = req.body;

  try {
    const review = await pageService.createReview(pageId, userId, rating ? parseInt(rating, 10) : 0, reviewText);
    res.json(review);
  } catch (err) {
    logger.error('Failed to create page review', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getReviews(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  try {
    const reviews = await pageService.getReviews(pageId);
    res.json(reviews);
  } catch (err) {
    logger.error('Failed to fetch page reviews list', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getInsights(req: AuthenticatedRequest, res: Response) {
  const pageId = req.params.id;
  const userId = req.user!.userId;
  try {
    const insights = await pageService.getInsights(pageId, userId);
    res.json(insights);
  } catch (err) {
    logger.error('Failed to retrieve page insights', { error: (err as Error).message });
    res.status(err instanceof Error && err.message.includes('denied') ? 403 : 500).json({ error: (err as Error).message });
  }
}
