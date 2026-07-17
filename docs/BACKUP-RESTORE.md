# Backup e Restore — SQLite

Procedimento de backup e restore do banco SQLite do LetraMestre
(`db/custom.db` em dev, `/var/lib/letramestre/custom.db` em produção).

---

## 1. Estratégia

SQLite é um banco baseado em arquivo único. A estratégia adotada é
**cópia filesystem a frio**:

- **Cópia direta do arquivo** `custom.db` para `backups/{timestamp}.db`.
  SQLite suporta cópia a frio sem corrupção desde que não haja writer
  ativo no momento exato da cópia. Para segurança extra em ambientes de
  alta escrita, considere `sqlite3 custom.db ".backup backups/<ts>.db"`
  (API hot backup) — mas para a carga esperada do LetraMestre, a cópia
  simples é suficiente.
- **Snapshot a cada backup**: cada execução cria um arquivo novo, sem
  sobrescrever.
- **Retenção configurável**: padrão mantém últimos 30 backups
  (`--keep 30`).

### Por que não `pg_dump`-like?

SQLite é um arquivo; não há dump lógico tão útil quanto o do PostgreSQL.
A cópia binária preserva tudo (índices, schema, dados) com custo mínimo.

---

## 2. Backup manual

### Via script standalone

```bash
# Backup simples
bun run scripts/backup-db.ts

# Backup com retenção (mantém últimos 30)
bun run scripts/backup-db.ts --keep 30

# Listar backups existentes
bun run scripts/backup-db.ts --list
```

Saída esperada:

```text
[backup-db] Criando backup de db/custom.db
[backup-db] ✓ Backup criado: backups/2025-10-16-223000.db (448 KB) em 42ms
[backup-db] Total de backups: 5 (2.2 MB)
```

### Via API (Console de Operações)

```bash
curl -X POST http://localhost:3000/api/ops/backup/run
```

Resposta:

```json
{
  "id": "bk_abc123",
  "filename": "2025-10-16-223000.db",
  "sizeBytes": 458752,
  "createdAt": "2025-10-16T22:30:00.000Z",
  "durationMs": 42,
  "path": "backups/2025-10-16-223000.db"
}
```

---

## 3. Backup automático (cron)

Agende um job diário. Exemplo: todo dia às **02:00** no fuso do servidor
(configurado com `timedatectl set-timezone Europe/Madrid`).

### Crontab

```cron
# Backup diário do SQLite — retenção 30 dias
0 2 * * * cd /opt/letramestre && /home/letramestre/.bun/bin/bun run scripts/backup-db.ts --keep 30 >> /var/log/letramestre/backup.log 2>&1
```

### Log esperado

```
[2025-10-17 02:00:00] [backup-db] Criando backup de db/custom.db
[2025-10-17 02:00:00] [backup-db] ✓ Backup criado: backups/2025-10-17-020000.db (452 KB) em 38ms
[2025-10-17 02:00:00] [backup-db] Retenção: removidos 1 backups antigos (>30)
```

### Verificação do job

```bash
# Status do cron
systemctl status cron

# Últimos backups
bun run scripts/backup-db.ts --list
```

---

## 4. Restore

### Via script standalone

```bash
# Listar backups disponíveis
bun run scripts/backup-db.ts --list

# Restaurar um backup específico
bun run scripts/backup-db.ts --restore 2025-10-16-223000.db
```

> **Atenção**: o restore **sobrescreve** o `db/custom.db` atual. Faça um
> backup do estado atual ANTES de restaurar (o script pergunta confirmação
> interativa; em modo não-interativo, passe `--yes`).

Saída esperada:

```text
[backup-db] ⚠  RESTAURAR sobrescreverá db/custom.db (448 KB atuais)
[backup-db] Backup automático do estado atual: backups/2025-10-16-225500-pre-restore.db
[backup-db] ✓ Restaurado de backups/2025-10-16-223000.db para db/custom.db (458 KB)
```

### Via API

```bash
curl -X POST http://localhost:3000/api/ops/backup/restore \
  -H "Content-Type: application/json" \
  -d '{"id":"bk_abc123"}'
```

Resposta:

```json
{
  "ok": true,
  "restoredFrom": "2025-10-16-223000.db",
  "verifiedAt": "2025-10-16T22:31:00.000Z",
  "sizeBytes": 458752
}
```

---

## 5. Verificação

Após qualquer restore, verifique a integridade do banco:

### Verificação rápida (script)

```bash
# Conta registros das tabelas principais
sqlite3 db/custom.db "SELECT
  (SELECT COUNT(*) FROM Game) AS games,
  (SELECT COUNT(*) FROM Player) AS players,
  (SELECT COUNT(*) FROM Move) AS moves,
  (SELECT COUNT(*) FROM ApprovedWord) AS approved_words,
  (SELECT COUNT(*) FROM BannedWord) AS banned_words;"
```

### Verificação de integridade SQLite

```bash
sqlite3 db/custom.db "PRAGMA integrity_check;"
# Esperado: ok
```

### Teste de restore periódico

Recomenda-se um teste de restore **mensal** em ambiente de staging:

1. Copie o backup mais recente para um servidor de staging.
2. Execute o restore.
3. Rode a verificação acima.
4. Carregue a homepage do app e confirme que jogos/jogadores aparecem.
5. Registre o resultado em `docs/TECH-DEBT.md` ou no runbook de ops.

---

## 6. Retenção

### Política padrão

| Tipo       | Frequência   | Retenção      | Local                  |
| ---------- | ------------ | ------------- | ---------------------- |
| Diário     | Todo dia 02:00 | 30 dias     | `backups/`             |
| Semanal    | Domingo 02:00  | 12 semanas  | `backups/weekly/` (opcional) |
| Pré-restore | Antes de cada restore | permanente (não autodeleta) | `backups/` |

### Limpeza manual

```bash
# Manter apenas os 30 mais recentes
bun run scripts/backup-db.ts --keep 30

# Manter apenas os 90 mais recentes (política longa)
bun run scripts/backup-db.ts --keep 90
```

### Tamanho esperado

Cada backup do LetraMestre tem ~450 KB-1 MB (SQLite compacto). Para 30
diários + 12 semanais, totaliza ~50 MB — despreocupante para disco.

---

## 7. Restauração em desastre total

Cenário: servidor perdido, resta apenas um backup offsite.

1. Provisione novo servidor (ver `docs/PRODUCTION-SETUP.md`).
2. Instale o app, `bun install`, `bun run db:generate`, `bun run db:push`
   (cria DB vazio com schema).
3. **Pare** o serviço: `sudo systemctl stop letramestre-web letramestre-game`.
4. Copie o backup offsite para `backups/<ts>.db`.
5. Restaure: `bun run scripts/backup-db.ts --restore <ts>.db --yes`.
6. Verifique: `sqlite3 db/custom.db "PRAGMA integrity_check;"`.
7. Inicie: `sudo systemctl start letramestre-game letramestre-web`.
8. Valide via Console de Operações (`/api/ops/phase0/status`).

---

## Referências

- `scripts/backup-db.ts` — implementação standalone.
- `docs/PRODUCTION-SETUP.md` §6 — cron em produção.
- `docs/PHASE0.md` — critério de saída `backup-tested`.
- SQLite Backup API: https://www.sqlite.org/backup.html
