# Conquistas (Achievements) — Guia e Catálogo

Documento de referência do sistema de conquistas/badges do LetraMestre,
introduzido na Fase 2 (Marco M2). Descreve o catálogo inicial, modelos
de dados, endpoints, fluxo de desbloqueio, notificação e como estender o
sistema com novas conquistas.

> **Documentos relacionados**:
> - [`docs/PHASE2.md`](./PHASE2.md) — execução da Fase 2.
> - [`docs/TEST-PLAN-PHASE2.md`](./TEST-PLAN-PHASE2.md) — casos de teste
>   funcionais das conquistas (F-013 a F-020).
> - `worklog.md` Task ID 10 — contrato de API (fonte de verdade).

---

## 1. Visão geral

O sistema de conquistas recompensa marcos do jogador — primeira partida,
primeira vitória, sequência de vitórias, pontuações altas, bingo. O
desbloqueio é **automático**: ao chamar `POST /api/player/games/simulate`,
o backend avalia todas as condições de conquista em relação ao estado
atualizado do `PlayerAccount` e do histórico de `GameRecord`. As
conquistas recém-desbloqueadas são persistidas em `PlayerAchievement` e
devolvidas no campo `newAchievements` da resposta — o frontend dispara um
toast para cada uma.

### Tiers e categorias

- **4 tiers** com cores distintas (paleta esmeralda/neutros do app):
  - `bronze` — marrom/cobre — conquistas iniciais.
  - `silver` — cinza — marcos de progressão.
  - `gold` — âmbar/dourado — marcos de destaque.
  - `platinum` — esmeralda claro — marcos de maestria (reservado para
    futuras conquistas sazonais/sociais).
- **3 categorias**:
  - `gameplay` — relacionada ao ato de jogar (partidas, vitórias).
  - `streak` — relacionada a sequências (vitórias consecutivas).
  - `special` — eventos especiais (bingo, pontuação alta).

### Catálogo inicial

**8 conquistas** distribuídas entre os tiers, todas com desbloqueio
automático. A tabela completa está na §2.

---

## 2. Tabela de conquistas

| Code              | Nome                | Descrição                                                         | Tier    | Categoria  | Condição de desbloqueio                                                                 | Ícone (lucide) |
| ----------------- | ------------------- | ----------------------------------------------------------------- | ------- | ---------- | --------------------------------------------------------------------------------------- | -------------- |
| `first_game`      | Primeira partida    | Jogue sua primeira partida.                                       | bronze  | gameplay   | `PlayerAccount.gamesPlayed >= 1` após o `simulate`.                                     | `gamepad`      |
| `first_win`       | Primeira vitória!   | Vença sua primeira partida.                                       | bronze  | gameplay   | `PlayerAccount.gamesWon >= 1` após o `simulate` com `result:'win'`.                     | `trophy`       |
| `ten_games`       | Veterano            | Jogue 10 partidas.                                                | silver  | gameplay   | `PlayerAccount.gamesPlayed >= 10`.                                                      | `medal`        |
| `five_wins`       | Estrategista        | Vença 5 partidas.                                                 | silver  | gameplay   | `PlayerAccount.gamesWon >= 5`.                                                          | `target`       |
| `high_score_200`  | Marcador            | Faça 200+ pontos em uma partida.                                  | silver  | special    | `game.score >= 200` na partida recém-criada.                                            | `flame`        |
| `high_score_300`  | Mestre das palavras | Faça 300+ pontos em uma partida.                                  | gold    | special    | `game.score >= 300` na partida recém-criada.                                            | `crown`        |
| `bingo`           | Bingo!              | Use todas as 7 peças em uma jogada (simulado: 10% por vitória).   | gold    | special    | `result === 'win'` **e** `Math.random() < 0.10` no `simulate` (probabilístico).         | `sparkles`     |
| `streak_3`        | Imparável           | Vença 3 partidas seguidas.                                        | gold    | streak     | `currentStreak >= 3` computado a partir das últimas `GameRecord` ordenadas por `createdAt` desc. | `zap`          |

> **Bingo probabilístico**: como o game-server real (Socket.io) não roda
> neste ambiente sandbox, a conquista `bingo` é desbloqueada com 10% de
> chance por vitória. Não é determinística — ver
> [`docs/TEST-PLAN-PHASE2.md` F-017](./TEST-PLAN-PHASE2.md) para o caso
> de teste correspondente.

---

## 3. Modelos de dados

### `Achievement` (definição do catálogo)

```prisma
model Achievement {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String   @default("")
  icon        String   @default("award")
  category    String   @default("gameplay") // gameplay, streak, social, special
  tier        String   @default("bronze")   // bronze, silver, gold, platinum
  target      Int      @default(1)
  createdAt   DateTime @default(now())
  unlocks     PlayerAchievement[]
}
```

- `code` — identificador estável (ex.: `first_game`); usado nas condições
  de desbloqueio em `ACHIEVEMENT_DEFS` (`src/lib/ops/achievements.ts`).
- `icon` — nome do ícone lucide a renderizar no frontend.
- `target` — alvo numérico para exibição de progresso (ex.: `10` para
  `ten_games`). Conquistas `target=1` exibem apenas locked/unlocked.

### `PlayerAchievement` (desbloqueio por jogador)

```prisma
model PlayerAchievement {
  id            String   @id @default(cuid())
  playerId      String
  achievementId String
  unlockedAt    DateTime @default(now())
  player        PlayerAccount @relation(fields: [playerId], references: [id], onDelete: Cascade)
  achievement   Achievement   @relation(fields: [achievementId], references: [id], onDelete: Cascade)

  @@unique([playerId, achievementId])
  @@index([playerId])
}
```

- `@@unique([playerId, achievementId])` — garante que cada conquista é
  desbloqueada no máximo uma vez por jogador (idempotência).
- `@@index([playerId])` — acelera `GET /api/player/achievements`
  (filtro por jogador).

### Relação em `PlayerAccount`

```prisma
model PlayerAccount {
  // ... campos da Fase 1
  achievements PlayerAchievement[]
}
```

---

## 4. Endpoints

### `GET /api/achievements` — público

Lista todas as conquistas definidas no catálogo.

```http
GET /api/achievements
```

**200**:
```json
{
  "achievements": [
    {
      "id": "ck...",
      "code": "first_game",
      "name": "Primeira partida",
      "description": "Jogue sua primeira partida",
      "icon": "gamepad",
      "category": "gameplay",
      "tier": "bronze"
    }
  ]
}
```

Sem auth. Cacheável no cliente (catálogo raramente muda).

### `GET /api/player/achievements` — auth

Conquistas do jogador autenticado, com progresso para as bloqueadas.

```http
GET /api/player/achievements
Cookie: player_session=...
```

**200**:
```json
{
  "unlocked": [
    {
      "id": "ck...",
      "code": "first_game",
      "name": "Primeira partida",
      "description": "Jogue sua primeira partida",
      "icon": "gamepad",
      "category": "gameplay",
      "tier": "bronze",
      "unlockedAt": "2025-01-15T12:34:56.000Z"
    }
  ],
  "locked": [
    {
      "id": "ck...",
      "code": "ten_games",
      "name": "Veterano",
      "description": "Jogue 10 partidas",
      "icon": "medal",
      "category": "gameplay",
      "tier": "silver",
      "progress": { "current": 3, "target": 10, "percent": 30 }
    }
  ],
  "stats": { "unlocked": 2, "total": 8, "percent": 25 }
}
```

**401** se não autenticado.

### `POST /api/player/games/simulate` — auth

Cria `GameRecord`, atualiza stats e **desbloqueia conquistas**. Retorna
`newAchievements` no payload.

```http
POST /api/player/games/simulate
Cookie: player_session=...
Content-Type: application/json

{ "result": "win", "score": 250, "opponent": "Bot" }
```

**201**:
```json
{
  "game": {
    "id": "ck...",
    "result": "win",
    "score": 250,
    "opponent": "Bot",
    "createdAt": "2025-01-15T12:34:56.000Z"
  },
  "newAchievements": [
    {
      "id": "ck...",
      "code": "first_win",
      "name": "Primeira vitória!",
      "description": "Vença sua primeira partida",
      "icon": "trophy",
      "tier": "bronze"
    }
  ]
}
```

`newAchievements` é `[]` quando nenhuma conquista nova é desbloqueada.

---

## 5. Como adicionar uma conquista

Para estender o catálogo com uma nova conquista:

1. **Adicionar a definição em `ACHIEVEMENT_DEFS`**
   (`src/lib/ops/achievements.ts`):
   ```ts
   {
     code: 'fifty_games',
     name: 'Maratonista',
     description: 'Jogue 50 partidas',
     icon: 'flag',
     category: 'gameplay',
     tier: 'gold',
     target: 50,
   }
   ```
2. **Adicionar a condição em `checkAndUnlockAchievements`**
   (`src/lib/ops/achievements.ts`):
   ```ts
   if (player.gamesPlayed >= 50) {
     newlyUnlocked.push('fifty_games')
   }
   ```
   - Use o `PlayerAccount` (atualizado) e a `GameRecord` recém-criada
     como entradas.
   - Para condições baseadas em histórico (ex.: streak), consulte as
     últimas `N` `GameRecord` ordenadas por `createdAt` desc.
3. **Rodar o seed** (`scripts/seed-achievements.ts`):
   ```bash
   bun run scripts/seed-achievements.ts
   ```
   O seed é idempotente — só cria conquistas cujo `code` ainda não existe.
4. **Documentar a conquista aqui** (tabela da §2) e adicionar caso de
   teste em `docs/TEST-PLAN-PHASE2.md`.
5. **Verificar UI** — o `achievements-panel.tsx` renderiza
   automaticamente novas conquistas (lê do endpoint). Para ícones novos,
   garantir que o lucide correspondente esteja disponível no bundle.

> **Convenção de `code`**: `snake_case` em inglês, descritivo
> (`first_game`, `high_score_300`, `streak_3`). Não renomear após
> publicado (quebra `PlayerAchievement.achievementId`).

---

## 6. Notificação (toast)

O frontend dispara um toast customizado para cada conquista em
`newAchievements` retornado pelo `simulate`.

### Componente

`src/components/player/achievement-toast.tsx` — wrapper em torno do
`sonner` (já integrado ao projeto via `src/components/ui/sonner.tsx`),
com layout próprio: ícone lucide à esquerda (renderizado a partir de
`achievement.icon`), nome em destaque, tier colorido à direita.

### Fluxo

```
profile-screen.tsx
  └─ POST /api/player/games/simulate
       └─ response.newAchievements[]
            └─ achievement-toast.toastAchievement(a)
                 └─ sonner.toast.custom(<AchievementToastView ... />)
```

- O toast aparece por **5s** com opção de fechamento manual.
- Em caso de múltiplas conquistas simultâneas (raro, mas possível — ex.:
  1ª vitória que também é `high_score_200`), os toasts são empilhados
  pelo sonner.
- O `profile-screen` também **refetch** `GET /api/player/achievements`
  após o simulate para atualizar o progresso das bloqueadas.

### Acessibilidade

- `role="status"` no container do toast.
- `aria-live="polite"` para que leitores de tela anunciem o
  desbloqueio sem interromper a navegação.
- Contraste de cor do texto contra o fundo do tier ≥ 4.5:1 (WCAG AA).

---

## 7. Extensões futuras

Ideias documentadas para evolução do sistema (não comprometidas para a
Fase 2):

- **Conquistas sazonais** — disponíveis apenas em janelas específicas
  (ex.: "Vence 10 partidas no Mês das Mães"). Exige `seasonStart`/
  `seasonEnd` em `Achievement` e filtro por data no `simulate`.
- **Conquistas sociais** — "Jogue uma partida com um amigo" (exige
  sistema de amigos da Fase 4+), "Vença um amigo" (existe multiplayer
  real).
- **Conquistas escondidas** — `hidden: Boolean` em `Achievement`; só
  aparecem no catálogo do jogador após desbloqueadas (surpresa/elemento
  de descoberta).
- **Recompensas** — desbloquear avatar exclusivo, badge de perfil,
  título (ex.: "Mestre das Palavras") exibido ao lado do nome no
  leaderboard. Exige `reward` em `Achievement` e integração com o
  perfil.
- **Conquistas de categoria social `social`** — já prevista no enum de
  `category`, mas sem conquistas iniciais.
- **Conquistas `platinum`** — tier reservado para conquistas de
  maestria/sazonais de alto nível (nenhuma no catálogo inicial).
- **Polling opcional** — para o caso de multiplayer real (sem
  `simulate`), o frontend pode fazer poll periódico de
  `GET /api/player/achievements` para detectar desbloqueios
  assíncronos. Não implementado na Fase 2.
- **Notificação push (PWA)** — disparar notificação do navegador ao
  desbloquear conquista mesmo com a aba em segundo plano. Exige
  service worker ativo (já existe para PWA) e permissão do usuário.

---

## Referências

- `worklog.md` Task ID 10 — modelo `Achievement`/`PlayerAchievement` e
  seed das 8 conquistas iniciais.
- [`docs/PHASE2.md`](./PHASE2.md) — visão geral da Fase 2.
- [`docs/PERFORMANCE.md`](./PERFORMANCE.md) — índices em
  `PlayerAchievement(playerId)`.
- [`docs/TEST-PLAN-PHASE2.md`](./TEST-PLAN-PHASE2.md) — casos F-013 a
  F-020 cobrem desbloqueio de cada conquista.
