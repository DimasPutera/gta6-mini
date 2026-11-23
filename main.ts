// main.ts — salin game + screenshots ke /output, lalu bangun dossier.
// Entrypoint Node 22, tanpa dependensi.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-game.ts';

const OUT = '/output';
const SOURCES = ['game', 'screenshots'] as const;

// Batas ukuran dossier, diteruskan apa adanya ke buildDossier.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function copyOne(src: string): void {
  if (!existsSync(src)) throw new Error(`sumber tidak ada: ${src}`);
  const dest = `${OUT}/${src}`;
  cpSync(src, dest, { recursive: true });
  console.log(`disalin: ${src} -> ${dest}`);
}

function copySources(): void {
  mkdirSync(OUT, { recursive: true });
  for (const src of SOURCES) copyOne(src);
}

function main(): void {
  console.log('memulai build dossier...');
  copySources();
  const dossier = buildDossier(OUT, caps);
  if (dossier.length === 0) {
    throw new Error('buildDossier mengembalikan dossier kosong');
  }
  const path = `${OUT}/dossier.json`;
  writeFileSync(path, dossier);
  const size = statSync(path).size;
  console.log(`dossier: ${size} byte -> ${path}`);
}

main();
