# GTA 6 Mini — Kota Top-Down

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/DimasPutera/gta6-mini/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/DimasPutera/gta6-mini/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Game kota 2D top-down: jalan kaki, mengemudi, antar paket, lalu lintas, pejalan kaki, dan patroli. Dibangun untuk kompetisi [gta6-01 di make.fun](https://make.fun/bounty/gta6-01).

## Cara main

Buka `game/index.html` di browser, atau jalankan server lokal dari folder `game/`:

```sh
cd game
python3 -m http.server 8123
```

Lalu buka http://127.0.0.1:8123/index.html.

Kontrol: WASD bergerak · E masuk/keluar mobil · P jeda.

## Isi

- `game/game.js` — inti game: kota grid, pemain, mobil, kamera, HUD, minimap, simpan progres.
- `game/systems.js` — lalu lintas, pejalan kaki, level patroli, misi, audio.
- `game/index.html`, `game/style.css` — halaman dan tampilan.
- `main.ts` — membangun dossier untuk make.fun (`MAKEFUN_OUTPUT_DIR=out node main.ts`).
- `screenshots/` — tangkapan layar gameplay.

Referral: https://make.fun/r/5tsm9en2
