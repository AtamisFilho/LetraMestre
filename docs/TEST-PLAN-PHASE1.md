# Plano de Testes — Fase 1 (Tarefa 1.9)

Plano de testes do sistema de contas de jogador introduzido na Fase 1
(Marco M1). Este documento cobre casos funcionais, de segurança, de OAuth
e de borda.

> **Política do sandbox**: este ambiente não executa suites de teste
> automatizadas. A tarefa 1.9 é entregue como **plano de testes
> documentado** (este arquivo). A execução — manual ou automatizada — deve
> ocorrer em ambiente com suite de testes (ex.: Vitest + Supertest no CI).
>
> **Documentos relacionados**:
> - [`docs/PHASE1.md`](./PHASE1.md) — execução da Fase 1.
> - [`docs/PLAYER-AUTH.md`](./PLAYER-AUTH.md) — guia técnico de auth.
> - `worklog.md` Task ID 5 — contrato de API (fonte de verdade).

---

## 1. Escopo

Cobertura dos fluxos de **autenticação de jogador** introduzidos na Fase 1:

- Registro e login por e-mail + senha.
- Sessão persistente via cookie `player_session`.
- Recuperação de senha por token (modo demo).
- OAuth Google (modo real e modo demo).
- Perfil do jogador (consulta e edição).
- Partidas simuladas vinculadas à conta.
- Segurança (autorização, validação, tokens expirados).

**Fora de escopo**: game-server Socket.io (não roda neste ambiente),
build Android, integração com Google Cloud Console real (depende de
infra externa; coberta por casos de "modo demo" e de "creds ausentes").

**Estratégia**:
- Casos **automatizáveis**: use Vitest + Supertest contra os handlers
  `/api/auth/player/*` e `/api/player/*`, com banco SQLite em memória
  (Prisma `db:push` em `file::memory:`).
- Casos **manuais**: OAuth real (exige browser + Google account) e
  inspeção de cookies no DevTools.

---

## 2. Casos funcionais

| ID     | Cenário                                | Passos                                                                                                                                | Resultado esperado                                                                                                          |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| F-001  | Registro válido                        | `POST /api/auth/player/register` com `{ email, username, password }` válidos.                                                          | `201`; body contém `player.{id,email,username,displayName,avatarUrl}`; `Set-Cookie: player_session=...`; `session:true`.    |
| F-002  | Registro — e-mail duplicado            | `POST /register` com e-mail já cadastrado.                                                                                             | `409 { error: 'E-mail já cadastrado' }`; nenhum cookie setado.                                                              |
| F-003  | Registro — username duplicado          | `POST /register` com username já cadastrado.                                                                                           | `409 { error: 'Username já cadastrado' }`.                                                                                  |
| F-004  | Registro — username inválido           | `POST /register` com `username='ab'` (curto) ou `'a-b'` (char inválido).                                                              | `400 { error: '...', details:[...] }`.                                                                                      |
| F-005  | Registro — senha fraca                 | `POST /register` com `password='123'`.                                                                                                 | `400 { error: 'Senha deve ter entre 8 e 72 caracteres' }`.                                                                  |
| F-006  | Login válido                           | `POST /api/auth/player/login` com e-mail + senha corretos.                                                                             | `200`; body com `player.{...}`; `Set-Cookie: player_session`; `lastLoginAt` atualizado.                                     |
| F-007  | Login — senha errada                   | `POST /login` com senha incorreta.                                                                                                     | `401 { error: 'Credenciais inválidas' }`; nenhum cookie.                                                                    |
| F-008  | Login — e-mail inexistente            | `POST /login` com e-mail não cadastrado.                                                                                               | `401 { error: 'Credenciais inválidas' }` (mensagem idêntica à F-007; não vaza existência).                                  |
| F-009  | Logout                                 | Após login, `POST /api/auth/player/logout`.                                                                                            | `200 { ok:true }`; `Set-Cookie: player_session=; Max-Age=0` (limpa cookie).                                                 |
| F-010  | `/me` sem cookie                       | `GET /api/auth/player/me` sem `player_session`.                                                                                        | `401 { error: 'Não autenticado' }`.                                                                                         |
| F-011  | `/me` com cookie válido                | Após login, `GET /me` com cookie.                                                                                                      | `200 { player: { id, email, username, displayName, avatarUrl, bio, createdAt, lastLoginAt, stats:{ gamesPlayed, gamesWon, winRate, totalScore, bestScore } } }`. |
| F-012  | `PATCH /me` atualiza displayName       | Após login, `PATCH /me` com `{ displayName:'Novo Nome' }`.                                                                             | `200 { player: { ..., displayName:'Novo Nome' } }`; persistido em banco.                                                    |
| F-013  | `PATCH /me` sem auth                   | `PATCH /me` sem cookie.                                                                                                                | `401`.                                                                                                                      |
| F-014  | `forgot-password` gera token (demo)    | `POST /api/auth/player/forgot-password` com `{ email }` de conta existente; `SMTP_HOST` ausente.                                       | `200 { ok:true, demoResetToken:'<hex-64>', demoResetUrl:'<url>?token=<token>' }`; linha em `PasswordResetToken` com `expiresAt=now+1h`, `usedAt:null`. |
| F-015  | `forgot-password` — e-mail inexistente| `POST /forgot-password` com e-mail não cadastrado.                                                                                     | `200 { ok:true }` (sem `demoResetToken`); nenhum token criado. Não vaza existência.                                         |
| F-016  | `reset-password` token válido          | Após F-014, `POST /reset-password` com `{ token, password:'novasenha' }`.                                                              | `200 { ok:true }`; `passwordHash` atualizado; `usedAt` setado.                                                              |
| F-017  | `reset-password` token expirado        | Criar token com `expiresAt=now-1min`; `POST /reset-password`.                                                                          | `400 { error: 'Token inválido ou expirado' }`.                                                                              |
| F-018  | `reset-password` token reuso           | Após F-016 (consumido), reusar mesmo token.                                                                                            | `400 { error: 'Token inválido ou expirado' }` (single-use).                                                                 |
| F-019  | `reset-password` token inexistente     | `POST /reset-password` com `token` aleatório.                                                                                          | `400 { error: 'Token inválido ou expirado' }`.                                                                              |
| F-020  | `reset-password` — senha fraca         | Token válido, `password='123'`.                                                                                                        | `400 { error: 'Senha deve ter entre 8 e 72 caracteres' }`.                                                                  |
| F-021  | Google demo — login                    | `POST /api/auth/player/google/demo` com `{ email, name }` (ou vazio).                                                                  | `200 { player:{...}, session:true }`; `Set-Cookie: player_session`; `PlayerAccount` criado ou reativado com `googleId` sintético. |
| F-022  | Google demo — reloginho               | Repetir F-021 com mesmo e-mail.                                                                                                        | `200`; mesma conta (mesmo `id`); `lastLoginAt` atualizado; **não** cria conta nova.                                          |
| F-023  | Simular partida atualiza stats         | Após login, `POST /api/player/games/simulate` com `{ result:'win', score:340, opponent:'Bot' }`.                                      | `201 { game:{ id, playerId, result:'win', score:340, opponent:'Bot', createdAt } }`; `PlayerAccount.gamesPlayed++`, `gamesWon++`, `totalScore+=340`, `bestScore=max(bestScore,340)`. |
| F-024  | Listar partidas                        | Após F-023 (várias partidas), `GET /api/player/games`.                                                                                 | `200 { games: GameRecord[] }` ordenado por `createdAt` desc; todas com `playerId` = jogador logado.                         |
| F-025  | Sessão persiste entre requisições      | Login → fechar "browser" (manter cookie jar) → nova requisição `GET /me`.                                                              | `200` com perfil; `lastLoginAt` **não** alterado (não é re-login).                                                          |
| F-026  | Sessão expira após TTL                 | Login com `PLAYER_SESSION_TTL_SECONDS=1`; esperar 2s; `GET /me`.                                                                       | `401` (JWT expirado).                                                                                                       |
| F-027  | Logout invalida sessão                 | Login → `POST /logout` → `GET /me`.                                                                                                    | Segunda chamada retorna `401`.                                                                                              |
| F-028  | Logout limpa cookie mesmo sem sessão   | `POST /logout` sem cookie prévio.                                                                                                      | `200 { ok:true }` (idempotente).                                                                                            |
| F-029  | Perfil — avatar default DiceBear       | Após registro (sem `avatarUrl`), `GET /me`.                                                                                            | `avatarUrl` é URL DiceBear `initials` com seed = `displayName`.                                                             |
| F-030  | Perfil — atualiza avatarUrl            | `PATCH /me` com `{ avatarUrl:'https://exemplo.com/avatar.png' }`.                                                                      | `200`; `avatarUrl` persistido; próximo `GET /me` retorna o novo valor.                                                      |
| F-031  | Cross-scope — token player não acessa admin | Login como jogador → `GET /api/admin/stats` com cookie `player_session`.                                                          | `401` ou `403` (token sem `scope:'admin'`).                                                                                 |
| F-032  | Cross-scope — token admin não acessa player | Login como admin → `GET /api/auth/player/me` com cookie `admin_session`.                                                          | `401` (sem `player_session`; mesmo que `admin_session` válido).                                                             |

---

## 3. Casos de segurança

| ID     | Cenário                                | Passos                                                                                              | Resultado esperado                                                                                       |
| ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| S-001  | Acesso a `/me` sem auth                | `GET /me` sem cookie.                                                                               | `401`.                                                                                                   |
| S-002  | Cookie forjado (JWT assinatura inválida) | Enviar `player_session=<jwt-modificado>` ou `<random>`.                                             | `401` (assinatura não verifica).                                                                         |
| S-003  | Token JWT expirado                     | Login → manipular `exp` para passado (ou aguardar TTL).                                             | `401` no próximo `GET /me`.                                                                              |
| S-004  | Senha fraca rejeitada                  | `POST /register` com `password='aaaaaaaa'` (8 chars, mas trivial) — ou abaixo de 8.                 | Se abaixo de 8: `400`. Se trivial mas ≥8: aceito (recomendado adicionar verificação de entropia/Common-Passwords em Fase 2). |
| S-005  | SQL injection em e-mail                | `POST /login` com `email = "x' OR 1=1 --"`.                                                          | `400` (zod rejeita como e-mail inválido) **ou** `401` (sem match); nunca executa SQL arbitrário (Prisma parametriza). |
| S-006  | NoSQL injection em username            | `POST /register` com `username = { "$ne": null }` (JSON).                                           | `400` (zod espera string, rejeita objeto).                                                               |
| S-007  | `passwordHash` nunca retornado         | `GET /me`, `POST /login`, `POST /register`, `GET /api/ops/phase1/players`.                          | Nenhuma resposta contém campo `passwordHash` ou `googleId` (este último só em endpoints admin).          |
| S-008  | Recuperação — token reuso negado       | Após consumir token, tentar de novo.                                                                | `400` (F-018).                                                                                           |
| S-009  | Recuperação — token expirado negado    | Token com `expiresAt` passado.                                                                      | `400` (F-017).                                                                                           |
| S-010  | `forgot-password` não vaza existência  | Solicitar reset para e-mail inexistente.                                                            | Resposta idêntica à de e-mail existente (mesmo status, mesmo shape — só sem `demoResetToken` se demo).   |
| S-011  | Rate-limit (quando implementado)       | 11 logins falhos em 1 minuto a partir de mesmo IP.                                                  | 11ª retorna `429 Too Many Requests` (após implementação do middleware).                                  |
| S-012  | Cookie `HttpOnly`                      | Inspecionar via DevTools (`document.cookie`).                                                       | `player_session` não aparece em `document.cookie`.                                                       |
| S-013  | Cookie `Secure` em prod                | Em `NODE_ENV=production`, inspecionar `Set-Cookie`.                                                 | Atributo `Secure` presente.                                                                              |
| S-014  | Cookie `SameSite=Lax`                  | Inspecionar `Set-Cookie`.                                                                           | Atributo `SameSite=Lax` presente.                                                                        |
| S-015  | `state` CSRF no OAuth                  | Iniciar `/google`, capturar `state`; trocar `state` no callback.                                    | Callback rejeita (`400` ou redirect para `/?auth_error=state_mismatch`).                                 |
| S-016  | Redirect URI spoofing                  | Callback com `redirect_uri` diferente do cadastrado.                                                | Backend não troca `code` (Google rejeita); `400` no callback.                                            |

---

## 4. Casos de OAuth

| ID     | Cenário                                | Pré-condição                                                          | Passos / Resultado esperado                                                                                                       |
| ------ | -------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| O-001  | Google configured=true                 | `GOOGLE_OAUTH_CLIENT_ID` definido.                                    | `GET /api/auth/player/google` → `200 { configured:true, demo:false, authUrl:"https://accounts.google.com/o/oauth2/v2/auth?..." }`. |
| O-002  | Google configured=false                | `GOOGLE_OAUTH_CLIENT_ID` ausente ou vazio.                            | `GET /api/auth/player/google` → `200 { configured:false, demo:true }`.                                                            |
| O-003  | Callback com `code` inválido           | `configured=true`.                                                    | `GET /api/auth/player/google/callback?code=invalid&state=<valid>` → `400` ou redirect `/?auth_error=code_exchange_failed`.        |
| O-004  | Callback sem `state`                   | `configured=true`.                                                    | `GET /api/auth/player/google/callback?code=<valid>` (sem `state`) → `400`/redirect `/?auth_error=state_mismatch`.                |
| O-005  | Callback com `state` inválido          | `configured=true`.                                                    | Mesmo que O-004.                                                                                                                  |
| O-006  | Callback cria nova conta               | `configured=true`, e-mail Google não cadastrado.                      | Após Google login, callback cria `PlayerAccount` com `googleId`, seta cookie, redireciona para `/`.                               |
| O-007  | Callback reativa conta existente       | `configured=true`, e-mail Google já tem conta.                        | Callback vincula `googleId` (se ainda não tinha), atualiza `lastLoginAt`, seta cookie, redireciona para `/`.                      |
| O-008  | Demo — sem creds                       | `GOOGLE_OAUTH_CLIENT_ID` ausente.                                     | `POST /api/auth/player/google/demo` → `200 { player, session:true }` (F-021).                                                     |
| O-009  | Demo — reloginho                       | Após O-008, repetir com mesmo e-mail.                                 | `200`; mesma conta; `lastLoginAt` atualizado.                                                                                     |
| O-010  | Demo — username derivado               | `POST /google/demo` sem `name`.                                       | `username` derivado do e-mail (ex.: `joao` para `joao@x.com`); se colidir, sufixo numérico.                                       |

> Casos O-001 a O-007 exigem Google Cloud Console configurado e,
> idealmente, domínio verificado. Em ambiente de dev, usar
> `http://localhost:3000/api/auth/player/google/callback` como redirect
> URI autorizado.

---

## 5. Casos de borda

| ID     | Cenário                                | Passos                                                                 | Resultado esperado                                              |
| ------ | -------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| B-001  | Username exatamente 3 chars            | `POST /register` com `username='abc'`.                                 | `201` (limite inferior inclusivo).                              |
| B-002  | Username exatamente 20 chars           | `POST /register` com `username='a'.repeat(20)`.                        | `201` (limite superior inclusivo).                              |
| B-003  | Username 21 chars                      | `POST /register` com `username='a'.repeat(21)`.                        | `400` (acima do limite).                                        |
| B-004  | Username 2 chars                       | `POST /register` com `username='ab'`.                                  | `400` (abaixo do limite).                                       |
| B-005  | Senha exatamente 8 chars               | `POST /register` com `password='12345678'`.                            | `201`.                                                          |
| B-006  | Senha exatamente 72 chars              | `POST /register` com `password='a'.repeat(72)`.                        | `201` (limite bcrypt).                                          |
| B-007  | Senha 73 chars                         | `POST /register` com `password='a'.repeat(73)`.                        | `400` (acima do limite bcrypt).                                 |
| B-008  | Senha 7 chars                          | `POST /register` com `password='1234567'`.                             | `400`.                                                          |
| B-009  | E-mail com formato estranho válido     | `POST /register` com `email='a+b+c@sub.domain.tld'`.                   | `201` (zod aceita; normalize para lowercase antes de persistir). |
| B-010  | E-mail inválido                        | `POST /register` com `email='nao-e-email'`.                            | `400`.                                                          |
| B-011  | E-mail com whitespace                  | `POST /register` com `email=' user@x.com '`.                           | `201` (após trim interno) ou `400` (se não trim). Definir e documentar. |
| B-012  | displayName exatamente 40 chars        | `POST /register` ou `PATCH /me` com `displayName='a'.repeat(40)`.      | `201`/`200`.                                                    |
| B-013  | displayName 41 chars                   | Idem com 41 chars.                                                     | `400`.                                                          |
| B-014  | bio exatamente 280 chars               | `PATCH /me` com `bio='a'.repeat(280)`.                                 | `200`.                                                          |
| B-015  | bio 281 chars                          | Idem com 281.                                                          | `400`.                                                          |
| B-016  | avatarUrl inválida                     | `PATCH /me` com `avatarUrl='nao-e-url'`.                               | `400`.                                                          |
| B-017  | `simulate` result inválido             | `POST /games/simulate` com `{ result:'empate' }`.                      | `400` (esperado enum `'win'|'loss'|'draw'`).                    |
| B-018  | `simulate` score negativo              | `POST /games/simulate` com `{ score:-10 }`.                            | `400` ou clamp para 0 (definir; recomendado `400`).             |
| B-019  | `simulate` sem auth                    | `POST /games/simulate` sem cookie.                                     | `401`.                                                          |
| B-020  | `games` sem auth                       | `GET /api/player/games` sem cookie.                                    | `401`.                                                          |
| B-021  | Reset — senha igual à anterior         | Após `reset-password` com senha igual à atual.                         | `200` (permitido; não há regra contra — recomendado proibir em Fase 2). |
| B-022  | Reset — token com 63 chars             | `POST /reset-password` com token truncado.                             | `400` (token não encontrado).                                   |
| B-023  | Logout com cookie expirado             | Aguardar TTL; `POST /logout`.                                          | `200 { ok:true }` (idempotente, limpa cookie mesmo expirado).   |
| B-024  | Múltiplos tokens de reset ativos       | Solicitar reset 3x sem consumir.                                       | 3 linhas em `PasswordResetToken` (todos válidos); qualquer um funciona (single-use por token, não por conta). |

---

## 6. Critério de aceitação

A tarefa 1.9 é considerada concluída quando:

1. **Todos os casos funcionais (F-001 a F-032) passam** — registro, login,
   logout, `/me`, `PATCH /me`, recuperação de senha (demo), Google demo,
   simulação de partida e listagem de partidas funcionam conforme contrato.
2. **Todos os casos de segurança (S-001 a S-016) passam** — em particular:
   - `passwordHash` nunca serializado em respostas.
   - Tokens JWT expirados rejeitados.
   - Cross-scope rejeitado (player ↔ admin).
   - Cookies com `HttpOnly`, `Secure` (prod), `SameSite=Lax`.
3. **Todos os casos de OAuth (O-001 a O-010) passam** — incluindo modo
   demo sem creds (O-008 a O-010) e modo real com Google Cloud Console
   configurado (O-001 a O-007, executados em ambiente staging).
4. **Todos os casos de borda (B-001 a B-024) passam** — limites de
   username, senha, displayName, bio, avatarUrl, result e score
   respeitados conforme schema zod.
5. **Suite existente do LetraMestre (218 testes) permanece verde** —
   nenhum teste da Fase 0 regressa.
6. **Plano de rate-limit documentado** — mesmo que não implementado nesta
   fase, a especificação (limites por endpoint) está em
   `docs/PLAYER-AUTH.md` §9.1.

### Não-bloqueantes (melhoria contínua)

- Implementação efetiva do rate-limit (S-011).
- Verificação de senha contra lista de senhas vazadas (S-004 melhoria).
- E-mail de verificação no registro (claim `emailVerified`).
- Rotação de `AUTH_SECRET` sem downtime (multi-secret).

---

## 7. Ambiente de execução sugerido

Para rodar os casos automatizáveis:

```bash
# 1. Banco de testes em memória
export DATABASE_URL="file::memory:"
bun run db:generate
bun run db:push

# 2. Variáveis mínimas
export AUTH_SECRET="$(openssl rand -base64 32)"
export NODE_ENV="test"
export PLAYER_SESSION_TTL_SECONDS="604800"
# GOOGLE_OAUTH_* e SMTP_* ausentes → modo demo

# 3. Rodar suite (Vitest, por exemplo)
bunx vitest run --project phase1
```

Casos manuais (OAuth real, inspeção de cookies): usar browser real contra
`http://localhost:3000` em modo Jogador.

---

## Referências

- [`docs/PHASE1.md`](./PHASE1.md) — execução da Fase 1.
- [`docs/PLAYER-AUTH.md`](./PLAYER-AUTH.md) — guia técnico de auth (endpoints, claims, segurança).
- `worklog.md` — Task ID 5: contrato de API (fonte de verdade dos endpoints).
- `.env.example` — variáveis de ambiente relevantes.
- OWASP Testing Guide (Auth): <https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Authentication_Testing/README>
