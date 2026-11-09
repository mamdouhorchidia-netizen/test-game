# Gravity Janitor

A small, funny gravity-flipping puzzle game for Android.

You are the janitor of Orbital Station Kevin. Swipe to flip gravity: everything
slides that way until it hits something. Get all the trash into the chute.
Do **not** send Chairman Meow (the cat) down the chute.

- 30 decks, each proven solvable by a solver; par is the shortest solution
- Sticky goo, and the Zoomba, a robot vacuum that falls the wrong way
- Undo, hints, 3-star ratings, saved progress, no ads, no network access

## Download

**[GravityJanitor.apk](../../releases/download/latest/GravityJanitor.apk)** -
open the link on an Android phone (Android 8+), then open the downloaded file
and allow installing from your browser when asked.

Every push rebuilds the APK with GitHub Actions and replaces the `latest` release.

## Project layout

| Path | What |
| --- | --- |
| `app/src/main/assets/` | The game itself (HTML5 canvas): `sim.js` rules, `game.js` drawing/input, `levels.js` |
| `app/src/main/java/` | Tiny fullscreen WebView shell |
| `tools/gen-levels.js` | Level generator (`node tools/gen-levels.js`, takes a few minutes) |
| `tools/check-levels.js` | Verifies every level against the solver (runs in CI) |

To try the game on a computer, open `app/src/main/assets/index.html` in a browser
and use the arrow keys (`Z` undo, `R` retry).

## Build locally

Open the folder in Android Studio, or run `./gradlew assembleRelease` with the
Android SDK installed. The APK lands in `app/build/outputs/apk/release/`.

The APK is signed with the demo key in `app/demo.keystore` (password `android`)
so updates install over each other. Use your own private key before publishing
to a store.
