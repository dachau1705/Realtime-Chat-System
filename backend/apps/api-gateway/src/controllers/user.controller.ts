import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as userService from '../services/user.service';
import { logger } from '@libs/common';

export async function search(req: AuthenticatedRequest, res: Response) {
  const q = req.query.q;
  if (!q || typeof q !== 'string') {
    return res.json([]);
  }
  const currentUserId = req.user!.userId;
  try {
    const result = await userService.search(q, currentUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to search users', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const profile = await userService.getProfile(targetUserId, currentUserId);
    res.json(profile);
  } catch (err) {
    logger.error('Failed to fetch user profile', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  if (currentUserId !== targetUserId) {
    return res.status(403).json({ error: 'You are not authorized to edit this profile' });
  }

  const { full_name, phone, bio, privacy_is_public, about_info } = req.body;
  console.log("[DEBUG BACKEND] Received PUT /users/:id. Target User ID:", targetUserId, "Current User ID:", currentUserId);
  console.log("[DEBUG BACKEND] Request body:", { full_name, phone, bio, privacy_is_public, about_info });

  let parsedAboutInfo = about_info;
  if (about_info && typeof about_info === 'string') {
    try {
      parsedAboutInfo = JSON.parse(about_info);
      console.log("[DEBUG BACKEND] Successfully parsed about_info string to object:", parsedAboutInfo);
    } catch (err) {
      console.error("[DEBUG BACKEND] Failed to parse about_info JSON string:", err);
    }
  }

  try {
    const user = await userService.updateProfile(targetUserId, full_name, phone, bio, privacy_is_public, parsedAboutInfo);
    console.log("[DEBUG BACKEND] Successfully updated profile. Returning user.");
    res.json(user);
  } catch (err) {
    console.error('Failed to update user profile error details:', err);
    logger.error('Failed to update user profile', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function uploadAvatar(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Validate size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Avatar image file must be smaller than 5MB' });
    }

    const result = await userService.uploadAvatar(currentUserId, req.file.buffer);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to process and upload avatar photo', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function uploadCover(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Validate size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Cover image file must be smaller than 5MB' });
    }

    const result = await userService.uploadCover(currentUserId, req.file.buffer);
    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to process and upload cover photo', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function follow(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const result = await userService.follow(currentUserId, targetUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to follow user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function unfollow(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const result = await userService.unfollow(currentUserId, targetUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to unfollow user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function getFollowStatus(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const result = await userService.getFollowStatus(currentUserId, targetUserId);
    res.json(result);
  } catch (err) {
    logger.error('Failed to query follow status', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function searchLocations(req: AuthenticatedRequest, res: Response) {
  const q = req.query.q || '';
  try {
    const result = await userService.searchLocations(String(q));
    res.json(result);
  } catch (err) {
    logger.error('Failed to search locations', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function searchLanguages(req: AuthenticatedRequest, res: Response) {
  const q = req.query.q || '';
  try {
    const result = await userService.searchLanguages(String(q));
    res.json(result);
  } catch (err) {
    logger.error('Failed to search languages', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function acceptFamilyRequest(req: AuthenticatedRequest, res: Response) {
  const currentUserId = req.user!.userId;
  const requestId = req.params.id;
  try {
    const result = await userService.acceptFamilyRequest(currentUserId, requestId);
    if (!result) {
      return res.status(404).json({ error: 'Request not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to accept family request', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
}


