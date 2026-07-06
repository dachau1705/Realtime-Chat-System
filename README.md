# Realtime Chat & Fanpage Management System

A production-grade, highly scalable social communication platform featuring real-time messaging, notification pipelines, and a complete Facebook-inspired Fanpage Management module.

Built using TypeScript, React/Vite, Express, Socket.io (WebSockets), Redis (caching & Pub/Sub), Kafka (message queue), and PostgreSQL (durable storage).

---

## 🏗️ Project Architecture

The project has been physically separated into standalone **Frontend** and **Backend** workspaces:

```text
Realtime-Chat-System/
├── backend/                  # Monorepo containing all backend apps & libraries
│   ├── apps/
│   │   ├── api-gateway/      # REST Express API gateway (auth, user records, page wizard)
│   │   ├── websocket-gateway/# Socket.io WebSocket server
│   │   └── worker/           # Kafka Consumer worker processing messaging queue
│   ├── libs/                 # Shared modules (common utils, Redis wrappers, Kafka setup)
│   ├── migrations/           # PostgreSQL schema DDL files & runner
│   ├── tests/                # Load tests & integration test suite
│   ├── docker-compose.yml    # Database, Redis, and Kafka cluster compose
│   └── package.json          # Node workspace definition for backend services
│
└── frontend/                 # Standalone Client Application (Vite + React + TS)
    ├── src/                  # React views, components, context, and hooks
    ├── public/               # Static assets & icons
    └── package.json          # Frontend build script and dependencies
```

---

## 🚀 How to Run Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)

---

### 2. Startup Step-by-Step

#### Step A: Run Infrastructure Services
Start PostgreSQL, Redis, and Kafka using Docker Compose:
```bash
# Navigate to the backend directory
cd backend

# Spin up databases and messaging brokers
docker compose up -d
```

#### Step B: Install Dependencies
Install modules for both workspaces:
```bash
# In the backend directory
npm install

# Navigate to frontend and install client modules
cd ../frontend
npm install
```

#### Step C: Execute Database Migrations
Create tables and seed initial data (such as page categories):
```bash
# Navigate back to backend
cd ../backend

# Run migrations
npm run db:migrate
```

#### Step D: Run Backend Services
Launch the backend services in separate terminal windows (from the `backend/` folder):

1. **REST API Gateway** (Port `3000`):
   ```bash
   npm run start:api
   ```
2. **WebSocket Server** (Port `3001`):
   ```bash
   npm run start:ws
   ```
3. **Kafka Background Consumer Worker**:
   ```bash
   npm run start:worker
   ```

#### Step E: Start Frontend Client
Run the Vite development server:
```bash
# Navigate to frontend
cd ../frontend

# Launch client
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to interact with the application.

---

### 📦 Optional: Production Build Bundling

To compile and bundle the React assets into the REST API Gateway's public directory for deployment:
```bash
cd frontend
npm run build
```
The compiled files are automatically written into `backend/apps/api-gateway/public/` using Vite mappings.
