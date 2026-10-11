# Kessler

An orbital demolition arcade game. Orbit a deflector around a vulnerable planet, steer a spinning demolition ball through three rings of derelicts, and collect the tools that fall from their wreckage. Clear the sky to advance through endless, faster waves.

## Run

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend, credentials, or external services are used.

## Build

```sh
npm run build
npm run preview
```

Deploy the complete `dist/` directory to a static host, at either the site root or a subdirectory. All sprites, particle systems, and sounds are committed under `assets/`. `public/assets` points to that directory so Vite copies them into the static build. The build never invokes asset-generation tools.

## Controls

- **A / D** or **Left / Right:** orbit the deflector.
- **Space:** launch a parked ball.
- **P / Escape:** pause or resume.
- **W / S** or **Up / Down:** select a menu entry.
- **Enter / Space:** confirm; **Escape:** leave instructions.
- Mouse, pen, and touch can select and activate menu entries.
- **Backtick:** toggle the engine's diagnostic overlay.

Steer with the edge of the deflector for angled shots. Widen gives a broader catch; narrow shrinks it. Multiball launches two extra balls, shield saves one incoming ball, and pierce cuts straight through armored targets. Missing the final ball costs a life.

## Verification

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The unit suite runs the actual engine over a native canvas and controlled clocks. It covers screen transitions, input edges, immutable debug poses, fractional frame timing, crossings, reflections, scoring, salvage effects, and wave progression. Browser media in `showcase/` is captured from the running game; `scripts/capture.mjs` reproduces it while the development server is running.

## Source and asset provenance

`src/model.ts` defines the state and geometry. `src/simulation.ts` owns the fixed-tick rules, `src/debug.ts` implements the automation surface, and `src/presentation.ts` draws the field and screens. `src/game.ts` loads assets and connects these parts to Simple 2D.

The original planet and pod sprites were rendered with `draw`; the six spin frames with `draw-sheet`; the three live effects with `particle-2d`; the thirteen cues with `sfx-synth`; and both sequenced music beds with `music`. Authoring operations and the optional one-time production script are retained in `assets/source/`. Those tools are needed only to re-author assets, never to install, build, or run the game. Music loops run for 20 and 16 seconds, with measured continuous, non-silent junctions.
