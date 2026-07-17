# Task ID: 7 — Agente E (Frontend Fase 1)

**Agent:** full-stack-developer (Frontend)
**Task:** Adicionar experiência de Conta do Jogador (Fase 1) à rota `/` — seletor de modo, auth, perfil, partidas, seção ops M1.

## Contexto consumido
- `worklog.md` seção "Task ID: 5 (Planejamento Fase 1)" — contrato de API fixado.
- Fase 0 já entregue pelo Agente B (Console Ops com 8 seções).
- Agente D (Task 6) — Backend Fase 1 já havia criado todos os endpoints
  `/api/auth/player/*`, `/api/player/*`, `/api/ops/phase1/*` e o schema Prisma
  quando comecei a verificar. Construí a UI contra o contrato e adaptei o
  cliente para tolerar diferenças de formato (flat vs nested stats).

## Decisões de arquitetura
- **Shell com mode switch**: `src/app/page.tsx` reduzido a um shell que renderiza
  `<OpsConsole>` (default) ou `<PlayerApp>` conforme `mode` persistido em
  `localStorage` via Zustand (`src/lib/mode-store.ts`). O Header (renderizado
  no layout) lê/escreve o mesmo store — sem precisar modificar `layout.tsx`.
  `skipHydration: true` + reidratação no `useEffect` evita mismatch de SSR.
- **OpsConsole extraído**: o conteúdo de `page.tsx` da Fase 0 foi movido para
  `src/components/ops/ops-console.tsx` (preservando integralmente todas as 8
  seções originais). Adicionada a 9ª seção "Contas de jogador (Fase 1)" no
  array de seções.
- **Cliente tolerante a formato**: o backend efetivo retorna stats *flat*
  (`gamesPlayed`, `gamesWon`, `winRate`, `totalScore`, `bestScore`,
  `googleLinked` no nível raiz do player), enquanto o contrato definiu
  `stats` aninhado. `getMe()` e `updateMe()` normalizam ambos os formatos
  para o tipo `PlayerMe` (com `stats` aninhado e `provider` derivado de
  `googleLinked`).
- **Provider badge**: o `/me` não expõe explicitamente `provider`. Derivo:
  `googleLinked: true` → `'google'`; caso contrário `'password'`. Se o
  backend evoluir e enviar `provider` explícito, ele tem prioridade.

## Arquivos criados
- `src/lib/auth-player-client.ts` — tipos TS, fetchers (com
  `credentials: 'include'` + `cache: 'no-store'`), `PlayerApiError`,
  normalizador `normalizePlayerMe`, hook `usePlayerSession`, utilitários
  `playerInitials` e `providerLabel`.
- `src/lib/mode-store.ts` — store Zustand persistido para alternar
  Operações/Jogador, com hook `useAppMode` seguro para SSR.
- `src/components/player/auth-screen.tsx` — Card mobile-first com Tabs
  Entrar/Criar conta, validação client-side (email, username 3-20
  alfanuméricos/_, senha min 8, confirmação), botão Google (chama
  `GET /api/auth/player/google` → dialog demo se `demo: true`,
  redirect se `configured: true`), sub-tela interna de Forgot e Reset
  (auto-detecta `?reset-token=` na URL).
- `src/components/player/forgot-password.tsx` — formulário que exibe
  `demoResetUrl`/`demoResetToken` retornados com mensagem clara sobre
  ambiente sem SMTP, e botão para redefinir com o token recebido.
- `src/components/player/reset-password.tsx` — formulário com token
  (pré-preenchido se vier da tela forgot ou da URL), nova senha + confirmação.
- `src/components/player/google-demo-dialog.tsx` — Dialog explicando que
  OAuth Google requer configuração em produção, com campos opcionais de
  email/nome e botão "Continuar com conta Google demo".
- `src/components/player/edit-profile-dialog.tsx` — Dialog com
  displayName, bio (max 280), avatarUrl (opcional) → `PATCH /me`.
- `src/components/player/profile-screen.tsx` — cabeçalho com avatar
  (fallback de iniciais), displayName, @username, email, badge provider,
  badge "Conta Fase 1", bio, datas de entrada/último login; botões Editar/
  Sair; grid de stats (Partidas, Vitórias, Taxa de vitória, Pontuação total,
  Melhor pontuação); seção "Partidas recentes" com badges coloridos
  (win=emerald, loss=rose, draw=amber); botões Atualizar/Simular partida;
  estado vazio amigável.
- `src/components/player/player-app.tsx` — orquestrador que usa
  `usePlayerSession` e alterna entre AuthScreen e ProfileScreen com
  `AnimatePresence` (framer-motion) + skeletons de loading.
- `src/components/ops/ops-console.tsx` — extraído do `page.tsx` original,
  com a 9ª seção "Contas de jogador (Fase 1)" adicionada.
- `src/components/ops/phase1-section.tsx` — seção do Console que consome
  `/api/ops/phase1/status` e `/api/ops/phase1/players`: progresso M1,
  critérios de saída, KPIs (total contas, com senha, com Google, vitórias),
  tabela de contas com avatar/username/email/provider/partidas/vitórias/
  último login, tabela de 10 tarefas (1.1-1.10) com status local que
  inclui "N/A" (não aplicável) para 1.10.

## Arquivos modificados
- `src/app/page.tsx` — refatorado para shell mínimo com mode switch.
- `src/components/site/header.tsx` — adicionado seletor de modo
  (segmented control) com ícones `Settings2` (Operações) e `UserCircle2`
  (Jogador); badge dinâmico (Fase 0 · M0 vs Fase 1 · M1); subtítulo do
  logo dinâmico ("Console de Operações" vs "Conta do Jogador").

## Validação

### Lint
- `bun run lint` → **0 errors, 0 warnings** (projeto inteiro limpo).

### Dev server log
- Sem erros. Endpoints consumidos respondendo 200/201 conforme esperado:
  `POST /api/auth/player/register` 201, `POST /api/auth/player/login` 200,
  `GET /api/auth/player/me` 200, `POST /api/player/games/simulate` 201,
  `GET /api/player/games` 200, `GET /api/ops/phase1/status` 200,
  `GET /api/ops/phase1/players` 200, `POST /api/auth/player/logout` 200,
  `POST /api/auth/player/forgot-password` 200,
  `POST /api/auth/player/reset-password` 200,
  `POST /api/auth/player/google/demo` 200, `GET /api/auth/player/google` 200.

### Agent Browser (E2E na rota `/`)
Capturas em `/home/z/my-project/agent-ctx/phase1-*.png`:
1. **phase1-01-ops-default.png** — Carregamento inicial: OpsConsole com 9
   seções no sidebar (incluindo "Contas de jogador (Fase 1)").
2. **phase1-02-ops-phase1-section.png** — Seção Fase 1 renderiza:
   progresso M1, 4 critérios de saída, KPIs, tabela de 6 contas reais
   (criadas pelo Agente D em testes), tabela de 10 tarefas com status
   "N/A" para 1.10.
3. **phase1-03-player-auth.png** — Modo Jogador: AuthScreen com Tabs
   Entrar/Criar conta, botão Google.
4. **phase1-04-player-register-success.png** — Registro bem-sucedido
   (agente.e@example.com / agente_e) → ProfileScreen imediatamente.
5. **phase1-05-player-profile-with-games.png** — Após 3 partidas simuladas:
   stats (3 partidas, 1 vitória, 33% win rate, 708 pts total, 372 best)
   e lista com 3 partidas (Vitória/Empate/Derrota).
6. **phase1-06-edit-profile-dialog.png** — Dialog de edição aberto.
7. **phase1-07-profile-edited.png** — Perfil atualizado (nome "Agente E
   Teste" + bio).
8. **phase1-08-logout-back-to-auth.png** — Logout → AuthScreen + toast
   "Você saiu da conta."
9. **phase1-09-login-back.png** — Login com senha → ProfileScreen
   preserva o perfil editado + toast "Bem-vindo de volta".
10. **phase1-10-forgot-password.png** — Tela "Esqueci minha senha".
11. **phase1-11-forgot-token-shown.png** — Token e URL retornados com
    mensagem clara sobre ambiente sem SMTP.
12. **phase1-12-reset-password.png** — Tela de redefinição com token
    pré-preenchido.
13. **phase1-13-after-reset.png** — Após redefinir, volta para login.
14. **phase1-14-login-with-new-password.png** — Login com a nova senha
    funciona.
15. **phase1-15-google-demo-dialog.png** — Dialog Google demo aberto.
16. **phase1-16-google-demo-logged-in.png** — Login Google demo
    bem-sucedido; profile mostra badge "Google".
17. **phase1-17-back-to-ops.png** — Volta para modo Operações.
18. **phase1-18-ops-phase1-with-new-player.png** — Seção Fase 1 agora
    lista os 2 novos jogadores criados (Agente E Teste e Jogador Google
    Demo).
19. **phase1-19-mobile-ops.png** — Viewport 390x844 (mobile) — sidebar
    vira Sheet "Abrir navegação de seções", modo Operações.
20. **phase1-20-mobile-player-auth.png** — Mobile, modo Jogador —
    sessão persistida via cookie HttpOnly, perfil mobile-first.

### Console/errors do browser
- `agent-browser errors` → vazio.
- `agent-browser console` → apenas logs de HMR/Fast Refresh, sem warnings.

## Resultado
- **Todos os fluxos da Fase 1 funcionando end-to-end**: registro, login,
  logout, edição de perfil, recuperação de senha (forgot + reset com token
  demo), login Google demo, simulação de partidas vinculadas à conta,
  persistência de sessão via cookie HttpOnly, badges de provider, stats
  agregadas, partidas recentes com badges coloridos.
- **Seletor de modo** funcional e persistido (recarrega em modo salão
  após reload).
- **9ª seção do OpsConsole** renderiza contas reais e progresso M1 com
  critérios de saída derivados do banco.
- **Mobile-first e acessível**: labels, aria-pressed no seletor de modo,
  aria-current na navegação, regiões semânticas, foco visível, skeletons
  durante loading, toasts sonner para feedback.
- **Footer sticky** preservado (mt-auto).
- **Paleta esmeralda/neutros** consistente com Fase 0 (sem indigo/azul).

## Pendências
- Nenhuma pendência crítica de frontend. Sugestão para o backend (Agente D):
  expor `provider` explicitamente no `/me` (hoje derivado de
  `googleLinked`) e/ou alinhar o formato ao contrato (`stats` aninhado) —
  o frontend já tolera ambos, mas o alinhamento reduziria a necessidade
  de normalização client-side.
- Documentação (Agente F / Task 8): pode referenciar
  `src/lib/auth-player-client.ts` como fonte de tipos do contrato e
  `src/components/player/**` como referência de UI.
