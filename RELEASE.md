# Processo de Release — LetraMestre

Este documento define o fluxo de release do projeto LetraMestre: versionamento,
changelog, tags, publicação e rollback. Aplica-se a releases do web app
(`web/`), do game-server (`mini-services/game-server/`) e do app Android (`app/`).

---

## 1. Versionamento (SemVer)

Adotamos **Versionamento Semântico 2.0.0** (https://semver.org/lang/pt-BR/):
`MAJOR.MINOR.PATCH`, incrementando:

- **MAJOR** — mudanças incompatíveis na API/contratos (ex.: quebra de schema
  do banco, remoção de endpoint público).
- **MINOR** — novas funcionalidades compatíveis com versões anteriores
  (ex.: nova rota de API, nova feature de jogo).
- **PATCH** — correções de bugs compatíveis (ex.: fix de validação).

### Tabela de exemplos

| Versão atual | Tipo de mudança                                  | Próxima versão | Justificativa                                    |
| ------------- | ------------------------------------------------ | -------------- | ------------------------------------------------ |
| `0.3.0`       | Correção de bug no validador de palavras         | `0.3.1`        | PATCH — fix isolado, sem novas features          |
| `0.3.0`       | Novo endpoint `/api/ops/healthz`                 | `0.4.0`        | MINOR — adição compatível                         |
| `0.3.0`       | Remoção de campo `boardState` do schema público  | `1.0.0`        | MAJOR — quebra de contrato                        |
| `0.3.0`       | Pré-release candidata                            | `0.4.0-rc.1`   | MINOR + sufixo de pré-release                     |

> **Pré-1.0**: enquanto `MAJOR = 0`, qualquer `MINOR` pode quebrar compatibilidade.
> Comunique quebras no CHANGELOG sob a seção **Changed**.

---

## 2. Fluxo de release

Passos numerados para publicar uma release `vX.Y.Z`:

1. **Atualizar CHANGELOG** — mova entradas de `## [Unreleased]` para uma nova
   seção `## [X.Y.Z] - AAAA-MM-DD` em `CHANGELOG.md`.
2. **Bump de versão no `package.json`** — ajuste o campo `"version"`.
   - Helper: `./scripts/release.sh X.Y.Z patch` automatiza este passo.
3. **Commit de release** — `chore(release): vX.Y.Z`.
4. **Criar tag git anotada** — `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
5. **Push das tags** — `git push origin main --tags`.
6. **Build** — `bun install && bun run build`. Em CI, o workflow
   `.github/workflows/ci.yml` roda automaticamente.
7. **Deploy** — siga `docs/PRODUCTION-SETUP.md`. Para Android, o workflow
   `.github/workflows/android.yml` dispara em push de tag `v*`.
8. **Anúncio** — registre o release via `POST /api/ops/release/tag`
   (console de operações) e comunique o time no canal #releases.

---

## 3. Changelog

Formato **Keep a Changelog** (https://keepachangelog.com/pt-BR/1.1.0/). Cada
entrada de versão pode conter as seções:

- **Added** — novas funcionalidades.
- **Changed** — mudanças em funcionalidades existentes.
- **Deprecated** — funcionalidades que serão removidas.
- **Removed** — funcionalidades removidas nesta versão.
- **Fixed** — correções de bugs.
- **Security** — correções de vulnerabilidades.

Exemplo:

```markdown
## [0.3.1] - 2025-10-20

### Fixed
- Validador de palavras agora aceita Ç em posições iniciais.
- Backup automático não sobrescreve snapshot manual do mesmo dia.

### Changed
- Endpoint `/api/ops/metrics` retorna `peakConnections` em vez de `peakConnectionsToday`.
```

---

## 4. Tags

Convenção: `vX.Y.Z` (ex.: `v0.3.0`, `v1.2.3`).

- Tags **anotadas** (`git tag -a`), nunca lightweight.
- Pré-releases usam sufixo SemVer: `v0.4.0-rc.1`, `v1.0.0-beta.2`.
- Após criada e pushada, uma tag NÃO deve ser movida. Se a release tiver
  bug crítico, faça uma release PATCH `vX.Y.(Z+1)` em vez de reescrever a tag.

```bash
# Criar tag anotada
git tag -a v0.3.1 -m "Release v0.3.1 — fix de validador"

# Listar tags
git tag --list --sort=-v:refname

# Push de uma única tag
git push origin v0.3.1

# Push de todas as tags
git push origin --tags
```

---

## 5. Rollback

Em caso de regressão em produção, siga nesta ordem:

1. **Identificar a versão estável anterior** via `CHANGELOG.md` ou
   `git tag --list`.
2. **Reverter o deploy** — faça redeploy da tag estável:
   ```bash
   git checkout vX.Y.(Z-1)
   bun install --frozen-lockfile
   bun run build
   # reinicie o serviço (systemd/pm2/docker)
   ```
3. **Reverter migrações de banco se houver** — apenas se a release quebrou
   o schema. Caso contrário, mantenha o banco atual (migrações devem ser
   compatíveis com versões anteriores).
4. **Restore de backup** se houve corrupção/perda de dados — siga
   `docs/BACKUP-RESTORE.md`.
5. **Hotfix** — crie branch `hotfix/vX.Y.(Z+1)` a partir da tag estável,
   corrija, e publique como PATCH.
6. **Post-mortem** — registre o incidente em `docs/TECH-DEBT.md` se aplicável.

> **Importante**: NUNCA reescreva tags `v*` já publicadas. Sempre avance com
> uma nova PATCH.

---

## 6. Branches

| Branch        | Função                                            | Proteção                        |
| ------------- | ------------------------------------------------- | ------------------------------- |
| `main`        | Produção. Cada commit em `main` é deployável.     | Reviews obrigatórios, CI verde. |
| `develop`     | Integração de features. Base para testes.         | CI verde.                       |
| `feature/*`   | Funcionalidade isolada. Merge em `develop`.       | Sem proteção.                   |
| `fix/*`       | Correção de bug. Merge em `develop` ou `main`.    | Sem proteção.                   |
| `hotfix/*`    | Hotfix de produção. Sai de tag em `main`.         | Merge em `main` E `develop`.    |
| `release/*`   | Preparação de release (bumps, changelog).         | Merge em `main` E `develop`.    |

---

## 7. Checklist pré-release

Antes de taguear `vX.Y.Z`, confirme TODOS os itens:

- [ ] `bun run lint` verde (sem erros, warnings aceitáveis revisados).
- [ ] `bun run test:run` verde (suite de **218 testes**).
- [ ] `bun run build` sem erros.
- [ ] `CHANGELOG.md` atualizado com a entrada `[X.Y.Z] - AAAA-MM-DD`.
- [ ] `bun run scripts/validate-secrets.ts` retorna `overall=ok` no ambiente
      de produção-alvo (ou `warning` com justificativa documentada).
- [ ] Migrações Prisma aplicadas em ambiente de staging.
- [ ] Backup recente do banco (ver `docs/BACKUP-RESTORE.md`).
- [ ] Métricas do game-server acessíveis (`GET /metrics` em
      `http://localhost:3003/metrics`).
- [ ] App Android compila em CI (workflow `android.yml` verde) — se a release
      inclui mudanças no app.
- [ ] Comunicado ao time no canal #releases.

---

## Referências

- SemVer: https://semver.org/lang/pt-BR/
- Keep a Changelog: https://keepachangelog.com/pt-BR/1.1.0/
- Helper de release: `./scripts/release.sh`
- API de release: `POST /api/ops/release/tag` (ver `worklog.md`)
