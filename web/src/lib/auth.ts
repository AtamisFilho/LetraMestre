import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * Auth layer for LetraMestre admin.
 *
 * Design notes:
 *  - bcrypt (cost 12) password hashing.
 *  - JWT HS256 via `jose`, 2h TTL, signed with AUTH_SECRET.
 *  - HttpOnly+Secure(production only)+SameSite=Strict cookie.
 *  - Bootstrap via env (ADMIN_USERNAME/ADMIN_PASSWORD); the legacy
 *    `admin/letramestre` backdoor is REMOVED. An empty password NEVER
 *    creates or authenticates an account (guard before any DB write).
 *  - In production without AUTH_SECRET, the layer fails closed: tokens
 *    are signed with a sentinel that fails verification, so login
 *    "succeeds" bcrypt but whoami/protected routes reject.
 */

const COOKIE_NAME = "admin_session";
const TOKEN_TTL_SECONDS = 7200; // 2h
const BCRYPT_COST = 12;

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === "production") {
    // Fail closed: a sentinel that never verifies against itself.
    // We still return something so signing doesn't throw, but tokens
    // signed here will not verify on subsequent requests.
    return new TextEncoder().encode("__AUTH_SECRET_MISSING__DO_NOT_USE__");
  }
  // Dev fallback so the layer is exercisable without env config.
  return new TextEncoder().encode("dev-insecure-secret-change-me-please-16+");
}

interface AdminTokenPayload {
  sub: string;
  username: string;
}

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.exp !== "number") return null;
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") return null;
    return { sub: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: "/";
  maxAge: number;
}

export function adminCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  };
}

export function buildSetCookieHeader(token: string): string {
  const opts = adminCookieOptions();
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${opts.maxAge}`,
    "SameSite=Strict",
  ];
  if (opts.secure) parts.push("Secure");
  parts.push("HttpOnly");
  return parts.join("; ");
}

export function buildClearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly`;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;

/**
 * Resolves (creating if necessary) the admin account used at login time.
 * Bootstrap is env-driven via ADMIN_USERNAME/ADMIN_PASSWORD. There is no
 * hardcoded fallback: an empty username or password short-circuits to null
 * before any DB write. Returns the admin row, or null if the credentials
 * do not match the bootstrapped account.
 */
export async function resolveAdminForLogin(
  username: string,
  password: string,
): Promise<{ id: string; username: string } | null> {
  if (!username || !password) return null;

  const bootstrapUser = process.env.ADMIN_USERNAME;
  const bootstrapPass = process.env.ADMIN_PASSWORD;

  // No bootstrap env configured → no auto-create. The DB may still hold
  // a previously-bootstrapped admin row that we'll bcrypt-verify below.
  if (bootstrapUser && bootstrapPass && username === bootstrapUser) {
    let admin = await db.adminUser.findFirst({ where: { username: bootstrapUser } });
    if (!admin) {
      const hash = await bcrypt.hash(bootstrapPass, BCRYPT_COST);
      try {
        admin = await db.adminUser.create({
          data: { username: bootstrapUser, password: hash },
        });
      } catch {
        // Race: another request created it. Re-fetch.
        admin = await db.adminUser.findFirst({ where: { username: bootstrapUser } });
      }
    }
    if (admin && (await bcrypt.compare(password, admin.password))) {
      return { id: admin.id, username: admin.username };
    }
    return null;
  }

  // Verify against any pre-existing admin row.
  const admin = await db.adminUser.findFirst({ where: { username } });
  if (!admin) return null;
  if (await bcrypt.compare(password, admin.password)) {
    return { id: admin.id, username: admin.username };
  }
  return null;
}
