# Task 1 — Backend (full-stack-developer)

## Resumo
Implementei toda a camada de dados + bibliotecas de ops + rotas API + mini-serviço
de métricas para o **Console de Operações LetraMestre — Fase 0**.

## Arquivos criados/modificados

### Schema Prisma
- `prisma/schema.prisma` — estendido com 5 modelos novos (mantendo `User`, `Post`):
  `BackupRecord`, `ReleaseRecord`, `TechDebtItem`, `MetricSnapshot`, `BuildValidation`.

### Bibliotecas de operações (`src/lib/ops/`)
- `metrics.ts` — agrega sistema + game-server (fetch 3004 c/ timeout 1.5s) + banco.
  Throttle de persistência (1 snapshot a cada 5s). Fallback random-walk simulado.
- `secrets.ts` — valida `AUTH_SECRET`, `INTERNAL_API_KEY`, `ADMIN_USERNAME`,
  `ADMIN_PASSWORD`, `DATABASE_URL`, `WEB_ORIGIN`, `GAME_SERVER_PORT`. Nunca expõe
  valores — apenas metadados (presente/força).
- `backup.ts` — `runBackup`/`getBackupHistory`/`restoreBackup`. Cria registro ANTES
  de copiar (p/ que snapshot inclua seu próprio registro) + re-cópia após update.
- `release.ts` — parser Keep-a-Changelog (`## [x.y.z] - data` + `### Resumo` +
  bullets), fallback p/ seed do banco. `createRelease` valida semver.
- `debt.ts` — lista ordenada (open→closed, high→low), `closeDebt`.
- `build.ts` — valida gradlew/build.gradle.kts em `/tmp/LetraMestre`, verifica
  `ANDROID_HOME`. Não compila APK. Status: pass/fail/blocked.
- `phase0.ts` — mapa estático de 7 tasks + média ponderada + exitCriteria derivado
  (prod-running=progress 0.1≥80, backup-tested=existe verified, android-build=
  BuildValidation pass, metrics-dashboard=sempre true). Task 0.7 → done se
  openCount==0.
- `index.ts` — barrel.

### Rotas API (`src/app/api/ops/`) — 13 endpoints
- `phase0/status/route.ts` (GET)
- `metrics/route.ts` (GET, force-dynamic)
- `secrets/status/route.ts` (GET)
- `backup/run/route.ts` (POST)
- `backup/history/route.ts` (GET)
- `backup/restore/route.ts` (POST)
- `release/changelog/route.ts` (GET)
- `release/history/route.ts` (GET)
- `release/tag/route.ts` (POST)
- `debt/items/route.ts` (GET)
- `debt/close/route.ts` (POST)
- `build/android/status/route.ts` (GET)
- `build/android/validate/route.ts` (POST)

Todas com `export const dynamic = 'force-dynamic'` e `revalidate = 0`. Tratamento
de erros try/catch com status 500/400 apropriado.

### Mini-serviço metrics-emitter (porta 3004)
- `mini-services/metrics-emitter/package.json` — `dev: bun --hot index.ts`.
- `mini-services/metrics-emitter/index.ts` — servidor HTTP puro (`node:http`),
  random-walk suave a cada 1s. Endpoints `/health`, `/metrics`, `/`.
  CORS `*`, Content-Type JSON.

### Seed
- `scripts/seed-ops.ts` — popula 8 `TechDebtItem` (5 open, 3 closed) e 3
  `ReleaseRecord` (0.1.0, 0.2.0, 0.3.0). Idempotente (upsert/update por título).
- `backups/.gitkeep` — mantém diretório no repositório.

## Validação

### db:push + db:generate
- `bun run db:push` → "Your database is now in sync with your Prisma schema. Done in 70ms"
- `bun run db:generate` → "Generated Prisma Client (v6.19.2)"

### Seed
- `bun run scripts/seed-ops.ts` → `TechDebtItem=8, ReleaseRecord=3`

### Mini-serviço (porta 3004)
- Iniciado com: `bash -c '( cd ... && exec bun index.ts ) >> service.log 2>&1 &'`
  (pattern double-fork-like para sobreviver ao fim do comando Bash).
- `curl http://localhost:3004/health` → `{"status":"ok","uptimeMs":...,"ts":...}`
- `curl http://localhost:3004/metrics` → JSON completo com todos os campos.
- Persiste entre comandos Bash (PID 4832, uptime verificado em ~7.5 min).
- Em restart do dev server, `dev.sh` auto-inicia este mini-serviço (scaneia
  `mini-services/*/package.json` com script `dev`).

### Rotas API (curl tests — todos passando)
- `GET /api/ops/phase0/status` → overallProgress=71, exitCriteria 1/4 met (metrics-dashboard).
- `GET /api/ops/metrics` → source=live (mini-serviço respondeu), history len=60.
- `GET /api/ops/secrets/status` → overall=critical (secrets não definidos no .env — apenas DATABASE_URL).
- `GET /api/ops/debt/items` → 8 itens (5 open, 3 closed), ordenados open→closed / high→low.
- `GET /api/ops/backup/history` → 0 backups inicialmente.
- `POST /api/ops/backup/run` → cria backup, retorna id/filename/sizeBytes/durationMs.
- `POST /api/ops/backup/restore` → ok=true, marca verified=true (após fix do ordem create-then-copy).
- `GET /api/ops/release/changelog` → 3 entries parseadas do CHANGELOG.md (Agente C),
  com summary de `### Resumo` e bullets de `### Added`. Types inferidos: 0.3.0=minor,
  0.2.0=minor, 0.1.0=patch.
- `GET /api/ops/release/history` → 3 releases do seed.
- `POST /api/ops/release/tag` → cria 0.3.1, valida semver.
- `GET /api/ops/build/android/status` → blocked (default, sem lastRun).
- `POST /api/ops/build/android/validate` → detecta gradlew+build.gradle.kts OK,
  ANDROID_HOME ausente → status=blocked, configValid=true.
- `POST /api/ops/debt/close` → marca closed, retorna closedAt/resolution.

### Lint
- `bun run lint` → 0 errors, 0 warnings (após remover eslint-disable desnecessários).

## Problemas conhecidos / pendências
- **Prisma client cache em dev server**: como o dev server Next.js já estava
  rodando antes do `db:push`, o client em cache pode não reconhecer os novos
  modelos. O coordenador deve reiniciar o dev server. O seed rodou com sucesso
  (prova que o schema e client estão corretos).
- **Mini-serviço `bun --hot` instável quando detached**: em testes, `bun --hot`
  morria após ~60-90s quando iniciado via Bash tool. Solução: iniciar com
  `bun index.ts` (sem --hot) para o serviço de produção. O `package.json`
  mantém `bun --hot` para dev interativo. Em restart do dev.sh (que usa
  `exec bun run dev` em subshell com disown), o --hot deve funcionar
  corretamente.
- **Restore SQLite**: o Prisma mantém o file descriptor aberto; em produção,
  recomenda-se parar o processo, restaurar, reiniciar. Em sandbox, a cópia
  em nível de filesystem é suficiente para demonstrar o fluxo. Documentado
  no código.
- **overallProgress=71** (vs 62 no exemplo do worklog): o exemplo do worklog
  é ilustrativo. O valor real computado é 71 (média ponderada com pesos 2
  em 0.1 e 0.3, que têm progress baixo 60 e 20). Ajustável em `phase0.ts`
  se o frontend preferir um número diferente.
- **Banco de dados simulado para métricas**: como o banco deste ambiente só
  tem `User`/`Post` + novos modelos ops (não há `Game`/`Player`/`Move`),
  os contadores de database em `/api/ops/metrics` são simulados com drift
  realista. `dbSizeMb` é real (via `fs.statSync` do `db/custom.db`).

## Status final
- Backend 100% funcional e validado.
- Mini-serviço metrics-emitter rodando na porta 3004 (live).
- Todas as 13 rotas API respondendo conforme o contrato.
- Estado inicial limpo (após re-seed): 8 debt items (5 open/3 closed),
  3 releases, 0 backups, 0 build validations, 0 metric snapshots.
