# Monitoramento — LetraMestre

Guia de monitoramento do LetraMestre em produção: endpoints de métricas,
formato, dashboard e alertas sugeridos.

---

## 1. Endpoints

| Endpoint                       | Origem        | Porta | Função                                                |
| ------------------------------ | ------------- | ----- | ----------------------------------------------------- |
| `GET /health`                  | game-server   | 3003  | Health-check simples (200 OK).                         |
| `GET /metrics`                 | game-server   | 3003  | Métricas em runtime (JSON). Bloqueado externamente.    |
| `GET /api/ops/metrics`         | web app       | 3000  | Agregado de sistema + game-server + banco + histórico. |
| `GET /api/ops/phase0/status`   | web app       | 3000  | Status da Fase 0 e marco M0.                           |
| `GET /api/ops/secrets/status`  | web app       | 3000  | Saúde das variáveis de ambiente.                       |
| `GET /api/ops/backup/history`  | web app       | 3000  | Histórico de backups.                                  |

### Exemplo de uso

```bash
# Health do game-server
curl http://localhost:3003/health
# → 200 OK

# Métricas agregadas (web)
curl http://localhost:3000/api/ops/metrics | jq .

# Status da Fase 0
curl http://localhost:3000/api/ops/phase0/status | jq .
```

> **Bloqueio externo**: o Caddy deve negar `/metrics` vindo de IPs externos
> (ver `docs/PRODUCTION-SETUP.md` §4). Internamente, `/metrics` responde em
> `localhost:3003`.

---

## 2. Métricas expostas

Tabela de métricas do game-server (em `GET /metrics`) e do agregado
(`GET /api/ops/metrics` sob `game.*` e `system.*`):

| Métrica              | Tipo    | Origem      | Descrição                                              |
| -------------------- | ------- | ----------- | ------------------------------------------------------ |
| `activeRooms`        | int     | game-server | Salas de jogo ativas (waiting + playing).              |
| `activeConnections`  | int     | game-server | Conexões Socket.io ativas no momento.                  |
| `peakConnections`    | int     | game-server | Pico histórico de conexões desde o último restart.     |
| `totalConnections`   | int     | game-server | Total acumulado de conexões desde o último restart.    |
| `reconnections`      | int     | game-server | Reconexões bem-sucedidas (dentro do grace period).     |
| `rateLimited`        | int     | game-server | Eventos rejeitados por rate-limit.                     |
| `gamesCreated`       | int     | game-server | Total de jogos criados desde o último restart.         |
| `memoryMb`           | float   | game-server | RSS do processo game-server (MB).                      |
| `uptimeMs`           | int     | game-server | Uptime desde o último restart (ms).                    |
| `system.memoryMb`    | float   | web app     | RSS do processo Next.js (MB).                          |
| `system.heapMb`      | float   | web app     | Heap usado (MB).                                       |
| `system.cpuLoad`     | float   | web app     | Load average 1min.                                     |
| `system.nodeVersion` | string  | web app     | Versão do Node/Bun.                                    |
| `system.platform`    | string  | web app     | SO (`linux`, etc.).                                    |
| `database.totalGames`   | int  | web app (Prisma) | Total de jogos no banco.                          |
| `database.activeGames`  | int  | web app (Prisma) | Jogos com status `playing`.                       |
| `database.totalPlayers` | int  | web app (Prisma) | Total de jogadores distintos.                     |
| `database.totalMoves`   | int  | web app (Prisma) | Total de jogadas registradas.                     |
| `database.approvedWords`| int  | web app (Prisma) | Palavras aprovadas no dicionário.                 |
| `database.bannedWords`  | int  | web app (Prisma) | Palavras banidas.                                 |
| `database.dbSizeMb`      | float| web app (fs.stat) | Tamanho do arquivo SQLite.                        |

---

## 3. Dashboard (Console de Operações)

O **Console de Operações** (rota `/`) é o dashboard principal de monitoramento.

### Seção Monitoramento

- **Cards de topo**: `activeRooms`, `activeConnections`, `peakConnections`,
  `memoryMb`, `uptimeMs`. Atualizados a cada 3s (polling).
- **Gráfico temporal**: histórico dos últimos 60 snapshots de
  `activeConnections` e `memoryMb`.
- **Tabela de banco**: total de jogos, jogadores, jogadas, palavras.
- **Indicador de source**: `live` (mini-serviço metrics-emitter respondeu)
  ou `simulated` (fallback).

### Comportamento técnico

- Polling client-side a cada **3 segundos** via `fetch('/api/ops/metrics')`.
- O endpoint `/api/ops/metrics` faz fetch server-side para
  `http://localhost:3004/metrics` (mini-serviço) com timeout 1.5s. Se falhar,
  retorna `source: "simulated"` com valores de fallback.
- Os snapshots ficam persistidos na tabela `MetricSnapshot` (Prisma), dos
  quais os últimos 60 são retornados como `history`.

---

## 4. Alertas sugeridos

Configure alertas com base nos seguintes limiares. Use Prometheus + Alertmanager,
ou um check simples (cron + curl + email).

| Alerta                          | Condição                              | Severidade | Ação                                              |
| ------------------------------- | ------------------------------------- | ---------- | ------------------------------------------------- |
| Memória alta (game-server)      | `game.memoryMb > 512` por 5 min       | warning    | Verificar vazamento; restart se > 600 MB.         |
| Memória alta (web app)          | `system.memoryMb > 768` por 5 min     | warning    | Verificar vazamento; restart do `letramestre-web`.|
| Conexões altas                  | `activeConnections > 500`             | warning    | Investigar pico; considerar autoscale.            |
| Sem salas ativas                | `activeRooms == 0` por > 10 min       | info       | Normal fora de pico; alertar só se em horário pico.|
| Uptime reiniciado               | `uptimeMs < 5 min`                    | warning    | Verificar `journalctl -u letramestre-game`.       |
| Rate-limit subindo              | `rateLimited` cresce > 50/min         | warning    | Possível abuso; revisar cliente malicioso.        |
| Backup falhou                   | Sem backup novo há > 26h              | critical   | Rodar `scripts/backup-db.ts` manualmente.         |
| Secrets em estado crítico       | `overall == critical` em `/secrets/status` | critical | Bloquear deploy até resolver.                  |
| Build Android falhou em CI      | workflow `android.yml` red            | warning    | Bloquear release até corrigir.                    |
| Disco cheio                     | `df -h /var/lib/letramestre > 85%`    | warning    | Limpar backups antigos (`backup-db.ts --keep N`). |

---

## 5. Integração futura (Prometheus / Grafana)

### Formato compatível

O endpoint `/metrics` do game-server retorna **JSON**. Para Prometheus
(texto formatado), será necessário um exporter que faça scrape e conversão.
Plano futuro:

1. Adicionar rota `/metrics/prometheus` no game-server com formato
   texto Prometheus (ex.: `letramestre_active_rooms 3`).
2. Configurar Prometheus para scrape a cada 15s:
   ```yaml
   scrape_configs:
     - job_name: 'letramestre-game'
       static_configs:
         - targets: ['localhost:3003']
       metrics_path: /metrics/prometheus
   ```
3. Dashboard Grafana importando o JSON template do LetraMestre (a definir).
4. Alertmanager com regras do item §4.

### Métricas de negócio (a instrumentar)

- Tempo médio de partida (do `waiting` ao `finished`).
- Taxa de abandono (jogos finalizados por desistência vs. conclusão).
- Palavras mais jogadas (top 20).
- Distribuição de pontuação por partida.

---

## Referências

- `worklog.md` — contrato da rota `GET /api/ops/metrics`.
- `docs/PRODUCTION-SETUP.md` — setup do game-server via systemd.
- `docs/PHASE0.md` — critério de saída `metrics-dashboard`.
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/
