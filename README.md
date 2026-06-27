# LetraMestre 🎯

**O jogo de palavras multiplayer em português brasileiro**

LetraMestre é um jogo de palavras estilo Scrabble para jogadores de língua portuguesa. Coloque peças no tabuleiro, forme palavras e ganhe pontos para ser o LetraMestre!

---

## 🎮 Funcionalidades

### Jogo
- **Tabuleiro 15x15** com bônus de letra dupla/tripla e palavra dupla/tripla
- **Distribuição de peças** otimizada para português brasileiro (incluindo Ç)
- **Dicionário** com mais de 1000 palavras válidas em português
- **Validação manual** de palavras não encontradas no dicionário
- **Multiplayer em tempo real** via WebSocket (2-4 jogadores)
- **Chat** durante o jogo
- **Sistema de pontuação** completo com bônus de 50 pontos por usar todas as 7 peças

### Aplicativo Web (PWA)
- **Progressive Web App** - instalável no Android e desktop
- **Design responsivo** - funciona em mobile e desktop
- **Tempo real** - atualizações instantâneas via Socket.io
- **Offline parcial** - cache de assets estáticos via Service Worker

### Painel Administrativo
- **Estatísticas** em tempo real (partidas, jogadores, jogadas)
- **Gerenciamento de palavras** - aprovar/banir palavras do dicionário
- **Salas ativas** - monitorar jogos em andamento
- **Melhores jogadas** - ranking das jogadas mais valiosas
- **Login seguro** com credenciais de administrador

---

## 🏗️ Arquitetura

```
LetraMestre/
├── app/                          # App Android original (Kotlin/Jetpack Compose)
│   └── src/main/java/com/letramestre/
│       ├── model/                # Modelos de dados
│       ├── game/                 # Lógica do jogo
│       ├── network/              # Servidor/cliente Ktor
│       ├── data/                 # Dicionário e distribuição
│       └── ui/                   # Telas e componentes
│
└── web/                          # Aplicativo Web (Next.js)
    ├── src/
    │   ├── app/                  # Rotas e API (Next.js App Router)
    │   ├── components/game/      # Componentes do jogo
    │   └── lib/game/             # Lógica do jogo (TypeScript)
    ├── mini-services/
    │   └── game-server/          # Servidor Socket.io (porta 3003)
    ├── prisma/                   # Schema do banco de dados
    └── public/                   # Assets, PWA manifest, SW
```

---

## 🚀 Instalação e Execução

### Aplicativo Web

#### Pré-requisitos
- [Bun](https://bun.sh/) v1.0+
- Node.js 18+

#### Configuração

```bash
cd web

# Instalar dependências
bun install

# Configurar banco de dados
bun run db:push

# Iniciar servidor de desenvolvimento
bun run dev
```

O aplicativo estará disponível em `http://localhost:3000`

#### Servidor de Jogo (Socket.io)

```bash
cd web/mini-services/game-server

# Instalar dependências
bun install

# Iniciar servidor
bun run dev
```

O servidor de jogo roda na porta 3003.

#### Acesso via duckdns.org

O servidor já está configurado para funcionar com duckdns.org via proxy reverso (Caddy). Configure o Caddyfile para apontar para o servidor web na porta 3000 e o game server na porta 3003.

---

## 📱 PWA (Android)

O LetraMestre é uma Progressive Web App, podendo ser instalada diretamente no Android:

1. Acesse o site no Chrome do Android
2. Toque no menu (⋮) e selecione "Instalar app" ou "Adicionar à tela inicial"
3. O app será instalado com ícone e tela de splash personalizados

---

## 🔐 Painel Administrativo

Acesse o painel admin clicando em "Painel Administrativo" na tela inicial.

**Credenciais padrão:**
- Usuário: `admin`
- Senha: `letramestre`

### Funcionalidades do Admin

| Aba | Descrição |
|-----|-----------|
| Visão Geral | Estatísticas gerais: partidas, jogadores, jogadas, média de pontos |
| Partidas | Lista de partidas recentes com status e detalhes |
| Palavras | Aprovar/banir palavras do dicionário, com busca |
| Salas Ativas | Monitorar jogos em andamento em tempo real |

---

## 🎯 Como Jogar

1. **Criar Partida**: Digite seu nome e clique em "Criar Partida"
2. **Compartilhar Código**: Compartilhe o código de 6 caracteres com outros jogadores
3. **Entrar na Partida**: Outros jogadores digitam o código para entrar
4. **Iniciar Jogo**: O host clica em "Iniciar Jogo" quando todos estiverem prontos
5. **Jogar**: 
   - Selecione uma peça no seu rack
   - Clique em uma célula do tabuleiro para colocá-la
   - Confirme sua jogada com o botão "Confirmar"
   - Ou passe a vez / troque peças

### Regras
- A primeira jogada deve cobrir o centro do tabuleiro (★)
- As peças devem formar palavras em linha (horizontal ou vertical)
- Cada jogada deve conectar com peças já existentes
- Palavras são validadas no dicionário português
- Palavras não reconhecidas podem ser aprovadas/rejeitadas pelos jogadores
- O jogo termina quando um jogador fica sem peças e o saco está vazio, ou quando todos passam

### Bônus do Tabuleiro
| Símbolo | Bônus |
|---------|-------|
| LD | Letra Dupla (x2 no valor da letra) |
| LT | Letra Tripla (x3 no valor da letra) |
| PD | Palavra Dupla (x2 no valor da palavra) |
| PT | Palavra Tripla (x3 no valor da palavra) |
| ★ | Centro (x2 no valor da primeira palavra) |

---

## 🛠️ Tecnologias

### App Android
- Kotlin + Jetpack Compose
- Ktor (servidor/cliente WebSocket)
- kotlinx.serialization

### App Web
- **Next.js 16** com App Router
- **TypeScript 5**
- **Tailwind CSS 4** + shadcn/ui
- **Socket.io** para multiplayer em tempo real
- **Prisma ORM** com SQLite
- **Zustand** para gerenciamento de estado
- **PWA** com Service Worker

---

## 📊 Banco de Dados

O aplicativo web usa Prisma ORM com SQLite para persistência:

- **Game**: Partidas criadas e finalizadas
- **Player**: Jogadores e suas pontuações
- **Move**: Histórico de jogadas
- **ChatMessage**: Mensagens do chat
- **ApprovedWord**: Palavras aprovadas manualmente
- **BannedWord**: Palavras banidas
- **AdminUser**: Usuários administradores
- **GameStats**: Estatísticas agregadas

---

## ⚙️ Escalabilidade e Operação

O servidor de jogo (Socket.io) foi endurecido para rodar com muitas partidas e jogadores simultâneos:

- **Lookup O(1) por código** — partidas são indexadas por código, sem varredura linear a cada `join`.
- **Reconexão transparente** — quedas de rede não custam o assento do jogador: o rack é preservado e a partida é retomada automaticamente (evento `game:rejoin`, com janela de carência configurável).
- **Migração de host e avanço de turno** — se o anfitrião sai, o papel migra para o jogador mais antigo conectado; se o jogador da vez cai, o turno avança para a partida não travar.
- **Coletor de salas ociosas** — lobbies abandonados e jogos finalizados são reciclados automaticamente, evitando vazamento de memória em servidores de longa duração.
- **Rate limiting e sanitização** — buckets por socket para jogadas/chat/criação, além de limpeza de nomes e mensagens (controle de caracteres invisíveis/bidi).
- **Dicionário persistente** — palavras aprovadas/banidas são carregadas do banco na inicialização e gravadas a cada decisão; o casamento é **insensível a acento e cedilha** (`ABRAÇO` ≡ `ABRACO`, `café` ≡ `CAFE`).
- **Observabilidade** — endpoints HTTP `GET /healthz` e `GET /metrics` no servidor de jogo.
- **Escala horizontal opcional** — defina `REDIS_URL` para distribuir eventos entre múltiplas instâncias via adaptador Redis do Socket.io (degrada graciosamente se ausente).

### Variáveis de ambiente do game server

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `GAME_SERVER_PORT` | `3003` | Porta do servidor Socket.io |
| `WEB_API_URL` | `http://localhost:3000` | Base da API web para persistência |
| `REDIS_URL` | — | Habilita o adaptador Redis (multi-instância) |
| `DISCONNECT_GRACE_MS` | `45000` | Janela de reconexão antes de liberar o assento |
| `WAITING_ROOM_TTL_MS` | `1800000` | TTL de lobbies ociosos |
| `FINISHED_ROOM_TTL_MS` | `300000` | TTL de jogos finalizados |
| `ABANDONED_ROOM_TTL_MS` | `600000` | TTL de salas sem ninguém conectado |

No frontend, o tabuleiro 15×15 memoriza as células (compara por valor), evitando re-renderizar as 225 células a cada atualização de estado.

---

## 📝 Changelog

### v2.1.0 - Escala e Robustez (2026)
- ✅ Reconexão transparente de jogadores (preserva rack e retoma a partida)
- ✅ Migração automática de host e avanço de turno em desconexões
- ✅ Lookup de partidas O(1) e coletor de salas ociosas (anti-vazamento de memória)
- ✅ Rate limiting por socket e sanitização de entradas
- ✅ Dicionário persistente em banco e casamento insensível a acento/cedilha
- ✅ Endpoints `/healthz` e `/metrics`; suporte opcional a Redis (escala horizontal)
- ✅ Memoização das células do tabuleiro no frontend

### v2.0.0 - Versão Web (2025)
- ✅ Aplicativo web completo com Next.js
- ✅ Multiplayer em tempo real via Socket.io
- ✅ PWA para instalação no Android
- ✅ Painel administrativo com estatísticas
- ✅ Persistência em banco de dados
- ✅ Chat durante o jogo
- ✅ Validação manual de palavras
- ✅ Design responsivo mobile-first

### v1.0.0 - Versão Android (original)
- App Android com Kotlin/Jetpack Compose
- Servidor WebSocket com Ktor
- Lógica do jogo completa

---

## 👥 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">
  <p>Feito com ❤️ para a comunidade de língua portuguesa</p>
  <p>🎯 <strong>LetraMestre</strong> - O jogo de palavras multiplayer</p>
</div>
