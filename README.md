# Dominó Online

A real-time **partnership domino** web platform built with Next.js 15, a custom Node server with Socket.io, PostgreSQL/Prisma, and Auth.js. Game logic lives in a pure domain layer so it can be tested and reused (e.g. for a future mobile client).

---

## Table of contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Game rules](#game-rules)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [Docker (PostgreSQL)](#docker-postgresql)
- [Getting started](#getting-started)
- [Network access & router setup](#network-access--router-setup)
- [Google OAuth (optional)](#google-oauth-optional)
- [Real-time / Socket.io](#real-time--socketio)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Deployment notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)

---

## Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn-style UI components |
| **Backend** | Custom Node server (`server.ts`) — Next.js + Socket.io in the same process |
| **Real-time** | Socket.io (moves, turns, scores, chat, presence, room sync) |
| **Database** | PostgreSQL 16 + Prisma ORM |
| **Auth** | Auth.js / NextAuth v5 — email/password + optional Google OAuth, JWT sessions |

---

## Architecture

Clean Architecture / DDD-style layering:

```
src/
  domain/         # Pure game engine, entities, rules (no Next/Prisma/Socket)
  application/    # Use cases: users, friends, rooms, invitations
  infrastructure/ # Prisma, Auth.js, RoomManager (realtime), socket tokens
  presentation/   # React components, hooks, server actions, socket gateway
  app/            # App Router pages (login, register, dashboard, room/[code], API)
  shared/         # Socket.io contract, room codes, shared utilities
  config/         # Environment validation (env.ts)
server.ts         # Custom HTTP server: Next.js + Socket.io
prisma/           # Schema, migrations, seed
tests/            # Vitest unit tests (domain) + optional e2e helpers
```

**Dependency rule:** `presentation → application → domain`. Infrastructure implements persistence and realtime. The domino domain has **zero** framework imports and is fully unit-tested.

### Key runtime flows

1. **HTTP** — Next.js handles pages, Server Actions, and REST routes (`/api/auth`, `/api/register`, `/api/realtime/token`).
2. **WebSocket** — Socket.io on path `/api/socket` (same port as the app). Clients obtain a short-lived token from `/api/realtime/token` after login.
3. **Rooms** — `RoomManager` (in-memory) is authoritative for lobby state and the `DominoEngine` during a match. Durable data (users, rooms, chat, match history) is stored in PostgreSQL.
4. **Room lifecycle** — A public room is listed while `status` is `LOBBY` or `IN_GAME` and it has members. When **all players disconnect**, the room is closed (`FINISHED`), members are removed, and it disappears from the public list.

---

## Game rules

- **Tile set:** double-six (28 tiles).
- **Players:** 2 or 4 (teams: seats 0/2 vs 1/3 in a 4-player game).
- **Validation:** All moves are validated server-side (turn, tile in hand, legal end).
- **Round end — normal:** Winning team scores the sum of opponents' remaining pips.
- **Round end — block (*tranque*):**
  - `individual` — lowest hand wins.
  - `parejas` — team with the lower combined hand wins.
- **Pass bonus** (0 / 25 / 30, 4 players only): If all three opponents pass in a row and the turn returns to whoever played the last tile, that player's team earns the bonus.
- **Match target:** 100 / 200 / 400 / 500 points (configurable per room).
- **Dealing:** Deterministic shuffle from a seeded RNG (reproducible, testable).

---

## Prerequisites

- **Node.js** 20+ (recommended)
- **pnpm** (`npm install -g pnpm`)
- **Docker** & Docker Compose (for PostgreSQL)
- **OpenSSL** (to generate `AUTH_SECRET`)

---

## Environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Default with Docker: `postgresql://domino:domino@localhost:5432/domino?schema=public` |
| `AUTH_SECRET` | Yes | Secret for Auth.js / JWT. Generate: `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Public base URL of the app (auth callbacks, Socket.io CORS). Example: `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Yes | Same URL, exposed to the browser (invitation links, client-side redirects) |
| `AUTH_GOOGLE_ID` | No | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | No | Google OAuth client secret |
| `PORT` | No | HTTP + Socket.io port (default: `3000`) |
| `HOST` | No | Bind address (default: `0.0.0.0` — required for LAN/WAN access) |
| `POSTGRES_PORT` | No | Host port mapped to Postgres in Docker (default: `5432`) |

### Example `.env` (local development)

```env
DATABASE_URL="postgresql://domino:domino@localhost:5432/domino?schema=public"
AUTH_SECRET="your-generated-secret-here"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PORT=3000
HOST=0.0.0.0
```

> **Important:** `AUTH_URL` and `NEXT_PUBLIC_APP_URL` must match the URL users type in the browser. If they differ (e.g. after port forwarding), auth and WebSockets will break.

---

## Docker (PostgreSQL)

The repo includes a minimal `docker-compose.yml` that runs **only PostgreSQL**. The Next.js app runs on your host (or another container you manage yourself).

### Start the database

```bash
docker compose up -d
```

This starts:

| Service | Container name | Image | Host port |
|---------|----------------|-------|-----------|
| `postgres` | `domino-postgres` | `postgres:16-alpine` | `${POSTGRES_PORT:-5432}` → `5432` |

Default credentials (match `.env.example`):

- **User:** `domino`
- **Password:** `domino`
- **Database:** `domino`

Data is persisted in the Docker volume `domino-pgdata`.

### Useful Docker commands

```bash
docker compose up -d      # Start Postgres in background
docker compose down       # Stop containers (data kept in volume)
docker compose down -v    # Stop and delete volume (wipes DB)
docker compose logs -f    # Follow Postgres logs
```

### Apply schema & seed

```bash
pnpm db:migrate   # Run Prisma migrations
pnpm db:seed      # Create test users (password: password123)
```

**Seed accounts:**

| Email | Password |
|-------|----------|
| `ana@example.com` | `password123` |
| `beto@example.com` | `password123` |
| `carla@example.com` | `password123` |
| `dario@example.com` | `password123` |

---

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET

# 3. Start PostgreSQL
docker compose up -d

# 4. Database setup
pnpm db:migrate
pnpm db:seed

# 5. Run development server (Next + Socket.io)
pnpm dev
```

Open **http://localhost:3000**

### Production build

```bash
pnpm build
pnpm start
```

### Tests & type checking

```bash
pnpm test        # Vitest (domain logic)
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
```

---

## Network access & router setup

The app serves **both HTTP and WebSocket traffic on a single TCP port** (`PORT`, default **3000**). Socket.io uses the path `/api/socket` on the same host and port — you do **not** need a separate WebSocket port.

### Play on the same Wi‑Fi (LAN)

1. Set `HOST=0.0.0.0` in `.env` (default).
2. Find your machine's LAN IP:
   - **macOS:** `ipconfig getifaddr en0`
   - **Linux:** `hostname -I`
   - **Windows:** `ipconfig`
3. Update both URLs in `.env`:
   ```env
   AUTH_URL="http://192.168.1.50:3000"
   NEXT_PUBLIC_APP_URL="http://192.168.1.50:3000"
   ```
4. Restart the server: `pnpm dev`
5. Friends open `http://192.168.1.50:3000` from their devices.

Ensure your OS firewall allows inbound TCP on port **3000**.

### Play over the internet (router port forwarding)

1. On your router, create a **port forwarding** (virtual server) rule:
   - **External port:** `3000` (TCP)
   - **Internal IP:** Your PC's LAN IP (e.g. `192.168.1.50`)
   - **Internal port:** `3000` (TCP)
   - **Protocol:** TCP (TCP-only is enough; Socket.io falls back to HTTP long-polling if WebSocket is blocked)

2. Find your public IP: `curl ifconfig.me`

3. Update `.env`:
   ```env
   AUTH_URL="http://YOUR_PUBLIC_IP:3000"
   NEXT_PUBLIC_APP_URL="http://YOUR_PUBLIC_IP:3000"
   ```
   Or use a domain name if you have one (HTTPS recommended for production).

4. Restart the server and share `http://YOUR_PUBLIC_IP:3000` with friends.

> **Router summary:** Forward **TCP port 3000** → your computer's LAN IP on port **3000**. No other ports are required for the game client. PostgreSQL (`5432`) should **not** be exposed to the internet unless you know what you're doing.

### CGNAT / no public IP

If your ISP uses CGNAT, port forwarding may not work. Use a tunnel (Cloudflare Tunnel, ngrok, Tailscale Funnel, etc.) and set `AUTH_URL` / `NEXT_PUBLIC_APP_URL` to the tunnel URL.

---

## Google OAuth (optional)

1. Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. OAuth redirect URI: `{AUTH_URL}/api/auth/callback/google`
3. Set in `.env`:
   ```env
   AUTH_GOOGLE_ID="your-client-id"
   AUTH_GOOGLE_SECRET="your-client-secret"
   ```

If either value is empty, only email/password login is shown.

---

## Real-time / Socket.io

| Item | Value |
|------|-------|
| Socket path | `/api/socket` |
| Port | Same as `PORT` (default `3000`) |
| Auth | Bearer token from `GET /api/realtime/token` (requires logged-in session) |
| Contract | `src/shared/socket/contract.ts` |

Main client → server events: `room:join`, `room:leave`, `match:start`, `match:playTile`, `match:pass`, `chat:send`.

Main server → client events: `room:state`, `match:sync`, `match:action`, `chat:message`, `room:closed`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Development server with hot reload (`tsx watch server.ts`) |
| `pnpm build` | Production Next.js build |
| `pnpm start` | Production server |
| `pnpm test` | Run Vitest suite |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Apply migrations (dev) |
| `pnpm db:push` | Push schema without migration files |
| `pnpm db:seed` | Seed test users |
| `pnpm db:studio` | Open Prisma Studio GUI |

---

## Project structure

```
dominos/
├── server.ts                 # Custom server entry point
├── docker-compose.yml        # PostgreSQL only
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── domain/domino/        # Game engine (Board, Round, DominoEngine)
│   ├── application/          # rooms.ts, users.ts, friends.ts, …
│   ├── infrastructure/
│   │   ├── realtime/         # room-manager.ts, token.ts
│   │   ├── auth/
│   │   └── db/
│   ├── presentation/
│   │   ├── components/room/  # Game UI (board, table, chat, animations)
│   │   ├── socket/           # gateway.ts
│   │   └── actions/          # Server Actions
│   └── app/                  # Next.js routes
└── tests/domino/             # Domain unit tests
```

### Board layout (UI)

Visual tile placement is **presentation-only** in:

- `src/presentation/components/room/board-layout.ts` — snake geometry, scaling
- `src/presentation/components/room/board-view.tsx` — renders absolute positions

The server only stores a 1D chain (`leftValue` / `rightValue` per tile).

---

## Deployment notes

- **Not compatible with Vercel serverless** — Socket.io requires a long-running Node process.
- Deploy to **Railway**, **Render**, **Fly.io**, a VPS, or any host that runs `pnpm start`.
- Set all environment variables on the host; use a managed PostgreSQL or run Postgres via Docker on the same machine.
- For horizontal scaling, add a **Redis adapter** for Socket.io (not included yet).
- On server startup, orphan rooms (`LOBBY` / `IN_GAME` with no live runtime) are automatically closed.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| `AUTH_SECRET is required` | Missing env var | Set `AUTH_SECRET` in `.env` |
| Can't connect to DB | Postgres not running | `docker compose up -d` |
| Auth works but socket fails | `AUTH_URL` mismatch | Match `AUTH_URL` to the browser URL |
| Friends can't join on LAN | Wrong URL or firewall | Use LAN IP in `.env`, allow port 3000 |
| Room stuck in public list | Old bug / server crash | Restart server (orphan cleanup) or all players re-join and leave |
| Google login redirect error | Wrong callback URL | Add `{AUTH_URL}/api/auth/callback/google` in Google Console |

---

## License

Private project — all rights reserved by the repository owner.
