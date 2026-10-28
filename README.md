# PokéPixel — Guess the Pokémon

A retro-inspired, five-round Pokémon identification browser game built with **React + TypeScript + Vite**.

## Game modes

- **Regular:** Four colored Kahoot-style multiple-choice buttons. One selection per round. A wrong choice immediately reveals the answer.
- **Hard:** Type a Pokémon name (with suggestion buttons), and keep guessing until the round ends or you are correct.

Each game chooses five distinct Pokémon. Sprites start pixelated and become clearer over a 20-second timer; correct guesses earn 1–3 points depending on remaining time. Both modes use the same final score screen.

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

## Notes

This is a fan-made educational prototype. Pokémon characters and imagery are the intellectual property of their respective owners; public distribution, branding, and commercialization require reviewing applicable rights and permissions. Images are loaded remotely, so gameplay needs internet access. No affiliation with Nintendo, Game Freak, The Pokémon Company, PokéAPI, or Smogon is implied.
