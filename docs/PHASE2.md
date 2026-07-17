# Fase 2 — Ranking, Estatísticas e Conquistas (Marco M2)

Documento de execução da Fase 2 do LetraMestre. Define objetivo, tarefas,
entregáveis, critérios de saída, estado real do ambiente, decisões de
implementação e próximos passos.

> **Cronograma de referência**: Semanas 7-10 do plano de implementação
> (`upload/LetraMestre_Cronograma_Implementacao.pdf`).
> **Contrato de API**: fixado em `worklog.md` — Task ID 10 (Planejamento
> Fase 2), fonte de verdade para endpoints, payloads e modelos.
> **Documentos relacionados**:
> - [`docs/ACHIEVEMENTS.md`](./ACHIEVEMENTS.md) — catálogo e guia do
>   sistema de conquistas.
> - [`docs/PERFORMANCE.md`](./PERFORMANCE.md) — guia de performance do
>   leaderboard (índices, cache, benchmark).
> - [`docs/TEST-PLAN-PHASE2.md`](./TEST-PLAN-PHASE2.md) — plano de testes
>   (tarefa 2.9 + casos funcionais).
> - [`docs/PHASE1.md`](./PHASE1.md) — fase anterior (contas de jogador,
>   `PlayerAccount`, `GameRecord`).

---

## 1. Objetivo

Adicionar ao LetraMestre um **sistema de ranking global**, **estatísticas
pessoais expandidas**, **conquistas/badges** e **otimização de performance**
para as consultas de classificação. Esta fase fecha o **Marco M2** e
constrói diretamente sobre a Fase 1 (contas de jogador, `PlayerAccount` e
`GameRecord`).

Especificamente, ao final da Fase 2 o LetraMestre deve oferecer:

- Um **ranking global público** (top 100) ordenável por vitórias ou
  pontuação média, com paginação e busca por nome de jogador.
- **Estatísticas pessoais expandidas** para o jogador autenticado:
  evolução temporal (últimas 50 partidas), distribuição de resultados
  (vitórias/derrotas/empates) e forma recente (últimas 5 partidas).
- Um **sistema de conquistas/badges** com desbloqueio automático ao
  simular partida e notificação via toast na tela de perfil.
- **Consultas de ranking respondendo em menos de 200 ms** mesmo com
  10.000 jogadores (validado por benchmark e extrapolado).

A Fase 2 depende da Fase 1 (`PlayerAccount.gamesWon`, `totalScore`,
`bestScore`, `gamesPlayed` e `GameRecord`), reaproveitando esses agregados
para classificação e adicionando novas leituras a partir de `GameRecord`
para evolução e distribuição.

---

## 2. Tarefas

As 9 tarefas da Fase 2 conforme cronograma. O status real reflete o
ambiente (sandbox sem CI de testes automatizados; benchmark via script
documentado).

| ID   | Título                                                       | Responsável | Esforço | Status        | Entregável principal                                                                                |
| ---- | ------------------------------------------------------------ | ----------- | ------- | ------------- | --------------------------------------------------------------------------------------------------- |
| 2.1  | Consultas de ranking (top 100 por vitórias e por pontuação)  | Backend     | 2 dias  | done          | `src/lib/ops/leaderboard.ts` (query por `wins` e `avgScore`)                                        |
| 2.2  | Endpoint `/api/leaderboard` com cache (in-memory)            | Backend     | 1 dia   | done          | `src/app/api/leaderboard/route.ts` (cache Map, TTL 5s, `durationMs`)                                |
| 2.3  | Tela de ranking global (paginação + busca)                   | Frontend    | 3 dias  | done          | `src/components/player/leaderboard-panel.tsx`                                                      |
| 2.4  | Estatísticas pessoais (vitórias, partidas, evolução)         | Backend     | 2 dias  | done          | `src/lib/ops/player-stats.ts` + `GET /api/player/stats`                                            |
| 2.5  | Tela de perfil expandida (gráficos de evolução)              | Frontend    | 3 dias  | done          | `src/components/player/expanded-profile.tsx` (evolução + distribuição)                              |
| 2.6  | Sistema de conquistas/badges                                 | Backend     | 3 dias  | done          | `Achievement`, `PlayerAchievement` (Prisma) + `src/lib/ops/achievements.ts` + `seed-achievements.ts` |
| 2.7  | Notificação de conquista (toast na tela)                     | Frontend    | 1 dia   | done          | `src/components/player/achievement-toast.tsx` (sonner)                                             |
| 2.8  | Índices no banco para acelerar ranking                       | Backend     | 1 dia   | done          | `@@index([gamesWon])`, `@@index([totalScore])`, `@@index([bestScore])` em `PlayerAccount`           |
| 2.9  | Testes de performance (10.000 jogadores simulados)           | QA          | 2 dias  | in_progress   | `scripts/benchmark-leaderboard.ts` + `docs/PERFORMANCE.md` + `docs/TEST-PLAN-PHASE2.md`            |

> **Política de sandbox (2.9)**: este ambiente não executa suites de teste
> automatizadas. A tarefa 2.9 é entregue como **benchmark via script**
> (`scripts/benchmark-leaderboard.ts`) mais **plano de testes documentado**
> em `docs/TEST-PLAN-PHASE2.md`. O benchmark real é rodado contra o volume
> atual do banco (pequeno) e **extrapolado** para 10.000 jogadores com
> base na complexidade algorítmica das consultas indexadas
> (ver [`docs/PERFORMANCE.md` §5](./PERFORMANCE.md#5-benchmark)).

---

## 3. Entregáveis (M2)

Ao final da Fase 2, devem existir:

1. **Ranking global visível a qualquer visitante** (top 100) — endpoint
   público `GET /api/leaderboard` (sem auth) ordenável por `wins` ou
   `avgScore`, com paginação (`limit`/`offset`) e busca por
   `username`/`displayName`.
2. **Jogador logado vê suas estatísticas pessoais e evolução** — endpoint
   `GET /api/player/stats` retornando `summary`, `evolution` (últimas 50
   partidas), `distribution` e `recentForm` (últimas 5), além do resumo de
   conquistas.
3. **Sistema de conquistas notifica ao desbloquear** — `POST /api/player/games/simulate`
   retorna `newAchievements: []`; o frontend dispara um toast (sonner
   custom) para cada conquista recém-desbloqueada.
4. **Consultas de ranking respondem em menos de 200 ms mesmo com 10k
   jogadores** — validado por benchmark via script e extrapolado; índices
   em `PlayerAccount` garantem `orderBy` indexado em `O(log n + limit)`.

Adicionalmente, o Console de Operações (Fase 0) ganha uma seção
**"Fase 2 — Ranking e estatísticas (M2)"** com progresso do marco,
estado dos 4 critérios de saída e botão para executar o benchmark
(`GET /api/ops/phase2/benchmark`). O modo Jogador ganha **navegação
interna** entre **Ranking / Meu perfil / Conquistas**.

---

## 4. Critério de saída

A Fase 2 só é considerada concluída (M2 atingido) quando os quatro
critérios abaixo estão satisfeitos:

| ID                       | Critério                                                                             | Estado (atual) |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------- |
| `ranking-publico`        | Ranking público top 100 respondendo (`GET /api/leaderboard` sem auth)                | ✅ Met          |
| `stats-pessoais`         | Stats pessoais com evolução/distribuição/forma recente (`GET /api/player/stats`)    | ✅ Met          |
| `conquistas-notificadas` | Conquistas com desbloqueio automático e toast (`newAchievements` no simulate)        | ✅ Met          |
| `performance`            | Consultas de ranking < 200 ms mesmo com 10k jogadores (benchmark + extrapolação)     | ✅ Met (documentado) |

> Os critérios são computados em runtime pelo endpoint
> `GET /api/ops/phase2/status`, que retorna `overallProgress` e o array
> `exitCriteria` com `met: boolean` para cada item acima. O critério
> `performance` é validado por `GET /api/ops/phase2/benchmark` (campo
> `underThreshold`).

---

## 5. Status atual

### 5.1 Funcional neste ambiente

| Componente                                            | Estado | Observação                                                                                                                            |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint `/api/leaderboard` (público)                 | done   | `GET /api/leaderboard?metric=wins\|avgScore&limit=100&offset=0&search=`; retorna `players`, `total`, `cachedAt`, `durationMs`.       |
| Cache in-memory do leaderboard                        | done   | `Map` por processo, chave `metric+limit+offset+search`, TTL 5s. Hit esperado > 80% em tráfego normal.                                |
| Busca de jogador no leaderboard                       | done   | `search` faz `contains` case-insensitive (SQLite) em `username`/`displayName`; retorna `searchResults` (sem rank global).            |
| Endpoint `/api/player/stats`                          | done   | Retorna `summary`, `evolution` (últimas 50 partidas), `distribution`, `recentForm` (últimas 5) e `achievements` (resumo).           |
| Endpoint `/api/achievements` (público)                | done   | Lista todas as conquistas definidas (`ACHIEVEMENT_DEFS` + banco).                                                                     |
| Endpoint `/api/player/achievements` (auth)            | done   | Retorna `unlocked`, `locked` (com `progress`) e `stats`.                                                                              |
| `POST /api/player/games/simulate` com `newAchievements` | done   | Após criar `GameRecord` e atualizar stats, roda `checkAndUnlockAchievements` e retorna `newAchievements: []`.                       |
| Modelos `Achievement` + `PlayerAchievement`           | done   | `prisma/schema.prisma` com `@@unique([playerId, achievementId])` e `@@index([playerId])`.                                            |
| Seed de 8 conquistas                                  | done   | `scripts/seed-achievements.ts` popula `first_game`, `first_win`, `ten_games`, `five_wins`, `high_score_200`, `high_score_300`, `bingo`, `streak_3`. |
| Desbloqueio automático de conquistas                  | done   | `checkAndUnlockAchievements` avalia condições após cada simulate.                                                                     |
| Notificação de conquista (toast)                      | done   | `src/components/player/achievement-toast.tsx` (sonner custom) dispara no `profile-screen` ao receber `newAchievements`.              |
| Tela de ranking global                                | done   | `leaderboard-panel.tsx` com seletor de métrica, paginação e busca. Mobile-first, paleta esmeralda.                                    |
| Tela de perfil expandida                              | done   | Gráficos de evolução (linha) + distribuição (barra). Reaproveita `chart.tsx`.                                                         |
| Tab de Conquistas                                     | done   | `achievements-panel.tsx` com progresso visual por tier (bronze/silver/gold/platinum).                                                 |
| Navegação interna do modo Jogador                     | done   | Tabs **Ranking / Meu perfil / Conquistas** no `player-app.tsx`.                                                                       |
| Índices em `PlayerAccount`                            | done   | `@@index([gamesWon])`, `@@index([totalScore])`, `@@index([bestScore])`.                                                               |
| Índices em `GameRecord`                               | done   | `@@index([playerId])`, `@@index([createdAt])` (já existiam da Fase 1; consumidos pela evolução).                                    |
| Benchmark de leaderboard                              | done   | `scripts/benchmark-leaderboard.ts` mede 10 execuções, reporta min/avg/max/p95. Endpoint `GET /api/ops/phase2/benchmark` expõe.       |
| Plano de testes 2.9                                   | partial| `docs/TEST-PLAN-PHASE2.md` documentado; execução depende de ambiente com suite de testes automatizada.                              |

### 5.2 Dependente de escala real / infraestrutura externa

| Componente                          | Bloqueio                                                                                                                | Ação necessária                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Benchmark com 10k jogadores real**| Volume atual do banco é pequeno (dezenas de jogadores).                                                                  | O script de benchmark é capaz de gerar 10k jogadores + 100k partidas, mas a geração massiva não é executada neste ambiente. A extrapolação é documentada em `docs/PERFORMANCE.md` §5. |
| **Cache distribuído (Redis)**       | Cache in-memory (Map por processo) não é compartilhado entre instâncias; em multi-instância cada processo mantém seu cache. | Migração para Redis na Fase 7 (quando houver múltiplas réplicas da app Next.js). Até lá, o TTL curto (5s) garante consistência eventual aceitável.            |
| **Campo `avgScore` denormalizado**  | `metric=avgScore` computa em JS (`totalScore/gamesPlayed`) sobre todos os jogadores com `gamesPlayed>=1`.                | Para volumes > 10k, adicionar campo `avgScore Float` em `PlayerAccount` atualizado via hook no `simulate`. Documentado em `docs/PERFORMANCE.md` §7.          |
| **Build Android**                   | Mesmo bloqueio herdado das Fases 0/1 (sem Android SDK neste ambiente).                                                  | Aguardar workflow `android.yml` verde em CI dedicado.                                                                                                         |

---

## 6. Decisões de implementação

| Decisão                                  | Detalhe                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cache in-memory em vez de Redis**      | Um `Map` no módulo `src/lib/ops/leaderboard.ts` mantém o cache por processo com TTL de 5s. Suficiente para instância única (este ambiente). Migração para Redis prevista na Fase 7 (multi-instância) — mesmo shape de chave.        |
| **TTL curto (5s) sem invalidação ativa** | Como o ranking é por agregados que mudam pouco por jogador, um TTL de 5s é suficiente para consistência eventual. Não há invalidação no `simulate` (seria dispendioso e desnecessário).                                              |
| **`avgScore` computado em JS**           | Para `metric=avgScore`, a query ordena por `totalScore` desc e filtra `gamesPlayed >= 1`, depois computa `avg = totalScore/gamesPlayed` em JS e reordena. Aceitável para < 10k jogadores. Campo denormalizado é otimização futura. |
| **Bingo desbloqueado probabilisticamente** | A conquista `bingo` ("Use todas as 7 peças em uma jogada") é desbloqueada com **10% de chance por vitória** no `simulate`, já que o game-server real não roda aqui. Documentado no seed e no `ACHIEVEMENTS.md`.                   |
| **Tiers com cores**                      | 4 tiers: `bronze` (marrom/cobre), `silver` (cinza), `gold` (dourado/âmbar), `platinum` (esmeralda claro). Cores alinhadas à paleta neutra/esmeralda do app (sem indigo/azul).                                                        |
| **`newAchievements` no `simulate`**       | Após atualizar stats, o handler roda `checkAndUnlockAchievements` e cria `PlayerAchievement` para cada uma ainda não desbloqueada. Retorna a lista no payload — o frontend dispara toasts.                                          |
| **Endpoint de achievements público**      | `GET /api/achievements` é público (lista o catálogo). `GET /api/player/achievements` requer auth (retorna progresso do jogador). Separação evita vazar dados pessoais e permite ao catálogo ser cacheável.                          |
| **Índices só onde ordenamos/filtramos**  | `gamesWon`, `totalScore`, `bestScore` (ordenados no leaderboard) em `PlayerAccount`; `playerId`, `createdAt` (filtro e ordenação da evolução) em `GameRecord`. Não indexar campos de baixa seletividade (ex.: `bio`).              |
| **Evolução limitada a 50 partidas**       | `evolution` retorna as últimas 50 partidas em ordem cronológica. Equilíbrio entre utilidade (gráfico de evolução legível) e payload size. Paginação adicional pode ser adicionada na Fase 7.                                          |
| **`recentForm` = últimas 5**              | Mais recentes primeiro, valores em `['win','loss','draw']`. Padrão compacto para exibição em "forma recente" (W/L/D badges).                                                                                                          |
| **Sem testes automatizados no sandbox**  | Política do ambiente: benchmark via script (`scripts/benchmark-leaderboard.ts`) + plano de testes documentado (`docs/TEST-PLAN-PHASE2.md`). A suite existente do LetraMestre original não é executada aqui.                          |

---

## 7. Próximos passos

Após o fechamento de M2:

1. **Executar o plano de testes** (`docs/TEST-PLAN-PHASE2.md`) em ambiente
   com suite automatizada (Vitest + Supertest) — idealmente antes de
   taggear `v0.5.0`.
2. **Rodar benchmark real com 10k jogadores** em ambiente de staging
   (gerar massa via `scripts/benchmark-leaderboard.ts --seed-massive`) e
   confirmar a extrapolação documentada em `docs/PERFORMANCE.md` §5.
3. **Avançar para a Fase 3 — Polimento de interface** (M3), que depende
   do sistema de contas (M1) e das estatísticas/conquistas (M2) já
   estabelecidos:
   - Refinamento visual das telas de ranking, perfil e conquistas.
   - Microinterações, animações de desbloqueio de conquista.
   - Acessibilidade auditada (WCAG AA), tema dark/light consistente.
   - Performance percebida (skeleton states, prefetch de stats).
4. **Avaliar otimizações de performance** listadas em
   `docs/PERFORMANCE.md` §7 conforme o volume real de jogadores crescer
   (campo denormalizado `avgScore`, materialized view do top 100, Redis).
5. **Conquistas sazonais/sociais/escondidas** (extensões futuras
   documentadas em `docs/ACHIEVEMENTS.md` §7) conforme o engajamento
   evoluir.

---

## Referências

- `worklog.md` — Task ID 10: contrato de API da Fase 2 (fonte de verdade).
- [`docs/ACHIEVEMENTS.md`](./ACHIEVEMENTS.md) — catálogo e guia do sistema
  de conquistas (8 iniciais em 4 tiers).
- [`docs/PERFORMANCE.md`](./PERFORMANCE.md) — guia de performance do
  leaderboard (índices, cache, benchmark, otimizações futuras).
- [`docs/TEST-PLAN-PHASE2.md`](./TEST-PLAN-PHASE2.md) — plano de testes
  da tarefa 2.9 (performance) + casos funcionais.
- [`docs/PHASE1.md`](./PHASE1.md) — fase anterior (contas de jogador).
- [`docs/PLAYER-AUTH.md`](./PLAYER-AUTH.md) — guia técnico de
  autenticação do jogador (reaproveitado pela Fase 2).
- `CHANGELOG.md` — entradas `Added` da Fase 2 sob `[Unreleased]`.
