# Frontlines

Two kingdoms, one river. You never command a soldier directly: you draw the roads your armies
march on, and thousands of soldiers clash on a 3D tabletop battlefield.

**Play it at [frontlines.mkjems.dk](https://frontlines.mkjems.dk/)**. It runs in the browser on desktop and mobile.

## How to play

- **The start screen** has three steps: a welcome with how-to-play tips, the map, then the difficulty.
- **Drag from one of your blue towns** to draw its march route. New soldiers follow it. End the route
  on an enemy or unclaimed town to attack it, or on open ground to gather an army there.
- **Drag from a gathered army** to send it on.
- **Tap a town** to choose what it trains:
  - spearmen beat cavalry;
  - archers beat spearmen;
  - cavalry beat archers.
- **Spend gold** from the tray on farms, watchtowers, forts, barracks and bridges. Farms and gold mines earn it.
- **Charge** (first in the tray, or press C, every 25 seconds): click on a fight and your soldiers in the
  circle run at the enemy there, sprinting, and their first blow hits two to three times as hard.
- **Take Redmarsh, the enemy capital, to win.** Lose Ashford and the war is over.
- **Every game is dealt a landscape:** River Valley, The Great Lake, Two Rivers, Mountain Pass, Open Border,
  The Steppe, The Greenwood, Highlands, Marshes or Broken Bridges. Step through them with the arrows or dots on the start screen, or add
  `?land=mountains` (or `valley`, `lake`, `tworivers`, `open`, `steppe`, `greenwood`, `highlands`, `marsh`, `broken`) to
  the address to pick one.
- **Every map is random but fair:** the towns, mines, farms, hills, woods, crags and bogs are laid out at
  random on your half and mirrored, turned about the centre, onto the enemy's. Each map has a number shown on
  the start screen; `?map=4821` (with `?land=`) rebuilds the same one. Tick **Classic towns** for the
  original hand-made town layout.
- **Camera:**
  - scroll or pinch to zoom;
  - drag open ground to look around;
  - double-click to zoom in or back out.
- **Shortcuts:** Space pauses, C arms Charge, Esc cancels. Hold Shift and hover over anything to see what it does.
- **Tips** appear as you play; any tip can turn them off, and the Rules sheet turns them back on.

The full rules are in the game under **Rules**.

## How it's built

The whole game is a single file, [frontlines.html](frontlines.html), with no build tools and no framework.

- **Rendering:** [three.js](https://threejs.org/) (loaded from a CDN) draws the board as a lit diorama with
  terraced hills, a river channel, buildings, trees and instanced soldiers casting real shadows.
- **Ground markings:** territory, routes, rings and field borders are painted onto a canvas each frame and
  blended into the ground's shader.
- **Text:** names, icons and labels are drawn on a 2D canvas on top, so they stay sharp.
- **Simulation:** runs at a fixed 40 steps per second, independent of the frame rate.
- **The enemy:** a scripted AI that gathers at bridges, feints, hunts weak towns, counters your most common
  troop type, and builds bridges where it needs them.
- **Sound:** all synthesized with the Web Audio API. There are no audio files.

`frontlines.html` is written without the `<html>`/`<head>` wrapper. [build.sh](build.sh) wraps it into
a complete page with sharing metadata at `site/index.html`, and copies [art/](art/) into `site/`: the
start, victory and defeat paintings, the icons and the link-preview image. [docs/art.md](docs/art.md)
describes their style and how to make more.

Ideas that have been discussed but not built yet are collected in [docs/ideas.md](docs/ideas.md).

## Running it locally

```sh
./build.sh
open site/index.html
```

## Tests

[tests/](tests/) plays the built game in headless Chrome with real mouse and touch input. It checks:
- the three-step start screen and its tips carousel;
- drawing routes and snapping onto towns;
- that an army sent into the enemy capital takes it, and that the battle plays on afterwards;
- zoom and pan;
- placing a watchtower, and Broken Bridges' free bridges for both sides;
- Charge: in the tray, armed with C, and soldiers running at the spot;
- battles, captures and attacks on your capital;
- every landscape: towns stay dry, nobody walks through rivers, mountains or crags, both sides field armies;
- armies crossing two rivers and a mountain pass;
- random layouts: mirrored for both sides, rebuilt by their map number, playable, and the landscape carousel;
- turning tips off and on;
- the Sound button silencing everything;
- the phone layout.

```sh
cd tests
npm install   # first time only
npm test      # rebuilds site/index.html, then runs the suite
```

The tests need Google Chrome or Chromium, which they find automatically on macOS and Linux. Set
`CHROME_PATH` to use another browser binary. Opening the game with `?test` in the URL exposes the small
`window.__t` hook the tests use. In that mode the board is drawn small, without shadows and only every
8th frame, which keeps the suite quick on CI, where Chrome draws in software; add `&lite=0` for the full
picture.

## Deployment

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. Builds `site/index.html` and runs the browser tests. A failing test stops the deploy.
2. Builds a Docker image and pushes it to `ghcr.io/mkjems/frontlines`. It runs [server/relay.mjs](server/relay.mjs), a
   small Node server that serves `site/` and, on `/ws`, relays two-player matches (see
   [docs/multiplayer.md](docs/multiplayer.md)). Caddy passes WebSocket connections through as they are.
3. Connects to the VPS over SSH and runs `docker compose pull && docker compose up -d` in `/opt/frontlines`.

On the VPS the container listens on `127.0.0.1:8083`, and Caddy serves it at `frontlines.mkjems.dk`
with automatic HTTPS. [compose.yaml](compose.yaml) is a copy of the one on the server. The deploy job needs
the repository secrets `VPS_HOST`, `VPS_USER` and `VPS_SSH_KEY`.
