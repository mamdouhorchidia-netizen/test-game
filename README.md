# test-game

Two small, funny Android puzzle games. Each is an HTML5 canvas game inside a
tiny fullscreen WebView shell: no ads, no network access, progress saved on the phone.

## Download

Open a link on an Android phone (Android 8+), then open the downloaded file and
allow installing from your browser when asked.

- **[CloseCall.apk](../../releases/download/latest/CloseCall.apk)**
- **[GravityJanitor.apk](../../releases/download/latest/GravityJanitor.apk)**

Every push rebuilds both APKs with GitHub Actions and replaces the `latest` release.

## Close Call

You direct movie stunts in 2099. Your star, REX, walks through the set on his own.
You place the lasers, barrels, banana peels, superfans and trampolines so that he
finishes with **exactly 1 HP**. Safer than that and the audience yawns; any less
and you have no star.

- 24 scenes; every one is brute-forced, so the 3-star "best thrill" is the true maximum
- Crushers that slam on a beat, donuts, pillows, and props that shift REX's timing
- Hints, star ratings, saved progress

## Gravity Janitor

You are the janitor of Orbital Station Kevin. Swipe to flip gravity: everything
slides that way until it hits something. Get all the trash into the chute, and do
**not** send Chairman Meow (the cat) down it.

- 30 decks, each proven solvable; par is the shortest solution
- Sticky goo, and the Zoomba, a robot vacuum that falls the wrong way
- Undo, hints, star ratings, saved progress

## Project layout

| Path | What |
| --- | --- |
| `closecall/src/main/assets/` | Close Call: `sim.js` rules, `game.js` drawing/input, `levels.js` |
| `app/src/main/assets/` | Gravity Janitor: same three files |
| `*/src/main/java/` | The WebView shell for each app |
| `tools/gen-closecall.js`, `tools/gen-levels.js` | Level generators |
| `tools/check-closecall.js`, `tools/check-levels.js` | Verify every level against the solver (run in CI) |

To try a game on a computer, open its `index.html` in a browser.

## Build locally

Open the folder in Android Studio, or run `./gradlew assembleRelease` with the
Android SDK installed. APKs land in `app/build/outputs/apk/release/` and
`closecall/build/outputs/apk/release/`.

Both APKs are signed with the demo key in `app/demo.keystore` (password `android`)
so updates install over each other. Use your own private key before publishing
to a store.
