# Task ID: 12 — Agente H — Frontend Fase 2

**Agent:** Frontend Fase 2 (full-stack-developer)
**Task:** Adicionar ranking público, perfil expandido com gráficos, conquistas com toast ao modo Jogador.

## Contexto

- Worklog `Task ID: 10` definiu o contrato de API da Fase 2 (leaderboard, stats, achievements, newAchievements em /simulate).
- Agente G (Task 11) estava criando os endpoints em paralelo. Quando comecei, os endpoints ainda não existiam; construí a UI contra o contrato com skeletons/erros graceful.
- Ao final, todos os endpoints existiam (Agent G entregou): `/api/leaderboard`, `/api/player/stats`, `/api/player/achievements`, `/api/achievements`, e a modificação de `/api/player/games/simulate` ainda pendente (`newAchievements` ainda não retornado).

## Arquivos criados

- `src/components/player/leaderboard-panel.tsx` — Ranking global público. Segmented control (ToggleGroup) para métrica `wins|avgScore`, busca com debounce 300ms, paginação prev/next, tabela com avatar/rank/stats, badges de cache (`cachedAt` relativo) e performance (`<Xms`), estado vazio, skeleton, polling opcional a cada 15s (somente sem busca ativa).
- `src/components/player/expanded-profile.tsx` — Perfil expandido. 8 KPI cards (partidas, vitórias, taxa de vitória, pontuação total, média, melhor, streak atual, melhor streak), gráfico de evolução (recharts AreaChart com `cumulativeScore` + `score` por partida), gráfico de distribuição (PieChart vitórias/derrotas/empates + legenda com %), `recentForm` (5 badges coloridos emerald/rose/amber), barra de win rate, callback `onStatsLoaded` para o parent usar o teaser.
- `src/components/player/achievements-panel.tsx` — Painel de conquistas. Header com progresso geral (X/Y, %, barra), seção "Recentes" (badges), grid de cards desbloqueados (com tier colorido bronze/silver/gold/platinum, halo, data) e bloqueados (com Lock, barra de progresso `percent`, target atual). Estado vazio "catálogo sendo populado", esqueletos, error CTA. Exporta `AchievementIcon`, `tierStyles`, `tierLabel` reutilizados pelo toast.
- `src/components/player/achievement-toast.tsx` — Toast customizado sonner via `toast.custom()`. Animação framer-motion, ícone + "Conquista desbloqueada!" + nome + tier colorido, botão fechar, auto-dismiss 5s. Exporta `showAchievementToast(achievement)`.

## Arquivos modificados

- `src/lib/auth-player-client.ts` — Adicionados tipos e fetchers da Fase 2: `LeaderboardMetric`, `LeaderboardPlayer`, `LeaderboardResult`, `PlayerStatsSummary`, `PlayerStatsEvolutionPoint`, `PlayerStatsResponse`, `AchievementsListResponse`, `PlayerAchievementsStats`, `PlayerAchievementsResponse`, `AchievementSummary`, `UnlockedAchievement`, `LockedAchievementProgress`, `NewAchievement`, `FetchLeaderboardParams`. Fetchers `fetchLeaderboard`, `fetchPlayerStats`, `fetchPlayerAchievements`, `fetchAchievements`. `SimulateGameResponse` agora tem `newAchievements?: NewAchievement[]`. `LeaderboardPlayer.rank` tornou-se opcional (search results não têm rank global).
- `src/components/player/profile-screen.tsx` — Substituído o grid estático de stats por `<ExpandedProfile>` (passa `refreshKey` que bumpa após simulate, e `onStatsLoaded` para o teaser de conquistas). Adicionado Card "Conquistas" teaser com barra de progresso e badges recentes, botão "Ver todas →" que chama `onViewAchievements`. `handleSimulate` agora captura `r.newAchievements` e dispara `showAchievementToast` para cada uma com delay 300ms entre elas, e mostra toast.info informando quantas desbloqueou. Mantém editar perfil, logout, partidas recentes.
- `src/components/player/player-app.tsx` — Refatorado para navegação por tabs (`Tabs` shadcn) com 3 abas: Ranking (sempre acessível), Meu perfil (CTA "Entrar na conta" se não logado), Conquistas (CTA se não logado). Header mostra chip do usuário logado ou botão "Entrar". `AuthScreen` aberta em overlay modal sob demanda. Após login, leva direto para "Meu perfil". `onViewAchievements` (de ProfileScreen) troca para a tab Conquistas e bump em `achievementsTabVisits` para forçar re-fetch. Mantém framer-motion, skeletons, sonner.

## Resultado do lint

`bun run lint` → limpo (nenhum erro/warning).

## Resultado do Agent Browser

Abri `http://localhost:3000/` no modo Jogador e validei:

1. **Ranking público (sem login)** — tabela renderiza 9 jogadores reais com posições 1º-9º, avatares, stats (partidas/vitórias/win rate/pontos/média/melhor). Toggle "Vitórias ↔ Pontuação média" funciona. Busca com debounce (busca "agente" retornou 1 resultado). Badge `<Xms` mostra latência. Screenshot: `phase2-leaderboard.png`, `phase2-leaderboard-final.png`.
2. **CTA login** — aba "Meu perfil" sem login mostra card "Seu perfil expandido" com botão "Entrar na conta". Clicar abre overlay com AuthScreen. Screenshot: `phase2-login-cta.png`.
3. **Registro** — registrei `phase2tester@example.com` / `@phase2tester` com sucesso. Após registro, foi direto para "Meu perfil".
4. **Perfil expandido** — após simular 4 partidas (1 vitória, 3 derrotas), KPIs mostram 4 partidas, 1 vitória, 25% win rate, 1040 pontos, 260 média, 330 melhor, streak atual 0, melhor streak 1. Gráfico de evolução renderiza (cumulativeScore em verde + score por partida em cinza). Gráfico de distribuição mostra piechart com % de cada resultado. Badges "Últimas 5 partidas" aparecem. Screenshot: `phase2-profile-with-data.png`.
5. **Aba Conquistas** — painel mostra barra "Progresso geral 0/0 0%" e estado vazio "Nenhuma conquista definida — Volte mais tarde, o catálogo está sendo populado" (porque o seed de achievements do Agente G ainda não foi executado). Screenshot: `phase2-achievements.png`, `phase2-achievements-empty.png`.
6. **Toaster** — sonner Toaster confirmado presente no layout (top-right, richColors). Toasts de sucesso/disparo funcionam (vi "Partida simulada: vitória · X pts"). O toast customizado de conquista não disparou porque o endpoint `/simulate` ainda não retorna `newAchievements` (pendente no Agente G); a UI trata `undefined` como sem conquistas.

## Pendências

- **`/api/player/games/simulate` ainda não retorna `newAchievements`** — pendência do Agente G (Task 11). Meu frontend já está preparado: `announceNewAchievements` é chamado com `r.newAchievements ?? []` e dispara `showAchievementToast` para cada item.
- **Seed de conquistas não executado** — `scripts/seed-achievements.ts` não existe. Quando o Agente G rodar, a aba Conquistas vai popular com as 8 conquistas definidas (first_game, first_win, ten_games, etc.).
- **Performance badge** — o leaderboard respondeu em 4-11ms (≤200ms threshold M2 validado).
- **Não toquei** em `prisma/**`, `src/lib/ops/**`, `src/app/api/**`, `docs/**`, `CHANGELOG.md`, `.env.example`, `src/components/ops/**`, `src/components/ui/**`, `src/components/site/**` (conforme mapa de propriedade).

## Notas operacionais

- Durante o teste, precisei regenerar o Prisma Client (`bun run db:push`) porque o Agente G adicionou modelos `Achievement`/`PlayerAchievement` mas o client em memória do dev server estava defasado. Após `db:push` e restart do dev server, `/api/player/stats` e `/api/player/achievements` passaram a responder 200.
- O `next dev` precisou ser reiniciado manualmente (processo tinha o PrismaClient antigo cacheado em `globalThis`). O sistema operacional do sandbox não reinicia automaticamente o dev server após kill.
