# Social Network Node Backend

TypeScript/Fastify replacement for the existing FastAPI backend.

## Stack

- Fastify 5, Zod validation, Swagger/OpenAPI
- Prisma 6 with PostgreSQL
- Argon2 password hashing
- JSON Web Token signed session bearer tokens
- HttpOnly `social_session` cookie and matching CSRF cookie
- Native `ws` WebSocket endpoint at `/ws`
- Vitest and Supertest

Fastify was chosen for its TypeScript support, low overhead, and first-party plugins for cookies, multipart uploads, CORS, rate limiting, and Swagger.

## Run

```bash
copy .env.example .env
cd ..
npm install
npm run migrate
npm run seed
npm run dev:backend
```

Docker Compose from the workspace root starts PostgreSQL, migrates, seeds, and starts this backend:

```bash
docker compose up --build
```

API docs:

- Swagger UI: `http://localhost:8000/api/docs`
- OpenAPI JSON: `http://localhost:8000/api/openapi.json` (also exposed through Fastify Swagger)

Demo users: `alice`, `bob`, and `carol`; password: `password123`.

## Authentication

The session cookie name and environment variables remain compatible: `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_TTL_SECONDS`, `MEDIA_ROOT`, `MAX_IMAGE_SIZE_MB`, `MAX_VIDEO_SIZE_MB`, `FRONTEND_ORIGIN`, and `SECURE_COOKIE`. `DATABASE_URL` uses the Prisma PostgreSQL format (`postgresql://...`) instead of the old SQLAlchemy PostgreSQL URL form.

Bearer tokens are also accepted. Token signing changes from Python `itsdangerous` to Node JWT, so existing sessions may be invalidated. Argon2 PHC hashes are read directly and remain verifiable.

## Realtime

The native WebSocket endpoint accepts `?token=<session-token>` or the HttpOnly session cookie. The connected event and existing event names/payloads are preserved. The connection registry is in-process; Redis pub/sub is not included for horizontal scaling.
