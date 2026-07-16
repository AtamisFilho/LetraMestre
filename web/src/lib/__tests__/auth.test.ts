import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Mock the db module so auth tests don't depend on a real database ─────────
// auth.ts imports `db` from `@/lib/db` and calls db.adminUser.findFirst/create.
// We mock just those two methods; bcrypt and jose run for real.
// vi.mock is hoisted to the top of the file by vitest, so the mock object
// must be created via vi.hoisted() to be available when the factory runs.
const { mockAdminUser } = vi.hoisted(() => ({
  mockAdminUser: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    adminUser: mockAdminUser,
  },
}));

import {
  signAdminToken,
  verifyAdminToken,
  resolveAdminForLogin,
  buildSetCookieHeader,
  buildClearCookieHeader,
  adminCookieOptions,
  ADMIN_COOKIE_NAME,
  ADMIN_TOKEN_TTL_SECONDS,
} from "@/lib/auth";

// Helper: sleep for ms.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Save env so each test can mutate freely.
const envSave: Record<string, string | undefined> = {};

describe("auth: signAdminToken + verifyAdminToken", () => {
  it("signAdminToken returns a non-empty JWT string with 3 parts", async () => {
    const token = await signAdminToken({ sub: "user_1", username: "admin" });
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
  });

  it("verifyAdminToken round-trips: sign → verify returns the payload", async () => {
    const token = await signAdminToken({ sub: "user_1", username: "admin" });
    const payload = await verifyAdminToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user_1");
    expect(payload!.username).toBe("admin");
  });

  it("verifyAdminToken returns null for a malformed token (not a JWT)", async () => {
    expect(await verifyAdminToken("not-a-jwt")).toBeNull();
    expect(await verifyAdminToken("")).toBeNull();
    expect(await verifyAdminToken("a.b")).toBeNull(); // only 2 parts
    expect(await verifyAdminToken("a.b.c.d")).toBeNull(); // 4 parts
  });

  it("verifyAdminToken returns null for a tampered payload", async () => {
    const token = await signAdminToken({ sub: "user_1", username: "admin" });
    const parts = token.split(".");
    // Decode payload, change username, re-encode.
    const payloadJson = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    payloadJson.username = "attacker";
    parts[1] = Buffer.from(JSON.stringify(payloadJson)).toString("base64url");
    const tampered = parts.join(".");
    expect(await verifyAdminToken(tampered)).toBeNull();
  });

  it("verifyAdminToken returns null for a tampered signature", async () => {
    const token = await signAdminToken({ sub: "user_1", username: "admin" });
    const parts = token.split(".");
    // Flip the last char of the signature.
    const sig = parts[2];
    const lastChar = sig[sig.length - 1];
    const flip = lastChar === "A" ? "B" : "A";
    parts[2] = sig.slice(0, -1) + flip;
    const tampered = parts.join(".");
    expect(await verifyAdminToken(tampered)).toBeNull();
  });

  it("verifyAdminToken returns null for a token signed with a different secret", async () => {
    process.env.AUTH_SECRET = "first-secret-16chars-or-more";
    const token = await signAdminToken({ sub: "u", username: "a" });
    process.env.AUTH_SECRET = "second-secret-16chars-or-more";
    expect(await verifyAdminToken(token)).toBeNull();
    delete process.env.AUTH_SECRET;
  });
});

describe("auth: cookie helpers", () => {
  it("ADMIN_COOKIE_NAME is 'admin_session'", () => {
    expect(ADMIN_COOKIE_NAME).toBe("admin_session");
  });

  it("ADMIN_TOKEN_TTL_SECONDS is 7200 (2h)", () => {
    expect(ADMIN_TOKEN_TTL_SECONDS).toBe(7200);
  });

  it("buildSetCookieHeader contains the token + HttpOnly + SameSite=Strict", async () => {
    const token = await signAdminToken({ sub: "u", username: "a" });
    const header = buildSetCookieHeader(token);
    expect(header).toContain(`${ADMIN_COOKIE_NAME}=${token}`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Path=/");
  });

  it("buildClearCookieHeader sets Max-Age=0", () => {
    const header = buildClearCookieHeader();
    expect(header).toContain(`${ADMIN_COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
  });

  it("adminCookieOptions returns secure=false in dev (NODE_ENV !== production)", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    expect(adminCookieOptions().secure).toBe(false);
    process.env.NODE_ENV = orig;
  });

  it("adminCookieOptions returns secure=true in production", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(adminCookieOptions().secure).toBe(true);
    process.env.NODE_ENV = orig;
  });

  it("buildSetCookieHeader includes Secure in production", async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const token = await signAdminToken({ sub: "u", username: "a" });
    expect(buildSetCookieHeader(token)).toContain("Secure");
    process.env.NODE_ENV = orig;
  });
});

describe("auth: resolveAdminForLogin", () => {
  beforeEach(() => {
    mockAdminUser.findFirst.mockReset();
    mockAdminUser.create.mockReset();
    envSave.ADMIN_USERNAME = process.env.ADMIN_USERNAME;
    envSave.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });
  afterEach(() => {
    if (envSave.ADMIN_USERNAME !== undefined) process.env.ADMIN_USERNAME = envSave.ADMIN_USERNAME;
    if (envSave.ADMIN_PASSWORD !== undefined) process.env.ADMIN_PASSWORD = envSave.ADMIN_PASSWORD;
  });

  it("returns null for empty username", async () => {
    expect(await resolveAdminForLogin("", "pass")).toBeNull();
  });

  it("returns null for empty password", async () => {
    expect(await resolveAdminForLogin("admin", "")).toBeNull();
  });

  it("returns null when admin not found and no bootstrap env configured", async () => {
    mockAdminUser.findFirst.mockResolvedValue(null);
    expect(await resolveAdminForLogin("unknown", "pass")).toBeNull();
    expect(mockAdminUser.findFirst).toHaveBeenCalledWith({ where: { username: "unknown" } });
  });

  it("creates and returns admin when bootstrap env matches and admin doesn't exist yet", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "bootstrap-pass";
    mockAdminUser.findFirst.mockResolvedValueOnce(null); // first lookup: not found
    mockAdminUser.create.mockImplementation(async (args: { data: { username: string; password: string } }) => ({
      id: "new_id",
      username: args.data.username,
      password: args.data.password,
    }));
    mockAdminUser.findFirst.mockResolvedValueOnce({ id: "new_id", username: "admin", password: "hashed" });
    // After create, bcrypt.compare(bootstrap-pass, hashed) — but we control the mock.
    // The create mock returns password: args.data.password which is the bcrypt hash.
    // resolveAdminForLogin then calls bcrypt.compare(password, admin.password) where
    // admin is the created row. Since the create mock returns the hash as password,
    // and bcrypt.compare(bootstrap-pass, hash) will be true (the hash was derived
    // from bootstrap-pass by the real bcrypt.hash call inside resolveAdminForLogin).
    const result = await resolveAdminForLogin("admin", "bootstrap-pass");
    expect(result).not.toBeNull();
    expect(result!.username).toBe("admin");
    expect(mockAdminUser.create).toHaveBeenCalledTimes(1);
  });

  it("returns admin when bootstrap env matches and admin exists with correct password", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "bootstrap-pass";
    // Hash the password with real bcrypt so the compare inside resolveAdminForLogin passes.
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("bootstrap-pass", 12);
    mockAdminUser.findFirst.mockResolvedValue({ id: "id1", username: "admin", password: hash });
    const result = await resolveAdminForLogin("admin", "bootstrap-pass");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("id1");
  });

  it("returns null when bootstrap env matches but password is wrong", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "bootstrap-pass";
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("different-pass", 12);
    mockAdminUser.findFirst.mockResolvedValue({ id: "id1", username: "admin", password: hash });
    const result = await resolveAdminForLogin("admin", "bootstrap-pass");
    expect(result).toBeNull();
  });

  it("returns null when bootstrap env is set but username doesn't match", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "bootstrap-pass";
    mockAdminUser.findFirst.mockResolvedValue(null);
    // Username "other" doesn't match bootstrap "admin" → falls through to the
    // non-bootstrap path, which looks up "other" in the DB.
    expect(await resolveAdminForLogin("other", "pass")).toBeNull();
  });

  it("returns admin when a pre-existing (non-bootstrap) admin matches", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("real-pass", 12);
    mockAdminUser.findFirst.mockResolvedValue({ id: "id2", username: "preexisting", password: hash });
    const result = await resolveAdminForLogin("preexisting", "real-pass");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("id2");
  });

  it("returns null when a pre-existing admin has a wrong password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("real-pass", 12);
    mockAdminUser.findFirst.mockResolvedValue({ id: "id2", username: "preexisting", password: hash });
    expect(await resolveAdminForLogin("preexisting", "wrong-pass")).toBeNull();
  });

  it("never calls db.create when bootstrap env is not set (no auto-create)", async () => {
    mockAdminUser.findFirst.mockResolvedValue(null);
    await resolveAdminForLogin("admin", "pass");
    expect(mockAdminUser.create).not.toHaveBeenCalled();
  });

  it("never calls db.create when bootstrap env is set but username differs (non-bootstrap path)", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "pass";
    mockAdminUser.findFirst.mockResolvedValue(null);
    await resolveAdminForLogin("other", "pass");
    expect(mockAdminUser.create).not.toHaveBeenCalled();
  });
});
