# Task ID: 11 — Agente G — Backend Fase 2

## Objetivo
Implementar Ranking + estatísticas + conquistas + índices + benchmark da Fase 2 (M2).

## Arquivos sob minha responsabilidade
- prisma/schema.prisma (estender)
- src/lib/ops/{leaderboard,achievements,player-stats,phase2}.ts (novo)
- src/app/api/{leaderboard,player/stats,player/achievements,achievements,ops/phase2/status,ops/phase2/benchmark}/route.ts (novo)
- src/app/api/player/games/simulate/route.ts (MODIFICAR)
- scripts/{seed-achievements,benchmark-leaderboard}.ts (novo)

## Decisões de implementação
- Cache in-memory: `Map<string, {at: number; payload: LeaderboardResult}>`, TTL 5s. Search não usa cache (ou usa cache curto separado).
- avgScore no SQLite: como não há divisão no orderBy do Prisma, faço fetch de todos com gamesPlayed>=1 (limitado por slice), compute em JS e ordene. Para volumes pequenos é aceitável. Comentario sobre otimização futura (campo denormalizado `avgScore` atualizado via hook).
- `bingo`: não-determinístico — desbloqueado apenas no simulate (10% chance por vitória) via criação direta de PlayerAchievement. Em checkAndUnlockAchievements, NUNCA desbloqueia bingo automaticamente (apenas preserva se já existe).
- `streak_3`: calcula streak atual de vitórias consecutivas do final do histórico.
- `phase2/performance` exit criterion: true se último benchmark retornou underThreshold.

## Progress
- [x] Lido worklog Task 10 + arquivos existentes (schema, simulate, auth-player, phase1)
- [ ] Schema estendido + db:push
- [ ] lib/ops/leaderboard.ts
- [ ] lib/ops/achievements.ts
- [ ] lib/ops/player-stats.ts
- [ ] lib/ops/phase2.ts
- [ ] Rotas API
- [ ] simulate modificado
- [ ] Scripts
- [ ] curl validation
- [ ] lint
- [ ] append worklog
