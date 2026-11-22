// main.ts — entrypoint kompetisi (Node 22, tanpa dependensi).
// Menyalin game/ dan screenshots/ dari repo ke /output, lalu
// menulis /output/dossier.json dengan buildDossier dari
// vendor/makefun-game.ts.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const ROOT = process.cwd();
const OUT = "/output";

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
  }
}

function copyFolder(name: string): void {
  const src = join(ROOT, name);
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    throw new Error(`main.ts: folder ${name}/ tidak ditemukan di ${ROOT}`);
  }
  copyTree(src, join(OUT, name));
  console.log(`main.ts: disalin ${name}/ -> ${join(OUT, name)}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

copyFolder("game");
copyFolder("screenshots");

const dossier = buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

writeFileSync(join(OUT, "dossier.json"), dossier);
console.log(`main.ts: ditulis /output/dossier.json (${dossier.length} byte)`);
