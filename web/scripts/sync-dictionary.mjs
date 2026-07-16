// Synchronizes the canonical dictionary at shared/dictionary.pt-BR.json
// to its two consumers:
//   1. web/src/lib/game/dictionary.pt-br.json   (imported by dictionary.ts)
//   2. app/src/main/res/raw/dictionary_pt_br.json (Android R.raw resource)
//
// Run via `bun run sync-dictionary` from the web/ directory, or directly.
//
// Rationale: the canonical JSON lives at the repo root so it is the single
// source of truth. We mirror it into web/src/lib/game/ (LOCAL import —
// Turbopack rejects imports that escape the web/ project root) and into
// app/src/main/res/raw/ (AGP turns the snake_case filename into an
// R.raw.dictionary_pt_br resource the Kotlin Dictionary can read).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve repo root whether invoked from web/ or from repo root.
const webRoot = existsSync(resolve(__dirname, "..", "package.json"))
  ? resolve(__dirname, "..")
  : resolve(__dirname, "..", "web");
const repoRoot = resolve(webRoot, "..");

const source = resolve(repoRoot, "shared", "dictionary.pt-BR.json");
if (!existsSync(source)) {
  console.error(`[sync-dictionary] source not found: ${source}`);
  console.error("  Run this from the web/ directory or the repo root.");
  process.exit(1);
}

const targets = [
  resolve(webRoot, "src", "lib", "game", "dictionary.pt-br.json"),
  resolve(repoRoot, "app", "src", "main", "res", "raw", "dictionary_pt_br.json"),
];

for (const dest of targets) {
  try {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    console.log(`[sync-dictionary] ${source} → ${dest}`);
  } catch (err) {
    console.error(`[sync-dictionary] failed to write ${dest}:`, err);
    process.exit(1);
  }
}

console.log("[sync-dictionary] done");
