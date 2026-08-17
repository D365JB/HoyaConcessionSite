import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { ENV } from "./_core/env";
import { countActiveLocalAdminAccounts, createLocalAdminAccount } from "./db";

const scrypt = promisify(nodeScrypt);

export const LOCAL_ADMIN_COOKIE = "hoyas_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours
const HASH_PREFIX = "scrypt";
const HASH_KEY_LENGTH = 64;

function sessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, HASH_KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !hash) return false;
  const candidate = (await scrypt(password, salt, HASH_KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export async function createLocalAdminSession(userId: number) {
  return new SignJWT({ kind: "local-admin", userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret());
}

export async function getLocalAdminSessionUserId(req: Request): Promise<number | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[LOCAL_ADMIN_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (payload.kind !== "local-admin" || typeof payload.userId !== "number") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function getLocalSessionMaxAgeMs() {
  return SESSION_DURATION_SECONDS * 1000;
}

/**
 * Creates the first local admin only when no active local admin exists and the
 * bootstrap credentials have been supplied through project secrets. Subsequent
 * requests are no-ops, so the bootstrap password cannot overwrite accounts.
 */
export async function ensureBootstrapLocalAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) return false;
  if (await countActiveLocalAdminAccounts()) return false;

  await createLocalAdminAccount({
    name: "Site Administrator",
    email,
    passwordHash: await hashPassword(password),
  });
  return true;
}
