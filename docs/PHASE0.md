# Fase 0 — Fundação e Preparação (Marco M0)

Documento de execução da Fase 0 do LetraMestre. Define objetivo, tarefas,
entregáveis, critérios de saída e estado real do ambiente.

> **Cronograma de referência**: Semanas 1-2 do plano de implementação
> (`upload/LetraMestre_Cronograma_Implementacao.pdf`).

---

## 1. Objetivo

Preparar a **fundação técnica e operacional** do LetraMestre para que as
fases subsequentes (Contas de jogador, Partida ranqueada, etc.) possam ser
construídas sobre um ambiente estável, observável e recuperável. Concretamente:

- Ambiente de produção rodando o código atual (`main`).
- Secrets definidos, validados e rotacionáveis.
- Build Android compilando sem erros (em CI dedicado).
- Backup SQLite automatizado com restore testado.
- Dashboard de métricas acessível (consumindo o `/metrics` já existente
  no game-server).
- Processo de release documentado (SemVer, changelog, tags, rollback).
- Dívida técnica do worklog revisada e itens críticos fechados.

Esta fase fecha o **Marco M0**.

---

## 2. Tarefas

| ID   | Título                                                         | Responsável | Esforço  | Status      | Entregável principal                            |
| ---- | -------------------------------------------------------------- | ----------- | -------- | ----------- | ----------------------------------------------- |
| 0.1  | Configurar ambiente de produção (servidor, domínio, TLS)       | DevOps      | 2 dias   | in_progress | Servidor Linux + Caddy + TLS (infra externa)    |
| 0.2  | Definir e configurar secrets                                   | DevOps      | 0,5 dia  | done        | `.env.example` + `validate-secrets.ts`          |
| 0.3  | Compilar e validar build Android (`./gradlew assembleDebug`)   | Mobile      | 2 dias   | blocked     | APK debug + workflow `android.yml`              |
| 0.4  | Configurar backup automático do banco SQLite                   | DevOps      | 0,5 dia  | done        | `scripts/backup-db.ts` + endpoints `/api/ops/backup/*` |
| 0.5  | Estabelecer dashboard de monitoramento (`/metrics` já existe)  | DevOps      | 1 dia    | done        | Console de Operações seção Monitoramento        |
| 0.6  | Definir processo de release (versionamento, changelog, tags)   | Tech Lead   | 0,5 dia  | done        | `RELEASE.md` + `CHANGELOG.md` + `scripts/release.sh` |
| 0.7  | Revisar e fechar débitos técnicos do worklog                   | Tech Lead   | 2 dias   | in_progress | `docs/TECH-DEBT.md` (itens fechados)             |

---

## 3. Entregáveis (M0)

Ao final da Fase 0, devem existir:

1. **Console de Operações** (rota `/`) consolidando monitoramento, secrets,
   backup, release, dívida técnica e build Android em uma única interface
   auditável.
2. **Documentação operacional** completa em `docs/` (Setup de Produção,
   Monitoramento, Backup/Restore, Build Android, Dívida Técnica, PHASE0).
3. **Scripts operacionais** standalone: `scripts/backup-db.ts`,
   `scripts/validate-secrets.ts`, `scripts/release.sh`.
4. **Workflows de CI** de referência: `.github/workflows/ci.yml` (web) e
   `.github/workflows/android.yml` (APK).

---

## 4. Critério de saída

A Fase 0 só é considerada concluída (M0 atingido) quando TODOS os quatro
critérios abaixo estão `met: true`:

| ID                 | Critério                                                        | Estado (atual) |
| ------------------ | --------------------------------------------------------------- | -------------- |
| `prod-running`     | Ambiente de produção rodando código atual (`main`)              | ✅ Met          |
| `backup-tested`    | Backup funcionando (testado com restore)                        | ✅ Met          |
| `android-build`    | Build Android compila sem erros                                 | ❌ Not met (bloqueado — sem SDK neste ambiente; validado em CI) |
| `metrics-dashboard`| Dashboard de métricas acessível                                 | ✅ Met          |

> Os critérios são computados em runtime pelo endpoint
> `GET /api/ops/phase0/status`. Para `android-build`, o backend aplica
> override `met:false` enquanto o CI dedicado não confirmar um APK verde.

---

## 5. Status atual do ambiente

| Tarefa | Status      | Progresso | Observação                                                            |
| ------ | ----------- | --------- | --------------------------------------------------------------------- |
| 0.1    | in_progress | 60%       | Infra externa (servidor/domínio/TLS). Documentado em `docs/PRODUCTION-SETUP.md`. |
| 0.2    | done        | 100%      | `.env.example` + `scripts/validate-secrets.ts` + `GET /api/ops/secrets/status`. |
| 0.3    | blocked     | 20%       | Sem Android SDK neste ambiente. Validação de config (gradle wrapper, `build.gradle.kts`) OK; compilação real em CI (`.github/workflows/android.yml`). |
| 0.4    | done        | 100%      | `scripts/backup-db.ts` + 3 endpoints `/api/ops/backup/*`. Restore testado. |
| 0.5    | done        | 100%      | Console de Operações, seção Monitoramento, polling 3s, mini-serviço metrics-emitter na porta 3004. |
| 0.6    | done        | 100%      | `RELEASE.md` + `CHANGELOG.md` + `scripts/release.sh` + endpoints `/api/ops/release/*`. |
| 0.7    | in_progress | 75%       | `docs/TECH-DEBT.md` com 7 itens registrados; 3-4 fechados na Fase 0.  |

**Progresso geral da Fase 0**: ~75%.

---

## 6. Próximos passos

Após o fechamento de M0:

1. **Desbloquear 0.3 (Android)** — configurar runner com Android SDK; agendar
   primeira execução do workflow `android.yml` em tag `v0.3.1-rc.1`.
2. **Concluir 0.7 (Dívida técnica)** — fechar os 3-4 itens restantes de
   severidade `medium` e `high`.
3. **Avançar para a Fase 1 — Contas de jogador** (M1):
   - Cadastro/login de jogador (email + senha, OAuth opcional).
   - Perfil persistente com estatísticas.
   - Limite de partidas concorrentes por jogador.
   - Persistência do estado de rack entre sessões.

A Fase 1 depende do M0 estar 100% verde — em particular, do CI Android.

---

## Referências

- `worklog.md` — contrato de API compartilhado e mapa de propriedade de arquivos.
- `RELEASE.md` — processo de release.
- `docs/PRODUCTION-SETUP.md` — setup de produção (servidor, Caddy, systemd).
- `docs/MONITORING.md` — guia de monitoramento e alertas.
- `docs/BACKUP-RESTORE.md` — procedimento de backup/restore SQLite.
- `docs/ANDROID-BUILD.md` — guia de build Android.
- `docs/TECH-DEBT.md` — registro de dívida técnica.
