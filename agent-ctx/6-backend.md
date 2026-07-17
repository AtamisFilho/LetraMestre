# Task 6 — Backend Fase 1 (full-stack-developer)

## Resumo
Implementei o sistema de **Contas de Jogador** da Fase 1 (marco M1): 3 modelos
Prisma, lib `auth-player.ts`, 12 endpoints (8 auth + 2 partidas + 2 ops) e o
script de seed. Todos os curls de validação passando.

## Arquivos criados/modificados

### Schema Prisma (modificado)
- `prisma/schema.prisma` — adicionados 3 modelos mantendo os 6 da Fase 0:
  - `PlayerAccount` (id, email unique, username unique, displayName, passwordHash?, googleId? unique, avatarUrl?, bio, emailVerified?, lastLoginAt?, gamesPlayed/won/totalScore/bestScore, timestamps) + relation `resetTokens` e `games` + `@@index([email])`.
  - `PasswordResetToken` (id, playerId, token unique, expiresAt, usedAt?, createdAt) + relation `player` (onDelete Cascade) + `@@index([playerId])`.
  - `GameRecord` (id, playerId, result, score, opponent, language='pt-BR', createdAt) + relation `player` (onDelete Cascade) + `@@index([playerId])` + `@@index([createdAt])`.

### Bibliotecas
- `src/lib/auth-player.ts` — auth do jogador (separada do admin). Stack: `bcryptjs` (cost 12) + `jose` (JWT HS256) + `zod`. Cookie `player_session` (HttpOnly, Secure em prod, SameSite=Lax, Path=/, Max-Age=604800). JWT com claim `scope:'player'` para distinguir do admin. Funções: `hashPassword`, `verifyPassword`, `signPlayerToken`, `verifyPlayerToken`, `playerCookieOptions`, `buildPlayerSetCookieHeader`, `buildPlayerClearCookieHeader`, `getPlayerSession` (server-only via `cookies()` de `next/headers`), `requirePlayer`. Schemas zod: register/login/forgotPassword/resetPassword/googleDemo/updateProfile/simulateGame. Helpers `toPublicPlayer` (sem vazar passwordHash) e `withStats`.
- `src/lib/ops/phase1.ts` — mapa estático das 10 tasks do cronograma (1.1-1.8 done=100, 1.9 in_progress=50 plano documentado, 1.10 n/a=100 sem anônimos). `getPhase1Status()` computa exitCriteria do estado real do banco (registration-login=persiste PlayerAccount c/ senha, persistent-session=true cookie implementado, linked-games=existe GameRecord, profile-avatar-stats=true). `getPhase1PlayersReport(limit=100)` retorna players + total + withGoogle + withPassword, derivando `provider: 'password'|'google'|'both'` de passwordHash/googleId.

### Endpoints Auth — `src/app/api/auth/player/` (8 rotas)
- `register/route.ts` POST → 201 `{player, session:true}`; 400 validação, 409 email/username em uso.
- `login/route.ts` POST → 200 `{player}`; 401 inválido. Atualiza lastLoginAt.
- `logout/route.ts` POST → 200 `{ok:true}`. Limpa cookie.
- `me/route.ts` GET → 200 `{player, winRate, googleLinked}`; 401. PATCH → atualiza displayName/bio/avatarUrl.
- `forgot-password/route.ts` POST → 200 `{ok:true, demoResetToken?, demoResetUrl?, demoNote?}`. Token hex 32 TTL 1h. Email inexistente retorna `{ok:true}` sem token (não vaza).
- `reset-password/route.ts` POST → 200 `{ok:true}`. 400 se token inválido/expirado/usado. Transação atualiza senha + marca usedAt.
- `google/route.ts` GET → 200 `{configured, demo, authUrl?, note?}`. Se `GOOGLE_OAUTH_CLIENT_ID`+`GOOGLE_OAUTH_REDIRECT_URI` presentes: gera authUrl real com state random; senão demo.
- `google/demo/route.ts` POST → 200 `{player, session:true}`. Cria/reativa PlayerAccount com googleId=`demo-${email}` (sem passwordHash). Username único com sufixo se colidir.

### Endpoints Partidas — `src/app/api/player/` (2 rotas)
- `games/route.ts` GET → 200 `{games: GameRecord[]}` (50 mais recentes).
- `games/simulate/route.ts` POST → 201 `{game}`. Defaults aleatórios: result win/loss/draw, score 50-400, opponent de lista fictícia. Atualiza PlayerAccount: gamesPlayed++, gamesWon++ (se win), totalScore += score, bestScore = max.

### Endpoints Ops Fase 1 — `src/app/api/ops/phase1/` (2 rotas)
- `status/route.ts` GET → `{milestone:'M1', phase, weeks, overallProgress, exitCriteria:[4], tasks:[1.1..1.10]}`. overallProgress=95.
- `players/route.ts` GET → `{players, total, withGoogle, withPassword}`.

### Seed
- `scripts/seed-players.ts` — idempotente (upsert por email). Popula 4 jogadores: `jogador@letramestre.com`/`senha12345` (6 partidas), `demo.google@example.com` (Google demo, 3 partidas), `misto@letramestre.com`/`senha12345` (senha+Google — provider='both', 4 partidas), `novato@letramestre.com`/`senha12345` (recém-criado). 13 GameRecord.

### Env
- `.env` — adicionado `AUTH_SECRET=letramestre-dev-secret-please-change-in-production-32bytes` (estava ausente).

### Dependências instaladas
- `bcryptjs@3.0.3` + `@types/bcryptjs@3.0.0` (estavam ausentes do package.json apesar de listados na stack exigida).

## Validação

### db:push + db:generate
- `bun run db:push` → "Your database is now in sync with your Prisma schema. Done in 19ms" + Prisma Client v6.19.2.

### Seed
- `bun run scripts/seed-players.ts` → `PlayerAccount=4, GameRecord=13`.

### Curls (TODOS PASSANDO — http://127.0.0.1:3000)
1. REGISTER `teste@x.com`/`teste`/`senha12345` → 201 + session=true.
2. LOGIN → 200 + cookie `player_session` setado.
3. GET /me → 200 + winRate=0 + googleLinked=false.
4. POST /games/simulate `{}` → 201 com result/score/opponent gerados.
5. GET /games → 200 lista com a partida criada.
6. GET /api/ops/phase1/status → overallProgress=95, 4/4 exitCriteria met, tasks 1.1-1.8 done / 1.9 in_progress / 1.10 n/a.
7. GET /api/ops/phase1/players → total=7 (4 seed + 1 teste + 1 google demo + 1 de outro agente), withGoogle=3, withPassword=5.
8. POST /forgot-password `teste@x.com` → 200 + demoResetToken + demoResetUrl.
9. POST /reset-password com token → 200 ok:true.
10. LOGIN com nova senha → 200 (senha foi efetivamente trocada).
11. RESET REUSE do mesmo token → 400 "Token já foi utilizado".
12. GET /google → `{configured:false, demo:true}` (sem env vars).
13. POST /google/demo `novo.google@example.com` → 200 cria PlayerAccount com googleId.
14. GET /me com cookie Google demo → 200 retorna o jogador Google.
15. POST /logout → 200 ok:true.
16. POST /forgot-password para email inexistente → `{ok:true}` (não vaza existência).
17. REGISTER conflito (email em uso) → 409.
18. REGISTER validação fraca (email inválido, username <3, senha <8) → 400.
19. PATCH /me `{displayName, bio}` → 200 atualizado.

### Lint
- `bun run lint` → 0 errors, 0 warnings.

## Observações para próximos agentes
- **Dev server**: o dev server do sistema estava com Prisma Client em cache após `db:push` (erro `Cannot read properties of undefined (reading 'findFirst')`). Foi necessário reiniciá-lo manualmente via `setsid` para detach total. O coordenador deve garantir estabilidade do auto-restart.
- **Variáveis de ambiente**: `AUTH_SECRET` foi adicionado ao `.env` (valor dev default). OAuth Google real requer `GOOGLE_OAUTH_CLIENT_ID`+`GOOGLE_OAUTH_REDIRECT_URI` (apenas o init `GET /google` e o demo `POST /google/demo` estão implementados).
- **Cookie**: `player_session` HttpOnly, Secure em prod, SameSite=Lax, Path=/, Max-Age=604800 (7 dias). Serialization manual (sem depender de lib externa).
- **JWT**: HS256 com `AUTH_SECRET`, claim `scope:'player'` distingue do admin. Issuer `letramestre:player`.
- **Logout**: apenas limpa o cookie client-side (JWT é stateless). Se o cliente mantiver cópia do token antigo, continuará válido até expirar (7d). Para revogação real seria necessário server-side session store — não implementado nesta fase.
- **Player summary** em `/api/ops/phase1/players` NÃO expõe passwordHash nem tokens.
- Não toquei em `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/**`, `docs/**`, `CHANGELOG.md`, `.env.example`, `src/lib/auth.ts` (admin, não existe), `src/lib/ops/*.ts` da Fase 0.
