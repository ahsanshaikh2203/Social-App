# Social Network Platform

A full-stack social networking application for profiles, posts, media, comments, likes, friend connections, notifications, privacy controls, and real-time updates.

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick start with Docker](#quick-start-with-docker)
- [Local development](#local-development)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [API documentation](#api-documentation)
- [Data model](#data-model)
- [Testing](#testing)
- [Security](#security)
- [Real-time behavior](#real-time-behavior)
- [Media handling](#media-handling)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

## Overview

The platform provides a responsive web interface backed by a REST API and native WebSocket endpoint. PostgreSQL stores application data, Prisma handles database access and migrations, and a local media volume stores uploaded avatars and post media.

The application supports:

- Account registration and login
- Public, friends-only, and private profile and post visibility
- Feed, profile, search, post detail, comments, and likes
- Friend requests, friends lists, cancellations, acceptances, declines, unfriending, and blocking
- Persistent notifications and unread notification counts
- Authenticated real-time events
- JWT bearer sessions and HttpOnly session cookies

## Features

### Accounts and profiles

- Secure registration and login
- Argon2 password hashing
- Editable display name, username, bio, avatar, and privacy settings
- Public and authenticated user search
- Profile visibility and friends-list visibility controls

### Social feed

- Text posts with public, friends-only, or private audiences
- Paginated feed and profile-post views
- Post editing and deletion
- Image and short-video attachments
- Comments and idempotent post likes

### Friends and notifications

- Send, cancel, accept, and decline friend requests
- Prevent duplicate and self friend requests
- Block and unfriend users
- Friends and incoming/outgoing request views
- Persistent friend-request, friendship, like, and comment notifications
- Mark notifications as read individually or all at once

### Real-time updates

- Native WebSocket connections
- Automatic browser reconnect behavior
- Live post, comment, like, friend, and notification events
- Per-user event delivery and server-side audience filtering

## Architecture

```text
Browser
  |
  | HTTP /api/* and WebSocket /ws
  v
React/Vite Frontend
  |
  | Docker/localhost network
  v
Fastify API + Native WebSocket Server
  |
  | Prisma
  v
PostgreSQL

Fastify API
  |
  +--> Local media volume
```

The repository is an npm workspace:

- `backend` exposes the REST API, WebSocket endpoint, authentication, Prisma data access, and seed script.
- `frontend` provides the React/Vite single-page application.
- `postgres` stores the relational data.
- `media_data` persists uploaded files independently of API containers.

## Technology stack

### Backend

- Node.js 22
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- Zod
- JSON Web Tokens
- Argon2
- Native `ws`
- Vitest
- Fastify Swagger/OpenAPI

### Frontend

- React 19
- React Router
- Vite
- Vitest
- Testing Library
- CSS

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL 16

## Project structure

```text
.
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config.ts
│   │   ├── realtime.ts
│   │   ├── security.ts
│   │   ├── seed.ts
│   │   └── server.ts
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── test/
│   │   ├── api.js
│   │   ├── auth.jsx
│   │   ├── hooks.js
│   │   └── styles.css
│   ├── Dockerfile
│   ├── index.html
│   └── package.json
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

## Code organization

The codebase is organized around small, explicit modules:

- `config.ts` loads environment configuration.
- `security.ts` handles password hashing and session signing.
- `realtime.ts` tracks authenticated WebSocket connections.
- `seed.ts` creates deterministic demo users and content.
- `server.ts` registers HTTP routes, validation, authorization, uploads, and WebSocket handling.
- Prisma models define users, profiles, posts, media, comments, likes, friendship requests, blocks, and notifications.

## Prerequisites

Choose one of the following setup methods.

### Docker

- Docker Desktop or Docker Engine
- Docker Compose v2

### Local Node development

- Node.js 22 or later
- npm 10 or later
- PostgreSQL 16 or compatible local PostgreSQL instance

## Quick start with Docker

1. Copy the root environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Replace `SESSION_SECRET` in `.env` with a cryptographically random value.

3. Build and start the complete stack:

   ```powershell
   docker compose up --build
   ```

4. Open:

   - Application: http://localhost:5173
   - API: http://localhost:8000
   - Swagger UI: http://localhost:8000/api/docs
   - OpenAPI document: http://localhost:8000/api/openapi.json

Docker Compose starts PostgreSQL, applies Prisma migrations, seeds demo data, and starts the API and frontend.

To stop containers:

```powershell
docker compose down
```

To remove containers and persisted database/media volumes:

```powershell
docker compose down --volumes
```

## Local development

Install all workspace dependencies:

```powershell
npm install
```

Start PostgreSQL through Docker:

```powershell
docker compose up postgres
```

Copy the backend environment template:

```powershell
Copy-Item backend/.env.example backend/.env
```

Apply migrations and seed demo data:

```powershell
npm run migrate
npm run seed
```

Start the backend and frontend in separate terminals:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

The frontend is available at http://localhost:5173 and proxies `/api` and `/ws` to the backend on port 8000.

## Demo accounts

All demo accounts use the password `password123`.

| Username | Display name | Purpose |
| --- | --- | --- |
| `alice` | Alice Johnson | Public and friends-only feed testing |
| `bob` | Bob Smith | Friendship and notification testing |
| `carol` | Carol Lee | Additional public profile and feed testing |

The seed creates an accepted friendship and demo posts.

## Environment variables

### Docker root variables

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_DB` | `social` | PostgreSQL database name |
| `POSTGRES_USER` | `social` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `social` | PostgreSQL password |
| `DATABASE_URL` | Compose-generated URL | Prisma/PostgreSQL connection URL |
| `SESSION_SECRET` | Development fallback | Secret used to sign session tokens |
| `SESSION_COOKIE_NAME` | `social_session` | HttpOnly session cookie name |
| `SESSION_TTL_SECONDS` | `604800` | Session lifetime in seconds |
| `MEDIA_ROOT` | `/app/media` | Uploaded media directory inside the API container |
| `MAX_IMAGE_SIZE_MB` | `10` | Maximum uploaded image size |
| `MAX_VIDEO_SIZE_MB` | `50` | Maximum uploaded video size |

Keep `.env` and secrets out of source control. The provided secret values are for local development only.

### Backend variables

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | Local PostgreSQL URL | Database connection string |
| `TEST_DATABASE_URL` | Empty | Optional test database override |
| `SESSION_SECRET` | Development fallback | Session signing secret |
| `SESSION_COOKIE_NAME` | `social_session` | Session cookie name |
| `SESSION_TTL_SECONDS` | `604800` | Session lifetime |
| `MEDIA_ROOT` | `./media` | Local media directory |
| `MAX_IMAGE_SIZE_MB` | `10` | Image upload limit |
| `MAX_VIDEO_SIZE_MB` | `50` | Video upload limit |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `SECURE_COOKIE` | `false` | Enables the Secure cookie flag |
| `PORT` | `8000` | API listen port |

## API documentation

When the backend is running:

- Swagger UI: http://localhost:8000/api/docs
- OpenAPI JSON: http://localhost:8000/api/openapi.json

### Core route groups

| Area | Routes |
| --- | --- |
| Authentication | `/api/auth/register`, `/login`, `/logout`, `/me`, `/csrf` |
| Profiles | `/api/profiles/me`, `/api/profiles/me/settings`, `/api/profiles/search`, `/api/profiles/:id` |
| Posts | `/api/posts/feed`, `/api/posts/profile/:id`, `/api/posts/direct/:id`, `/api/posts/:id` |
| Comments and likes | `/api/posts/:id/comments`, `/api/posts/:id/like` |
| Friends | `/api/friend-requests/*`, `/api/friends`, `/api/friends/pending`, `/api/friends/:id/unfriend` |
| Notifications | `/api/notifications`, `/api/notifications/unread`, `/api/notifications/:id/read` |
| Media | `/api/media/:id` |
| Health | `/api/health` |
| Real-time | `/ws` |

### Response conventions

- JSON success responses use route-specific bodies.
- Validation and application errors use `{ "detail": "Message" }`.
- `204` responses have no body.
- Bearer tokens are accepted through `Authorization: Bearer <token>`.
- Mutating cookie-authenticated requests require the CSRF cookie and `X-CSRF-Token` header.

## Data model

The Prisma schema contains:

- `User`
- `Profile`
- `Post`
- `Media`
- `Comment`
- `Like`
- `FriendRequest`
- `Block`
- `Notification`

Key constraints include:

- Unique usernames and emails
- Unique post/user likes
- Unique friend-request pairs
- Unique block pairs
- Cascade deletion for user-owned profile and content records
- Indexed post users and audiences
- Indexed comment posts and notification users

The complete model is in [backend/prisma/schema.prisma](backend/prisma/schema.prisma).

## Testing

Run all workspace tests:

```powershell
npm run test
```

Run individual workspaces:

```powershell
npm run test --workspace backend
npm run test --workspace frontend
```

Create production builds:

```powershell
npm run build
```

Backend tests cover authentication, password compatibility, privacy, friend transitions, media validation, and WebSocket authorization where a PostgreSQL/test environment is available.

## Security

- Argon2 password hashing
- Expiring signed session tokens
- HttpOnly, SameSite session cookies
- CSRF validation for cookie-authenticated mutations
- CORS restricted to the configured frontend origin
- Zod request validation
- Prisma parameterized queries
- Rate limiting on login/write paths
- Server-side profile, post, comment, media, search, and event authorization
- Generated media filenames
- Content-signature and size validation for uploads
- Do not use the development `SESSION_SECRET` outside local development

## Real-time behavior

The WebSocket endpoint is available at:

```text
ws://localhost:8000/ws
```

It accepts:

- The authenticated `social_session` cookie
- `?token=<session-token>` for API clients and tests

The frontend reconnects after dropped connections. Event delivery is scoped to the relevant recipient or relationship.

The current connection registry is process-local. Redis or another shared pub/sub system is required for fan-out across multiple API processes.

## Media handling

- Images are validated by MIME type and binary signatures.
- Supported image types include JPEG, PNG, and WebP.
- Supported video behavior is limited to basic MP4/WebM content validation.
- Upload size limits are configurable through environment variables.
- Generated filenames prevent user-controlled path names.
- Media URLs pass through `/api/media/:id`.
- Private post media and profile avatars require authorization.

## Known limitations

- The WebSocket registry is single-process and does not support horizontal API scaling.
- Video uploads are validated but no transcoding or adaptive streaming is provided.
- Media is stored in a Docker volume or local filesystem, not external object storage.
- Email verification and password recovery are not implemented.
- Third-party authentication is not implemented.
- Direct messaging and content moderation are not included.
- Docker secrets and production TLS terminate outside the local development setup.

## Troubleshooting

### Docker services fail to start

```powershell
docker compose down
docker compose up --build
docker compose ps
docker compose logs backend
docker compose logs postgres
```

### Port already in use

Stop the existing process using ports `5173`, `8000`, or `5432`, or change the corresponding host port in `docker-compose.yml`.

### Database migrations do not apply

Check PostgreSQL health and rerun:

```powershell
docker compose up postgres
npm run migrate
```

### CSRF errors

Cookie-authenticated mutation requests require both:

- A `csrf_token` cookie
- An `X-CSRF-Token` header containing the same value

The frontend obtains this token through `/api/auth/csrf`.

### Session lost after restart

Changing `SESSION_SECRET` invalidates existing session tokens. Clear the browser cookie or sign in again.
