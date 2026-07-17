/**
 * Cliente de dados do Console de Operações LetraMestre (Fase 0).
 *
 * Tipos alinhados ao contrato de API definido no worklog:
 * `/home/z/my-project/worklog.md` (seção "Contrato de API").
 *
 * Todas as funções fazem fetch client-side com `cache: 'no-store'` e
 * lançam `OpsApiError` em caso de falha. Os consumidores (seções) devem
 * tratar o erro e mostrar skeletons/mensagens graceful.
 */

'use client';

// ---------------------------------------------------------------------------
// Tipos compartilhados
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type SecretStrength = 'strong' | 'weak' | 'missing';
export type SecretOverall = 'ok' | 'warning' | 'critical';
export type BuildStatus = 'pass' | 'fail' | 'blocked' | 'pending';
export type DebtStatus = 'open' | 'closed';
export type DebtSeverity = 'low' | 'medium' | 'high';
export type ReleaseType = 'major' | 'minor' | 'patch';
export type MetricsSource = 'live' | 'simulated';

// ---------------------------------------------------------------------------
// GET /api/ops/phase0/status
// ---------------------------------------------------------------------------

export interface ExitCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface PhaseTask {
  id: string;
  title: string;
  owner: string;
  effort: string;
  status: TaskStatus;
  progress: number;
}

export interface Phase0Status {
  milestone: string;
  phase: string;
  weeks: string;
  overallProgress: number;
  exitCriteria: ExitCriterion[];
  tasks: PhaseTask[];
}

// ---------------------------------------------------------------------------
// GET /api/ops/metrics
// ---------------------------------------------------------------------------

export interface SystemMetrics {
  memoryMb: number;
  heapMb: number;
  cpuLoad: number;
  nodeVersion: string;
  platform: string;
}

export interface GameMetrics {
  activeRooms: number;
  activeConnections: number;
  peakConnections: number;
  totalConnections: number;
  reconnections: number;
  rateLimited: number;
  memoryMb: number;
  source: MetricsSource;
}

export interface DatabaseMetrics {
  totalGames: number;
  activeGames: number;
  waitingGames: number;
  finishedGames: number;
  totalPlayers: number;
  totalMoves: number;
  approvedWords: number;
  bannedWords: number;
  dbSizeMb: number;
}

export interface MetricHistoryPoint {
  t: string;
  activeRooms: number;
  activeConnections: number;
  memoryMb: number;
}

export interface OpsMetrics {
  timestamp: string;
  source: MetricsSource;
  uptimeMs: number;
  system: SystemMetrics;
  game: GameMetrics;
  database: DatabaseMetrics;
  history: MetricHistoryPoint[];
}

// ---------------------------------------------------------------------------
// GET /api/ops/secrets/status
// ---------------------------------------------------------------------------

export interface SecretItem {
  name: string;
  required: boolean;
  present: boolean;
  strength: SecretStrength;
  issue: string | null;
  recommendation: string;
}

export interface SecretsStatus {
  overall: SecretOverall;
  secrets: SecretItem[];
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export interface BackupRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  durationMs: number;
  verified: boolean;
  verifiedAt: string | null;
}

export interface BackupRunResult {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  durationMs: number;
  path: string;
}

export interface BackupHistory {
  backups: BackupRecord[];
  lastBackupAt: string | null;
  autoBackupEnabled: boolean;
  schedule: string;
  totalSizeBytes: number;
}

export interface BackupRestoreResult {
  ok: boolean;
  restoredFrom: string;
  verifiedAt: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

export interface ChangelogEntry {
  version: string;
  date: string;
  type: ReleaseType;
  summary: string;
  changes: string[];
}

export interface ReleaseChangelog {
  currentVersion: string;
  nextPlanned: string;
  entries: ChangelogEntry[];
}

export interface ReleaseRecord {
  id: string;
  version: string;
  tag: string;
  date: string;
  type: ReleaseType;
  notes: string;
  releasedBy: string;
}

export interface ReleaseHistory {
  releases: ReleaseRecord[];
}

export interface ReleaseTagResult {
  id: string;
  tag: string;
  version: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Dívida técnica
// ---------------------------------------------------------------------------

export interface DebtItem {
  id: string;
  title: string;
  area: string;
  severity: DebtSeverity;
  status: DebtStatus;
  file: string;
  description: string;
  resolution: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface DebtList {
  items: DebtItem[];
  openCount: number;
  closedCount: number;
}

export interface DebtCloseResult {
  id: string;
  status: 'closed';
  closedAt: string;
  resolution: string;
}

// ---------------------------------------------------------------------------
// Build Android
// ---------------------------------------------------------------------------

export interface BuildStep {
  name: string;
  ok: boolean;
  detail: string;
}

export interface AndroidBuildStatus {
  status: BuildStatus;
  lastRun: string | null;
  durationMs: number;
  configValid: boolean;
  gradleWrapperPresent: boolean;
  androidSdkAvailable: boolean;
  steps: BuildStep[];
  artifact: string | null;
  log: string;
  blocker: string | null;
}

// ---------------------------------------------------------------------------
// Erro de API
// ---------------------------------------------------------------------------

export class OpsApiError extends Error {
  status: number;
  endpoint: string;
  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'OpsApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function opsFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    // Falha de rede / servidor fora do ar.
    throw new OpsApiError(
      `Falha de conexão com ${endpoint}`,
      0,
      endpoint,
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error || data?.message || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new OpsApiError(
      detail || `Erro ${res.status} em ${endpoint}`,
      res.status,
      endpoint,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new OpsApiError(
      `Resposta inválida (não-JSON) de ${endpoint}`,
      res.status,
      endpoint,
    );
  }
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

export const fetchPhase0Status = () =>
  opsFetch<Phase0Status>('/api/ops/phase0/status');

export const fetchMetrics = () => opsFetch<OpsMetrics>('/api/ops/metrics');

export const fetchSecretsStatus = () =>
  opsFetch<SecretsStatus>('/api/ops/secrets/status');

export const fetchBackupHistory = () =>
  opsFetch<BackupHistory>('/api/ops/backup/history');

export const runBackup = () =>
  opsFetch<BackupRunResult>('/api/ops/backup/run', { method: 'POST' });

export const restoreBackup = (id: string) =>
  opsFetch<BackupRestoreResult>('/api/ops/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });

export const fetchReleaseChangelog = () =>
  opsFetch<ReleaseChangelog>('/api/ops/release/changelog');

export const fetchReleaseHistory = () =>
  opsFetch<ReleaseHistory>('/api/ops/release/history');

export const tagRelease = (body: {
  version: string;
  type: ReleaseType;
  notes: string;
}) =>
  opsFetch<ReleaseTagResult>('/api/ops/release/tag', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchDebtItems = () =>
  opsFetch<DebtList>('/api/ops/debt/items');

export const closeDebt = (body: { id: string; resolution: string }) =>
  opsFetch<DebtCloseResult>('/api/ops/debt/close', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchAndroidBuildStatus = () =>
  opsFetch<AndroidBuildStatus>('/api/ops/build/android/status');

export const validateAndroidBuild = () =>
  opsFetch<AndroidBuildStatus>('/api/ops/build/android/validate', {
    method: 'POST',
  });

// ---------------------------------------------------------------------------
// Utilitários de formatação
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatUptime(ms: number): string {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
