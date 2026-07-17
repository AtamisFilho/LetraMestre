# Plano de Testes — Fase 2 (Tarefa 2.9)

Plano de testes da Fase 2 (Marco M2) do LetraMestre. Cobre testes de
**performance** do leaderboard (tarefa 2.9) e testes **funcionais** de
ranking, estatísticas pessoais e conquistas.

> **Política do sandbox**: este ambiente não executa suites de teste
> automatizadas. A tarefa 2.9 é entregue como **benchmark via script**
> (`scripts/benchmark-leaderboard.ts`) mais este **plano de testes
> documentado**. A execução automatizada deve ocorrer em ambiente com
> Vitest + Supertest (ou equivalente).
>
> **Documentos relacionados**:
> - [`docs/PHASE2.md`](./PHASE2.md) — execução da Fase 2.
> - [`docs/PERFORMANCE.md`](./PERFORMANCE.md) — guia de performance
>   (índices, cache, benchmark).
> - [`docs/ACHIEVEMENTS.md`](./ACHIEVEMENTS.md) — catálogo de
>   conquistas.
> - `worklog.md` Task ID 10 — contrato de API (fonte de verdade).

---

## 1. Escopo

Cobertura de dois grupos:

- **Performance (P-*)** — latência do `GET /api/leaderboard` sob
  diferentes volumes de jogadores, métricas e condições de cache.
  Tarefa 2.9 do cronograma.
- **Funcionais (F-*)** — comportamento esperado dos endpoints e da UI
  de ranking, estatísticas pessoais e conquistas.

**Fora de escopo**:

- Game-server Socket.io (não roda neste ambiente).
- Multiplayer real (o `simulate` é a única fonte de partidas).
- Build Android (mesmo bloqueio herdado das Fases 0/1).
- OAuth Google real (cobre-se apenas o fluxo demo — já na Fase 1).

**Estratégia**:

- Casos **automatizáveis**: Vitest + Supertest contra os handlers
  `/api/leaderboard`, `/api/player/stats`, `/api/player/achievements`,
  `/api/achievements`, `/api/player/games/simulate`, `/api/ops/phase2/*`.
  Banco SQLite em memória (`file::memory:`) com `prisma db push` +
  `scripts/seed-achievements.ts` no `beforeAll`.
- Casos **manuais**: inspeção de toast na UI, paginação visual,
  gráficos de evolução.
- Casos de **performance**: executar `scripts/benchmark-leaderboard.ts`
  (ou `GET /api/ops/phase2/benchmark`) e validar `underThreshold=true`.

---

## 2. Performance (2.9)

Threshold global: **`durationMs <= 200 ms`** (P95 em 10 execuções).
Para casos de cache hit, threshold secundário: **2ª chamada < 1ª**.

| ID     | Cenário                                                        | Setup                                                                       | Passos                                                                   | Resultado esperado                                                                            |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| P-001  | Leaderboard `metric=wins` com 0 jogadores                      | Banco vazio (após `prisma migrate reset`).                                 | `GET /api/leaderboard?metric=wins&limit=100`.                            | `200`; `total=0`; `players=[]`; `durationMs < 200`.                                           |
| P-002  | Leaderboard `metric=wins` com 100 jogadores                    | Seed de 100 `PlayerAccount` com `gamesWon` aleatório (0-20).               | `GET /api/leaderboard?metric=wins&limit=100`.                            | `200`; `total=100`; `players.length=100`; `players[0].gamesWon >= players[1].gamesWon`; `durationMs < 200`. |
| P-003  | Leaderboard `metric=wins` com 1.000 jogadores                  | Seed de 1.000 `PlayerAccount`.                                              | `GET /api/leaderboard?metric=wins&limit=100`.                            | `200`; `total=1000`; `players.length=100`; `durationMs < 200`.                                |
| P-004  | Leaderboard `metric=wins` com 10.000 jogadores (simulado)      | Seed de 10.000 `PlayerAccount` via `scripts/benchmark-leaderboard.ts --seed-massive` (ou extrapolação documentada). | `GET /api/leaderboard?metric=wins&limit=100` (10 execuções, reporta p95). | `p95Ms < 200`; `underThreshold=true`. Se via extrapolação: confirmar `O(log n + limit)` (ver [`PERFORMANCE.md` §5](./PERFORMANCE.md#5-benchmark)). |
| P-005  | Leaderboard `metric=avgScore` com 1.000 jogadores              | Seed de 1.000 `PlayerAccount` com `gamesPlayed >= 1`.                      | `GET /api/leaderboard?metric=avgScore&limit=100`.                        | `200`; todos `players[i].gamesPlayed >= 1`; `players[0].avgScore >= players[1].avgScore`; `durationMs < 200`. |
| P-006  | Busca (`search`) responde < 200 ms                             | Seed de 1.000 jogadores com usernames variados.                            | `GET /api/leaderboard?metric=wins&search=joao`.                          | `200`; `searchResults` contém apenas jogadores com `joao` em `username` ou `displayName` (case-insensitive); `durationMs < 200`. |
| P-007  | Cache hit reduz latência                                      | Banco com 100 jogadores.                                                    | (1) `GET /api/leaderboard?metric=wins` (cold). (2) `GET` idêntico (hit). | `durationMs` da 2ª chamada **<** da 1ª; `cachedAt` igual nas duas; 2ª chamada ~0-2 ms.        |
| P-008  | Endpoint `/api/ops/phase2/benchmark` retorna `underThreshold=true` | Banco com volume atual (pequeno).                                          | `GET /api/ops/phase2/benchmark`.                                          | `200`; payload contém `playerCount`, `minMs`, `avgMs`, `maxMs`, `p95Ms`, `underThreshold=true`, `thresholdMs=200`. |

> **Observação sobre P-004**: este ambiente não gera massa de 10k
> jogadores automaticamente. O caso P-004 é satisfeito pela
> **extrapolação documentada** em `docs/PERFORMANCE.md` §5 (complexidade
> `O(log n + limit)` do `orderBy` indexado). Em ambiente de staging,
> executar `scripts/benchmark-leaderboard.ts --seed-massive` para validar
> a extrapolação empiricamente.

---

## 3. Funcionais

Casos organizados por área: **leaderboard** (F-001 a F-006),
**estatísticas pessoais** (F-007 a F-012), **conquistas** (F-013 a
F-020).

### 3.1 Leaderboard

| ID     | Cenário                                          | Passos                                                                                                       | Resultado esperado                                                                                       |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| F-001  | Leaderboard sem jogadores (lista vazia)          | `GET /api/leaderboard` com banco vazio.                                                                       | `200`; `total=0`; `players=[]`; `searchResults=null`; `durationMs` presente.                             |
| F-002  | Top-3 ordenado por vitórias                      | Seed de 3 jogadores com `gamesWon` = 5, 3, 1. `GET /api/leaderboard?metric=wins`.                            | `players[0].gamesWon=5`, `[1].gamesWon=3`, `[2].gamesWon=1`; `rank=1,2,3`.                               |
| F-003  | Paginação (`limit`/`offset`)                     | Seed de 150 jogadores. `GET ?limit=100&offset=0` depois `?limit=50&offset=100`.                              | 1ª chamada: `players.length=100`. 2ª: `players.length=50`. Nenhum `id` se repete entre as duas.          |
| F-004  | Busca sem resultado                              | `GET ?search=zzznomequenaoexiste`.                                                                            | `200`; `searchResults=[]`; `players` pode ser `[]` ou conter top-100 padrão; `total` reflete total real. |
| F-005  | Busca parcial (case-insensitive)                 | Seed de jogador com `username='JoaoSilva'`. `GET ?search=joao`.                                              | `searchResults` contém o jogador; `search` é case-insensitive (teste também `JOAO`, `joAO`).             |
| F-006  | `metric=avgScore` exclui jogadores com `gamesPlayed=0` | Seed de jogador A com `gamesPlayed=0` (zero partidas) e jogador B com `gamesPlayed=5, totalScore=500`. `GET ?metric=avgScore`. | Jogador A **não** aparece em `players`; jogador B aparece com `avgScore=100`.                            |

### 3.2 Estatísticas pessoais

| ID     | Cenário                                          | Passos                                                                                                       | Resultado esperado                                                                                       |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| F-007  | Stats de jogador sem partidas                    | Registrar novo jogador; `GET /api/player/stats`.                                                             | `summary.gamesPlayed=0`, `gamesWon=0`, `winRate=0`, `totalScore=0`, `bestScore=0`, `currentStreak=0`, `bestStreak=0`; `evolution=[]`; `distribution={wins:0,losses:0,draws:0}`; `recentForm=[]`. |
| F-008  | Stats com evolução de 50 partidas                | Simular 60 partidas para o jogador (mistura win/loss/draw). `GET /api/player/stats`.                         | `evolution.length=50` (últimas 50); `evolution[0]` é a mais antiga das 50; `evolution[49]` é a mais recente; `cumulativeScore` cresce corretamente; `cumulativeWins` bate com `summary.gamesWon`. |
| F-009  | Distribuição correta                             | Simular 5 win, 3 loss, 2 draw. `GET /api/player/stats`.                                                      | `distribution={wins:5,losses:3,draws:2}`; `summary.gamesPlayed=10`.                                      |
| F-010  | Forma recente (5)                                | Simular 10 partidas. `GET /api/player/stats`.                                                                | `recentForm.length=5`; `recentForm[0]` = resultado da partida mais recente (ordem decrescente).          |
| F-011  | `currentStreak` e `bestStreak`                   | Simular sequência W,W,W,L,W. `GET /api/player/stats`.                                                        | `currentStreak=1` (após L quebrou; W atual conta 1); `bestStreak=3`.                                     |
| F-012  | Stats sem auth                                   | `GET /api/player/stats` sem cookie `player_session`.                                                         | `401 { error: 'Não autenticado' }`.                                                                      |

### 3.3 Conquistas

| ID     | Cenário                                          | Passos                                                                                                       | Resultado esperado                                                                                       |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| F-013  | `first_game` desbloqueia na 1ª partida           | Jogador novo. `POST /api/player/games/simulate` (qualquer resultado).                                        | `201`; `newAchievements` contém `{code:'first_game'}`; `PlayerAchievement` criado com `unlockedAt` setado. |
| F-014  | `first_win` desbloqueia na 1ª vitória            | Jogador novo. `POST /api/player/games/simulate { result:'win' }`.                                            | `201`; `newAchievements` contém `first_game` **e** `first_win`.                                          |
| F-015  | `ten_games` desbloqueia na 10ª partida           | Simular 9 partidas (nenhum `ten_games` em `newAchievements`). 10ª: `POST /simulate`.                          | 10ª resposta contém `{code:'ten_games'}` em `newAchievements`.                                          |
| F-016  | `high_score_200` quando `bestScore >= 200`        | `POST /simulate { result:'win', score:250 }`.                                                                | `201`; `newAchievements` contém `high_score_200` (e **não** `high_score_300`, pois 250 < 300).          |
| F-017  | `bingo` probabilístico (não determinístico)      | Jogador com várias vitórias. Repetir `POST /simulate { result:'win' }` N=50 vezes.                           | `bingo` aparece em `newAchievements` em **alguma** das execuções (estatisticamente, ~99% de chance em 50 tentativas com 10% cada). **Documentar**: caso de teste não-determinístico — para testar deterministicamente, mockar `Math.random` ou expor flag de teste. |
| F-018  | `streak_3` após 3 vitórias seguidas              | `POST /simulate { result:'win' }` 3x consecutivas (jogador novo).                                            | 3ª resposta contém `{code:'streak_3'}` em `newAchievements`.                                             |
| F-019  | Conquista **não** re-desbloqueia                 | Após F-013 (1ª partida), simular 2ª partida.                                                                 | `201`; `newAchievements` **não** contém `first_game` (já desbloqueada); `PlayerAchievement` com `(playerId, achievementId='first_game')` permanece único. |
| F-020  | `GET /api/achievements` é público                | Sem cookie. `GET /api/achievements`.                                                                         | `200`; `achievements.length=8`; cada item tem `code, name, description, icon, category, tier`.           |
| F-021  | `GET /api/player/achievements` requer auth       | Sem cookie. `GET /api/player/achievements`.                                                                  | `401`.                                                                                                   |
| F-022  | `simulate` retorna `newAchievements`             | Após login. `POST /api/player/games/simulate`.                                                               | `201`; body contém `game` e `newAchievements` (array, pode ser `[]`).                                    |
| F-023  | Progresso de conquista bloqueada                 | Após 3 partidas (não 10). `GET /api/player/achievements`.                                                    | `locked` contém `{code:'ten_games', progress:{current:3, target:10, percent:30}}`.                       |
| F-024  | Toast de conquista dispara na UI                 | (Manual) Na tela de perfil, clicar em "Simular partida" e desbloquear uma conquista.                         | Toast custom aparece por ~5s com ícone, nome e tier colorido.                                            |

> **F-017 — Bingo probabilístico**: por ser não-determinístico, o caso
> de teste deve ser **documentado** no relatório de execução com a
> abordagem usada (mock de `Math.random`, flag de teste, ou N=50 com
> asserção estatística). Recomenda-se expor um modo de teste no
> `simulate` (ex.: `?mockRandom=0.05` força bingo) — **não
> implementado na Fase 2**, listado como otimização futura.

---

## 4. Critério de aceitação

A tarefa 2.9 é considerada concluída quando:

1. **Todos os P-\* com `underThreshold=true`**:
   - P-001 a P-008 executados (em ambiente com suite automatizada
     ou via script de benchmark).
   - `p95Ms <= 200 ms` em todos os casos.
   - P-004 (10k jogadores) pode ser satisfeito por extrapolação
     documentada (ver [`docs/PERFORMANCE.md` §5](./PERFORMANCE.md#5-benchmark)).
2. **Todos os F-\* passam**:
   - F-001 a F-024 executados (manuais ou automatizados).
   - Exceção: F-017 (bingo probabilístico) — documentar abordagem.
3. **Suite existente permanece verde**:
   - Após merges da Fase 2, nenhum teste da Fase 0/1 regressa.
   - Plano de testes da Fase 1 (`docs/TEST-PLAN-PHASE1.md`) ainda
     válido.

> **Execução neste ambiente**: o script `scripts/benchmark-leaderboard.ts`
> (e o endpoint `GET /api/ops/phase2/benchmark`) valida P-001 a P-008 no
> volume atual do banco. Os casos F-\* são **plano documentado** — a
> execução automatizada depende de ambiente com Vitest + Supertest.

---

## 5. Riscos e mitigações

| Risco                                                | Mitigação                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Latência do `metric=avgScore` cresce linearmente     | Campo denormalizado `avgScore` em `PlayerAccount` (otimização futura — `docs/PERFORMANCE.md` §7).                          |
| Cache in-memory perde em multi-instância             | Migração para Redis na Fase 7 (mesmo shape de chave).                                                                      |
| `LIKE '%term%'` em `search` degrada em volume grande | FTS5 SQLite para `username`+`displayName` (otimização futura).                                                             |
| Extrapolação de 10k pode ser otimista                | Rodar benchmark real em staging com `--seed-massive` antes de fechar M2 em produção.                                       |
| Bingo probabilístico não-testável deterministicamente| Documentar abordagem (mock de `Math.random` ou flag de teste).                                                             |
| Índices não aplicados se Prisma não os detectar      | Verificar `EXPLAIN QUERY PLAN` no SQLite para `orderBy([gamesWon desc])` — confirmar uso do índice.                        |

---

## Referências

- `worklog.md` Task ID 10 — contrato de API (endpoints, payloads).
- [`docs/PHASE2.md`](./PHASE2.md) §4 — critério de saída `performance`.
- [`docs/PERFORMANCE.md`](./PERFORMANCE.md) — guia de performance
  (índices, cache, benchmark, otimizações futuras).
- [`docs/ACHIEVEMENTS.md`](./ACHIEVEMENTS.md) — catálogo de conquistas
  (condições de desbloqueio).
- [`docs/TEST-PLAN-PHASE1.md`](./TEST-PLAN-PHASE1.md) — plano da Fase 1
  (suite anterior que deve permanecer verde).
- `scripts/benchmark-leaderboard.ts` — script de benchmark.
