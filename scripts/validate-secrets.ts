/**
 * ════════════════════════════════════════════════════════════════════════════
 * LetraMestre — Validador de Variáveis de Ambiente (standalone)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Script standalone que valida as variáveis de ambiente do LetraMestre.
 * NÃO importa código de src/ — lê apenas process.env.
 *
 * Uso:
 *   bun run scripts/validate-secrets.ts
 *   bun run scripts/validate-secrets.ts --json     # saída JSON (para CI)
 *   bun run scripts/validate-secrets.ts --help
 *
 * Lógica:
 *   - Carrega .env automaticamente via dotenv-like parsing simples (sem dep).
 *   - Verifica cada secret: presente, tamanho, não-default.
 *   - Imprime relatório tabulado.
 *   - Sai com código:
 *       0 — overall=ok
 *       1 — overall=warning (algum secret fraco ou não-default)
 *       2 — overall=critical (algum secret required ausente ou default perigoso)
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

// ─── Padrões reconhecidos como "default/dev" (NUNCA válidos em produção) ────

const DEFAULT_PATTERNS: RegExp[] = [
  /^placeholder-/i,
  /^dev-/i,
  /^change-me/i,
  /^troque-/i,
  /^trocar-/i,
  /^insecure/i,
  /^example/i,
  /^your-/i,
  /^xxx/i,
  /^secret$/i,
  /^admin$/i, // username "admin"
  /^password$/i,
];

function isDefaultValue(value: string): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return DEFAULT_PATTERNS.some((re) => re.test(v));
}

// ─── Carregamento simples de .env (sem dependência externa) ──────────────────

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Remove aspas duplas ou simples
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Não sobrescreve variáveis já presentes no ambiente real
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Strength = "strong" | "weak" | "missing";
type Severity = "ok" | "warning" | "critical";

interface CheckResult {
  name: string;
  required: boolean;
  present: boolean;
  strength: Strength;
  issue: string | null;
  recommendation: string;
}

// ─── Regras de validação ─────────────────────────────────────────────────────

function checkAuthSecret(): CheckResult {
  const v = process.env.AUTH_SECRET ?? "";
  const name = "AUTH_SECRET";
  if (!v) {
    return {
      name,
      required: true,
      present: false,
      strength: "missing",
      issue: "Não definido.",
      recommendation: "Gere com `openssl rand -base64 32`.",
    };
  }
  if (isDefaultValue(v)) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: "Valor parece ser placeholder/default de desenvolvimento.",
      recommendation: "Gere com `openssl rand -base64 32` em produção.",
    };
  }
  if (v.length < 16) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: `Segredo muito curto (${v.length} chars < 16).`,
      recommendation: "Use >= 32 chars para HS256.",
    };
  }
  return {
    name,
    required: true,
    present: true,
    strength: "strong",
    issue: null,
    recommendation: "Mantenha >= 32 chars, rotacione a cada 90 dias.",
  };
}

function checkInternalApiKey(): CheckResult {
  const v = process.env.INTERNAL_API_KEY ?? "";
  const name = "INTERNAL_API_KEY";
  if (!v) {
    return {
      name,
      required: true,
      present: false,
      strength: "missing",
      issue: "Não definido.",
      recommendation: "Gere com `openssl rand -hex 32`.",
    };
  }
  if (isDefaultValue(v)) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: "Valor parece ser placeholder/default de desenvolvimento.",
      recommendation: "Gere com `openssl rand -hex 32` em produção.",
    };
  }
  if (v.length < 16) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: `Chave muito curta (${v.length} chars < 16).`,
      recommendation: "Use >= 32 chars.",
    };
  }
  return {
    name,
    required: true,
    present: true,
    strength: "strong",
    issue: null,
    recommendation: "Rotacione a cada 90 dias.",
  };
}

function checkAdminUsername(): CheckResult {
  const v = process.env.ADMIN_USERNAME ?? "";
  const name = "ADMIN_USERNAME";
  if (!v) {
    return {
      name,
      required: true,
      present: false,
      strength: "missing",
      issue: "Não definido.",
      recommendation: "Defina um nome de admin NÃO-default (>= 3 chars).",
    };
  }
  if (v.toLowerCase() === "admin" || isDefaultValue(v)) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: "Username padrão 'admin' ou placeholder.",
      recommendation: "Use um nome não-default.",
    };
  }
  if (v.length < 3) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: `Username muito curto (${v.length} chars < 3).`,
      recommendation: "Use >= 3 chars.",
    };
  }
  return {
    name,
    required: true,
    present: true,
    strength: "strong",
    issue: null,
    recommendation: "Remova do .env após o primeiro login do admin.",
  };
}

function checkAdminPassword(): CheckResult {
  const v = process.env.ADMIN_PASSWORD ?? "";
  const name = "ADMIN_PASSWORD";
  if (!v) {
    return {
      name,
      required: true,
      present: false,
      strength: "missing",
      issue: "Não definido.",
      recommendation: "Defina uma senha >= 12 chars.",
    };
  }
  if (isDefaultValue(v)) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: "Senha parece ser placeholder/default.",
      recommendation: "Gere com `openssl rand -base64 18` ou use gerenciador.",
    };
  }
  if (v.length < 12) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: `Senha curta (${v.length} chars < 12).`,
      recommendation: "Use >= 12 chars misturando classes.",
    };
  }
  return {
    name,
    required: true,
    present: true,
    strength: "strong",
    issue: null,
    recommendation: "Rotacione a cada 90 dias. Remova do .env após bootstrap.",
  };
}

function checkDatabaseUrl(): CheckResult {
  const v = process.env.DATABASE_URL ?? "";
  const name = "DATABASE_URL";
  if (!v) {
    return {
      name,
      required: true,
      present: false,
      strength: "missing",
      issue: "Não definido.",
      recommendation: "Defina como file:<caminho> (Prisma SQLite).",
    };
  }
  if (!v.startsWith("file:")) {
    return {
      name,
      required: true,
      present: true,
      strength: "weak",
      issue: "Formato inesperado (deveria começar com 'file:').",
      recommendation: "Use 'file:./db/custom.db' (dev) ou caminho absoluto (prod).",
    };
  }
  return {
    name,
    required: true,
    present: true,
    strength: "strong",
    issue: null,
    recommendation: "Em produção use caminho absoluto em volume persistente.",
  };
}

function checkOptional(name: string, envKey: string, hint: string): CheckResult {
  const v = process.env[envKey] ?? "";
  if (!v) {
    return {
      name,
      required: false,
      present: false,
      strength: "missing",
      issue: "Não definido (opcional).",
      recommendation: hint,
    };
  }
  return {
    name,
    required: false,
    present: true,
    strength: "strong",
    issue: null,
    recommendation: "OK.",
  };
}

// ─── Agregação ───────────────────────────────────────────────────────────────

function severityFromResults(results: CheckResult[]): Severity {
  let hasMissing = false;
  let hasWeakDefault = false;
  for (const r of results) {
    if (!r.required) continue;
    if (r.strength === "missing") hasMissing = true;
    else if (r.strength === "weak") hasWeakDefault = true;
  }
  if (hasMissing) return "critical";
  if (hasWeakDefault) return "warning";
  return "ok";
}

// ─── Renderização ────────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function renderTable(results: CheckResult[]): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(
    `  ${pad("VAR", 22)} ${pad("REQ", 4)} ${pad("PRESENT", 9)} ${pad("STRENGTH", 10)} PROBLEMA`,
  );
  lines.push(
    `  ${"-".repeat(22)} ${"-".repeat(4)} ${"-".repeat(9)} ${"-".repeat(10)} ${"-".repeat(40)}`,
  );
  for (const r of results) {
    const issue = r.issue ?? "—";
    lines.push(
      `  ${pad(r.name, 22)} ${pad(r.required ? "sim" : "não", 4)} ${pad(r.present ? "sim" : "não", 9)} ${pad(r.strength, 10)} ${issue}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderRecommendations(results: CheckResult[]): string {
  const lines: string[] = ["Recomendações:"];
  for (const r of results) {
    if (!r.present || r.strength !== "strong") {
      lines.push(`  • ${r.name}: ${r.recommendation}`);
    }
  }
  return lines.join("\n");
}

function help(): void {
  console.log(`
LetraMestre — Validador de Variáveis de Ambiente (standalone)

Uso:
  bun run scripts/validate-secrets.ts             Relatório tabulado (human)
  bun run scripts/validate-secrets.ts --json      Saída JSON (para CI)
  bun run scripts/validate-secrets.ts --help      Esta ajuda

Carrega .env do cwd automaticamente (variáveis reais do processo têm precedência).

Saída:
  Código 0 = ok        (todos os required estão strong)
  Código 1 = warning   (algum required weak mas presente)
  Código 2 = critical  (algum required missing ou default perigoso)
`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    help();
    return;
  }

  // Carrega .env (se existir) — variáveis reais têm precedência.
  const envPath = resolve(process.cwd(), ".env");
  loadDotEnv(envPath);

  const results: CheckResult[] = [
    checkAuthSecret(),
    checkInternalApiKey(),
    checkAdminUsername(),
    checkAdminPassword(),
    checkDatabaseUrl(),
    checkOptional("WEB_ORIGIN", "WEB_ORIGIN", "Defina a origem pública para CORS/cookies."),
    checkOptional("GAME_SERVER_PORT", "GAME_SERVER_PORT", "Padrão 3003."),
    checkOptional("WEB_API_URL", "WEB_API_URL", "Padrão http://localhost:3000."),
  ];

  const overall = severityFromResults(results);

  if (args.includes("--json")) {
    const payload = {
      overall,
      secrets: results.map((r) => ({
        name: r.name,
        required: r.required,
        present: r.present,
        strength: r.strength,
        issue: r.issue,
        recommendation: r.recommendation,
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("");
    console.log("LetraMestre — Validação de Variáveis de Ambiente");
    console.log(`Arquivo .env carregado: ${existsSync(envPath) ? envPath : "(não encontrado, usando apenas process.env)"}`);
    console.log(renderTable(results));

    const label = { ok: "✓ OK", warning: "⚠  WARNING", critical: "✗ CRITICAL" }[overall];
    console.log(`Overall: ${label}`);
    console.log("");
    console.log(renderRecommendations(results));
    console.log("");
  }

  // Código de saída
  const code = overall === "ok" ? 0 : overall === "warning" ? 1 : 2;
  process.exit(code);
}

main();
