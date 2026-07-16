import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // `globals: false` forces explicit imports (describe/it/expect) which keeps
  // the test files portable to plain tsc + node runners and avoids accidental
  // global pollution. RTL auto-cleanup is wired in src/test-setup.ts.
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist", "out"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/game/**/*.ts"],
      exclude: ["src/lib/game/__tests__/**", "src/lib/game/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // CRITICAL: the project's postcss.config.mjs lists `@tailwindcss/postcss` as
  // a *string* plugin, which Vite's CSS loader rejects at startup with
  // "Invalid PostCSS Plugin found at: plugins[0]". Hand-veto the auto-load by
  // providing an empty plugins array — Vite then never reads the project's
  // postcss file. This is needed only for component tests (.tsx) that import
  // CSS via the Tailwind pipeline; the game-logic tests (.ts, node env) don't
  // touch CSS at all.
  css: {
    postcss: {
      plugins: [],
    },
  },
});
