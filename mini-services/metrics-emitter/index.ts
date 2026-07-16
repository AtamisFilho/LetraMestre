/**
 * metrics-emitter — Mini-serviço que emula o /metrics do game-server
 * do LetraMestre. Porta 3004. Servidor HTTP puro (node:http), sem deps.
 *
 * Endpoints:
 *   GET /health   → { status, uptimeMs, ts }
 *   GET /metrics  → JSON com todos os campos
 *   GET /         → mensagem curta
 *
 * Estado em memória com random-walk suave a cada 1s.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

const PORT = 3004

interface EmitterState {
  startedAt: number
  connections: number
  peakConnections: number
  totalConnections: number
  reconnections: number
  rateLimited: number
  activeRooms: number
  memoryMb: number
  heapMb: number
}

const state: EmitterState = {
  startedAt: Date.now(),
  connections: 8,
  peakConnections: 12,
  totalConnections: 124,
  reconnections: 5,
  rateLimited: 1,
  activeRooms: 2,
  memoryMb: 42,
  heapMb: 20,
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function drift(v: number, step: number, min: number, max: number): number {
  const delta = (Math.random() - 0.5) * 2 * step
  return Math.round(clamp(v + delta, min, max))
}

// Tick a cada 1s — random-walk suave.
const tickTimer = setInterval(() => {
  state.activeRooms = drift(state.activeRooms, 1, 0, 8)
  state.connections = drift(state.connections, 3, 0, 40)
  state.peakConnections = Math.max(state.peakConnections, state.connections)
  // Total cresce lentamente.
  if (Math.random() < 0.4) state.totalConnections += 1
  if (Math.random() < 0.25) state.reconnections += 1
  if (Math.random() < 0.12) state.rateLimited += 1
  state.memoryMb = drift(state.memoryMb, 4, 30, 90)
  state.heapMb = drift(state.heapMb, 2, 12, 60)
}, 1000)
tickTimer.unref?.()

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  setCors(res)
  res.statusCode = status
  res.end(JSON.stringify(payload))
}

function uptimeMs(): number {
  return Date.now() - state.startedAt
}

function metricsPayload() {
  return {
    ts: new Date().toISOString(),
    uptimeMs: uptimeMs(),
    activeRooms: state.activeRooms,
    connections: state.connections,
    peakConnections: state.peakConnections,
    totalConnections: state.totalConnections,
    reconnections: state.reconnections,
    rateLimited: state.rateLimited,
    memoryMb: state.memoryMb,
    heapMb: state.heapMb,
    source: 'live',
  }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Preflight CORS.
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.statusCode = 204
    res.end()
    return
  }

  const url = req.url ?? '/'

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  if (url === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      uptimeMs: uptimeMs(),
      ts: new Date().toISOString(),
    })
    return
  }

  if (url === '/metrics') {
    sendJson(res, 200, metricsPayload())
    return
  }

  if (url === '/' || url === '') {
    sendJson(res, 200, {
      service: 'metrics-emitter',
      port: PORT,
      endpoints: ['/health', '/metrics'],
      ts: new Date().toISOString(),
    })
    return
  }

  sendJson(res, 404, { error: 'Not found', path: url })
})

server.listen(PORT, () => {
  // Log simples em stdout para depuração.
  console.log(`[metrics-emitter] ouvindo em http://localhost:${PORT}`)
})

// Graceful shutdown.
function shutdown(signal: string): void {
  console.log(`[metrics-emitter] recebido ${signal}, encerrando...`)
  clearInterval(tickTimer)
  server.close(() => process.exit(0))
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
