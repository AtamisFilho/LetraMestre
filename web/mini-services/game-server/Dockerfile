# ─── game-server Dockerfile ───────────────────────────────────────────────────
# NOTE: the build context MUST be the web/ directory (not this folder) because
# index.ts imports ../../src/lib/game/index.ts, which lives outside this folder.
# Build with:  docker build -f mini-services/game-server/Dockerfile -t letramestre-game-server .
#   (run from the web/ directory)
FROM oven/bun:1.3-debian
WORKDIR /app
COPY mini-services/game-server/package.json mini-services/game-server/bun.lock ./mini-services/game-server/
RUN cd mini-services/game-server && bun install --frozen-lockfile
COPY mini-services/game-server/ ./mini-services/game-server/
COPY src/lib/game/ ./src/lib/game/
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:3003/healthz || exit 1
CMD ["bun", "mini-services/game-server/index.ts"]
