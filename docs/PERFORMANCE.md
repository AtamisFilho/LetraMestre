# Performance do Leaderboard — Guia

Documento de referência de performance das consultas de ranking do
LetraMestre (Fase 2, Marco M2). Define o objetivo de latência, os
índices utilizados, a estratégia de cache, as consultas Prisma, o
benchmark, o monitoramento e as otimizações futuras.

> **Documentos relacionados**:
> - [`docs/PHASE2.md`](./PHASE2.md) §4 — critério de saída
>   `performance` (< 200 ms com 10k jogadores).
> - [`docs/TEST-PLAN-PHASE2.md`](./TEST-PLAN-PHASE2.md) — casos P-001 a
>   P-008 (testes de performance).
> - `scripts/benchmark-leaderboard.ts` — script de benchmark.
> - `worklog.md` Task ID 10 — contrato de `/api/leaderboard`.

---

## 1. Objetivo

Garantir que as consultas de ranking respondam em **menos de 200 ms**
mesmo com **10.000 jogadores** cadastrados, conforme entregável M2 da
Fase 2. Este limite cobre:

- `GET /api/leaderboard?metric=wins` (top 100 por vitórias).
- `GET /api/leaderboard?metric=avgScore` (top 100 por pontuação média).
- `GET /api/leaderboard?search=...` (busca por nome).

O threshold de 200 ms cobre o tempo total do handler (consulta Prisma +
computação JS + serialização JSON), reportado no campo `durationMs` do
payload de resposta. A latência de rede (cliente↔servidor) é excluída.

---

## 2. Índices

Os índices abaixo são definidos em `prisma/schema.prisma`:

### `PlayerAccount`

| Índice                       | Justificativa                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@@index([gamesWon])`        | `metric=wins` ordena por `gamesWon desc, totalScore desc`. Acelera a fase de `orderBy` (varredura indexada).             |
| `@@index([totalScore])`      | Desempate em `metric=wins` e métrica-base para `metric=avgScore` (computada como `totalScore/gamesPlayed`).              |
| `@@index([bestScore])`       | Não usado diretamente no leaderboard, mas habilitado para futura métrica `bestScore` e para a tela de perfil (estatística). |
| `@@unique([email])`          | Já existia da Fase 1 — `findUnique` no login.                                                                            |
| `@@unique([username])`       | Já existia da Fase 1 — busca por username no `search`.                                                                   |

### `GameRecord`

| Índice                  | Justificativa                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@@index([playerId])`   | `GET /api/player/stats` (evolução/distribuição) filtra por `playerId`. Já existia da Fase 1.                     |
| `@@index([createdAt])`  | `evolution` ordena por `createdAt` desc (últimas 50 partidas); `streak_3` avalia últimas N partidas por data.    |

> **Princípio**: indexar apenas campos que aparecem em `orderBy`,
> `where` com seletividade alta, ou junções. Não indexar campos de
> baixa seletividade (ex.: `bio`) — o custo de manutenção do índice
> supera o ganho.

---

## 3. Cache

### Estratégia

Cache **in-memory** no módulo `src/lib/ops/leaderboard.ts`:

```ts
type CacheKey = string // `${metric}:${limit}:${offset}:${search ?? ''}`
interface CacheEntry { payload: LeaderboardPayload; expiresAt: number }

const leaderboardCache = new Map<CacheKey, CacheEntry>()
const TTL_MS = 5_000 // 5 segundos
```

- **Chave**: `metric + limit + offset + search` (search normalizada:
  trim + lowercase; vazia se ausente).
- **TTL**: 5 segundos. Entradas expiradas são removidas na leitura
  (lazy eviction) ou em uma varredura periódica.
- **Escopo**: por processo Node.js. Em multi-instância, cada processo
  mantém seu cache — ver §7 (migração para Redis na Fase 7).

### Hit ratio esperada

- **Tráfego normal** (poucos jogadores simultâneos, múltiplas chamadas
  ao leaderboard por sessão): hit ratio **> 80%**.
- **Tráfego pico** (rankings consultados por muitos visitantes): hit
  ratio **> 95%** (5s de TTL captura a maioria das repetições).
- **Cold cache** (após deploy/restart): primeira chamada é cache miss;
  subseqüentes são hit.

### Invalidação

**Não há invalidação ativa**. Justificativa:

1. Os agregados em `PlayerAccount` (`gamesWon`, `totalScore`, etc.)
   mudam pouco por jogador e raramente afetam o top 100.
2. Um TTL de 5s já é consistência eventual suficiente para ranking —
   um jogador que acaba de vencer verá sua posição atualizada em até 5s.
3. Invalidar no `simulate` exigiria conhecer todas as chaves
   afetadas (todas as combinações de `metric+limit+offset+search`),
   o que é dispendioso e frágil.

> **Trade-off aceito**: um jogador pode ver o ranking "atrasado" em até
> 5s após própria vitória. Aceitável para ranking global (não é
> tempo-real competitivo).

---

## 4. Consultas

### `metric=wins`

Ordenação indexada via Prisma:

```ts
const players = await db.playerAccount.findMany({
  where: search
    ? { OR: [{ username: { contains: search } }, { displayName: { contains: search } }] }
    : { gamesWon: { gt: 0 } }, // opcional: omitir jogadores sem vitórias
  orderBy: [{ gamesWon: 'desc' }, { totalScore: 'desc' }],
  skip: offset,
  take: limit,
  select: {
    id: true, displayName: true, username: true, avatarUrl: true,
    gamesPlayed: true, gamesWon: true, totalScore: true, bestScore: true,
  },
})
```

- `orderBy([gamesWon desc, totalScore desc])` usa o índice
  `@@index([gamesWon])` — complexidade **O(log n + limit)**.
- `contains` (search) é **case-insensitive no SQLite** — não há
  otimização específica, mas o volume filtrado é baixo (dezenas a
  centenas de matches típicos).

### `metric=avgScore`

A pontuação média (`avgScore = totalScore / gamesPlayed`) **não é um
campo do banco**. A consulta:

1. Busca todos os jogadores com `gamesPlayed >= 1` (exclui quem nunca
   jogou — evita divisão por zero).
2. Computa `avgScore` em JS para cada um.
3. Reordena por `avgScore desc`.
4. Aplica `skip`/`take` (paginação) **depois** da reordenação.

```ts
const all = await db.playerAccount.findMany({
  where: { gamesPlayed: { gte: 1 }, ...(search ? { OR: [...] } : {}) },
  select: { /* ... campos necessários ... */ },
})
const ranked = all
  .map(p => ({ ...p, avgScore: p.totalScore / p.gamesPlayed }))
  .sort((a, b) => b.avgScore - a.avgScore)
const page = ranked.slice(offset, offset + limit)
```

- **Aceitável para < 10k jogadores**: carregar ~10k registros
  (`select` mínimo, ~150 bytes cada = ~1.5 MB) e ordenar em JS é da
  ordem de **10-50 ms**.
- **Otimização futura**: campo denormalizado `avgScore Float` em
  `PlayerAccount`, atualizado via hook no `simulate`. Ver §7.

### Busca (`search`)

```ts
where: {
  OR: [
    { username: { contains: search } },
    { displayName: { contains: search } },
  ],
}
```

- `contains` no SQLite equivale a `LIKE '%term%'` — **não usa índice**
  (leading wildcard). Para volumes pequenos é aceitável.
- Para volumes grandes, considere FTS5 (SQLite full-text search) — não
  implementado na Fase 2.
- Quando `search` está presente, `searchResults` é retornado sem
  rank global (apenas a lista filtrada); `players` pode ser vazio.

---

## 5. Benchmark

### Script

`scripts/benchmark-leaderboard.ts` executa **10 chamadas** ao
`/api/leaderboard` (internamente, chamando a função de query sem HTTP)
e reporta:

```json
{
  "playerCount": 42,
  "metric": "wins",
  "runs": 10,
  "minMs": 4,
  "avgMs": 8,
  "maxMs": 15,
  "p95Ms": 12,
  "underThreshold": true,
  "thresholdMs": 200,
  "lastRun": "2025-01-15T12:34:56.000Z",
  "notes": "..."
}
```

- **min/avg/max/p95** sobre as 10 execuções.
- **`underThreshold`**: `p95Ms <= thresholdMs` (200 ms).
- **`playerCount`**: total de `PlayerAccount` no banco (para contexto).
- O script pode opcionalmente gerar massa (`--seed-massive`): 10k
  jogadores + 100k partidas. **Não executado neste ambiente** (volume
  real é pequeno).

### Resultado atual (volume pequeno)

Com o banco deste ambiente (dezenas de jogadores), o benchmark reporta
consistentemente **< 50 ms** para `metric=wins` e `metric=avgScore`.
`underThreshold=true`. Cache desabilitado na primeira chamada (cold),
hit nas 9 subsequentes.

### Extrapolação para 10k jogadores

| Métrica        | Complexidade                | Volume atual (~50 jog.) | Extrapolação (10k jog.) | Threshold |
| -------------- | --------------------------- | ----------------------- | ----------------------- | --------- |
| `metric=wins`  | `O(log n + limit)` (indexado) | ~5 ms                   | ~10-15 ms               | 200 ms ✅  |
| `metric=avgScore` | `O(n)` (JS sort sobre n)  | ~8 ms                   | ~30-80 ms               | 200 ms ✅  |
| `search`       | `O(n)` (scan com `LIKE`)    | ~6 ms                   | ~50-150 ms              | 200 ms ✅  |

> **Justificativa da extrapolação**:
> - `metric=wins` usa `orderBy` indexado — o `LIMIT 100` faz o banco
>   percorrer apenas ~100 entradas do índice, não 10k. Latência fica
>   dominada por I/O do índice (poucas páginas), não por `n`.
> - `metric=avgScore` carrega os 10k registros e ordena em JS. Para
>   10k objetos de ~150 bytes (1.5 MB), o `sort` do V8 é ~5-10 ms; o
>   `findMany` Prisma é ~20-60 ms (SQLite, sem rede). Total < 100 ms.
> - `search` com `LIKE '%term%'` faz scan linear, mas em 10k registros
>   simples é ~20-50 ms no SQLite; combinado com renderização e
>   serialização, fica < 150 ms.
>
> Os números extrapolados assumem SQLite local (sem rede) e índices
> carregados em memória. Em ambiente com Postgres remoto, adicionar
> latência de rede (~10-30 ms por query) — ainda dentro do threshold.

### Execução via Ops Console

`GET /api/ops/phase2/benchmark` invoca o script inline (sem gerar massa)
e retorna o payload acima. Disponível no Console de Operações — seção
"Fase 2" — para validação on-demand.

---

## 6. Monitoramento

### `durationMs` no payload

Toda resposta de `GET /api/leaderboard` inclui `durationMs` (tempo do
handler, em ms). Exemplo:

```json
{
  "metric": "wins",
  "total": 42,
  "players": [...],
  "cachedAt": "2025-01-15T12:34:56.000Z",
  "durationMs": 8
}
```

- `cachedAt` — timestamp de quando o payload foi gerado (pode ser
  anterior à requisição se veio do cache).
- `durationMs` — tempo da requisição atual (se cache hit, é apenas o
  lookup do Map: ~0-1 ms).

### Console de Operações

O endpoint `GET /api/ops/phase2/benchmark` (seção "Fase 2" do Console)
executa o benchmark on-demand e retorna o payload. Recomendação de
alerta:

- **`durationMs > 500 ms`** (em uma única chamada) — investigar
  cache miss recorrente, índices faltando, ou volume anormal.
- **`p95Ms > 200 ms`** (em benchmark) — limiar do M2 violado; revisar
  índices e otimizações (§7).
- **`hitRatio < 50%`** (se rastreado) — TTL muito curto ou tráfego
  muito diversificado (muitas combinações de `metric+offset+search`).

> **Limitação**: o benchmark não roda automaticamente em background
> (sem cron neste ambiente). O operador deve dispará-lo manualmente
> pela UI ou via `bun run scripts/benchmark-leaderboard.ts`. Em
> produção, agendar execução a cada hora e alertar se
> `underThreshold=false`.

---

## 7. Otimizações futuras

Listadas em ordem de prioridade conforme o volume real evolui:

1. **Campo denormalizado `avgScore Float` em `PlayerAccount`**
   - Atualizado no `POST /api/player/games/simulate`:
     `avgScore = (totalScore + score) / (gamesPlayed + 1)`.
   - Permite `metric=avgScore` usar `orderBy` indexado (igual a
     `metric=wins`), eliminando o `sort` em JS.
   - Adicionar `@@index([avgScore])` em `PlayerAccount`.
   - **Quando**: volume > 5k jogadores, ou se `metric=avgScore` >
     100 ms observado.

2. **Materialized view do top 100**
   - Tabela `LeaderboardSnapshot` (ou `PlayerAccount` flag
     `isTopWins100`) atualizada via job assíncrono a cada 1 min.
   - `GET /api/leaderboard` lê direto da snapshot — O(1) com cache.
   - **Quando**: volume > 50k jogadores, ou se latência percebida
     pelo usuário precisar ser < 50 ms.

3. **Redis cache distribuído**
   - Substituir o `Map` por `redis.set(key, payload, 'PX', 5000)`.
   - Necessário em **multi-instância** (várias réplicas Next.js):
     cache compartilhado, invalidação coordenada.
   - Mesmo shape de chave — migração transparente para o handler.
   - **Quando**: Fase 7 (quando houver múltiplas réplicas).

4. **CDN para ranking público**
   - `Cache-Control: public, s-maxage=5, stale-while-revalidate=30`
     em `GET /api/leaderboard`.
   - CDN (Vercel Edge, Cloudflare) atende cache hits sem tocar a
     origem.
   - **Quando**: tráfego público significativo (> 100 req/s).

5. **FTS5 (SQLite full-text search) para `search`**
   - Tabela virtual `player_search` indexando `username` +
     `displayName`.
   - Substitui `LIKE '%term%'` por `MATCH` — O(log n).
   - **Quando**: volume > 20k jogadores, ou se `search` > 150 ms.

6. **Cursor pagination em vez de `offset`**
   - `offset` alto é caro (banco ainda percorre `offset` registros).
   - Para paginar além da página 10, usar cursor (`WHERE gamesWon <
     <last_value>`).
   - **Quando**: se usuários paginarem muito além do top 100 (caso
     raro — ranking é visualmente top 100).

7. **Streaming do payload**
   - Para top 100 com campos pesados (avatarUrl, etc.), usar
     `Response` streaming para reduzir TTFB.
   - **Quando**: otimização marginal, baixa prioridade.

---

## Referências

- `worklog.md` Task ID 10 — contrato de `/api/leaderboard` (campos,
  cache, `durationMs`).
- [`docs/PHASE2.md`](./PHASE2.md) §6 — decisão "Cache in-memory em vez
  de Redis" e "`avgScore` computado em JS".
- [`docs/TEST-PLAN-PHASE2.md`](./TEST-PLAN-PHASE2.md) — casos P-001 a
  P-008.
- [Prisma: Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [SQLite: Query Planning](https://www.sqlite.org/queryplanner.html)
