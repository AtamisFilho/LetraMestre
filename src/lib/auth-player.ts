/**
 * LetraMestre — Fase 1: Auth do jogador (separada do admin)
 *
 * Stack: bcryptjs (cost 12) + jose (JWT HS256 com AUTH_SECRET).
 * Cookie `player_session`, TTL 7 dias, HttpOnly, Secure em prod, SameSite=Lax (importante p/ OAuth), Path=/.
 *
 * Token JWT inclui `scope: 'player'` para distinguir do admin (que usaria outro claim/scope).
 *
 * IMPORTANTE: este módulo só funciona server-side (usa `next/headers`).
 */
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'

// ---------------------------------------------------------------
// Constantes públicas
// ---------------------------------------------------------------

export const PLAYER_COOKIE_NAME = 'player_session'
export const PLAYER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 dias
const BCRYPT_COST = 12
const JWT_ALG = 'HS256'

// ---------------------------------------------------------------
// Secret helper (mesmo padrão usado para admin, distinto por claim)
// ---------------------------------------------------------------

function getAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'letramestre-dev-secret-please-change-in-production-32bytes'
  if (secret.length < 16) {
    throw new Error('AUTH_SECRET deve ter pelo menos 16 caracteres')
  }
  return secret
}

function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

// ---------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------

export interface PlayerTokenPayload {
  id: string
  email: string
  username: string
  scope: 'player'
}

export interface PlayerSession {
  id: string
  email: string
  username: string
}

// ---------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, BCRYPT_COST)
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pw, hash)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------

export async function signPlayerToken(input: {
  id: string
  email: string
  username: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    id: input.id,
    email: input.email,
    username: input.username,
    scope: 'player',
  })
    .setProtectedHeader({ alg: JWT_ALG, typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + PLAYER_TOKEN_TTL_SECONDS)
    .setSubject(input.id)
    .setIssuer('letramestre:player')
    .sign(secretToKey(getAuthSecret()))
}

export async function verifyPlayerToken(token: string): Promise<PlayerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretToKey(getAuthSecret()), {
      algorithms: [JWT_ALG],
      issuer: 'letramestre:player',
    })
    if (
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.username !== 'string' ||
      payload.scope !== 'player'
    ) {
      return null
    }
    return {
      id: payload.id,
      email: payload.email,
      username: payload.username,
      scope: 'player',
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------

export interface PlayerCookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge: number
}

export function playerCookieOptions(): PlayerCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PLAYER_TOKEN_TTL_SECONDS,
  }
}

/**
 * Constrói o valor do header `Set-Cookie` para o token de jogador.
 * Não depende de nenhuma lib externa (serialização manual).
 */
export function buildPlayerSetCookieHeader(token: string): string {
  const opts = playerCookieOptions()
  const parts: string[] = [
    `${PLAYER_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=${opts.sameSite.charAt(0).toUpperCase()}${opts.sameSite.slice(1)}`,
  ]
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildPlayerClearCookieHeader(): string {
  const opts = playerCookieOptions()
  const parts: string[] = [
    `${PLAYER_COOKIE_NAME}=`,
    `Path=${opts.path}`,
    'Max-Age=0',
    `SameSite=${opts.sameSite.charAt(0).toUpperCase()}${opts.sameSite.slice(1)}`,
  ]
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

// ---------------------------------------------------------------
// Session helpers (server-side only — usam next/headers)
// ---------------------------------------------------------------

/**
 * Lê o cookie `player_session` via `cookies()` do next/headers,
 * verifica o JWT e retorna a sessão do jogador ou null.
 *
 * Server-only (route handlers, server components, server actions).
 */
export async function getPlayerSession(): Promise<PlayerSession | null> {
  try {
    const store = await cookies()
    const token = store.get(PLAYER_COOKIE_NAME)?.value
    if (!token) return null
    const payload = await verifyPlayerToken(token)
    if (!payload) return null
    return { id: payload.id, email: payload.email, username: payload.username }
  } catch {
    return null
  }
}

/**
 * Retorna a sessão do jogador ou null. Use em rotas que precisam distinguir
 * 401 manualmente. Nas rotas, trate o null retornando 401.
 */
export async function requirePlayer(): Promise<PlayerSession | null> {
  return getPlayerSession()
}

// ---------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------

export function buildAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`
}

// ---------------------------------------------------------------
// Zod schemas (reutilizados nos endpoints)
// ---------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, 'Use apenas letras, números e underscore'),
  password: z.string().min(8).max(72),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(128),
  password: z.string().min(8).max(72),
})

export const googleDemoSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(80).optional(),
})

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().max(500).optional(),
})

export const simulateGameSchema = z.object({
  result: z.enum(['win', 'loss', 'draw']).optional(),
  score: z.number().int().min(0).max(9999).optional(),
  opponent: z.string().min(1).max(60).optional(),
})

// ---------------------------------------------------------------
// Tipos de saída (sem passwordHash, sem tokens de reset)
// ---------------------------------------------------------------

export interface PublicPlayer {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio: string
  emailVerified: string | null
  lastLoginAt: string | null
  gamesPlayed: number
  gamesWon: number
  totalScore: number
  bestScore: number
  createdAt: string
}

export interface PlayerWithStats extends PublicPlayer {
  winRate: number
  googleLinked: boolean
}

export function toPublicPlayer(
  p: {
    id: string
    email: string
    username: string
    displayName: string
    avatarUrl: string | null
    bio: string
    emailVerified: Date | null
    lastLoginAt: Date | null
    gamesPlayed: number
    gamesWon: number
    totalScore: number
    bestScore: number
    createdAt: Date
    googleId?: string | null
  },
): PublicPlayer {
  return {
    id: p.id,
    email: p.email,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    bio: p.bio,
    emailVerified: p.emailVerified ? p.emailVerified.toISOString() : null,
    lastLoginAt: p.lastLoginAt ? p.lastLoginAt.toISOString() : null,
    gamesPlayed: p.gamesPlayed,
    gamesWon: p.gamesWon,
    totalScore: p.totalScore,
    bestScore: p.bestScore,
    createdAt: p.createdAt.toISOString(),
  }
}

export function withStats(p: PublicPlayer): PlayerWithStats {
  const winRate =
    p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0
  return { ...p, winRate, googleLinked: false }
}
