# Production-Grade Realtime Chat System

A highly scalable, fault-tolerant realtime chat system built in TypeScript utilizing Socket.io (WebSocket), Redis (Pub/Sub & caching), Kafka (message queue with in-order processing), and PostgreSQL (durable storage).

---

## 🏗️ System Architecture

The system is designed with horizontal scalability in mind. WebSocket connections are managed by stateless gateway nodes, and all operations are decoupled using an asynchronous message queue.

### Gateway Layer (WebSocket Server)
- Serves Socket.io connections.
- Authenticates users and checks if message retries are duplicates (idempotency check) against Redis in O(1) time.
- Resolves room/channel connections based on PostgreSQL membership lists.
- Publishes messages to Kafka and returns immediate ACKs (at-least-once receipt confirmation) to clients.
- Subscribes to Redis Pub/Sub events to route incoming messages from other nodes to local users.

### Message Queue (Kafka Broker)
- Serves as the backplane for raw chat messages.
- Messages are partitioned with `key = conversation_id`. Kafka hashes this key, directing all messages of a given conversation to the same partition. This ensures **strict sequential FIFO order** within a conversation.

### Processing Worker (Consumer Group)
- Consumes from the Kafka `chat.messages` and `chat.receipts` topics.
- Commits offsets manually (at-least-once semantics) after successfully writing records to the database.
- Broadcasts persistence events to Redis Pub/Sub channels to sync all gateway nodes.

---

## 🧩 Data Modeling

### 1. PostgreSQL Schema (`migrations/schema.sql`)
- `users`: Stores user identity and credential hash.
- `conversations`: Header records of chats. Supports 1-1 (name is NULL) and group chats.
- `conversation_members`: Junction table mapping users to conversations.
- `messages`: Core message repository. Includes a unique index on `client_message_id` for database-level deduplication.
- `message_receipts`: Tracks delivery state (`sent` | `delivered` | `seen`) per user, per message.

### 2. Redis Schema
- **Presence**: Hash `user:presence:<user_id>` containing socket status, node association, and timestamp.
- **Typing Indicator**: Key `typing:<conversation_id>:<user_id>`, TTL = 3 seconds (auto-expires to stop typing indicators if client disconnects).
- **Idempotency Cache**: Key `idempotency:msg:<client_message_id>`, maps to `server_message_id`, TTL = 24 hours.

---

## 📂 Project Structure

```
.
├── apps/
│   ├── api-gateway/            # REST API (CRUD users/rooms, message history)
│   ├── websocket-gateway/      # Socket.io real-time server
│   └── worker/                 # Kafka Consumer (writes messages/receipts to DB)
├── libs/
│   ├── common/                 # Pool configuration, Logging, Shared interfaces
│   ├── redis/                  # Redis Pub/Sub client & cache helper methods
│   └── kafka/                  # Kafka producer & consumer runner
├── migrations/
│   ├── schema.sql              # Database DDL statements
│   └── migrate.ts              # Migration runner execution script
├── tests/
│   └── load-test.ts            # Simulation & integration test suite
├── docker-compose.yml          # Postgres, Redis, and CP-Kafka services
├── package.json                # npm workspaces script mapping
└── tsconfig.json               # Path alias namespace map
```

---

## 🚀 Getting Started

### 1. Requirements
- Node.js (v18+)
- Docker and Docker Compose

### 2. Install Dependencies
```bash
npm install
```

### 3. Spin Up Infrastructure (PostgreSQL, Redis, Kafka)
Make sure the Docker daemon is running and run:
```bash
npm run infra:up
```

### 4. Execute Migrations
Apply the PostgreSQL schemas:
```bash
npm run db:migrate
```

### 5. Launch the Services
Start each service in a separate terminal panel to observe the logs:
```bash
# Start the REST API Gateway
npm run start:api

# Start the WebSocket Gateway
npm run start:ws

# Start the consumer worker queue processor
npm run start:worker
```

### 6. Run Integration & Load Simulation Tests
This command seeds the database, connects Alice and Bob socket clients, runs typing, messaging, deduplication, and disconnect/reconnect tests, followed by simulating concurrent clients sending messages:
```bash
npm run test:load
```

---

## 🔐 Reliability & Scaling Decisions

### At-Least-Once Delivery
The client resends messages if they do not receive an acknowledgement within a timeout. The server handles this by validating the `client_message_id` against Redis. If it exists, the server returns the cached message metadata without sending it to Kafka, preventing duplicate DB entries.

### Dead Letter Queue (DLQ)
In case of database downtime or schema mismatches, the worker catches the error, packages the message alongside the failure timestamp and error log header, and pushes it to `chat.messages.dlq`. This prevents queue blocking and allows message redelivery once system health is restored.
