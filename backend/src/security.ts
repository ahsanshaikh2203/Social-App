import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(password: string, hash: string) {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

export function encodeSession(userId: number) {
  return jwt.sign({ sub: String(userId) }, config.sessionSecret, { expiresIn: config.sessionTtlSeconds });
}

export function decodeSession(token?: string): number | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.sessionSecret) as jwt.JwtPayload;
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch { return null; }
}
