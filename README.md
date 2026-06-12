# Lumen — a journey inward

A Celeste-style precision platformer for Android (and the browser), themed around
spiritual enlightenment: you begin shrouded in fog and gray, and the world — and the
character — gradually fill with light as you ascend.

Built with TypeScript + HTML5 Canvas, wrapped into a native Android app with Capacitor.
All pixel art and audio are generated in code; there are no asset files.

> **Preview build:** 12 screens are currently enabled for play-testing — all of
> Chapter 1 (10 screens) plus the first 2 screens of Chapter 2. The remaining screens
> are being added chapter by chapter; the slice is configured in `src/levels/index.ts`.
>
> The game is a **vertical ascent**: each screen is a multi-layered climb, and screens
> stack on top of each other through chimney seams (exit through the top, arrive at the
> bottom of the next). Falling down a chimney drops you back a screen — a setback, not
> a death.

## Play in the browser (quickest way to test)

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). The game scales to any window.

**Keyboard controls**
| Action | Keys |
|---|---|
| Move | Arrow keys / WASD |
| Jump | Z or Space |
| Dash | X or Shift |
| Grab/climb | C or Ctrl |
| Pause | Esc or Enter |

**Touch controls** (phone browser or the Android app): floating joystick on the left half
of the screen. The action buttons fan around the right thumb's resting corner: `A` = jump
(bottom corner), `B` = dash (one roll left), `G` = grab (one roll up). **Grab is a toggle**
— tap `G` once to latch on (a ring shows it's active), tap again to release; a long press
still works as hold-to-grab. Pause at the top-right.

## Build the Android APK

The Android project in `android/` is complete and synced. Building the APK requires a
machine with the **Android SDK** (Android Studio, or command-line tools with
`platforms;android-34` + `build-tools`). Then:

```bash
npm install
npm run cap:sync          # builds the web bundle and copies it into android/
cd android
./gradlew assembleDebug   # → android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a device with `adb install app/build/outputs/apk/debug/app-debug.apk`
(or open `android/` in Android Studio and press Run).

The app runs fullscreen, landscape, with screen-on lock and display-cutout support.

## Development

```bash
npm test        # vitest: physics, player mechanics, level structure validation
npm run build   # type-check + production web build
```

- `src/engine/` — game loop, renderer (320×180 integer-scaled), input, physics (Celeste-style actor/solid), touch
- `src/game/` — player state machine, constants (all tuning in `constants.ts`), entities, scenes
- `src/art/` — code-generated sprites, tiles, palettes (one per chapter, gray → luminous), backgrounds, particles
- `src/audio/` — WebAudio synth, SFX, ambient music
- `src/levels/` — ASCII screen definitions, one file per chapter
- `e2e/` — Playwright smoke/playthrough scripts

In dev mode, `window.__game` exposes the current screen, player state, and a
`warp('1-2')` helper for jumping to any screen.
