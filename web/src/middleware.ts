import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/auth";

/**
 * Edge middleware: protects admin- and game-state API routes.
 *
 *  - `/api/admin` (non-POST): requires admin cookie. POST `/api/admin`
 *    (login) is exempt so credentials can be exchanged.
 *  - `/api/stats`, `/api/words`, `/api/game`: requires admin cookie OR
 *    the `x-internal-key` header (service-to-service from game-server).
 *
 * If `INTERNAL_API_KEY` is unset, the header path is disabled entirely
 * (even an empty header value does not bypass).
 *
 * Path normalization: trailing slash and query string are collapsed so
 * `/api/admin/` and `/api/admin?foo=bar` are treated like `/api/admin`.
 */
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function normalizePath(p: string): string {
  let path = p;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.toLowerCase();
}

function headerMatchesInternal(provided: string | null): boolean {
  if (!INTERNAL_API_KEY) return false;
  if (!provided) return false;
  // Constant-time-ish compare to avoid trivial timing oracles.
  if (provided.length !== INTERNAL_API_KEY.length) return false;
  let mismatch = 0;
  for (let i = 0; i < INTERNAL_API_KEY.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ INTERNAL_API_KEY.charCodeAt(i);
  }
  return mismatch === 0;
}

async function isAdminCookieValid(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookie) return false;
  const payload = await verifyAdminToken(cookie);
  return payload !== null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const path = normalizePath(pathname);
  const method = req.method;

  const isInternal = headerMatchesInternal(req.headers.get("x-internal-key"));
  if (isInternal) return NextResponse.next();

  // Login endpoint is exempt so credentials can be exchanged.
  if (path === "/api/admin" && method === "POST") {
    return NextResponse.next();
  }

  const protectedPaths = new Set(["/api/admin", "/api/stats", "/api/words", "/api/game"]);
  if (!protectedPaths.has(path)) {
    return NextResponse.next();
  }

  if (await isAdminCookieValid(req)) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "Não autorizado" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export const config = {
  matcher: [
    "/api/admin",
    "/api/admin/:path*",
    "/api/stats",
    "/api/stats/:path*",
    "/api/words",
    "/api/words/:path*",
    "/api/game",
    "/api/game/:path*",
  ],
};
