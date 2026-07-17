# Configuração de Ambiente de Produção

Guia de implantação do LetraMestre em produção: servidor Linux, Bun, Caddy
(TLS), game-server como serviço systemd, backups e hardening.

---

## 1. Pré-requisitos

| Componente    | Versão mínima | Observação                                            |
| ------------- | ------------- | ----------------------------------------------------- |
| Servidor      | Linux x86_64  | Ubuntu 22.04 LTS ou Debian 12 recomendados.           |
| CPU/RAM       | 1 vCPU / 1 GB | Mínimo absoluto; 2 vCPU / 2 GB recomendado.           |
| Disco         | 20 GB         | Volume persistente para `/var/lib/letramestre`.        |
| Bun           | 1.x           | Runtime JS. Instalação: `curl -fsSL https://bun.sh/install \| bash` |
| Node.js       | 18+           | Necessário para algumas deps nativas.                  |
| Caddy         | 2.x           | Reverse proxy + TLS automático (Let's Encrypt).        |
| Domínio       | —             | Apontando (A record) para o IP do servidor.            |
| SQLite        | (embutido)    | Sem servidor separado; via Prisma.                     |

---

## 2. Variáveis de ambiente

Use `.env.example` como base. Copie para `.env` e **regenere** os segredos:

```bash
cp .env.example .env
# Edite .env e troque TODOS os valores "placeholder-*"
```

### ⚠️ Segredos que DEVEM ser regenerados em produção

| Variável           | Como gerar                              | Tamanho mínimo |
| ------------------ | --------------------------------------- | -------------- |
| `AUTH_SECRET`      | `openssl rand -base64 32`               | 16 chars (32 recomendado) |
| `INTERNAL_API_KEY` | `openssl rand -hex 32`                  | 16 chars (32 recomendado) |
| `ADMIN_USERNAME`   | Escolher nome **não-default**           | 3 chars         |
| `ADMIN_PASSWORD`   | `openssl rand -base64 18` ou gerador    | 12 chars        |

Após editar, valide:

```bash
bun run scripts/validate-secrets.ts
# Sai 0 = ok, 1 = warning, 2 = critical
```

### Ajustes de caminho de banco

Em produção, use **caminho absoluto** em volume persistente:

```dotenv
DATABASE_URL="file:/var/lib/letramestre/custom.db"
```

E defina `WEB_ORIGIN` com a URL pública HTTPS:

```dotenv
WEB_ORIGIN="https://letramestre.exemplo.com.br"
WEB_API_URL="http://localhost:3000"
GAME_SERVER_PORT="3003"
```

---

## 3. Build

```bash
# 1. Instalar dependências (lockfile congelado)
bun install --frozen-lockfile

# 2. Gerar cliente Prisma + aplicar schema
bun run db:generate
bun run db:push

# 3. Build de produção (Next.js standalone)
bun run build

# 4. Iniciar o servidor (NODE_ENV=production implícito no start)
bun run start
```

O `start` roda o server standalone em `.next/standalone/server.js`. Por
padrão escuta em `:3000`.

---

## 4. Caddy (TLS / reverse proxy)

Caddy fornece TLS automático via Let's Encrypt e faz o reverse proxy para o
Next.js (`:3000`) e para o game-server (`:3003`).

### Caddyfile de exemplo

Salve em `/etc/caddy/Caddyfile`:

```caddy
# Substitua letramestre.exemplo.com.br pelo seu domínio.
letramestre.exemplo.com.br {
    # SSRF mitigation: allow-list XTransformPort para 3000 (web) ou 3003 (game-server).
    @api_port {
        query XTransformPort=3000
    }
    @game_port {
        query XTransformPort=3003
    }

    handle @api_port {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }

    handle @game_port {
        reverse_proxy localhost:3003 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }

    # Default: serve o Next.js app.
    handle {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }

    # Bloquear /metrics externamente — só acessível internamente via localhost.
    @metrics path /metrics
    handle @metrics {
        remote_ip 127.0.0.1 ::1
    }

    # Security headers
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:; frame-ancestors 'none'"
    }
}
```

### Recarregar Caddy após editar

```bash
sudo systemctl reload caddy
# ou
caddy reload --config /etc/caddy/Caddyfile
```

---

## 5. Game-server como serviço (systemd)

O game-server Socket.io roda na porta `3003`. Crie um unit systemd:

`/etc/systemd/system/letramestre-game.service`

```ini
[Unit]
Description=LetraMestre — Game Server (Socket.io)
After=network.target

[Service]
Type=simple
User=letramestre
WorkingDirectory=/opt/letramestre/mini-services/game-server
EnvironmentFile=/opt/letramestre/.env
ExecStart=/home/letramestre/.bun/bin/bun index.ts
Restart=on-failure
RestartSec=5s
# Limites de recurso
MemoryMax=512M
LimitNOFILE=4096

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/letramestre

[Install]
WantedBy=multi-user.target
```

E para o web app:

`/etc/systemd/system/letramestre-web.service`

```ini
[Unit]
Description=LetraMestre — Web App (Next.js)
After=network.target letramestre-game.service

[Service]
Type=simple
User=letramestre
WorkingDirectory=/opt/letramestre
EnvironmentFile=/opt/letramestre/.env
ExecStart=/home/letramestre/.bun/bin/bun .next/standalone/server.js
Restart=on-failure
RestartSec=5s
MemoryMax=768M

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/letramestre

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar:

```bash
sudo useradd -r -s /bin/false -d /opt/letramestre letramestre
sudo mkdir -p /opt/letramestre /var/lib/letramestre
sudo chown -R letramestre:letramestre /opt/letramestre /var/lib/letramestre

sudo systemctl daemon-reload
sudo systemctl enable --now letramestre-web letramestre-game
sudo systemctl status letramestre-web letramestre-game
```

---

## 6. Backups

Configure um job cron diário para backup do SQLite. Detalhes completos em
[`docs/BACKUP-RESTORE.md`](./BACKUP-RESTORE.md).

Exemplo de crontab (roda todo dia às 02:00, fuso America/Madrid):

```cron
# Backup diário do SQLite (retenção 30 dias)
0 2 * * * cd /opt/letramestre && /home/letramestre/.bun/bin/bun run scripts/backup-db.ts --keep 30 >> /var/log/letramestre/backup.log 2>&1
```

> Defina o fuso do servidor com `timedatectl set-timezone Europe/Madrid`
> (ou o fuso do seu público-alvo).

---

## 7. Monitoramento

O Console de Operações (rota `/`) já agrega métricas em tempo real. Para
alertas e integração futura com Prometheus/Grafana, veja
[`docs/MONITORING.md`](./MONITORING.md).

---

## 8. Hardening

Além do que já está no systemd unit e no Caddyfile:

### Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP (Caddy redirect)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw enable
```

> As portas 3000 (web) e 3003 (game-server) **NÃO** devem ser expostas — só
> via reverse proxy Caddy.

### Usuário não-root

O serviço roda como `letramestre` (sem shell de login). Para deploy, use
um usuário de deploy separado com sudo.

### fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

Configure `[sshd]` com `maxretry = 3` e `bantime = 1h`. Considere uma jail
para o Caddy se houver tentativas de abuso em endpoints de auth.

### Rate-limit

- Caddy: use o plugin `caddy-ratelimit` ou faça rate-limit na camada app
  (middleware Next.js).
- Para endpoints de auth (`/api/admin/login`), recomende no máximo 5
  tentativas por IP por minuto.

### Rotação de secrets

- `AUTH_SECRET` e `INTERNAL_API_KEY`: rotacione a cada 90 dias ou após
  incidente de segurança. Após rotacionar `AUTH_SECRET`, todos os JWTs
  ativos ficam inválidos — comunique admins.
- `ADMIN_PASSWORD`: rotacione a cada 90 dias.

---

## Referências

- `.env.example` — variáveis de ambiente.
- `docs/MONITORING.md` — monitoramento e alertas.
- `docs/BACKUP-RESTORE.md` — procedimento de backup/restore.
- `docs/TECH-DEBT.md` — dívida técnica.
- `RELEASE.md` — processo de release.
- Caddy docs: https://caddyserver.com/docs/
- systemd docs: https://www.freedesktop.org/software/systemd/man/systemd.service.html
