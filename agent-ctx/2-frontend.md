# Task ID: 2 — Agente B (Frontend)

**Agent:** Frontend (full-stack-developer)
**Task:** Construir o Console de Operações LetraMestre Fase 0 na rota `/` — 8 seções, navegação sidebar+Sheet, charts recharts, polling (3s/15s), tema esmeralda claro/escuro, footer sticky.

## Contexto lido
- `/home/z/my-project/worklog.md` (contrato de API completo — 9 endpoints sob `/api/ops/*`).
- Stack confirmada: Next.js 16 App Router, TS 5, Tailwind 4, shadcn/ui (New York) já em `src/components/ui/`, `lucide-react`, `recharts`, `framer-motion`, `next-themes`, `sonner`.

## Arquivos criados (meus)
- `src/lib/ops/client.ts` — tipos TS de todas as 9 respostas do contrato + fetchers (`fetchPhase0Status`, `fetchMetrics`, `fetchSecretsStatus`, `fetchBackupHistory`, `runBackup`, `restoreBackup`, `fetchReleaseChangelog`, `fetchReleaseHistory`, `tagRelease`, `fetchDebtItems`, `closeDebt`, `fetchAndroidBuildStatus`, `validateAndroidBuild`) + classe `OpsApiError` + utilitários (`formatBytes`, `formatUptime`, `formatTimeShort`, `formatDateTime`).
- `src/components/theme-provider.tsx` — wrapper `next-themes`.
- `src/components/site/header.tsx` — header sticky com logo, badge "Fase 0 · M0", link GitHub, toggle de tema (Sun/Moon) com Tooltip.
- `src/components/site/footer.tsx` — footer sticky (`mt-auto`) com versão (fetch próprio de `/api/ops/release/changelog`), status "Sistema operacional", link GitHub.
- `src/components/ops/section-shell.tsx` — `SectionShell` (título+desc+icon+actions+transição framer-motion), `KpiCard`, `LoadingBlock`, `ErrorBlock`.
- `src/components/ops/status-badge.tsx` — badges tipados: TaskStatus, SecretStrength, SecretOverall, BuildStatus, DebtSeverity, DebtStatus, ReleaseType, Bool, Owner.
- `src/components/ops/overview-section.tsx` — progresso geral, critérios M0 (check/x), tabela das 7 tasks, polling 15s.
- `src/components/ops/production-section.tsx` — checklist 6 itens (server/domínio/TLS/deploy/backup/monitoramento), KPIs, guia de deploy resumido (Caddy, build, env vars).
- `src/components/ops/secrets-section.tsx` — badge overall, alerta se != ok, tabela de secrets, botão revalidar.
- `src/components/ops/android-section.tsx` — KPIs status/lastRun/duration/artifact, alerta blocker, lista de steps, log em `<pre>` com scroll, botão validar (POST).
- `src/components/ops/backup-section.tsx` — KPIs, botão "Backup agora" (POST run + toast), tabela com botão restore por linha (POST restore + toast).
- `src/components/ops/monitoring-section.tsx` — **DESTAQUE**: polling 3s, pausa quando aba oculta, 6 KPIs, LineChart (salas/conexões), AreaChart (memória), grid de DB stats, badge source (live/simulado), badge "reconectando" se fetch falha (mantém último valor), spinner sutil durante poll.
- `src/components/ops/release-section.tsx` — KPIs versão atual/próxima, accordion changelog, dialog nova release (form version/type/notes → POST tag + toast), tabela histórico.
- `src/components/ops/debt-section.tsx` — KPIs open/closed/total, lista de itens em aberto com botão fechar (dialog resolução → POST close + toast), seção colapsável "Fechadas".

## Arquivos modificados (meus)
- `src/app/layout.tsx` — metadata PT-BR, ThemeProvider (defaultTheme light, enableSystem false), `<html lang="pt-BR" suppressHydrationWarning>`, estrutura `min-h-screen flex flex-col` com Header/Footer, Toaster sonner richColors.
- `src/app/globals.css` — override do tema para **esmeralda** (primary, ring, sidebar, chart) em `:root` e `.dark`, mantendo estrutura de tokens. Adicionada utilidade `.scrollbar-thin` para listas longas.
- `src/app/page.tsx` — shell do console: sidebar desktop (w-64, sticky, com nav e card de info), Sheet mobile (botão "Seções" abre drawer esquerdo), 8 seções com ícones lucide, estado `activeId`, scroll-to-top na troca.

## Decisões técnicas
- **Sem React Query**: fetch direto com `useEffect`+`setInterval` + flag `mounted` + `document.visibilityState` para pausar polling em aba oculta (monitoring).
- **Estados graceful**: cada seção trata `OpsApiError` e mostra `ErrorBlock` com retry; loading mostra `Skeleton`. Página nunca dá tela branca.
- **Manter último valor conhecido** no monitoring quando fetch falha (badge "reconectando").
- **Paleta esmeralda/teal/amber/rose** para status — nenhum indigo/azul como marca.
- **Footer sticky** via `mt-auto` em wrapper `flex min-h-screen flex-col` no layout.
- **Acessibilidade**: `header`/`main`/`nav`/`section`/`footer` semânticos, `aria-label` em botões de ícone, `aria-current="page"` na seção ativa, `role="status"` em live regions, foco visível via `focus-visible:ring-2`.

## Lint
- `bun run lint`: **0 errors** em meus arquivos.
- 5 warnings restantes são em `mini-services/metrics-emitter/index.ts` (Agente A) e `scripts/seed-ops.ts` (Agente C) — `Unused eslint-disable directive (no-console)`. Não são meus; não toquei.

## Validação Agent Browser
- `http://localhost:3000/` carregou sem erros (título "LetraMestre · Console de Operações").
- **Overview**: tabela das 7 tasks renderizada com dados reais da API (0.1 in_progress 60%, 0.2 done 100%, 0.3 blocked 20%, etc.).
- **Navegação desktop**: clicou em Monitoramento, Backup, Android, Debt — todas renderizaram, sem erros no console.
- **Navegação mobile** (viewport 390x844): botão "Seções" abre Sheet esquerdo com a nav; clicar em "Monitoramento" fecha o Sheet e troca a seção.
- **Toggle tema** (Sun/Moon): funciona.
- **Ação backup**: clicou "Backup agora" → `POST /api/ops/backup/run 200` no dev.log + `GET /api/ops/backup/history` refresh; sem erros.
- `agent-browser errors`: vazio. `agent-browser console`: só logs HMR e um warning a11y transitório de DialogContent (radix) — não bloqueante.
- Screenshots salvos em `/home/z/my-project/agent-ctx/`: overview, monitoring, debt, mobile, mobile-sheet, mobile-monitoring, dark, backup-toast.

## Pendências para o coordenador
- O Agente A já terminou as 9 rotas `/api/ops/*` (confirmado via dev.log: todas 200). O console consome dados reais.
- O Agente C ainda precisa criar `docs/PRODUCTION-SETUP.md` (referenciado no card de guia de deploy da seção Produção) — link é textual, não quebra nada.
- Warning a11y do radix Dialog ("Missing Description") aparece em dev para os diálogos de Release e Debt; é transitório e não afeta produção. Se quiser silenciar, pode-se passar `aria-describedby={undefined}` nos `DialogContent`, mas preferi manter a `DialogDescription` que já está presente.
