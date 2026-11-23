export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "development-secret-change-before-production",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "social_session",
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 604800),
  mediaRoot: process.env.MEDIA_ROOT ?? "./media",
  maxImageSizeMb: Number(process.env.MAX_IMAGE_SIZE_MB ?? 10),
  maxVideoSizeMb: Number(process.env.MAX_VIDEO_SIZE_MB ?? 50),
  frontendOrigin:
    process.env.FRONTEND_ORIGIN ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:5173"),
  secureCookie:
    (process.env.SECURE_COOKIE ?? "false").toLowerCase() === "true",
  port: Number(process.env.PORT ?? 8000),
};
