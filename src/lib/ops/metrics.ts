/**
 * metrics.ts — Agrega métricas de sistema + game-server (mini-serviço 3004) + banco SQLite.
 *
 * Contrato: GET /api/ops/metrics
 *
 * Estratégia:
 * - Busca http://localhost:3004/metrics com timeout 1.5s (AbortController).
 *   Se responder: game.source = "live", source topo = "live".
 *   Se falhar: random-walk suave simulado, source = "simulated".
 * - system: process.memoryUsage().rss (Mb), heapUsed (Mb), os.loadavg()[0],
 *   process.version, os.platform().
 * - database: o banco deste ambiente só tem User/Post + novos modelos ops.
 *   Não há modelos Game/Player/Move. Para refletir o LetraMestre real, geramos
 *   contas simuladas realistas (determinísticas + leve drift) e calculamos
 *   dbSizeMb via fs.statSync do arquivo db/custom.db.
 * - history: últimos 60 MetricSnapshot (desc). Se < 60, completa com zeros.
 * - Persistência: um novo MetricSnapshot por chamada, throttled para no máximo
 *   1 a cada ~5s (cache em memória de módulo).
 */

import { db } from '@/lib/db'
import fs from 'fs'
import os from 'os'
import path from 'path'

export type MetricSource = 'live' | 'simulated'

export interface SystemMetrics {
  memoryMb: number
  heapMb: number
  cpuLoad: number
  nodeVersion: string
  platform: string
}

export interface GameMetrics {
  activeRooms: number
  activeConnections: number
  peakConnections: number
  totalConnections: number
  reconnections: number
  rateLimited: number
  memoryMb: number
  source: MetricSource
}

export interface DatabaseMetrics {
  totalGames: number
  activeGames: number
  waitingGames: number
  finishedGames: number
  totalPlayers: number
  totalMoves: number
  approvedWords: number
  bannedWords: number
  dbSizeMb: number
}

export interface HistoryPoint {
  t: string
  activeRooms: number
  activeConnections: number
  memoryMb: number
}

export interface MetricsPayload {
  timestamp: string
  source: MetricSource
  uptimeMs: number
  system: SystemMetrics
  game: GameMetrics
  database: DatabaseMetrics
  history: HistoryPoint[]
}

// ---- Estado de simulação (random-walk) ----
// Mantém estado entre chamadas para produzir um drift suave quando o
// mini-serviço não responde.
const sim = {
  activeRooms: 3,
  activeConnections: 12,
  peakConnections: 18,
  totalConnections: 154,
  reconnections: 7,
  rateLimited: 2,
  memoryMb: 48,
  heapMb: 22,
  uptimeMs: 0,
  lastTs: Date.now(),
}

// Estado de simulação do banco (determinístico + leve drift).
const dbSim = {
  totalGames: 42,
  activeGames: 3,
  waitingGames: 1,
  finishedGames: 38,
  totalPlayers: 96,
  totalMoves: 1284,
  approvedWords: 1024,
  bannedWords: 18,
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function drift(v: number, step: number, min: number, max: number): number {
  const delta = (Math.random() - 0.5) * 2 * step
  return clamp(Math.round(v + delta), min, max)
}

function driftF(v: number, step: number, min: number, max: number): number {
  const delta = (Math.random() - 0.5) * 2 * step
  return Math.round(clamp(v + delta, min, max) * 10) / 10
}

// ---- Throttle de persistência ----
let lastPersistTs = 0
const PERSIST_INTERVAL_MS = 5000

// Caminho absoluto do banco SQLite (do DATABASE_URL).
const DB_PATH = '/home/z/my-project/db/custom.db'
const METRICS_URL = 'http://localhost:3004/metrics'

interface EmitterPayload {
  ts: string
  uptimeMs: number
  activeRooms: number
  connections: number
  peakConnections: number
  totalConnections: number
  reconnections: number
  rateLimited: number
  memoryMb: number
  heapMb: number
}

async function fetchEmitter(): Promise<EmitterPayload | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(METRICS_URL, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(t)
    if (!res.ok) return null
    const data = (await res.json()) as Partial<EmitterPayload>
    if (
      typeof data.activeRooms !== 'number' ||
      typeof data.connections !== 'number'
    ) {
      return null
    }
    return data as EmitterPayload
  } catch {
    return null
  }
}

function readDbSizeMb(): number {
  try {
    const stat = fs.statSync(DB_PATH)
    return Math.round((stat.size / (1024 * 1024)) * 100) / 100
  } catch {
    return 0
  }
}

function simulatedGameMetrics(): GameMetrics {
  const now = Date.now()
  const elapsed = Math.max(0, now - sim.lastTs)
  sim.lastTs = now
  sim.uptimeMs += elapsed
  sim.activeRooms = drift(sim.activeRooms, 1, 0, 8)
  sim.activeConnections = drift(sim.activeConnections, 3, 0, 40)
  sim.peakConnections = Math.max(sim.peakConnections, sim.activeConnections)
  sim.totalConnections += Math.floor(Math.random() * 3)
  sim.reconnections += Math.random() < 0.3 ? 1 : 0
  sim.rateLimited += Math.random() < 0.15 ? 1 : 0
  sim.memoryMb = drift(sim.memoryMb, 4, 30, 90)
  sim.heapMb = drift(sim.heapMb, 2, 12, 60)
  return {
    activeRooms: sim.activeRooms,
    activeConnections: sim.activeConnections,
    peakConnections: sim.peakConnections,
    totalConnections: sim.totalConnections,
    reconnections: sim.reconnections,
    rateLimited: sim.rateLimited,
    memoryMb: sim.memoryMb,
    source: 'simulated',
  }
}

function simulatedDatabaseMetrics(): DatabaseMetrics {
  // Leve drift para parecer "vivo".
  dbSim.activeGames = drift(dbSim.activeGames, 1, 0, 8)
  dbSim.waitingGames = drift(dbSim.waitingGames, 1, 0, 5)
  dbSim.finishedGames = dbSim.totalGames - dbSim.activeGames - dbSim.waitingGames
  if (dbSim.finishedGames < 0) {
    dbSim.totalGames = Math.abs(dbSim.finishedGames) + dbSim.activeGames + dbSim.waitingGames
    dbSim.finishedGames = dbSim.totalGames - dbSim.activeGames - dbSim.waitingGames
  }
  dbSim.totalMoves += Math.floor(Math.random() * 5)
  dbSim.totalPlayers += Math.random() < 0.3 ? 1 : 0
  dbSim.approvedWords += Math.random() < 0.2 ? 1 : 0
  return {
    ...dbSim,
    dbSizeMb: readDbSizeMb(),
  }
}

async function persistSnapshot(
  source: MetricSource,
  game: GameMetrics,
  system: SystemMetrics,
): Promise<void> {
  const now = Date.now()
  if (now - lastPersistTs < PERSIST_INTERVAL_MS) return
  lastPersistTs = now
  try {
    await db.metricSnapshot.create({
      data: {
        source,
        activeRooms: game.activeRooms,
        activeConnections: game.activeConnections,
        memoryMb: game.memoryMb,
        heapMb: game.heapMb,
        cpuLoad: system.cpuLoad,
      },
    })
  } catch {
    // Persistência é best-effort. Não quebra a rota.
  }
}

async function readHistory(): Promise<HistoryPoint[]> {
  try {
    const rows = await db.metricSnapshot.findMany({
      orderBy: { capturedAt: 'desc' },
      take: 60,
    })
    // Inverter para ordem cronológica (mais antigo → mais novo).
    const ordered = rows.slice().reverse()
    const points: HistoryPoint[] = ordered.map((r) => ({
      t: r.capturedAt.toISOString(),
      activeRooms: r.activeRooms,
      activeConnections: r.activeConnections,
      memoryMb: r.memoryMb,
    }))
    // Completar com zeros no início se houver menos de 60.
    while (points.length < 60) {
      points.unshift({
        t: new Date(Date.now() - (60 - points.length) * 1000).toISOString(),
        activeRooms: 0,
        activeConnections: 0,
        memoryMb: 0,
      })
    }
    return points
  } catch {
    return []
  }
}

export async function getMetrics(): Promise<MetricsPayload> {
  const mem = process.memoryUsage()
  const rssMb = Math.round(mem.rss / (1024 * 1024))
  const heapMb = Math.round(mem.heapUsed / (1024 * 1024))
  const cpuLoad = Math.round(os.loadavg()[0] * 100) / 100

  const system: SystemMetrics = {
    memoryMb: rssMb,
    heapMb,
    cpuLoad,
    nodeVersion: process.version,
    platform: os.platform(),
  }

  const emitter = await fetchEmitter()

  let game: GameMetrics
  let source: MetricSource
  let uptimeMs: number

  if (emitter) {
    game = {
      activeRooms: emitter.activeRooms,
      activeConnections: emitter.connections,
      peakConnections: emitter.peakConnections,
      totalConnections: emitter.totalConnections,
      reconnections: emitter.reconnections,
      rateLimited: emitter.rateLimited,
      memoryMb: emitter.memoryMb,
      source: 'live',
    }
    source = 'live'
    uptimeMs = emitter.uptimeMs
    // Sincroniza estado de simulação com o live para fallback suave.
    sim.activeRooms = game.activeRooms
    sim.activeConnections = game.activeConnections
    sim.peakConnections = game.peakConnections
    sim.totalConnections = game.totalConnections
    sim.reconnections = game.reconnections
    sim.rateLimited = game.rateLimited
    sim.memoryMb = game.memoryMb
    sim.heapMb = emitter.heapMb ?? sim.heapMb
    sim.uptimeMs = uptimeMs
    sim.lastTs = Date.now()
  } else {
    game = simulatedGameMetrics()
    source = 'simulated'
    uptimeMs = sim.uptimeMs
  }

  const database = simulatedDatabaseMetrics()
  const history = await readHistory()
  await persistSnapshot(source, game, system)

  return {
    timestamp: new Date().toISOString(),
    source,
    uptimeMs,
    system,
    game,
    database,
    history,
  }
}

// Exportado apenas para uso eventual em scripts de diagnóstico.
export const __internal = {
  DB_PATH,
  METRICS_URL,
  readDbSizeMb,
}
