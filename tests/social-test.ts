import { io as ioClient, Socket } from 'socket.io-client';
import { logger } from '@libs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3001';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSocialTest() {
  logger.info('Starting E2E Social Platform Integration Test...');

  // Generate unique usernames to allow running the test multiple times cleanly
  const suffix = Math.floor(Math.random() * 10000);
  const aliceUsername = `alice_${suffix}`;
  const bobUsername = `bob_${suffix}`;
  const emailAlice = `alice_${suffix}@test.com`;
  const emailBob = `bob_${suffix}@test.com`;
  const password = 'Password123!';

  // 1. Register Alice and Bob
  logger.info(`Registering Alice (${aliceUsername}) and Bob (${bobUsername})...`);
  const aliceRegRes = await axios.post(`${API_URL}/api/users`, {
    username: aliceUsername,
    email: emailAlice,
    password
  });
  const aliceId = aliceRegRes.data.user.id;
  logger.info(`Alice registered successfully with ID: ${aliceId}`);

  const bobRegRes = await axios.post(`${API_URL}/api/users`, {
    username: bobUsername,
    email: emailBob,
    password
  });
  const bobId = bobRegRes.data.user.id;
  logger.info(`Bob registered successfully with ID: ${bobId}`);

  // 2. Login to get JWT tokens
  logger.info('Logging in to retrieve JWT tokens...');
  const aliceLoginRes = await axios.post(`${API_URL}/api/auth/login`, {
    username: aliceUsername,
    password
  });
  const aliceToken = aliceLoginRes.data.token;

  const bobLoginRes = await axios.post(`${API_URL}/api/auth/login`, {
    username: bobUsername,
    password
  });
  const bobToken = bobLoginRes.data.token;

  const aliceHeaders = { Authorization: `Bearer ${aliceToken}` };
  const bobHeaders = { Authorization: `Bearer ${bobToken}` };

  // 3. Connect WebSockets for both users
  logger.info('Connecting WebSockets for Alice and Bob...');
  const aliceSocket = ioClient(WS_URL, {
    query: { token: aliceToken },
    transports: ['websocket']
  });

  const bobSocket = ioClient(WS_URL, {
    query: { token: bobToken },
    transports: ['websocket']
  });

  const aliceNotifications: any[] = [];
  const bobNotifications: any[] = [];

  aliceSocket.on('notification', (notif) => {
    logger.info('[WS Notification] Alice received:', notif);
    aliceNotifications.push(notif);
  });

  bobSocket.on('notification', (notif) => {
    logger.info('[WS Notification] Bob received:', notif);
    bobNotifications.push(notif);
  });

  await delay(1000); // Wait for sockets to connect

  // 4. Test Follow & WS Notification
  logger.info('--- Testing Follow System & Follow WS Notifications ---');
  logger.info('Alice follows Bob...');
  const followRes = await axios.post(`${API_URL}/api/users/${bobId}/follow`, {}, { headers: aliceHeaders });
  logger.info('Follow response:', followRes.data);

  await delay(1500); // Wait for Worker service and WebSocket delivery

  // 4.5. Test Media Upload to Cloudinary
  logger.info('--- Testing Media Upload to Cloudinary ---');
  const FormData = require('form-data');
  const form = new FormData();
  const dummyImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  form.append('file', dummyImageBuffer, {
    filename: 'test_image.png',
    contentType: 'image/png'
  });

  const uploadRes = await axios.post(`${API_URL}/api/upload`, form, {
    headers: {
      ...aliceHeaders,
      ...form.getHeaders()
    }
  });
  logger.info('Upload response:', uploadRes.data);
  if (!uploadRes.data.url.startsWith('https://res.cloudinary.com/')) {
    throw new Error(`Expected Cloudinary URL starting with https://res.cloudinary.com/, got: ${uploadRes.data.url}`);
  }
  if (!uploadRes.data.thumbnailUrl.startsWith('https://res.cloudinary.com/')) {
    throw new Error(`Expected Cloudinary thumbnail URL, got: ${uploadRes.data.thumbnailUrl}`);
  }
  logger.info('Successfully verified Cloudinary upload integration.');

  // 5. Test Post Creation
  logger.info('--- Testing Post Creation ---');
  logger.info('Bob creates a new post...');
  const postRes = await axios.post(`${API_URL}/api/posts`, {
    content: 'Hello social world! Checking out my new feed system.',
    mediaUrls: [uploadRes.data.url]
  }, { headers: bobHeaders });
  const post = postRes.data;
  logger.info('Post created successfully:', post);

  // 6. Test Feed Retrieval (Alice following Bob)
  logger.info('--- Testing Feed Retrieval ---');
  logger.info('Alice retrieves her feed...');
  const feedRes = await axios.get(`${API_URL}/api/feed`, { headers: aliceHeaders });
  logger.info(`Alice's feed items count: ${feedRes.data.length}`);
  const postInFeed = feedRes.data.find((p: any) => p.id === post.id);
  if (!postInFeed) {
    throw new Error('Bob\'s post was not found in Alice\'s feed!');
  }
  logger.info('Successfully verified Bob\'s post is present in Alice\'s feed.');

  // 7. Test Reactions & WS Notification
  logger.info('--- Testing Reactions & Reaction WS Notifications ---');
  logger.info('Alice reacts/likes Bob\'s post...');
  const reactRes = await axios.post(`${API_URL}/api/posts/${post.id}/react`, { type: 'like' }, { headers: aliceHeaders });
  logger.info('React response:', reactRes.data);

  await delay(1500); // Wait for WS notification

  // 8. Test Comments & WS Notification
  logger.info('--- Testing Comments & Comment WS Notifications ---');
  logger.info('Alice comments on Bob\'s post...');
  const commentRes = await axios.post(`${API_URL}/api/posts/${post.id}/comments`, {
    content: 'Wow Bob, looks fantastic!'
  }, { headers: aliceHeaders });
  logger.info('Comment response:', commentRes.data);

  await delay(1500); // Wait for WS notification

  // 9. Fetch and Verify Bob's Notifications
  logger.info('--- Testing Notification Retrieval & Verification ---');
  const bobNotifRes = await axios.get(`${API_URL}/api/notifications`, { headers: bobHeaders });
  const bobDbNotifications = bobNotifRes.data;
  logger.info('Bob\'s notifications in DB:', bobDbNotifications);

  const followNotif = bobDbNotifications.find((n: any) => n.type === 'follow');
  const likeNotif = bobDbNotifications.find((n: any) => n.type === 'like');
  const commentNotif = bobDbNotifications.find((n: any) => n.type === 'comment');

  logger.info('Assertion Checks:');
  logger.info(`- Follow Notification exists in DB: ${!!followNotif}`);
  logger.info(`- Like Notification exists in DB: ${!!likeNotif}`);
  logger.info(`- Comment Notification exists in DB: ${!!commentNotif}`);
  
  logger.info(`- Bob received Follow WS notification: ${bobNotifications.some(n => n.type === 'follow')}`);
  logger.info(`- Bob received Like WS notification: ${bobNotifications.some(n => n.type === 'like')}`);
  logger.info(`- Bob received Comment WS notification: ${bobNotifications.some(n => n.type === 'comment')}`);

  // 10. Mark Notifications as Read
  logger.info('--- Testing Mark Notifications as Read ---');
  const markReadRes = await axios.post(`${API_URL}/api/notifications/read`, {}, { headers: bobHeaders });
  logger.info('Mark read response:', markReadRes.data);

  const bobNotifAfterRes = await axios.get(`${API_URL}/api/notifications`, { headers: bobHeaders });
  const allRead = bobNotifAfterRes.data.every((n: any) => n.is_read === true);
  logger.info(`All notifications read state verified: ${allRead}`);

  // Cleanup connections
  aliceSocket.disconnect();
  bobSocket.disconnect();

  if (!followNotif || !likeNotif || !commentNotif) {
    throw new Error('E2E integration test failed: DB notifications missing!');
  }
  if (bobNotifications.length < 3) {
    throw new Error(`E2E integration test failed: Expected at least 3 WS notifications, got ${bobNotifications.length}`);
  }

  logger.info('=====================================================');
  logger.info('SUCCESS: E2E SOCIAL PLATFORM INTEGRATION TEST PASSED!');
  logger.info('=====================================================');
}

runSocialTest().catch((err) => {
  logger.error('Social integration test failed with error:', err.message);
  process.exit(1);
});
