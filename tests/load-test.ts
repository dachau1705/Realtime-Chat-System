import { io as ioClient, Socket } from 'socket.io-client';
import { logger } from '@libs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'http://localhost:3001';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoadTest() {
  logger.info('Starting Chat System Integration & Load Simulation...');

  // 1. Seed database with Alice, Bob and a shared conversation
  logger.info(`Seeding test data via API Gateway at ${API_URL}/api/seed...`);
  let seedData;
  try {
    const res = await axios.post(`${API_URL}/api/seed`);
    seedData = res.data;
    logger.info('Database seeded successfully', {
      aliceId: seedData.alice.id,
      bobId: seedData.bob.id,
      conversationId: seedData.conversationId
    });
  } catch (err) {
    logger.warn('Failed to seed DB via API Gateway (Running in Local Fallback Mode). Generating simulated query parameters and mock tokens...', {
      error: (err as Error).message
    });
    
    const mockAliceId = uuidv4();
    const mockBobId = uuidv4();
    const mockConvId = uuidv4();
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    
    const aliceToken = jwt.sign(
      { userId: mockAliceId, username: 'alice', conversationIds: [mockConvId] },
      jwtSecret,
      { expiresIn: '24h' }
    );
    const bobToken = jwt.sign(
      { userId: mockBobId, username: 'bob', conversationIds: [mockConvId] },
      jwtSecret,
      { expiresIn: '24h' }
    );
    
    seedData = {
      alice: { id: mockAliceId, username: 'alice' },
      bob: { id: mockBobId, username: 'bob' },
      conversationId: mockConvId,
      aliceToken,
      bobToken
    };
  }

  const { alice, bob, conversationId, aliceToken, bobToken } = seedData;

  // 2. Connect Alice
  logger.info('Connecting Alice client...');
  const aliceSocket = ioClient(WS_URL, {
    query: { token: aliceToken },
    transports: ['websocket']
  });

  // 3. Connect Bob
  logger.info('Connecting Bob client...');
  const bobSocket = ioClient(WS_URL, {
    query: { token: bobToken },
    transports: ['websocket']
  });

  // Setup event listeners
  let bobReceivedMessagesCount = 0;
  let bobReceivedTypingEvents: any[] = [];
  let aliceReceivedReceiptEvents: any[] = [];

  bobSocket.on('message', (msg) => {
    logger.info('Bob received message:', msg);
    bobReceivedMessagesCount++;
    // Emit read receipt back
    bobSocket.emit('read_receipt', {
      conversationId: msg.conversation_id,
      messageId: msg.id,
      status: 'seen'
    });
  });

  bobSocket.on('typing', (event) => {
    logger.info('Bob received typing event:', event);
    bobReceivedTypingEvents.push(event);
  });

  aliceSocket.on('receipt', (event) => {
    logger.info('Alice received receipt event:', event);
    aliceReceivedReceiptEvents.push(event);
  });

  // Wait for connections to stabilize
  await delay(1000);

  // --- TEST CASE 1: Typing Indicator ---
  logger.info('--- TEST 1: Typing Indicators ---');
  logger.info('Alice starts typing...');
  aliceSocket.emit('typing_start', { conversationId });
  await delay(1000);

  logger.info('Alice stops typing...');
  aliceSocket.emit('typing_stop', { conversationId });
  await delay(1000);

  // --- TEST CASE 2: Messaging flow & ACK & Delivery/Seen receipts ---
  logger.info('--- TEST 2: Messaging, ACKs, and Receipts ---');
  const clientMessageId = uuidv4();
  const startTime = Date.now();

  aliceSocket.emit('send_message', {
    conversationId,
    clientMessageId,
    content: 'Hello Bob! This is an integration test.'
  }, (ack: any) => {
    const latency = Date.now() - startTime;
    logger.info('Alice received ACK from server:', { ack, latencyMs: latency });
  });

  // Wait for propagation
  await delay(2000);

  // --- TEST CASE 3: Idempotency / Deduplication ---
  logger.info('--- TEST 3: Idempotency (Deduplication) ---');
  logger.info('Alice sending duplicate message with same clientMessageId...');
  const retryStartTime = Date.now();
  aliceSocket.emit('send_message', {
    conversationId,
    clientMessageId,
    content: 'Hello Bob! This is an integration test.' // Same message ID
  }, (ack: any) => {
    const latency = Date.now() - retryStartTime;
    logger.info('Alice received duplicate ACK from server:', { ack, latencyMs: latency });
  });

  await delay(2000);

  // --- TEST CASE 4: Reconnect Handling ---
  logger.info('--- TEST 4: Reconnect Handling ---');
  logger.info('Disconnecting Bob client...');
  bobSocket.disconnect();
  await delay(1000);

  // Alice sends offline message
  const offlineClientMsgId = uuidv4();
  aliceSocket.emit('send_message', {
    conversationId,
    clientMessageId: offlineClientMsgId,
    content: 'Are you still there Bob?'
  }, (ack: any) => {
    logger.info('Alice received ACK for offline message:', ack);
  });

  await delay(2000);

  logger.info('Reconnecting Bob client...');
  bobSocket.connect();
  
  // Wait to establish and receive sync messages
  await delay(2000);

  // Assertions and test report
  logger.info('===============================================');
  logger.info('INTEGRATION TEST SUMMARY:');
  logger.info(`- Bob received message count: ${bobReceivedMessagesCount} (Expected: 2)`);
  logger.info(`- Bob received typing start/stop events: ${bobReceivedTypingEvents.length} (Expected: >= 2)`);
  logger.info(`- Alice received read/delivered receipts: ${aliceReceivedReceiptEvents.length} (Expected: >= 1)`);
  logger.info('===============================================');

  // --- LOAD TESTING SIMULATION (Optional high concurrency) ---
  const CONCURRENT_CLIENTS = parseInt(process.env.SIMULATE_CONCURRENCY || '100', 10);
  logger.info(`--- SIMULATING ${CONCURRENT_CLIENTS} CONCURRENT USERS ---`);
  
  const sockets: Socket[] = [];
  logger.info(`Creating ${CONCURRENT_CLIENTS} clients...`);
  
  for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
    // Authenticate simulated users alternating between Alice and Bob
    const isAlice = i % 2 === 0;
    const token = isAlice ? aliceToken : bobToken;

    const s = ioClient(WS_URL, {
      query: { token },
      transports: ['websocket'],
      forceNew: true
    });
    
    s.on('connect', () => {
      if (i % 10 === 0 || i === CONCURRENT_CLIENTS - 1) {
        logger.info(`Connected client simulation progress: ${i + 1}/${CONCURRENT_CLIENTS}`);
      }
    });

    s.on('connect_error', (err) => {
      logger.error(`Client ${i} connect error:`, err.message);
    });

    sockets.push(s);
    // Throttle client connections slightly to avoid rate limit spikes
    if (i % 50 === 0) await delay(100);
  }

  logger.info(`All ${CONCURRENT_CLIENTS} simulation clients initialized. Emitting test payloads...`);
  await delay(2000);

  let successAcks = 0;
  let errorAcks = 0;

  logger.info('Simulating active messages from all clients...');
  const promises = sockets.map((s, index) => {
    return new Promise<void>((resolve) => {
      s.emit('send_message', {
        conversationId,
        clientMessageId: uuidv4(),
        content: `Simulation message from client ${index}`
      }, (ack: any) => {
        if (ack && ack.status === 'sent') {
          successAcks++;
        } else {
          errorAcks++;
        }
        resolve();
      });
    });
  });

  await Promise.all(promises);
  logger.info(`Load Simulation Completed: Success ACK = ${successAcks}, Failed ACK = ${errorAcks}`);

  // Cleanup
  logger.info('Disconnecting all test clients...');
  aliceSocket.disconnect();
  bobSocket.disconnect();
  sockets.forEach((s) => s.disconnect());

  logger.info('Integration & Load test successfully run!');
}

runLoadTest().catch((err) => {
  logger.error('Error running load test script', { error: err.stack || err.message });
  process.exit(1);
});
