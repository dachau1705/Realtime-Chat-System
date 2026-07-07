import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { upload } from '../helpers/upload.helper';
import { uploadToCloudinary, cloudinary } from '../helpers/cloudinary.helper';
import crypto from 'crypto';
import sharp from 'sharp';
import { logger } from '@libs/common';

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileId = crypto.randomUUID();

    // Optimize original image and convert to WebP in memory
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload optimized image buffer to Cloudinary
    const uploadResult = await uploadToCloudinary(optimizedBuffer, fileId, 'media');

    // Generate dynamic thumbnail URL using Cloudinary transformations
    const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true
    });

    res.status(200).json({
      url: uploadResult.secure_url,
      thumbnailUrl: thumbnailUrl
    });
  } catch (err) {
    logger.error('Failed to process and upload image to Cloudinary', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
