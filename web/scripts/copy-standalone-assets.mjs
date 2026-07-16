// Cross-platform replacement for the `cp -r` shell call that breaks on
// Windows. Mirrors `.next/static` and `public/` into `.next/standalone/`
// so the standalone server has all the assets it needs at runtime.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webRoot = resolve(__dirname, "..");

const standaloneDir = join(webRoot, ".next", "standalone");
if (!existsSync(standaloneDir)) {
  console.error(
    "[copy-standalone-assets] .next/standalone not found. Run `next build` first.",
  );
  process.exit(1);
}

const targets = [
  { src: join(webRoot, ".next", "static"), dest: join(standaloneDir, ".next", "static") },
  { src: join(webRoot, "public"), dest: join(standaloneDir, "public") },
];

for (const { src, dest } of targets) {
  if (!existsSync(src)) {
    console.warn(`[copy-standalone-assets] source missing, skipping: ${src}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-standalone-assets] copied ${src} → ${dest}`);
}

console.log("[copy-standalone-assets] done");
