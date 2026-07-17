# Fase 1 — Contas de Jogador (Marco M1)

Documento de execução da Fase 1 do LetraMestre. Define objetivo, tarefas,
entregáveis, critério de saída, estado real do ambiente, decisões de
implementação e próximos passos.

> **Cronograma de referência**: Semanas 3-6 do plano de implementação
> (`upload/LetraMestre_Cronograma_Implementacao.pdf`).
> **Contrato de API**: fixado em `worklog.md` — Task ID 5 (Planejamento Fase 1).
> **Guia técnico de autenticação**: [`docs/PLAYER-AUTH.md`](./PLAYER-AUTH.md).
> **Plano de testes**: [`docs/TEST-PLAN-PHASE1.md`](./TEST-PLAN-PHASE1.md).

---

## 1. Objetivo

Adicionar ao LetraMestre um **sistema de contas de jogador** com perfil
persistente, histórico de partidas e identidade verificável. Esta fase fecha o
**Marco M1** e habilita as fases seguintes (Ranking, partidas ranqueadas,
estatísticas agregadas) que dependem de identidade.

Especificamente, ao final da Fase 1 o jogador deve poder:

- Registrar-se e autenticar-se por **e-mail + senha** (bcrypt + JWT).
- Opcionalmente, autenticar-se via **Google OAuth2** (quando configurado).
- Recuperar senha por **token de uso único** (1h de TTL).
- Manter a **sessão persistente** entre visitas (cookie HttpOnly, 7 dias).
- Ter um **perfil** com avatar, nome de exibição, bio e estatísticas.
- Ter **partidas vinculadas** à conta (simuladas neste ambiente).

A Fase 1 **reaproveita a infraestrutura de autenticação já existente** para o
admin (`web/src/lib/auth.ts`: bcrypt cost 12 + JWT HS256 assinado com
`jose` usando `AUTH_SECRET`), estendendo-a para o escopo `player`. A separação
de cookies (`player_session` vs `admin_session`) e do claim `scope` no JWT
garante que tokens de admin e de jogador não se confundam.

---

## 2. Tarefas

As 10 tarefas da Fase 1 conforme cronograma. O status real reflete o estado
deste ambiente (sandbox sem CI de testes automatizados e sem jogadores
anônimos prévios).

| ID   | Título                                                              | Responsável     | Esforço | Status        | Entregável principal                                                              |
| ---- | ------------------------------------------------------------------- | --------------- | ------- | ------------- | --------------------------------------------------------------------------------- |
| 1.1  | Modelar tabela `PlayerAccount`                                      | Backend         | 1 dia   | done          | `prisma/schema.prisma` (+ `PasswordResetToken`, `GameRecord`)                     |
| 1.2  | Endpoint de registro e-mail + senha                                | Backend         | 2 dias  | done          | `POST /api/auth/player/register`                                                  |
| 1.3  | Endpoint de login — reaproveitar `auth.ts`                          | Backend         | 1 dia   | done          | `POST /api/auth/player/login`                                                     |
| 1.4  | Login social Google OAuth2                                         | Backend         | 3 dias  | done          | `GET /api/auth/player/google` + `POST /api/auth/player/google/demo`               |
| 1.5  | Tela de registro/login mobile-first acessível                      | Frontend        | 3 dias  | done          | `src/components/player/*` (modo Jogador)                                          |
| 1.6  | Integrar conta ao fluxo de jogo                                    | Frontend        | 2 dias  | done          | `POST /api/player/games/simulate` + `GET /api/player/games`                       |
| 1.7  | Tela de perfil — avatar, nome, stats                               | Frontend        | 2 dias  | done          | `GET /api/auth/player/me` + `PATCH /api/auth/player/me`                           |
| 1.8  | Recuperação de senha                                                | Backend+Frontend| 2 dias  | done          | `POST /api/auth/player/forgot-password` + `POST /api/auth/player/reset-password`  |
| 1.9  | Testes — registro, login, recuperação, OAuth                       | QA              | 2 dias  | in_progress   | `docs/TEST-PLAN-PHASE1.md` (plano documentado; sandbox sem suite automatizada)    |
| 1.10 | Migrar jogadores anônimos existentes                               | Backend         | 1 dia   | n/a           | Documentado: não há jogadores anônimos prévios neste ambiente                     |

> **Política de sandbox (1.9)**: este ambiente não executa suites de teste
> automatizadas. A tarefa 1.9 é entregue como **plano de testes documentado**
> em `docs/TEST-PLAN-PHASE1.md`, cobrindo casos funcionais, de segurança, de
> OAuth e de borda.
>
> **Justificativa N/A (1.10)**: o LetraMestre original não possui fluxo de
> "jogador anônimo" persistente — o modo quick-play usa nome efêmero sem
> armazenamento de identidade. A estratégia de migração está documentada em
> [`docs/PLAYER-AUTH.md` §10](./PLAYER-AUTH.md#10-migração-de-anônimos-110) e
> será aplicada se/when um fluxo anônimo for introduzido.

---

## 3. Entregáveis (M1)

Ao final da Fase 1, devem existir:

1. **Registro/login real** — jogador pode se registrar com e-mail/senha **ou**
   login Google (este último quando `GOOGLE_OAUTH_CLIENT_ID` configurado).
2. **Sessão persistente** — cookie `player_session` HttpOnly, TTL 7 dias,
   sobrevive a fechamento do navegador e reabertura.
3. **Partidas vinculadas à conta** — toda partida (simulada neste ambiente)
   fica associada ao `playerId` e atualiza as estatísticas do perfil.
4. **Perfil com avatar + stats** — tela mostrando `displayName`, `avatarUrl`,
   `bio`, `gamesPlayed`, `gamesWon`, `winRate`, `totalScore`, `bestScore` e
   partidas recentes.

Adicionalmente, o Console de Operações (Fase 0) ganha uma seção
**"Contas de jogador (Fase 1)"** com progresso do M1 e lista de jogadores
cadastrados, e o cabeçalho do app ganha um **seletor de modo
Operações/Jogador**.

---

## 4. Critério de saída

A Fase 1 só é considerada concluída (M1 atingido) quando os quatro critérios
abaixo estão satisfeitos:

| ID                     | Critério                                                          | Estado (atual) |
| ---------------------- | ----------------------------------------------------------------- | -------------- |
| `register-login`       | Jogador registra e loga (e-mail/senha **ou** Google)              | ✅ Met          |
| `persistent-session`   | Sessão persiste entre visitas (cookie HttpOnly, 7 dias)           | ✅ Met          |
| `games-linked`         | Partidas criadas ficam vinculadas à conta (`playerId`)            | ✅ Met          |
| `profile-avatar-stats` | Perfil exibe avatar + estatísticas + partidas recentes            | ✅ Met          |

> Os critérios são computados em runtime pelo endpoint
> `GET /api/ops/phase1/status`, que retorna `overallProgress` e o array
> `exitCriteria` com `met: boolean` para cada item acima.

---

## 5. Status atual

### 5.1 Funcional neste ambiente

| Componente                              | Estado | Observação                                                                                              |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Modelo `PlayerAccount` (+ relacionados) | done   | `prisma/schema.prisma` estendido com `PlayerAccount`, `PasswordResetToken`, `GameRecord`.               |
| Registro e-mail + senha                 | done   | `POST /api/auth/player/register` — bcrypt cost 12, validação zod, avatar DiceBear inicial.              |
| Login e-mail + senha                    | done   | `POST /api/auth/player/login` — verifica hash, emite JWT HS256, seta cookie `player_session`.           |
| Logout                                  | done   | `POST /api/auth/player/logout` — limpa cookie.                                                          |
| Sessão (`/me`)                          | done   | `GET /api/auth/player/me` — hidrata sessão, retorna perfil + stats. 401 sem cookie.                     |
| Edição de perfil                        | done   | `PATCH /api/auth/player/me` — atualiza `displayName`, `bio`, `avatarUrl`.                               |
| Recuperação de senha (demo)             | done   | `POST /api/auth/player/forgot-password` gera token hex 32 (TTL 1h, single-use); em modo demo retorna o token na resposta. |
| Reset de senha                          | done   | `POST /api/auth/player/reset-password` — valida token, atualiza hash.                                   |
| Google OAuth (real)                     | done*  | `GET /api/auth/player/google` gera `authUrl` real quando `GOOGLE_OAUTH_CLIENT_ID` configurado. Callback real em `/api/auth/player/google/callback` (aguarda domínio verificado). |
| Google OAuth (demo)                     | done   | `POST /api/auth/player/google/demo` simula callback OAuth sem depender do Google.                       |
| Partidas simuladas vinculadas           | done   | `POST /api/player/games/simulate` + `GET /api/player/games` atualizam e listam partidas do jogador.     |
| Tela de registro/login                  | done   | `src/components/player/*` no modo Jogador (mobile-first, acessível, paleta esmeralda).                  |
| Tela de perfil                          | done   | Avatar DiceBear, stats, partidas recentes.                                                              |
| Seletor de modo Operações/Jogador       | done   | `src/components/site/header.tsx`.                                                                       |
| Seção Ops "Contas de jogador"           | done   | `GET /api/ops/phase1/status` + `GET /api/ops/phase1/players`.                                           |
| Plano de testes                         | partial| `docs/TEST-PLAN-PHASE1.md` documentado; execução depende de ambiente com suite de testes.               |

`*` — OAuth real exige infra externa (ver §5.2).

### 5.2 Dependente de infraestrutura externa

| Componente                     | Bloqueio                                                                                                       | Ação necessária                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Google OAuth real**          | Credenciais `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` não definidas; redirect URI não verificada. | Criar OAuth client no Google Cloud Console, autorizar `<WEB_ORIGIN>/api/auth/player/google/callback`, definir domínio verificado. |
| **E-mail de recuperação real** | Sem servidor SMTP configurado.                                                                                 | Provisionar SMTP (Mailtrap em staging, SES/SendGrid/Postmark em prod) e definir `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`. Até lá, `/forgot-password` retorna o token na resposta (modo demo — NUNCA em produção). |
| **Build Android**              | Mesmo bloqueio herdado da Fase 0 (sem Android SDK neste ambiente).                                             | Aguardar workflow `android.yml` verde em CI dedicado.                                                 |

---

## 6. Decisões de implementação

| Decisão                                  | Detalhe                                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cookie separado**                      | `player_session` é distinto do `admin_session` (já existente). Um jogador autenticado não ganha acesso admin e vice-versa.                                                                              |
| **SameSite=Lax**                         | Necessário para o fluxo OAuth: o redirect de callback do Google chega como navegação top-level cross-site, que o `Lax` permite. `Strict` quebraria o OAuth. `None` seria excessivamente permissivo.     |
| **Secure em produção**                   | `Secure=true` quando `NODE_ENV=production`; `false` em dev (http://localhost).                                                                                                                          |
| **TTL 7 dias**                           | Equilíbrio entre conveniência (não logar toda hora) e segurança. Configurável via `PLAYER_SESSION_TTL_SECONDS` (default `604800`).                                                                      |
| **JWT HS256 com `jose`**                 | Reutiliza `AUTH_SECRET` já provisionado na Fase 0. Claim `scope: 'player'` distingue de tokens admin (`scope: 'admin'`).                                                                                |
| **bcrypt cost 12**                       | Mesmo padrão do admin. Hash armazenado em `passwordHash`. Senha em texto nunca logada, nunca retornada em nenhuma rota.                                                                                  |
| **Avatar DiceBear**                      | Avatar inicial gerado via DiceBear `initials` API (`https://api.dicebear.com/7.x/initials/svg?seed=<displayName>`). Jogador pode sobrescrever via `PATCH /me`.                                          |
| **Google OAuth com fallback demo**       | Endpoints `/google` e `/google/callback` são reais e prontos. Quando creds ausentes, `/google` retorna `{configured:false, demo:true}` e o cliente usa `/google/demo` para simular o fluxo.            |
| **Recuperação de senha (token)**         | Token random hex 32 bytes, TTL 1h, single-use (`usedAt` marcado no consumo). Em produção é entregue por e-mail; em dev (sem SMTP) é retornado na resposta para facilitar testes — claramente rotulado. |
| **Validação de input com zod**           | Todos os endpoints validam body com schemas zod; falha retorna 400 com mensagem acionável.                                                                                                              |
| **Partidas simuladas**                   | Como o game-server real não roda neste ambiente, `POST /api/player/games/simulate` cria um `GameRecord` e atualiza stats — demonstrando o vínculo conta↔partida sem depender do Socket.io.            |
| **Sem testes automatizados no sandbox**  | Política do ambiente: plano de testes documentado em `docs/TEST-PLAN-PHASE1.md` (tarefa 1.9). A suite existente do LetraMestre original (218 testes) não é executada aqui.                            |

---

## 7. Próximos passos

Após o fechamento de M1:

1. **Provisionar infra externa pendente** (§5.2):
   - Google Cloud Console: OAuth client + redirect URI verificada.
   - SMTP: servidor de e-mail para recuperação de senha real.
2. **Executar o plano de testes** (`docs/TEST-PLAN-PHASE1.md`) em ambiente
   com suite automatizada — idealmente antes de taggear `v0.4.0`.
3. **Avançar para a Fase 2 — Ranking e estatísticas** (M2), que depende das
   contas de jogador estabelecidas nesta fase:
   - Ranking global e por janela temporal (semanal/mensal).
   - Estatísticas agregadas por jogador (média de pontos, tempo de partida,
     taxa de bingo).
   - Conquistas/badges derivadas do `GameRecord`.
4. **Reabrir 1.10** se um fluxo anônimo for introduzido — aplicar a
   estratégia de migração documentada em `docs/PLAYER-AUTH.md` §10.

---

## Referências

- `worklog.md` — Task ID 5: contrato de API da Fase 1 (fonte de verdade).
- [`docs/PLAYER-AUTH.md`](./PLAYER-AUTH.md) — guia técnico do sistema de auth do jogador.
- [`docs/TEST-PLAN-PHASE1.md`](./TEST-PLAN-PHASE1.md) — plano de testes (tarefa 1.9).
- [`docs/PHASE0.md`](./PHASE0.md) — documentação da Fase 0 (fundação).
- [`docs/PRODUCTION-SETUP.md`](./PRODUCTION-SETUP.md) — setup de produção (inclui hardening, rate-limit, rotação de `AUTH_SECRET`).
- `.env.example` — variáveis de ambiente (incluindo `PLAYER_SESSION_TTL_SECONDS`, `GOOGLE_OAUTH_*`, `SMTP_*`).
- `RELEASE.md` — processo de release (SemVer, tags, rollback).
