import { NextRequest, NextResponse } from "next/server";
import {
  resolveAdminForLogin,
  signAdminToken,
  verifyAdminToken,
  buildSetCookieHeader,
  buildClearCookieHeader,
  ADMIN_COOKIE_NAME,
} from "@/lib/auth";

/**
 * Admin auth endpoints.
 *
 *  - POST   /api/admin          login: bcrypt-verify → set HttpOnly cookie → return token
 *  - GET    /api/admin          whoami: verify cookie, re-issue a rotated token (sliding window)
 *  - DELETE /api/admin          logout: clear cookie
 *
 * The legacy backdoor (admin/letramestre auto-create) is removed. Bootstrap
 * happens via env ADMIN_USERNAME/ADMIN_PASSWORD on first login.
 */

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Payload inválido");
  }
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const admin = await resolveAdminForLogin(username, password);
  if (!admin) {
    return jsonError(401, "Credenciais inválidas");
  }

  const token = await signAdminToken({ sub: admin.id, username: admin.username });
  const res = NextResponse.json({
    success: true,
    id: admin.id,
    username: admin.username,
    token,
  });
  res.headers.set("Set-Cookie", buildSetCookieHeader(token));
  return res;
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookie) return jsonError(401, "Não autenticado");

  const payload = await verifyAdminToken(cookie);
  if (!payload) return jsonError(401, "Sessão inválida ou expirada");

  // Rotating the token on each whoami gives a sliding 2h window without
  // letting the original leak persist forever.
  const fresh = await signAdminToken({ sub: payload.sub, username: payload.username });
  const res = NextResponse.json({
    success: true,
    id: payload.sub,
    username: payload.username,
    token: fresh,
  });
  res.headers.set("Set-Cookie", buildSetCookieHeader(fresh));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.headers.set("Set-Cookie", buildClearCookieHeader());
  return res;
}
