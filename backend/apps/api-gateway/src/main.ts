import express from 'express';
import { dbPool, logger } from '@libs/common';
import crypto from 'crypto';
import path from 'path';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';

// Modular Configurations, Middlewares, and Utilities
import { redisService, initKafka } from './config/services';
import { hashPassword, comparePassword } from './utils/crypto';
import { uploadToCloudinary, cloudinary } from './utils/cloudinary';
import { createNotification } from './utils/notification';
import { createRateLimiter } from './middleware/rate-limiter';
import { authenticateToken, AuthenticatedRequest } from './middleware/auth.middleware';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const PORT = parseInt(process.env.API_PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Initialize Kafka social events pipeline
initKafka();

const authLimiter = createRateLimiter(redisService, 15, 60);



const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed.'));
    }
  }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
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

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 1. User Registration (Public)
app.post('/api/users', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing username, email, or password' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await dbPool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );
    
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    logger.error('Failed to create user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2. User Login (Public)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const result = await dbPool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    logger.error('Failed to log in', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2.9. Search Users (Protected)
app.get('/api/search/users', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string') {
    return res.json([]);
  }
  const currentUserId = req.user!.userId;
  try {
    const result = await dbPool.query(
      `SELECT id, username, email, full_name, avatar_url 
       FROM users 
       WHERE (username ILIKE $1 OR email ILIKE $1 OR full_name ILIKE $1)
         AND id != $2
       LIMIT 10`,
      [`%${q}%`, currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to search users', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Fetch Users (Protected - Returns only accepted friends)
app.get('/api/users', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  try {
    const result = await dbPool.query(
      `SELECT u.id, u.username, u.email, u.created_at, u.full_name, u.avatar_url, u.bio
       FROM users u
       JOIN friendships f ON (f.user_id_1 = u.id OR f.user_id_2 = u.id)
       WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND f.status = 'accepted'
         AND u.id != $1
       ORDER BY u.username ASC`,
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch user friends list', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.1. Fetch User Profile by ID (Protected)
app.get('/api/users/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    // 1. Fetch user profile fields
    const userRes = await dbPool.query(
      `SELECT id, username, email, created_at, full_name, phone, avatar_url, cover_url, bio, privacy_is_public 
       FROM users WHERE id = $1`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];

    // 2. Fetch friendship status
    const friendshipRes = await dbPool.query(
      `SELECT * FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, targetUserId]
    );

    let friendshipStatus = 'none'; // 'none', 'friends', 'request_sent', 'request_received', 'self'
    
    if (currentUserId === targetUserId) {
      friendshipStatus = 'self';
    } else if (friendshipRes.rows.length > 0) {
      const friendship = friendshipRes.rows[0];
      if (friendship.status === 'accepted') {
        friendshipStatus = 'friends';
      } else if (friendship.status === 'pending') {
        if (friendship.user_id_1 === currentUserId) {
          friendshipStatus = 'request_sent';
        } else {
          friendshipStatus = 'request_received';
        }
      }
    }

    const isOwner = currentUserId === targetUserId;
    const isFriend = friendshipStatus === 'friends';
    const shouldRedact = !user.privacy_is_public && !isOwner && !isFriend;

    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      cover_url: user.cover_url,
      privacy_is_public: user.privacy_is_public,
      created_at: user.created_at,
      friendshipStatus,
      // Redacted properties if private and not friends/owner
      email: shouldRedact ? null : user.email,
      phone: shouldRedact ? null : user.phone,
      bio: shouldRedact ? null : user.bio,
      is_redacted: shouldRedact
    });
  } catch (err) {
    logger.error('Failed to fetch user profile details', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.2. Update User Profile details (Protected)
app.put('/api/users/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;
  const { full_name, phone, bio, privacy_is_public } = req.body;

  if (currentUserId !== targetUserId) {
    return res.status(403).json({ error: 'You can only edit your own profile' });
  }

  try {
    const result = await dbPool.query(
      `UPDATE users 
       SET full_name = $1, phone = $2, bio = $3, privacy_is_public = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, username, email, created_at, full_name, phone, avatar_url, cover_url, bio, privacy_is_public`,
      [full_name, phone, bio, privacy_is_public, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];

    // Broadcast profile update via Redis Pub/Sub
    try {
      await redisService.publish('chat:events', {
        type: 'profile_update',
        data: {
          userId: updatedUser.id,
          username: updatedUser.username,
          fullName: updatedUser.full_name,
          avatarUrl: updatedUser.avatar_url
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish profile_update to Redis', { error: (redisErr as Error).message });
    }

    res.json(updatedUser);
  } catch (err) {
    logger.error('Failed to update user profile details', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.3. Upload Profile Avatar (Protected)
app.post('/api/upload/avatar', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Validate size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Avatar image file must be smaller than 5MB' });
    }

    // Optimize and crop to 300x300px
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 300, height: 300, fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const fileId = `avatar_${currentUserId}`;
    const uploadResult = await uploadToCloudinary(optimizedBuffer, fileId, 'avatars');
    const avatarUrl = uploadResult.secure_url;

    // Save url
    const dbRes = await dbPool.query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING username, full_name',
      [avatarUrl, currentUserId]
    );

    const user = dbRes.rows[0];

    // Broadcast update
    try {
      await redisService.publish('chat:events', {
        type: 'profile_update',
        data: {
          userId: currentUserId,
          username: user.username,
          fullName: user.full_name,
          avatarUrl: avatarUrl
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish avatar update to Redis', { error: (redisErr as Error).message });
    }

    res.status(200).json({ avatarUrl });
  } catch (err) {
    logger.error('Failed to process and upload avatar', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.4. Upload Profile Cover Photo (Protected)
app.post('/api/upload/cover', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Validate size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Cover image file must be smaller than 5MB' });
    }

    // Optimize and crop to cover banner aspect ratio
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 450, fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const fileId = `cover_${currentUserId}`;
    const uploadResult = await uploadToCloudinary(optimizedBuffer, fileId, 'covers');
    const coverUrl = uploadResult.secure_url;

    // Save url
    await dbPool.query(
      'UPDATE users SET cover_url = $1, updated_at = NOW() WHERE id = $2',
      [coverUrl, currentUserId]
    );

    res.status(200).json({ coverUrl });
  } catch (err) {
    logger.error('Failed to process and upload cover photo', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.8. Fetch User Friends with Mutual indicator (Protected)
app.get('/api/users/:id/friends', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    // 1. Verify privacy permissions
    const userRes = await dbPool.query(
      'SELECT privacy_is_public FROM users WHERE id = $1',
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userRes.rows[0];

    // Check friendship status
    const friendshipRes = await dbPool.query(
      `SELECT status FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, targetUserId]
    );

    const isOwner = currentUserId === targetUserId;
    const isFriend = friendshipRes.rows.length > 0 && friendshipRes.rows[0].status === 'accepted';

    if (!targetUser.privacy_is_public && !isOwner && !isFriend) {
      return res.status(403).json({ error: 'This user\'s friend list is private' });
    }

    // 2. Fetch friends list and mark mutual status
    const result = await dbPool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.email,
              EXISTS (
                SELECT 1 FROM friendships mf
                WHERE ((mf.user_id_1 = u.id AND mf.user_id_2 = $2) OR (mf.user_id_1 = $2 AND mf.user_id_2 = u.id))
                  AND mf.status = 'accepted'
              ) as is_mutual
       FROM users u
       JOIN friendships f ON (f.user_id_1 = u.id OR f.user_id_2 = u.id)
       WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND f.status = 'accepted'
         AND u.id != $1
       ORDER BY u.username ASC`,
      [targetUserId, currentUserId]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch user friends list', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.5. Add/Accept Friend Request (Protected)
app.post('/api/friends', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { email } = req.body;
  const currentUserId = req.user!.userId;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // 1. Find user by email
    const userRes = await dbPool.query(
      'SELECT id, username FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User with this email not found' });
    }

    const targetUser = userRes.rows[0];
    const targetUserId = targetUser.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    // 2. Check if a relationship already exists
    const friendCheck = await dbPool.query(
      `SELECT * FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, targetUserId]
    );

    if (friendCheck.rows.length > 0) {
      const friendship = friendCheck.rows[0];
      if (friendship.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends with this user' });
      }

      // If pending, check original sender
      if (friendship.user_id_1 === currentUserId) {
        return res.status(400).json({ error: 'Friend request already sent and pending' });
      } else {
        // Target user sent a request to current user. Accept it!
        await dbPool.query(
          `UPDATE friendships 
           SET status = 'accepted', updated_at = NOW() 
           WHERE user_id_1 = $1 AND user_id_2 = $2`,
          [friendship.user_id_1, friendship.user_id_2]
        );

        // Notify target user that their request was accepted
        try {
          await redisService.publish('chat:events', {
            type: 'friend_accept',
            data: {
              receiverId: targetUserId,
              senderUsername: req.user!.username
            }
          });
        } catch (redisErr) {
          logger.error('Failed to publish friend_accept event to Redis', { error: (redisErr as Error).message });
        }

        return res.status(200).json({ 
          message: `You are now friends with ${targetUser.username}!`, 
          status: 'accepted'
        });
      }
    }

    // No existing relationship. Create a pending request
    await dbPool.query(
      `INSERT INTO friendships (user_id_1, user_id_2, status) 
       VALUES ($1, $2, 'pending')`,
      [currentUserId, targetUserId]
    );

    // Notify target user of incoming friend request
    try {
      await redisService.publish('chat:events', {
        type: 'friend_request',
        data: {
          receiverId: targetUserId,
          senderUsername: req.user!.username
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish friend_request event to Redis', { error: (redisErr as Error).message });
    }

    res.status(201).json({ 
      message: `Friend request sent to ${targetUser.username}`, 
      status: 'pending' 
    });
  } catch (err) {
    logger.error('Failed to process friend request', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.6. Fetch Pending Friend Requests (Protected)
app.get('/api/friends/requests', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  try {
    const result = await dbPool.query(
      `SELECT f.user_id_1 as sender_id, u.username as sender_username, u.email as sender_email, u.avatar_url as sender_avatar_url, f.created_at
       FROM friendships f
       JOIN users u ON f.user_id_1 = u.id
       WHERE f.user_id_2 = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch friend requests', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.7. Accept Friend Request (Protected)
app.post('/api/friends/accept', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { senderId } = req.body;
  const currentUserId = req.user!.userId;

  if (!senderId) {
    return res.status(400).json({ error: 'Sender ID is required' });
  }

  try {
    const result = await dbPool.query(
      `UPDATE friendships 
       SET status = 'accepted', updated_at = NOW() 
       WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'pending'
       RETURNING *`,
      [senderId, currentUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending friend request not found' });
    }

    // Notify original sender that their request was accepted!
    try {
      await redisService.publish('chat:events', {
        type: 'friend_accept',
        data: {
          receiverId: senderId,
          senderUsername: req.user!.username
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish friend_accept event to Redis', { error: (redisErr as Error).message });
    }

    res.json({ message: 'Friend request accepted successfully' });
  } catch (err) {
    logger.error('Failed to accept friend request', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3.8. Decline Friend Request (Protected)
app.post('/api/friends/decline', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { senderId } = req.body;
  const currentUserId = req.user!.userId;

  if (!senderId) {
    return res.status(400).json({ error: 'Sender ID is required' });
  }

  try {
    const result = await dbPool.query(
      `DELETE FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [senderId, currentUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Friend request relationship not found' });
    }

    res.json({ message: 'Friend request declined successfully' });
  } catch (err) {
    logger.error('Failed to decline friend request', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 4. Fetch User's Conversations (Protected)
app.get('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  try {
    const result = await dbPool.query(
      `SELECT c.id, c.name, c.is_group, c.created_at,
              COALESCE(array_agg(u.username) FILTER (WHERE u.id != $1), '{}') as member_usernames,
              COALESCE(array_agg(u.id) FILTER (WHERE u.id != $1), '{}') as member_ids,
              COALESCE(array_agg(u.avatar_url) FILTER (WHERE u.id != $1), '{}') as member_avatar_urls,
              COALESCE(array_agg(u.full_name) FILTER (WHERE u.id != $1), '{}') as member_full_names
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       JOIN users u ON cm.user_id = u.id
       WHERE c.id IN (
         SELECT conversation_id FROM conversation_members WHERE user_id = $1
       )
       GROUP BY c.id, c.name, c.is_group, c.created_at`,
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch user conversations', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 5. Create Conversation (Protected)
app.post('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { name, isGroup, memberIds } = req.body;
  const currentUserId = req.user!.userId;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds array is required' });
  }

  // Ensure the current user is added to the conversation members
  const uniqueMemberIds = Array.from(new Set([...memberIds, currentUserId]));

  // Deduplicate: If it's a 1-1 conversation, check if one already exists
  if (!isGroup && uniqueMemberIds.length === 2) {
    try {
      const existCheck = await dbPool.query(
        `SELECT c.id, c.name, c.is_group, c.created_at FROM conversations c
         JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
         JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
         WHERE c.is_group = false LIMIT 1`,
        [uniqueMemberIds[0], uniqueMemberIds[1]]
      );
      if (existCheck.rows.length > 0) {
        return res.status(200).json({ ...existCheck.rows[0], memberIds: uniqueMemberIds });
      }
    } catch (err) {
      logger.error('Failed to check existing conversation', { error: (err as Error).message });
    }
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    // Create conversation record
    const convRes = await client.query(
      `INSERT INTO conversations (name, is_group)
       VALUES ($1, $2)
       RETURNING id, name, is_group, created_at`,
      [name || null, !!isGroup]
    );
    const conversation = convRes.rows[0];

    // Insert memberships
    for (const userId of uniqueMemberIds) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2)`,
        [conversation.id, userId]
      );
    }

    await client.query('COMMIT');

    // Publish new conversation event to Redis Pub/Sub
    try {
      const memberUsersRes = await dbPool.query(
        'SELECT id, username FROM users WHERE id = ANY($1)',
        [uniqueMemberIds]
      );

      await redisService.publish('chat:events', {
        type: 'new_conversation',
        data: {
          id: conversation.id,
          name: conversation.name,
          is_group: conversation.is_group,
          created_at: conversation.created_at,
          memberIds: uniqueMemberIds,
          members: memberUsersRes.rows
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish new_conversation event to Redis', { error: (redisErr as Error).message });
    }

    res.status(201).json({ ...conversation, memberIds: uniqueMemberIds });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to create conversation', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// 5. Fetch Conversation Messages (Protected & Authorized)
app.get('/api/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const conversationId = req.params.id;
  const currentUserId = req.user!.userId;
  const limit = parseInt(req.query.limit as string || '50', 10);
  const before = req.query.before as string;
  const beforeId = req.query.beforeId as string;

  try {
    // Authorization check: Verify that the current user is a member of the conversation
    const membershipCheck = await dbPool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, currentUserId]
    );
    
    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to view messages in this conversation' });
    }

    let query = `
      SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar_url, u.full_name as sender_full_name 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const params: any[] = [conversationId];

    if (before && beforeId) {
      query += ` AND (m.created_at < $2 OR (m.created_at = $2 AND m.id < $3))`;
      params.push(new Date(before), beforeId);
    } else if (before) {
      query += ` AND m.created_at < $2`;
      params.push(new Date(before));
    }

    query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await dbPool.query(query, params);
    
    // Return chronological order (reverse our DESC fetch)
    res.json(result.rows.reverse());
  } catch (err) {
    logger.error('Failed to fetch messages', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 6. Database Seeding endpoint (Public, returns JWT tokens for tests)
app.post('/api/seed', async (req, res) => {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const hashedPassword = await hashPassword('password');
    
    const user1Res = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('alice', 'alice@example.com', $1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [hashedPassword]
    );
    const alice = user1Res.rows[0];

    const user2Res = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('bob', 'bob@example.com', $1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [hashedPassword]
    );
    const bob = user2Res.rows[0];

    // Check if a direct 1-1 conversation already exists
    const existCheck = await client.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
       WHERE c.is_group = false LIMIT 1`,
      [alice.id, bob.id]
    );

    let conversationId;
    if (existCheck.rows.length > 0) {
      conversationId = existCheck.rows[0].id;
    } else {
      const convRes = await client.query(
        `INSERT INTO conversations (name, is_group)
         VALUES ($1, false)
         RETURNING id`,
        ['Alice and Bob']
      );
      conversationId = convRes.rows[0].id;
      
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversationId, alice.id, bob.id]
      );
    }

    await client.query('COMMIT');

    const aliceToken = jwt.sign(
      { userId: alice.id, username: alice.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const bobToken = jwt.sign(
      { userId: bob.id, username: bob.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      alice,
      aliceToken,
      bob,
      bobToken,
      conversationId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to seed DB', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  } finally {
    client.release();
  }
});

// Helper to distribute post to followers (Hybrid Fan-out on Write)
async function pushPostToFollowers(userId: string, postId: string, timestamp: number, post: any, user: any) {
  try {
    const client = redisService.getClient();
    
    // 1. Save detailed post cache (JSON format, 24 hour TTL)
    const postDetails = {
      ...post,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      comment_count: 0,
      reaction_count: 0,
      has_reacted: false,
      reaction_type: null
    };
    await client.set(`post:${postId}`, JSON.stringify(postDetails), 'EX', 24 * 3600);

    // 2. Add to user's own feed Sorted Set
    const ownFeedKey = `feed:user:${userId}`;
    await client.zadd(ownFeedKey, timestamp, postId);
    await client.zremrangebyrank(ownFeedKey, 0, -501);

    // 3. Get followers and friends list
    const relationsRes = await dbPool.query(
      `SELECT follower_id AS user_id FROM follows WHERE following_id = $1
       UNION
       SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
      [userId]
    );

    const followersCount = relationsRes.rows.length;

    if (followersCount > 100) {
      // VIP/Celebrity: Do not push to individual feeds. Save to celebrity posts set.
      const celebrityKey = `celebrity_posts:${userId}`;
      await client.zadd(celebrityKey, timestamp, postId);
      await client.zremrangebyrank(celebrityKey, 0, -101); // Keep last 100
      await client.expire(celebrityKey, 7 * 24 * 3600); // 7 days TTL

      // Broadcast realtime notification to followers online asynchronously
      setTimeout(async () => {
        for (const row of relationsRes.rows) {
          const followerId = row.user_id;
          await redisService.publish('chat:events', {
            type: 'new_feed_item',
            data: { followerId, post: postDetails }
          });
        }
      }, 0);
    } else {
      // Standard User: Fan-out on Write to all active followers' caches
      for (const row of relationsRes.rows) {
        const followerId = row.user_id;
        const key = `feed:user:${followerId}`;
        
        // Push only if the cache currently exists in Redis
        const cacheExists = await client.exists(key);
        if (cacheExists) {
          await client.zadd(key, timestamp, postId);
          await client.zremrangebyrank(key, 0, -501);
        }

        // Publish realtime notification via Redis Pub/Sub
        await redisService.publish('chat:events', {
          type: 'new_feed_item',
          data: { followerId, post: postDetails }
        });
      }
    }
  } catch (err) {
    logger.error('Failed to execute hybrid fan-out for post', { userId, postId, error: (err as Error).message });
  }
}

// Helper to remove post from feeds on deletion
async function removePostFromFeeds(userId: string, postId: string) {
  try {
    const client = redisService.getClient();
    await client.del(`post:${postId}`);
    await client.zrem(`feed:user:${userId}`, postId);
    await client.zrem(`celebrity_posts:${userId}`, postId);

    const relationsRes = await dbPool.query(
      `SELECT follower_id AS user_id FROM follows WHERE following_id = $1
       UNION
       SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
      [userId]
    );

    for (const row of relationsRes.rows) {
      await client.zrem(`feed:user:${row.user_id}`, postId);
    }
  } catch (err) {
    logger.error('Failed to remove post from feeds', { userId, postId, error: (err as Error).message });
  }
}

// 1. Create a Post
app.post('/api/posts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { content, media_urls = [] } = req.body;
  const userId = req.user!.userId;

  if (!content && (!media_urls || media_urls.length === 0)) {
    return res.status(400).json({ error: 'Post must contain text content or media' });
  }

  try {
    const result = await dbPool.query(
      `INSERT INTO posts (user_id, content, media_urls)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, content || null, media_urls]
    );

    const post = result.rows[0];

    // Fetch user details
    const userRes = await dbPool.query('SELECT username, full_name, avatar_url FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    // Run Hybrid Fan-out distribution
    const timestamp = new Date(post.created_at).getTime();
    await pushPostToFollowers(userId, post.id, timestamp, post, user);

    res.status(201).json({
      ...post,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      comment_count: 0,
      reaction_count: 0,
      has_reacted: false,
      reaction_type: null
    });
  } catch (err) {
    logger.error('Failed to create post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2. Fetch Aggregated News Feed
app.get('/api/feed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const limit = parseInt(req.query.limit as string || '20', 10);
  const before = req.query.before as string; // Timestamp ISO string

  try {
    const redisClient = redisService.getClient();
    const cacheKey = `feed:user:${currentUserId}`;

    // 1. Get friend and following user IDs + currentUserId
    const userIdsRes = await dbPool.query(
      `SELECT following_id AS user_id FROM follows WHERE follower_id = $1
       UNION
       SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'
       UNION
       SELECT $1 AS user_id`,
      [currentUserId]
    );
    const userIds = userIdsRes.rows.map(r => r.user_id);

    // 2. Check if cache exists. If not, rebuild it (Fan-out on Read backfill)
    const cacheExists = await redisClient.exists(cacheKey);
    if (!cacheExists && userIds.length > 0) {
      const buildRes = await dbPool.query(
        `SELECT id, created_at FROM posts 
         WHERE user_id = ANY($1) 
         ORDER BY created_at DESC LIMIT 200`,
        [userIds]
      );
      
      if (buildRes.rows.length > 0) {
        const pipeline = redisClient.pipeline();
        for (const row of buildRes.rows) {
          pipeline.zadd(cacheKey, new Date(row.created_at).getTime(), row.id);
        }
        pipeline.expire(cacheKey, 24 * 3600); // Cache warm for 24h
        await pipeline.exec();
      }
    }

    // 3. Query post IDs from Sorted Set
    const maxScore = before ? new Date(before).getTime() - 1 : '+inf';
    const standardPostIds = await redisClient.zrevrangebyscore(
      cacheKey,
      maxScore,
      '-inf',
      'LIMIT',
      0,
      limit
    );

    // 4. Fetch VIPs (celebrities) whom we follow
    // In our simplified test setup, any following user with > 100 followers is a VIP
    const vipFollowingsRes = await dbPool.query(
      `SELECT following_id FROM follows 
       WHERE follower_id = $1 AND following_id IN (
         SELECT following_id FROM follows GROUP BY following_id HAVING COUNT(*) > 100
       )`,
      [currentUserId]
    );
    const vipIds = vipFollowingsRes.rows.map(r => r.following_id);

    // Fetch VIP post IDs from their celebrity cache
    let vipPostIds: string[] = [];
    for (const vipId of vipIds) {
      const vipPosts = await redisClient.zrevrangebyscore(
        `celebrity_posts:${vipId}`,
        maxScore,
        '-inf',
        'LIMIT',
        0,
        limit
      );
      vipPostIds = [...vipPostIds, ...vipPosts];
    }

    // 5. Merge standard posts and celebrity posts, then deduplicate
    const allPostIds = Array.from(new Set([...standardPostIds, ...vipPostIds]));

    if (allPostIds.length === 0) {
      return res.json([]);
    }

    // Helper to get detailed post details (with Redis caching)
    const getPostDetails = async (postId: string) => {
      const cached = await redisClient.get(`post:${postId}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const dbRes = await dbPool.query(
        `SELECT p.*, u.username, u.full_name, u.avatar_url,
                (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
                (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) AS reaction_count
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [postId]
      );
      
      if (dbRes.rows.length === 0) return null;
      const details = dbRes.rows[0];
      // Cache post details for 24h
      await redisClient.set(`post:${postId}`, JSON.stringify(details), 'EX', 24 * 3600);
      return details;
    };

    // Hydrate all posts details in parallel
    const postDetailsPromises = allPostIds.map(id => getPostDetails(id));
    const rawPosts = (await Promise.all(postDetailsPromises)).filter(p => p !== null);

    // Get current user reactions for these posts in one query
    const postIdsToQuery = rawPosts.map(p => p.id);
    const userReactions: Record<string, string | null> = {};
    if (postIdsToQuery.length > 0) {
      const reactionsRes = await dbPool.query(
        `SELECT post_id, type FROM reactions WHERE user_id = $1 AND post_id = ANY($2)`,
        [currentUserId, postIdsToQuery]
      );
      for (const row of reactionsRes.rows) {
        userReactions[row.post_id] = row.type;
      }
    }

    const posts = rawPosts.map(p => ({
      ...p,
      has_reacted: !!userReactions[p.id],
      reaction_type: userReactions[p.id] || null
    }));

    // 6. Rank posts using basic EdgeRank sorting formula: Score = (Affinity * Weight) / Decay
    const now = Date.now();
    const rankedPosts = posts.map(post => {
      const createdTime = new Date(post.created_at).getTime();
      const hoursSinceCreated = (now - createdTime) / (1000 * 3600);
      
      const affinity = post.user_id === currentUserId ? 1.2 : 1.0;
      const weight = (post.reaction_count * 1) + (post.comment_count * 3) + 1;
      const decay = Math.pow(hoursSinceCreated + 2, 1.5);
      const score = (affinity * weight) / decay;
      
      return { post, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.post);

    res.json(rankedPosts);
  } catch (err) {
    logger.error('Failed to load news feed', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Fetch Single Post Detail
app.get('/api/posts/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;

  try {
    const postRes = await dbPool.query(
      `SELECT p.*, u.username, u.full_name, u.avatar_url,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
              EXISTS (SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS has_reacted,
              (SELECT type FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS reaction_type
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $2`,
      [currentUserId, postId]
    );

    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(postRes.rows[0]);
  } catch (err) {
    logger.error('Failed to fetch post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 4. Update Post
app.put('/api/posts/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;
  const { content, media_urls } = req.body;

  try {
    const postCheck = await dbPool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postCheck.rows[0].user_id !== currentUserId) {
      return res.status(403).json({ error: 'You are not authorized to edit this post' });
    }

    const result = await dbPool.query(
      `UPDATE posts 
       SET content = $1, media_urls = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [content || null, media_urls || '{}', postId]
    );

    // Delete post details cache to force refresh
    await redisService.getClient().del(`post:${postId}`);
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to update post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 5. Delete Post
app.delete('/api/posts/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;

  try {
    const postCheck = await dbPool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postCheck.rows[0].user_id !== currentUserId) {
      return res.status(403).json({ error: 'You are not authorized to delete this post' });
    }

    await dbPool.query('DELETE FROM posts WHERE id = $1', [postId]);

    await removePostFromFeeds(currentUserId, postId);
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 6. Fetch Posts by User
app.get('/api/users/:id/posts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    // Check target profile privacy
    const userRes = await dbPool.query('SELECT privacy_is_public FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    const isOwner = currentUserId === targetUserId;

    // Check friendship status
    const friendshipRes = await dbPool.query(
      `SELECT status FROM friendships 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, targetUserId]
    );
    const isFriend = friendshipRes.rows.length > 0 && friendshipRes.rows[0].status === 'accepted';

    // If profile is private and we're not friends/owner, hide posts
    if (!user.privacy_is_public && !isOwner && !isFriend) {
      return res.json([]); // Return empty list
    }

    const postsRes = await dbPool.query(
      `SELECT p.*, u.username, u.full_name, u.avatar_url,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT COUNT(*)::int FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
              EXISTS (SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS has_reacted,
              (SELECT type FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS reaction_type
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $2
       ORDER BY p.created_at DESC`,
      [currentUserId, targetUserId]
    );

    res.json(postsRes.rows);
  } catch (err) {
    logger.error('Failed to fetch user posts', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 7. React/Toggle Reaction on a Post
app.post('/api/posts/:id/react', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;
  const { type = 'like' } = req.body; 

  try {
    const postRes = await dbPool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const postOwnerId = postRes.rows[0].user_id;

    if (!type) {
      // Remove reaction
      await dbPool.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2', [postId, currentUserId]);
    } else {
      // Upsert reaction
      await dbPool.query(
        `INSERT INTO reactions (post_id, user_id, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (post_id, user_id) 
         DO UPDATE SET type = EXCLUDED.type`,
        [postId, currentUserId, type]
      );

      // Trigger Notification
      if (postOwnerId !== currentUserId) {
        await createNotification(postOwnerId, currentUserId, 'like', postId, null);
      }
    }

    const countsRes = await dbPool.query(
      `SELECT COUNT(*)::int as count,
              EXISTS (SELECT 1 FROM reactions WHERE post_id = $1 AND user_id = $2) as has_reacted,
              (SELECT type FROM reactions WHERE post_id = $1 AND user_id = $2) as reaction_type
       FROM reactions WHERE post_id = $1`,
      [postId, currentUserId]
    );

    // Clear cached post details to sync count
    await redisService.getClient().del(`post:${postId}`);

    // Broadcast reaction count update in real-time
    try {
      await redisService.publish('chat:events', {
        type: 'update_reaction',
        data: {
          postId,
          reactionCount: countsRes.rows[0].count
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish update_reaction to Redis', { error: (redisErr as Error).message });
    }

    res.json({
      postId,
      reaction_count: countsRes.rows[0].count,
      has_reacted: countsRes.rows[0].has_reacted,
      reaction_type: countsRes.rows[0].reaction_type
    });
  } catch (err) {
    logger.error('Failed to react to post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 8. Add a Comment to a Post
app.post('/api/posts/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const postId = req.params.id;
  const { content, parent_id = null } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const postRes = await dbPool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const postOwnerId = postRes.rows[0].user_id;

    const result = await dbPool.query(
      `INSERT INTO comments (post_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, currentUserId, content.trim(), parent_id]
    );

    const comment = result.rows[0];

    // Trigger Notification
    if (postOwnerId !== currentUserId) {
      await createNotification(postOwnerId, currentUserId, 'comment', postId, comment.id);
    }

    // Fetch user details for the comment
    const userRes = await dbPool.query('SELECT username, full_name, avatar_url FROM users WHERE id = $1', [currentUserId]);
    const user = userRes.rows[0];

    // Clear cached post details to sync count
    await redisService.getClient().del(`post:${postId}`);

    // Broadcast new comment in real-time
    try {
      await redisService.publish('chat:events', {
        type: 'new_comment',
        data: {
          comment: {
            id: comment.id,
            post_id: postId,
            user_id: currentUserId,
            content: comment.content,
            created_at: comment.created_at,
            username: user.username,
            avatar_url: user.avatar_url
          }
        }
      });
    } catch (redisErr) {
      logger.error('Failed to publish new_comment to Redis', { error: (redisErr as Error).message });
    }

    res.status(201).json({
      ...comment,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url
    });
  } catch (err) {
    logger.error('Failed to comment on post', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 9. Fetch Comments for a Post
app.get('/api/posts/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const postId = req.params.id;

  try {
    const result = await dbPool.query(
      `SELECT c.*, u.username, u.full_name, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch comments', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 10. Follow a User
app.post('/api/users/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  if (currentUserId === targetUserId) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  try {
    await dbPool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [currentUserId, targetUserId]
    );

    await createNotification(targetUserId, currentUserId, 'follow', null, null);
    
    // Invalidate cache
    await redisService.getClient().del(`feed:user:${currentUserId}`);

    res.json({ message: 'Successfully followed user', is_following: true });
  } catch (err) {
    logger.error('Failed to follow user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 11. Unfollow a User
app.post('/api/users/:id/unfollow', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    await dbPool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUserId, targetUserId]
    );

    // Invalidate cache
    await redisService.getClient().del(`feed:user:${currentUserId}`);

    res.json({ message: 'Successfully unfollowed user', is_following: false });
  } catch (err) {
    logger.error('Failed to unfollow user', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 12. Query Follower/Following Status
app.get('/api/users/:id/follow-status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const targetUserId = req.params.id;

  try {
    const followRes = await dbPool.query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUserId, targetUserId]
    );

    const followerRes = await dbPool.query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [targetUserId, currentUserId]
    );

    res.json({
      is_following: followRes.rows.length > 0,
      is_follower: followerRes.rows.length > 0
    });
  } catch (err) {
    logger.error('Failed to query follow status', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 13. Friend / Follow Suggestions (ranked by mutual friends)
app.get('/api/friends/suggestions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;

  try {
    const result = await dbPool.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url,
             (
               SELECT COUNT(*)::int FROM friendships f1
               JOIN friendships f2 ON (
                 (((f1.user_id_1 = $1 AND f1.user_id_2 = f2.user_id_1) OR (f1.user_id_2 = $1 AND f1.user_id_1 = f2.user_id_1) OR
                  (f1.user_id_1 = $1 AND f1.user_id_2 = f2.user_id_2) OR (f1.user_id_2 = $1 AND f1.user_id_1 = f2.user_id_2))
                 AND (f2.user_id_1 = u.id OR f2.user_id_2 = u.id))
               )
               WHERE f1.status = 'accepted' AND f2.status = 'accepted'
                 AND f1.user_id_1 != u.id AND f1.user_id_2 != u.id
                 AND f2.user_id_1 != $1 AND f2.user_id_2 != $1
             ) AS mutual_friends_count
      FROM users u
      WHERE u.id != $1
        -- Exclude accepted friends
        AND NOT EXISTS (
          SELECT 1 FROM friendships f
          WHERE ((f.user_id_1 = $1 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = $1))
            AND f.status = 'accepted'
        )
        -- Exclude already followed users
        AND NOT EXISTS (
          SELECT 1 FROM follows fol
          WHERE fol.follower_id = $1 AND fol.following_id = u.id
        )
      ORDER BY mutual_friends_count DESC, u.username ASC
      LIMIT 10`,
      [currentUserId]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to load friend suggestions', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 14. Fetch Notifications
app.get('/api/notifications', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;

  try {
    const result = await dbPool.query(
      `SELECT n.*, u.username as actor_username, u.full_name as actor_full_name, u.avatar_url as actor_avatar_url
       FROM notifications n
       JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [currentUserId]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to load notifications', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 15. Mark Notifications as Read
app.post('/api/notifications/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;
  const { notificationId } = req.body;

  try {
    if (notificationId) {
      await dbPool.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND id = $2',
        [currentUserId, notificationId]
      );
    } else {
      await dbPool.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
        [currentUserId]
      );
    }

    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    logger.error('Failed to mark notifications read', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 16. Create a Story (Protected, expires in 24 hours)
app.post('/api/stories', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { media_url } = req.body;
  const currentUserId = req.user!.userId;

  if (!media_url) {
    return res.status(400).json({ error: 'Media URL is required to publish a story' });
  }

  try {
    const result = await dbPool.query(
      `INSERT INTO stories (user_id, media_url, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [currentUserId, media_url]
    );

    const story = result.rows[0];
    
    // Fetch author details
    const userRes = await dbPool.query('SELECT username, avatar_url FROM users WHERE id = $1', [currentUserId]);
    const user = userRes.rows[0];

    res.status(201).json({
      ...story,
      username: user.username,
      avatar_url: user.avatar_url
    });
  } catch (err) {
    logger.error('Failed to create story', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// 17. Fetch Active Stories (Protected)
app.get('/api/stories', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.userId;

  try {
    // 1. Get friend and following user IDs + currentUserId
    const userIdsRes = await dbPool.query(
      `SELECT following_id AS user_id FROM follows WHERE follower_id = $1
       UNION
       SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS user_id 
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'
       UNION
       SELECT $1 AS user_id`,
      [currentUserId]
    );
    const userIds = userIdsRes.rows.map(r => r.user_id);

    // 2. Fetch active stories where expires_at is greater than current time
    const result = await dbPool.query(
      `SELECT s.id, s.user_id, s.media_url as thumbnail_url, s.created_at, u.username, u.avatar_url as user_avatar
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ANY($1) AND s.expires_at > NOW()
       ORDER BY s.created_at DESC`,
      [userIds]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch active stories', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

// Mount modular routers
import mainRouter from './routes';
app.use(mainRouter);

// Serve SPA index.html for any frontend client-side router path (e.g. /profile/:id)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  logger.info(`API Gateway REST server running on port ${PORT}`);
});
