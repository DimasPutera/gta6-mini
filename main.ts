import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const OUT = "/output";

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) {
      copyTree(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function copyFolder(name: string): void {
  const src = join(process.cwd(), name);
  if (!existsSync(src)) {
    throw new Error(`Folder sumber tidak ada: ${src}`);
  }
  copyTree(src, join(OUT, name));
}

if (existsSync(OUT)) {
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

copyFolder("game");
copyFolder("screenshots");

const dossier = buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: {
    max: 4,
    max_bytes: 262144,
  },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

const dossierPath = join(OUT, "dossier.json");
writeFileSync(dossierPath, dossier);
const gameFiles = readdirSync(join(OUT, "game"), { recursive: true }).length;
console.log(`game: ${gameFiles} file, dossier.json: ${statSync(dossierPath).size} byte`);