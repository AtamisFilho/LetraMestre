# Changelog

Todos os changelogs notáveis do projeto **LetraMestre** serão documentados
neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Added
- **Console de Operações** — dashboard web unificado (`/`) com seções de
  Monitoramento, Secrets, Backup, Release, Dívida Técnica e Build Android.
- **Dashboard de monitoramento** agregando métricas de sistema + game-server
  + banco SQLite, com histórico de 60 snapshots e polling de 3s.
- **Validação de secrets** automatizada via `scripts/validate-secrets.ts` e
  endpoint `GET /api/ops/secrets/status`, com classificação `strong`/`weak`/`missing`.
- **Backup SQLite automatizado** via `scripts/backup-db.ts` e endpoints
  `POST /api/ops/backup/run`, `GET /api/ops/backup/history`,
  `POST /api/ops/backup/restore`.
- **Processo de release documentado** em `RELEASE.md` com SemVer, tags,
  rollback e checklist pré-release.
- **Documentação operacional** completa: `docs/PHASE0.md`,
  `docs/PRODUCTION-SETUP.md`, `docs/MONITORING.md`, `docs/TECH-DEBT.md`,
  `docs/BACKUP-RESTORE.md`, `docs/ANDROID-BUILD.md`.
- **Workflows de CI** de referência: `.github/workflows/ci.yml` (lint, test,
  build) e `.github/workflows/android.yml` (assembleDebug em tag).
- **Helper de release** `scripts/release.sh` para bump + tag + commit.

### Changed
- `.env.example` reescrito com placeholders seguros e instruções de geração
  de segredos via `openssl rand`.

### Fixed
- _Nada nesta versão._

---

## [0.3.0] - 2025-10-01

### Resumo
Console de operações + fundação da Fase 0 (Marco M0).

### Added
- Dashboard de monitoramento em tempo real (métricas de sistema, game-server
  e banco SQLite).
- Validação de secrets do ambiente (`AUTH_SECRET`, `INTERNAL_API_KEY`,
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DATABASE_URL`).
- Backup SQLite automatizado com retenção configurável.
- Processo de release documentado (versionamento SemVer, changelog, tags,
  rollback).
- Revisão e fechamento parcial de dívida técnica do projeto.
- Endpoints de operações sob `/api/ops/*` (9 rotas: status, metrics,
  secrets, backup run/history/restore, release changelog/history/tag,
  debt items/close, build android status/validate).

### Changed
- `package.json` bumped de `0.2.0` para `0.3.0`.

---

## [0.2.0] - 2025-09-15

### Resumo
Multiplayer WebSocket + painel administrativo.

### Added
- **Game-server Socket.io** (porta 3003) com salas em tempo real,
  reconexão com janela de graça (45s) e limpeza de salas ociosas.
- Endpoints `/health` e `/metrics` no game-server (activeRooms,
  activeConnections, peakConnections, memoryMb, uptimeMs).
- **Auth admin** com bcrypt (hash de senha) + JWT assinado com `jose` (HS256).
- **Dicionário PT-BR** com suporte a Ç e validação manual de palavras
  não encontradas.
- **PWA instalável** (manifest + service worker) — Android e desktop.
- Painel administrativo: estatísticas, gerenciamento de palavras,
  salas ativas, ranking de jogadas.

### Changed
- Schema Prisma com models `Game`, `Player`, `Move`, `ChatMessage`,
  `ApprovedWord`, `BannedWord`, `GameStats`, `AdminUser`.
- `package.json` bumped de `0.1.0` para `0.2.0`.

---

## [0.1.0] - 2025-08-01

### Resumo
Versão inicial do LetraMestre.

### Added
- **Tabuleiro 15x15** com bônus de letra dupla/tripla e palavra dupla/tripla.
- **Distribuição de peças** otimizada para português brasileiro (incluindo Ç).
- **Validação manual** de palavras não encontradas no dicionário.
- **Chat** durante o jogo (limite de 280 caracteres por mensagem).
- Sistema de pontuação completo com bônus de 50 pontos por usar todas as
  7 peças (bingo).
- Suporte a 2-4 jogadores por sala.

---

<!-- Links de comparação -->

[Unreleased]: https://github.com/AtamisFilho/LetraMestre/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/AtamisFilho/LetraMestre/releases/tag/v0.3.0
[0.2.0]: https://github.com/AtamisFilho/LetraMestre/releases/tag/v0.2.0
[0.1.0]: https://github.com/AtamisFilho/LetraMestre/releases/tag/v0.1.0
