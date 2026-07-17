# Autenticação de Jogador (Fase 1)

Guia técnico do sistema de autenticação de jogador introduzido na Fase 1
(Marco M1). Este documento é a referência para modelos de dados, senha,
JWT, cookie, endpoints, recuperação de senha, OAuth Google, segurança e
migração de anônimos.

> **Documento pai**: [`docs/PHASE1.md`](./PHASE1.md).
> **Contrato de API**: fixado em `worklog.md` — Task ID 5.
> **Configuração de ambiente**: `.env.example` (variáveis `PLAYER_SESSION_TTL_SECONDS`,
> `GOOGLE_OAUTH_*`, `SMTP_*`).

---

## 1. Visão geral

O fluxo de autenticação do jogador é **separado** do auth admin (já
existente em `src/lib/auth.ts`) e compartilha apenas os primitivos
criptográficos (bcrypt + JWT HS256 via `jose`).

```
Registro (e-mail/senha)            Login (e-mail/senha ou Google)
        │                                       │
        ▼                                       ▼
 POST /api/auth/player/register       POST /api/auth/player/login
        │                              (ou /api/auth/player/google/*)
        ▼                                       │
 bcrypt.hash(pw, 12)                 bcrypt.compare(pw, hash)
        │                                       │
        ▼                                       ▼
 PlayerAccount.create()             JWT HS256 { sub, email, username, scope:'player' }
        │                                       │
        └─────────────┬─────────────────────────┘
                      ▼
        Set-Cookie: player_session=<jwt>; HttpOnly; SameSite=Lax
        Path=/; Secure (prod); Max-Age=604800
                      │
                      ▼
        GET /api/auth/player/me  →  hidrata sessão no cliente
```

**Separação de escopos**:
- Admin → cookie `admin_session`, JWT `scope:'admin'`, rotas `/api/admin/*`.
- Jogador → cookie `player_session`, JWT `scope:'player'`, rotas `/api/auth/player/*`
  e `/api/player/*`.

Um token de jogador nunca é aceito em rotas admin, e vice-versa.

---

## 2. Modelos de dados

Os três modelos Prisma adicionados na Fase 1 (definidos em
`prisma/schema.prisma`):

### 2.1 `PlayerAccount`

| Campo           | Tipo       | Restrições                          | Descrição                                                       |
| --------------- | ---------- | ----------------------------------- | --------------------------------------------------------------- |
| `id`            | `String`   | `@id @default(cuid())`              | Identificador único.                                            |
| `email`         | `String`   | `@unique`                           | E-mail do jogador (case-insensitive no aplicativo).             |
| `username`      | `String`   | `@unique`                           | Nome curto único (3-20 chars, `[a-zA-Z0-9_]`).                  |
| `displayName`   | `String`   | —                                   | Nome exibido no perfil (até 40 chars).                          |
| `passwordHash`  | `String?`  | nullable                            | Hash bcrypt quando o jogador usa senha; `null` se só Google.    |
| `googleId`      | `String?`  | `@unique` nullable                  | Subject do Google; `null` se só e-mail/senha.                   |
| `avatarUrl`     | `String?`  | nullable                            | URL do avatar; default DiceBear `initials`.                     |
| `bio`           | `String`   | `@default("")`                      | Bio curta (até 280 chars).                                      |
| `emailVerified` | `DateTime?`| nullable                            | Quando o e-mail foi verificado (futuro).                        |
| `lastLoginAt`   | `DateTime?`| nullable                            | Atualizado em cada login.                                       |
| `gamesPlayed`   | `Int`      | `@default(0)`                       | Total de partidas.                                              |
| `gamesWon`      | `Int`      | `@default(0)`                       | Vitórias.                                                       |
| `totalScore`    | `Int`      | `@default(0)`                       | Soma de pontos.                                                 |
| `bestScore`     | `Int`      | `@default(0)`                       | Recorde pessoal.                                                |
| `createdAt`     | `DateTime` | `@default(now())`                   | Criação.                                                        |
| `updatedAt`     | `DateTime` | `@updatedAt`                        | Atualização automática.                                         |
| `resetTokens`   | `PasswordResetToken[]` | relação                | Tokens de reset ativos/expirados.                               |
| `games`         | `GameRecord[]`        | relação                | Histórico de partidas.                                          |

Índices: `@@index([email])`.

### 2.2 `PasswordResetToken`

| Campo       | Tipo           | Restrições                              | Descrição                                     |
| ----------- | -------------- | --------------------------------------- | --------------------------------------------- |
| `id`        | `String`       | `@id @default(cuid())`                  | Identificador.                                |
| `playerId`  | `String`       | FK → `PlayerAccount.id`                 | Dono do token.                                |
| `token`     | `String`       | `@unique`                               | Token hex 32 bytes (64 chars).                |
| `expiresAt` | `DateTime`     | —                                       | Expiração (criação + 1h).                     |
| `usedAt`    | `DateTime?`    | nullable                                | Quando consumido (single-use).                |
| `createdAt` | `DateTime`     | `@default(now())`                       | Criação.                                      |

Relação: `player PlayerAccount @relation(...) @onDelete: Cascade`.
Índices: `@@index([playerId])`.

### 2.3 `GameRecord`

| Campo       | Tipo      | Restrições                 | Descrição                                       |
| ----------- | --------- | -------------------------- | ----------------------------------------------- |
| `id`        | `String`  | `@id @default(cuid())`     | Identificador.                                  |
| `playerId`  | `String`  | FK → `PlayerAccount.id`    | Dono da partida.                                |
| `result`    | `String`  | —                          | `'win'` \| `'loss'` \| `'draw'`.                |
| `score`     | `Int`     | `@default(0)`              | Pontuação.                                      |
| `opponent`  | `String`  | `@default("")`             | Nome do adversário (free text).                 |
| `language`  | `String`  | `@default("pt-BR")`        | Idioma da partida.                              |
| `createdAt` | `DateTime`| `@default(now())`          | Quando ocorreu.                                 |

Relação: `player PlayerAccount @relation(...) @onDelete: Cascade`.
Índices: `@@index([playerId])`, `@@index([createdAt])`.

---

## 3. Senha

- **Algoritmo**: bcrypt.
- **Cost factor**: `12` (mesmo padrão do admin).
- **Validação de tamanho**: mínimo 8 chars, máximo 72 chars (limite bcrypt).
- **Armazenamento**: hash em `PlayerAccount.passwordHash` (nullable — `null`
  se o jogador só usa Google).
- **Comparação**: `bcrypt.compare(input, passwordHash)` no login; senha
  incorreta retorna `401 { error: 'Credenciais inválidas' }`.
- **Logs**: a senha em texto **nunca** é logada, **nunca** retornada em
  resposta, **nunca** serializada em objetos `PlayerAccount` enviados ao
  cliente. O helper de serialização remove explicitamente `passwordHash`.

> Recomendação futura: migrar para Argon2id quando `node:argon2` estiver
> disponível no runtime. Manter bcrypt cost 12 até lá.

---

## 4. JWT

- **Algoritmo**: HS256 (simétrico) via `jose`.
- **Segredo**: `AUTH_SECRET` (compartilhado com admin; mínimo 16 chars,
  recomendado 32+). Gerar com `openssl rand -base64 32`.
- **Claims**:

  | Claim     | Valor                                |
  | --------- | ------------------------------------ |
  | `sub`     | `PlayerAccount.id`                   |
  | `email`   | `PlayerAccount.email`                |
  | `username`| `PlayerAccount.username`             |
  | `scope`   | `'player'` (vs `'admin'` no admin)   |
  | `iat`     | emitido em (auto, `jose`)            |
  | `exp`     | `iat + PLAYER_SESSION_TTL_SECONDS`   |

- **TTL**: 7 dias (`604800` segundos). Configurável via
  `PLAYER_SESSION_TTL_SECONDS`.
- **Verificação**: `jose.jwtVerify(token, secret)` valida assinatura e
  expiração. Tokens expirados → `401`.
- **Rotação de `AUTH_SECRET`**: ao trocar o segredo, **todos** os JWTs
  emitidos (admin e jogador) tornam-se inválidos. Comunique admins e
  force re-login global. Documentado em `docs/PRODUCTION-SETUP.md` §8.

> **Distinção admin vs jogador**: o claim `scope` é a fonte da verdade.
  Middlewares diferentes leem cookies diferentes (`admin_session` vs
  `player_session`) **e** verificam o `scope` correto. Um token de jogador
  no cookie `admin_session` é rejeitado; o oposto também.

---

## 5. Cookie

| Atributo      | Valor                                              | Justificativa                                                                                                |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Name`        | `player_session`                                   | Distinto de `admin_session`.                                                                                 |
| `Value`       | JWT HS256                                          | Compacto, assinado.                                                                                          |
| `HttpOnly`    | `true`                                             | Impede leitura via JS (mitiga roubo por XSS).                                                                |
| `Secure`      | `true` em prod, `false` em dev                     | Só trafega em HTTPS em produção.                                                                             |
| `SameSite`    | `Lax`                                              | Permite redirect top-level do callback OAuth; bloqueia envio em sub-requests cross-site (CSRF mitigation).   |
| `Path`        | `/`                                                | Disponível em todo o app.                                                                                    |
| `Max-Age`     | `PLAYER_SESSION_TTL_SECONDS` (default `604800`)    | 7 dias.                                                                                                      |

### Por que `Lax` e não `Strict`?

`Strict` impediria o envio do cookie na navegação que chega do redirect do
Google (`accounts.google.com → letramestre.app/api/auth/player/google/callback`).
Sem o cookie, o callback não conseguiria distinguir sessões — embora o
callback use `state`/`code` do OAuth, manter `Lax` simplifica fluxos
futuros (ex.: "continuar logado ao voltar do Google"). `Lax` já bloqueia
CSRF em sub-requests (fetch cross-site, iframes, imagens).

### Por que `Lax` e não `None`?

`None` exige `Secure=true` (ok em prod) mas permite envio em **todos**
contextos cross-site, incluindo sub-requests — aumenta superfície de CSRF.
`Lax` é o mínimo necessário para OAuth sem abrir mais do que preciso.

---

## 6. Endpoints

Todos os endpoints sob `/api/auth/player/*` e `/api/player/*` exigem
cookie `player_session` válido (exceto os de registro/login/recuperação/OAuth).

### 6.1 `/api/auth/player/*` — autenticação

| Método | Rota                                   | Propósito                                              | Auth        |
| ------ | -------------------------------------- | ------------------------------------------------------ | ----------- |
| POST   | `/api/auth/player/register`            | Registrar novo jogador (e-mail + senha + username).    | pública     |
| POST   | `/api/auth/player/login`               | Login por e-mail + senha.                              | pública     |
| POST   | `/api/auth/player/logout`              | Encerrar sessão (limpa cookie).                        | opcional    |
| GET    | `/api/auth/player/me`                  | Retornar perfil + stats do jogador logado.             | **player**  |
| PATCH  | `/api/auth/player/me`                  | Atualizar `displayName`, `bio`, `avatarUrl`.           | **player**  |
| POST   | `/api/auth/player/forgot-password`     | Gerar token de reset (envia e-mail ou retorna demo).   | pública     |
| POST   | `/api/auth/player/reset-password`      | Consumir token e redefinir senha.                      | pública     |
| GET    | `/api/auth/player/google`              | Retornar `authUrl` (real) ou sinalizar modo demo.      | pública     |
| GET    | `/api/auth/player/google/callback`     | Callback OAuth Google (troca `code` por perfil).       | pública     |
| POST   | `/api/auth/player/google/demo`         | Simular callback OAuth (cria/loga conta demo).         | pública     |

### 6.2 `/api/player/*` — dados do jogador

| Método | Rota                              | Propósito                                              | Auth        |
| ------ | --------------------------------- | ------------------------------------------------------ | ----------- |
| POST   | `/api/player/games/simulate`      | Criar uma partida simulada e atualizar stats.          | **player**  |
| GET    | `/api/player/games`               | Listar partidas do jogador (recentes primeiro).        | **player**  |

### 6.3 `/api/ops/phase1/*` — visão operacional

| Método | Rota                          | Propósito                                              | Auth        |
| ------ | ----------------------------- | ------------------------------------------------------ | ----------- |
| GET    | `/api/ops/phase1/status`      | Progresso M1, exit criteria, lista de tarefas.         | admin       |
| GET    | `/api/ops/phase1/players`     | Lista de jogadores cadastrados (summary).              | admin       |

> Os endpoints `/api/ops/*` são protegidos pelo auth admin existente
> (`admin_session` + `scope:'admin'`).

---

## 7. Recuperação de senha

### 7.1 Fluxo

1. Jogador solicita reset em `POST /api/auth/player/forgot-password`
   `{ email }`.
2. Backend busca `PlayerAccount` por e-mail. Se não existe, retorna
   `200 { ok: true }` mesmo assim (não vaza existência de conta).
3. Se existe, gera token: `crypto.randomBytes(32).toString('hex')` (64 chars).
4. Persiste `PasswordResetToken { playerId, token, expiresAt: now+1h }`.
5. **Entrega do token**:
   - **Produção (com SMTP)**: envia e-mail com link
     `<WEB_ORIGIN>/reset-password?token=<token>`. Resposta: `200 { ok: true }`.
   - **Demo (sem SMTP)**: retorna o token na resposta:
     `200 { ok: true, demoResetToken: '<token>', demoResetUrl: '<WEB_ORIGIN>/reset-password?token=<token>' }`.
6. Jogador consome em `POST /api/auth/player/reset-password` `{ token, password }`.
7. Backend valida: token existe, `expiresAt > now`, `usedAt` é `null`.
8. Se válido: marca `usedAt = now`, atualiza `passwordHash` (bcrypt hash
   da nova senha), retorna `200 { ok: true }`.
9. Se inválido/expirado/reusado: retorna `400 { error: 'Token inválido ou expirado' }`.

### 7.2 Propriedades

- **TTL**: 1 hora (`3600` segundos).
- **Single-use**: `usedAt` é setado no consumo; tentativa de reuso retorna 400.
- **Entropia**: 32 bytes → 2^256 possibilities; inbrutável em URL.
- **Rate-limit sugerido**: 3 solicitações de `/forgot-password` por IP
  por hora, por e-mail (mitigar spam de e-mail).

> ⚠️ **Modo demo NUNCA em produção**. Retornar o token na resposta é
> aceitável apenas em desenvolvimento sem SMTP. Em produção, sempre
> provisionar `SMTP_*` (ver `.env.example`) e omitir `demoResetToken` da
> resposta. O backend decide o modo com base na presença de `SMTP_HOST`.

---

## 8. OAuth Google

### 8.1 Pré-requisitos

1. **Google Cloud Console** → APIs & Services → Credentials →
   **Create Credentials** → **OAuth client ID**.
2. Tipo: **Web application**.
3. **Authorized JavaScript origins**: `https://<seu-dominio>` (e
   `http://localhost:3000` para dev).
4. **Authorized redirect URIs**:
   `https://<seu-dominio>/api/auth/player/google/callback` (e
   `http://localhost:3000/api/auth/player/google/callback` para dev).
5. **Domínio verificado** no OAuth consent screen (Google exige
   verificação de propriedade para escopos sensíveis; `email` e `profile`
   são considerados não-sensíveis, mas verificação ainda é recomendada).
6. Copiar `Client ID` e `Client Secret` para `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID="<client-id>.apps.googleusercontent.com"
   GOOGLE_OAUTH_CLIENT_SECRET="<secret>"
   GOOGLE_OAUTH_REDIRECT_URI="https://<seu-dominio>/api/auth/player/google/callback"
   ```

### 8.2 Fluxo (real)

```
1. Cliente → GET /api/auth/player/google
   Resposta: { configured:true, demo:false, authUrl:"https://accounts.google.com/o/oauth2/v2/auth?..." }

2. Browser redireciona para authUrl → Google login + consent

3. Google redireciona para GOOGLE_OAUTH_REDIRECT_URI?code=<code>&state=<state>
   → GET /api/auth/player/google/callback

4. Backend troca code por tokens (https://oauth2.googleapis.com/token)
   → obtém access_token e id_token

5. Backend decodifica id_token (jose, chave Google JWKS) → obtém { sub, email, name, picture }

6. Busca PlayerAccount por googleId == sub
   - Existe → atualiza lastLoginAt, emite JWT, seta cookie, redireciona para /
   - Não existe → busca por email
     - Existe → vincula googleId, emite JWT, seta cookie
     - Não existe → cria PlayerAccount { email, username derivado, googleId, avatarUrl:picture }, emite JWT, seta cookie

7. Redireciona para <WEB_ORIGIN>/ (com cookie player_session)
```

### 8.3 Fluxo (demo)

Quando `GOOGLE_OAUTH_CLIENT_ID` está ausente, `GET /api/auth/player/google`
retorna `{ configured:false, demo:true }`. O cliente então chama:

```
POST /api/auth/player/google/demo
Body: { email?, name? }
Resposta: { player: {...}, session: true }
```

O backend cria/reativa uma conta fictícia (`googleId` sintético) e seta o
cookie normalmente. Isso permite exercitar o fluxo de perfil e partidas
sem depender do Google.

### 8.4 Segurança do OAuth

- `state` (CSRF token) gerado e validado no callback.
- `id_token` verificado via JWKS do Google (não confiar no `code` sozinho).
- Redirect URI estrita — rejeitar qualquer `redirect_uri` não cadastrado.
- Em caso de erro no callback, redirecionar para `/?auth_error=...` com
  mensagem genérica (não vazar detalhes).

---

## 9. Segurança

### 9.1 Rate-limit (recomendado)

| Endpoint                                  | Limite sugerido                |
| ----------------------------------------- | ------------------------------ |
| `POST /api/auth/player/register`          | 5 / IP / hora                  |
| `POST /api/auth/player/login`             | 10 / IP / minuto               |
| `POST /api/auth/player/forgot-password`   | 3 / IP / hora, 3 / e-mail / hora |
| `POST /api/auth/player/reset-password`    | 10 / IP / minuto               |
| `POST /api/auth/player/google/demo`       | 5 / IP / hora                  |

Implementação: middleware Next.js com contador em memória (dev) ou Redis
(prod). Alternativa: plugin `caddy-ratelimit` no edge.

### 9.2 CSRF

- `SameSite=Lax` já mitiga CSRF em sub-requests cross-site.
- Para endpoints `PATCH /me` e `POST /games/simulate` (mutações sensíveis),
  considere **double-submit cookie** ou checagem de `Origin`/`Referer`
  quando `Lax` não for suficiente.
- Endpoints de auth (`/login`, `/register`) são intencionalmente
  `public` — CSRF não se aplica (não há sessão prévia para abusar).

### 9.3 Rotação de `AUTH_SECRET`

- Rotacione a cada 90 dias ou após incidente.
- Rotação invalida **todos** os JWTs (admin + jogador) — force re-login
  global. Comunique admins.
- Para rotação sem downtime, considere suporte a múltiplos segredos
  (lista em `jose`); fora do escopo da Fase 1.

### 9.4 Validação de input

- Todos os endpoints validam body com **zod** antes de tocar no banco.
- Senha: `z.string().min(8).max(72)`.
- E-mail: `z.string().email()` (zod previne formatos inválidos; caso
  borderline, normalize para lowercase antes de persistir/consultar).
- Username: `z.string().regex(/^[a-zA-Z0-9_]{3,20}$/)`.
- `displayName`: `z.string().min(1).max(40)`.
- `bio`: `z.string().max(280)`.
- `avatarUrl`: `z.string().url().optional()` (ou nulo para resetar).

> zod previne **injeção SQL** indiretamente ao garantir tipos antes de
> chegar ao Prisma (que usa queries parametrizadas). Inputs malformados
> retornam `400 { error: '...', details: [...] }`.

### 9.5 Considerações adicionais

- **E-mail de verificação**: fora do escopo da Fase 1 (`emailVerified`
  é nullable para uso futuro).
- **2FA**: fora do escopo.
- **Lockout de conta**: após N tentativas falhas, exigir captcha ou
  bloqueio temporário por IP. Recomendado para Fase 2+.

---

## 10. Migração de anônimos (1.10)

**Cenário**: jogadores que, antes da Fase 1, entravam apenas com nome
efêmero (sem conta) e acumularam histórico (partidas, stats) atrelado ao
nome + IP/sessão.

**Estratégia** (a aplicar quando/if um fluxo anônimo for introduzido):

1. Ao registrar uma nova conta, se existirem `GameRecord` anônimos com
   mesmo `displayName` (case-insensitive) **e** mesmo IP de criação
   (ou sessão ativa), oferecer ao usuário a opção "Vincular histórico
   anterior".
2. Se confirmado, atualizar `playerId` dos `GameRecord` anônimos para o
   novo `PlayerAccount.id` e recalcular `gamesPlayed`/`gamesWon`/
   `totalScore`/`bestScore`.
3. Se recusado, manter anônimos como estão (sem dono) para fins de
   auditoria, mas não contabilizar no perfil.

**Status neste ambiente**: **N/A**. O LetraMestre original não persiste
identidade anônima — o modo quick-play usa nome efêmero sem
armazenamento. Logo, não há dados anônimos prévios para migrar. A
estratégia acima está documentada para referência futura.

---

## Referências

- [`docs/PHASE1.md`](./PHASE1.md) — documento de execução da Fase 1.
- [`docs/TEST-PLAN-PHASE1.md`](./TEST-PLAN-PHASE1.md) — plano de testes.
- [`docs/PRODUCTION-SETUP.md`](./PRODUCTION-SETUP.md) §8 — hardening, rate-limit, rotação de secrets.
- `worklog.md` — Task ID 5: contrato de API da Fase 1 (fonte de verdade).
- `.env.example` — variáveis `PLAYER_SESSION_TTL_SECONDS`, `GOOGLE_OAUTH_*`, `SMTP_*`.
- Google Identity: <https://developers.google.com/identity/openid-connect/openid-connect>
- OWASP Auth Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
