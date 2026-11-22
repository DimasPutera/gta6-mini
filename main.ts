import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function countFiles(dir: string): number {
  return readdirSync(dir, { recursive: true }).filter((f) => {
    try { return statSync(join(dir, f as string)).isFile(); } catch { return false; }
  }).length;
}

for (const name of ['game', 'screenshots']) {
  if (!existsSync(join(repoDir, name))) throw new Error(`folder ${name}/ tidak ditemukan di ${repoDir}`);
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const gameFiles = countFiles(join(outDir, 'game'));
const shots = countFiles(join(outDir, 'screenshots'));

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));

console.log(`disalin ${gameFiles} file game + ${shots} screenshot ke ${outDir} — siap dinilai`);
console.log(`wrote ${outDir}/dossier.json`);
