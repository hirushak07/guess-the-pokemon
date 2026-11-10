# PokéPixel — Guess the Pokémon

A retro-inspired, five-round Pokémon identification browser game built with **React + TypeScript + Vite**.

## Game modes

- **Regular:** Four colored Kahoot-style multiple-choice buttons. One selection per round. A wrong choice immediately reveals the answer.
- **Hard:** Type a Pokémon name (with suggestion buttons), and keep guessing until the round ends or you are correct.

Each game chooses five distinct Pokémon. Sprites start pixelated and become clearer over a 10-second timer; a correct guess earns 1–1,000 points depending on how much time is left, for a maximum of 5,000 across five rounds. Both modes show the total, number correct, and points earned each round. Wrong Regular picks, skips, and timeouts score zero. Wrong Hard guesses can be retried while the clock runs.

On touch-first devices, Hard mode waits after the intro for **Tap to type & start timer**. This opens the keyboard with a direct gesture and starts the full 10-second window. Use the keyboard’s Go key, the Guess button, or a suggestion to submit.

## Spawn and sound

Each round loads its sprite, then plays a 1.6-second ball arrival, opening flash, and Pokémon emergence. The intro finishes or is skipped before guessing starts. Hard mode on touch-first devices then waits for the typing tap. Reduced-motion preferences bypass the animated intro and flash. GIF frames keep moving throughout emergence and the existing progressive pixelation is preserved. The static PNG fallback now uses that same canvas pixelation; failed assets display a message instead of blocking the game. Each asset request has an eight-second timeout.

**Sound on/off** remembers the player's choice when browser storage is available. Web Audio supplies original synthesized cues plus the requested Gen 3 throw/release and Zedge success recordings, with short envelopes and modest output gain. Audio starts only after a player interaction; unsupported or blocked audio does not prevent gameplay. Muting or skipping the intro cancels its pending sounds.

The throw and release are the Gen 3 samples from the linked Soundeffects Wiki pages; success uses the linked Zedge “Pokemon A Button” clip. These third-party recordings are documented in [asset attribution](src/assets/ATTRIBUTION.md), and are not represented as openly licensed. All other effects and music are original synthesis. The throw starts 200 ms before the ball enters, the release plays at the opening flash (760 ms), and success plays on a correct answer. The first intro gives audio decoding up to 500 ms; loading failures use synthesized fallbacks without stalling gameplay. The ball, flash, ring, and particles are drawn in CSS for this project; no video frames or game assets were extracted. Pokémon/Poké Ball designs and the existing remote sprites remain subject to their respective owners' rights. The supplied reference clip informs the arrival/opening/emergence and HP-style timer; no media from the clip is bundled.

## Music and HP timer

The HP bar shows remaining time and changes from green to yellow to red as the deadline approaches. The points readout shows how much a correct guess would earn at the latest timer update. The award uses the actual submission time, rounded up at one point per 10 ms remaining. A submission at or after the deadline earns zero, even if a browser delay leaves the previous countdown visible.

An original eight-bar, 120 BPM chiptune loop adds pulse melody, triangle bass, and a soft synthesized kick while the site is open, including the home screen and results. Playback begins after the first click or keypress because browsers restrict autoplay. Music and sound effects have independent, remembered toggles. The music scheduler uses the Web Audio clock, continues across screens and background tabs, and avoids playing a backlog if the browser suspends the page. Closing the page or switching music off stops playback. Effects include selection, final-three-second ticks, skipping, and a distinct timeout cue. Music has its own quiet channel, so effects cannot accidentally stop or restart the loop.

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
- `src/sound.ts` — release recording playback, synthesized cues, music scheduler, and independent audio controls
- `src/TimerBar.tsx` — HP countdown and available points
- `src/scoring.ts` — scoring formula and round limits

## Browser checks

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

For an already installed Edge browser, set `PLAYWRIGHT_CHANNEL=msedge` (PowerShell: `$env:PLAYWRIGHT_CHANNEL='msedge'`) before running tests. The test server uses a signed-out Clerk stub and an original two-frame GIF fixture. Gameplay checks cover five-round replay, precise scoring and late submissions, 320×568 and 390×844 touch viewports, and Hard-mode focus, retry and Enter submission in a simulated keyboard-sized viewport. Audio and sprite regression coverage remains in the suite. For visual/audio review, also play both modes with real sprites, toggle sound during release, and enable the operating system's reduced-motion setting.

## Future ranked scoring

- Verify Clerk tokens on the server. Issue a run ID tied to the authenticated player, mode, and scoring version. Have the server choose rounds and track deadlines, answer validation, and scoring. Use server receipt time and define a consistent policy for network latency before ranking runs.
- Advance each round atomically and make retries idempotent. Rate-limit guesses and run creation, expire stale runs, and prevent round replay. Store results through a server-only write path and use Supabase row-level security for player access.
- Keep ranked answers out of client state and replace answer-identifying sprite URLs with opaque per-round assets. Image matching and automation are still possible, so define abuse controls and keep leaderboards separate by mode and scoring version.

## Notes

This is a fan-made educational prototype. Pokémon characters and imagery are the intellectual property of their respective owners; public distribution, branding, and commercialization require reviewing applicable rights and permissions. Images are loaded remotely, so gameplay needs internet access. No affiliation with Nintendo, Game Freak, The Pokémon Company, PokéAPI, or Smogon is implied.

## Verified game results backend

The Supabase migration adds an authenticated `play_verified_game` RPC and an owner-only `verified_game_results` table alongside any existing `game_results` table. The database selects the five rounds, sets each 10-second deadline, checks guesses, and saves the result when round five resolves. Use the existing Clerk third-party auth configuration. Apply the migration to a local or staging database before connecting the game UI.

Call the RPC with the signed-in player's Supabase client. `start` takes `p_mode` (`regular` or `hard`) and resumes an unfinished run in its original mode when one exists. `open`, `guess`, `skip`, and `next` take the returned `p_run_id` and expected `p_round`. `status` takes the run ID and returns the current round. Send Regular choices as ID strings and Hard guesses as names. The deadline starts on `open`, which also reveals the sprite ID and any choices. Use the returned deadline and server time for display. A completed response contains the verified total and all five round results. Runs expire after 30 minutes if unfinished.

Signed-in games use this RPC after the migration is deployed. Guests continue to play locally. Verified rounds start on an explicit tap and load the sprite during the timed round. Sprite IDs are visible during play and can be mapped to Pokémon names, so these results are suitable for verifying scoring rules and need additional abuse controls before competitive ranking.

Run the database integration test against a local Supabase database after applying the migration:

```sh
psql "$LOCAL_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verified_game_results.sql
```
