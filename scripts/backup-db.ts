/**
 * ════════════════════════════════════════════════════════════════════════════
 * LetraMestre — Backup do SQLite (standalone)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Script standalone (sem deps externas; roda com `bun` ou `node`).
 * Opera SOMENTE no nível de filesystem — NÃO importa Prisma nem código de app.
 *
 * Uso:
 *   bun run scripts/backup-db.ts                 # cria backup agora
 *   bun run scripts/backup-db.ts --list          # lista backups existentes
 *   bun run scripts/backup-db.ts --keep N        # remove backups além dos últimos N
 *   bun run scripts/backup-db.ts --restore <arq> # restaura de um backup
 *   bun run scripts/backup-db.ts --restore <arq> --yes  # sem prompt de confirmação
 *   bun run scripts/backup-db.ts --help          # ajuda
 *
 * Variáveis de ambiente opcionais:
 *   LM_DB_PATH        — caminho do banco (padrão: db/custom.db, relativo ao cwd)
 *   LM_BACKUP_DIR     — diretório de backups (padrão: backups, relativo ao cwd)
 *
 * Saída:
 *   - 0 em sucesso.
 *   - 1 em erro (DB ausente, backup não encontrado, falha de cópia).
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, readFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import process from "node:process";

// ─── Configuração ────────────────────────────────────────────────────────────

const DB_PATH = process.env.LM_DB_PATH
  ? resolve(process.env.LM_DB_PATH)
  : resolve(process.cwd(), "db", "custom.db");

const BACKUP_DIR = process.env.LM_BACKUP_DIR
  ? resolve(process.env.LM_BACKUP_DIR)
  : resolve(process.cwd(), "backups");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts(): string {
  // YYYY-MM-DD-HHMMSS em UTC para nome de arquivo determinístico
  const d = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function log(msg: string): void {
  console.log(`[backup-db] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[backup-db] ⚠  ${msg}`);
}

function err(msg: string): void {
  console.error(`[backup-db] ✗ ${msg}`);
}

function sizeFmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ensureBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    log(`Diretório de backups criado: ${BACKUP_DIR}`);
  }
}

function listBackups(): { name: string; path: string; size: number; mtime: Date }[] {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((name) => {
      const path = join(BACKUP_DIR, name);
      const st = statSync(path);
      return { name, path, size: st.size, mtime: st.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // mais recente primeiro
}

// ─── Ações ───────────────────────────────────────────────────────────────────

function actionBackup(keep?: number): void {
  if (!existsSync(DB_PATH)) {
    err(`Banco não encontrado: ${DB_PATH}`);
    err("Defina LM_DB_PATH ou rode este script a partir da raiz do projeto.");
    process.exit(1);
  }
  ensureBackupDir();

  const filename = `${ts()}.db`;
  const dest = join(BACKUP_DIR, filename);

  const t0 = Date.now();
  try {
    copyFileSync(DB_PATH, dest);
  } catch (e) {
    err(`Falha ao copiar: ${(e as Error).message}`);
    process.exit(1);
  }
  const duration = Date.now() - t0;

  const size = statSync(dest).size;
  log(`✓ Backup criado: ${filename} (${sizeFmt(size)}) em ${duration}ms`);
  log(`  Origem: ${DB_PATH}`);
  log(`  Destino: ${dest}`);

  // Retenção opcional
  if (typeof keep === "number" && keep > 0) {
    applyRetention(keep);
  }

  // Resumo final
  const all = listBackups();
  const totalSize = all.reduce((s, b) => s + b.size, 0);
  log(`Total de backups: ${all.length} (${sizeFmt(totalSize)})`);
}

function applyRetention(keep: number): void {
  const all = listBackups();
  if (all.length <= keep) {
    log(`Retenção: ${all.length} backups ≤ ${keep}; nada a remover.`);
    return;
  }
  const toRemove = all.slice(keep);
  let removed = 0;
  for (const b of toRemove) {
    try {
      unlinkSync(b.path);
      removed++;
    } catch (e) {
      warn(`Não foi possível remover ${b.name}: ${(e as Error).message}`);
    }
  }
  log(`Retenção: removidos ${removed} backups antigos (> ${keep})`);
}

function actionList(): void {
  const all = listBackups();
  if (all.length === 0) {
    log(`Nenhum backup encontrado em ${BACKUP_DIR}`);
    return;
  }
  log(`Backups em ${BACKUP_DIR} (${all.length}):`);
  const totalSize = all.reduce((s, b) => s + b.size, 0);
  console.log("");
  console.log("  DATA (UTC)            TAMANHO   ARQUIVO");
  console.log("  ────────────────────  ────────  ──────────────────────────────");
  for (const b of all) {
    const date = b.mtime.toISOString().replace("T", " ").slice(0, 19);
    console.log(`  ${date}   ${sizeFmt(b.size).padStart(8)}   ${b.name}`);
  }
  console.log("");
  log(`Total: ${all.length} backups, ${sizeFmt(totalSize)}`);
}

function actionRestore(filename: string, yes: boolean): void {
  const src = join(BACKUP_DIR, filename);
  if (!existsSync(src)) {
    err(`Backup não encontrado: ${src}`);
    err("Use --list para ver os backups disponíveis.");
    process.exit(1);
  }

  if (!yes) {
    // Confirmação interativa
    const currentSize = existsSync(DB_PATH) ? statSync(DB_PATH).size : 0;
    console.log("");
    warn(`RESTAURAR sobrescreverá ${DB_PATH} (${sizeFmt(currentSize)} atuais)`);
    warn(`Origem: ${src} (${sizeFmt(statSync(src).size)})`);
    console.log("");
    process.stdout.write("Confirma? [y/N] ");
    const answer = readFileSync(0, "utf8").trim().toLowerCase();
    if (answer !== "y" && answer !== "yes" && answer !== "sim") {
      log("Restore cancelado pelo usuário.");
      process.exit(0);
    }
  }

  // Backup pré-restore do estado atual (se existir)
  if (existsSync(DB_PATH)) {
    ensureBackupDir();
    const pre = join(BACKUP_DIR, `${ts()}-pre-restore.db`);
    try {
      copyFileSync(DB_PATH, pre);
      log(`Backup automático do estado atual: ${basename(pre)}`);
    } catch (e) {
      warn(`Não foi possível fazer backup pré-restore: ${(e as Error).message}`);
    }
  }

  try {
    copyFileSync(src, DB_PATH);
  } catch (e) {
    err(`Falha ao restaurar: ${(e as Error).message}`);
    process.exit(1);
  }

  const size = statSync(DB_PATH).size;
  log(`✓ Restaurado de ${filename} para ${DB_PATH} (${sizeFmt(size)})`);
  log("  Recomendado: rode `sqlite3 db/custom.db \"PRAGMA integrity_check;\"`");
}

function help(): void {
  console.log(`
LetraMestre — Backup do SQLite (standalone)

Uso:
  bun run scripts/backup-db.ts                 Cria backup agora
  bun run scripts/backup-db.ts --list          Lista backups existentes
  bun run scripts/backup-db.ts --keep N        Remove backups além dos últimos N
  bun run scripts/backup-db.ts --restore <arq> Restaura de um backup
  bun run scripts/backup-db.ts --restore <arq> --yes   Sem prompt

Variáveis:
  LM_DB_PATH     Caminho do banco (padrão: db/custom.db)
  LM_BACKUP_DIR  Diretório de backups (padrão: backups)

Saída:
  0 sucesso · 1 erro
`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    help();
    return;
  }

  // Modos
  if (args.includes("--list")) {
    actionList();
    return;
  }

  const restoreIdx = args.indexOf("--restore");
  if (restoreIdx !== -1) {
    const file = args[restoreIdx + 1];
    if (!file || file.startsWith("--")) {
      err("--restore requer um nome de arquivo.");
      err("Use: --restore 2025-10-16-223000.db");
      process.exit(1);
    }
    const yes = args.includes("--yes");
    actionRestore(file, yes);
    return;
  }

  const keepIdx = args.indexOf("--keep");
  let keep: number | undefined;
  if (keepIdx !== -1) {
    const n = Number(args[keepIdx + 1]);
    if (!Number.isFinite(n) || n < 0) {
      err(`--keep requer um número >= 0 (recebi: ${args[keepIdx + 1]})`);
      process.exit(1);
    }
    keep = n;
  }

  // Padrão: backup
  actionBackup(keep);
}

main();
