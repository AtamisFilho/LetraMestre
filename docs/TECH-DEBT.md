# Dívida Técnica — LetraMestre

Registro de débitos técnicos do projeto, com plano de mitigação. Itens
fechados na Fase 0 estão marcados como `closed`. Atualizado via
`POST /api/ops/debt/close`.

---

## Resumo

| ID      | Título                                                  | Área        | Severidade | Status        |
| ------- | ------------------------------------------------------- | ----------- | ---------- | ------------- |
| DT-001  | Índice Prisma corrompido `@@index(oveType])` no Move    | database    | high       | ✅ Fechado Fase 0 |
| DT-002  | Falta de índice em `Move.createdAt`                     | database    | medium     | ✅ Fechado Fase 0 |
| DT-003  | Testes e2e não executados em CI                         | testing     | high       | ✅ Fechado Fase 0 |
| DT-004  | `ADMIN_PASSWORD` e `INTERNAL_API_KEY` com defaults inseguros | security | high       | ✅ Fechado Fase 0 |
| DT-005  | Ausência de backup automático do SQLite                 | ops         | high       | ✅ Fechado Fase 0 |
| DT-006  | Falta de observabilidade (métricas agregadas)           | ops         | medium     | 🟡 Aberto     |
| DT-007  | Schema `Game.boardState` JSON em coluna string          | database    | medium     | 🟡 Aberto     |
| DT-008  | SSE/WebSocket fallback não documentado para mobile       | docs        | low        | 🟡 Aberto     |

**Total**: 8 itens — 5 fechados na Fase 0, 3 abertos.

---

## DT-001 — Índice Prisma corrompido `@@index(oveType])` no Move

- **Área**: database
- **Severidade**: high
- **Status**: ✅ Fechado na Fase 0
- **Arquivo**: `prisma/schema.prisma` (model `Move`)
- **Descrição**: O schema do LetraMestre de referência tinha o índice escrito
  como `@@index(oveType])` — sintaxe inválida (colchete aberto sem fechar e
  nome truncado para `oveType` em vez de `[moveType]`). Issso fazia o
  `prisma validate` falhar silenciosamente em alguns setups e quebrava o
  `prisma migrate`.
- **Impacto**: impossível aplicar migrations limpas; consultas filtrando por
  `moveType` (ex.: relatório de jogadas do tipo `exchange`) rodavam sem índice.
- **Mitigação aplicada**: corrigido para `@@index([moveType])`. Validado com
  `bun run db:push`. Registrado no endpoint `/api/ops/debt/close` com
  `resolution: "Índice corrigido para @@index([moveType])."`.
- **Fechado em**: 2025-10-15.

---

## DT-002 — Falta de índice em `Move.createdAt`

- **Área**: database
- **Severidade**: medium
- **Status**: ✅ Fechado na Fase 0
- **Arquivo**: `prisma/schema.prisma`
- **Descrição**: Consultas de histórico ordenadas por data (`ORDER BY
  createdAt DESC`) em `Move` não usavam índice. Para jogos com muitas
  jogadas, isso gerava full table scan.
- **Impacto**: lentidão em relatórios de "últimas jogadas" e no ranking de
  melhores jogadas.
- **Mitigação aplicada**: adicionado `@@index([createdAt])` ao model `Move`.
  Reaplicado schema via `db:push`.
- **Fechado em**: 2025-10-15.

---

## DT-003 — Testes e2e não executados em CI

- **Área**: testing
- **Severidade**: high
- **Status**: ✅ Fechado na Fase 0
- **Arquivo**: `.github/workflows/ci.yml`
- **Descrição**: O projeto tinha 218 testes (unit + integration) mas nenhum
  pipeline de CI executava lint + typecheck + testes + build automaticamente.
  Regressões só eram detectadas no deploy manual.
- **Impacto**: risco alto de quebrar `main` sem perceber; ausência de
  sinal verde para release.
- **Mitigação aplicada**: criado workflow `.github/workflows/ci.yml`
  executando em push/PR para `main`: checkout → setup Bun → `bun install`
  → `bun run lint` → `bun run typecheck` → `bun run test:run` → `bun run build`.
  Documentado no checklist pré-release (`RELEASE.md` §7).
- **Fechado em**: 2025-10-16.

---

## DT-004 — Defaults inseguros em `ADMIN_PASSWORD` e `INTERNAL_API_KEY`

- **Área**: security
- **Severidade**: high
- **Status**: ✅ Fechado na Fase 0
- **Arquivo**: `.env.example`, `scripts/validate-secrets.ts`
- **Descrição**: O `.env.example` original usava valores como
  `ADMIN_PASSWORD="change-me-please"` e
  `INTERNAL_API_KEY="dev-internal-key-change-me"` que eram frequentemente
  copiados direto para produção sem troca. Não havia validador automático.
- **Impacto**: risco de deploy em produção com segredos defaults conhecidos.
- **Mitigação aplicada**: `.env.example` reescrito com placeholders explícitos
  (`placeholder-troque-por-openssl-rand-...`); `scripts/validate-secrets.ts`
  rejeita qualquer valor que case com padrões default/dev. CI pode rodar o
  validador como gate pré-deploy.
- **Fechado em**: 2025-10-16.

---

## DT-005 — Ausência de backup automático do SQLite

- **Área**: ops
- **Severidade**: high
- **Status**: ✅ Fechado na Fase 0
- **Arquivo**: `scripts/backup-db.ts`, `docs/BACKUP-RESTORE.md`,
  endpoints `/api/ops/backup/*`
- **Descrição**: Não havia procedimento de backup automatizado; o SQLite era
  copiado manualmente quando alguém lembrava. Sem retention, sem restore
  testado.
- **Impacto**: risco de perda total de dados em caso de falha de disco.
- **Mitigação aplicada**: script `backup-db.ts` (copia `db/custom.db` para
  `backups/{timestamp}.db` com retenção `--keep N`); job cron diário 02:00
  documentado; endpoints de backup no `/api/ops/backup/*`; teste de restore
  incluído na rotina.
- **Fechado em**: 2025-10-16.

---

## DT-006 — Falta de observabilidade (métricas agregadas)

- **Área**: ops
- **Severidade**: medium
- **Status**: 🟡 Aberto
- **Arquivo**: `mini-services/game-server/index.ts` (já expõe `/metrics`);
  falta exporter Prometheus e dashboard Grafana.
- **Descrição**: O game-server já expõe `/metrics` (JSON), mas não há
  coleta centralizada, retenção histórica ou alertas. O Console de Operações
  da Fase 0 resolve parte (agregação + 60 snapshots), mas sem persistência
  de longo prazo.
- **Impacto**: impossível correlacionar incidentes com métricas históricas
  além dos 60 snapshots recentes.
- **Plano de mitigação**:
  1. Adicionar rota `/metrics/prometheus` (formato texto) no game-server.
  2. Subir Prometheus + Grafana em produção.
  3. Definir alertas (ver `docs/MONITORING.md` §4).
- **ETA**: Fase 1.

---

## DT-007 — Schema `Game.boardState` como JSON em string

- **Área**: database
- **Severidade**: medium
- **Status**: 🟡 Aberto
- **Arquivo**: `prisma/schema.prisma`
- **Descrição**: `Game.boardState` e `Game.tileBagState` são armazenados como
  `String` contendo JSON serializado. Idem `Player.rack` e `Move.tiles`. Não
  é possível indexar ou consultar campos internos.
- **Impacto**: relatórios analíticos (ex.: "quais letras mais trocadas")
  exigem parse JSON em código, não em SQL.
- **Plano de mitigação**:
  - Manter para estado de runtime (mutável, lido/escrito a cada jogada).
  - Para análise, criar uma tabela derivada `MoveTileFact` (star schema) com
    colunas individuais (tile, position, gameId, moveId), populada via hook
    pós-insert.
- **ETA**: Fase 2 ou 3 (quando relatórios forem priorizados).

---

## DT-008 — SSE/WebSocket fallback não documentado para mobile

- **Área**: docs
- **Severidade**: low
- **Status**: 🟡 Aberto
- **Arquivo**: `docs/` (a criar)
- **Descrição**: O app Android usa Socket.io que tem fallback automático
  para long-polling. Não há documentação de quando isso ocorre nem como
  diagnosticar problemas de conexão em redes restritas (corp/cellular).
- **Impacto**: baixo; usuários avançados podem ter dificuldade de debug.
- **Plano de mitigação**: adicionar `docs/MOBILE-CONNECTIVITY.md` na Fase 1.
- **ETA**: Fase 1.

---

## Processo de fechamento

Para fechar um item:

```bash
curl -X POST http://localhost:3000/api/ops/debt/close \
  -H "Content-Type: application/json" \
  -d '{"id":"dt_007","resolution":"Tabela derivada criada em Fase 2."}'
```

Ou via Console de Operações (seção Dívida Técnica → botão "Fechar").

---

## Referências

- `docs/PHASE0.md` — tarefa 0.7.
- `worklog.md` — contrato `GET /api/ops/debt/items` e `POST /api/ops/debt/close`.
- `RELEASE.md` — checklist pré-release inclui revisão de tech debt.
