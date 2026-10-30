# PokéPixel — Guess the Pokémon

A retro-inspired, five-round Pokémon identification browser game built with **React + TypeScript + Vite**.

## Game modes

- **Regular:** Four colored Kahoot-style multiple-choice buttons. One selection per round. A wrong choice immediately reveals the answer.
- **Hard:** Type a Pokémon name (with suggestion buttons), and keep guessing until the round ends or you are correct.

Each game chooses five distinct Pokémon. Sprites start pixelated and become clearer over a 10-second timer; correct guesses earn 1–3 points depending on remaining time. Both modes use the same final score screen.

## Spawn and sound

Each round loads its sprite, then plays a 1.4-second ball arrival, opening flash, and Pokémon emergence. The guessing timer and controls start only after the intro finishes (or **Skip intro** is selected). Reduced-motion preferences bypass the animated intro and flash. GIF frames keep moving throughout emergence and the existing progressive pixelation is preserved. The static PNG fallback now uses that same canvas pixelation; failed assets display a message instead of blocking the game. Each asset request has an eight-second timeout.

**Sound on/off** remembers the player's choice when browser storage is available. Original Web Audio synthesis supplies the landing, release, correct, incorrect, and completion cues, with short envelopes and modest output gain. Audio starts only after a player interaction; unsupported or blocked audio does not prevent gameplay. Muting or skipping the intro cancels its pending sounds.

The new sounds contain no third-party recordings or samples. The ball, flash, ring, and particles are drawn in CSS for this project; no video frames or game assets were extracted. Pokémon/Poké Ball designs and the existing remote sprites remain subject to their respective owners' rights. The reference video was not available during implementation, so the sequence follows the described arrival/opening/emergence rather than matching particular frames.

## Animated sprites

The first source is the official Gen V Black/White-era animated GIF directory hosted in the [PokéAPI sprites repository](https://github.com/PokeAPI/sprites):

`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif`

If the GIF is unavailable, the renderer tries PokéAPI's Showdown animation and then a static Black/White PNG. The prototype's random pool currently uses curated Gen I Pokémon with Gen V-style sprites, not every generation.

The animation is sampled into an HTML Canvas each frame, allowing the game to pixelate a moving GIF, rather than displaying a static screenshot. External images must support cross-origin canvas rendering.

## Run

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
npm run preview
```

## Files

- `src/App.tsx` — round state, modes, answer checking, timer, scoring
- `src/pokemon.ts` — Pokémon pool, sprite URL providers, random selections
- `src/PixelSprite.tsx` — animated canvas sampling and reveal
- `src/style.css` — arcade-inspired styling and responsive layout
- `src/SpawnEffect.tsx` — cancellable intro timing and decorative effect
- `src/sound.ts` — original synthesized cues and audio controls

## Browser checks

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

For an already installed Edge browser, set `PLAYWRIGHT_CHANNEL=msedge` (PowerShell: `$env:PLAYWRIGHT_CHANNEL='msedge'`) before running tests. Tests use an original two-frame GIF fixture and cover loading/intro timing, moving frames, progressive pixelation, five-round replay, hard-mode timeout/focus, mobile layout, mute persistence, audio cues, and fallback rendering. For visual/audio review, also play both modes with real sprites, toggle sound during release, and enable the operating system's reduced-motion setting.

## Notes

This is a fan-made educational prototype. Pokémon characters and imagery are the intellectual property of their respective owners; public distribution, branding, and commercialization require reviewing applicable rights and permissions. Images are loaded remotely, so gameplay needs internet access. No affiliation with Nintendo, Game Freak, The Pokémon Company, PokéAPI, or Smogon is implied.
