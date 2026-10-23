# Multiplayer plan: two players online

The plan for playing Frontlines against another person, agreed on 23 October 2026. Work through the phases
in order. Single player against the computer must keep working, and feel the same, after every phase.

**Current phase:** 1, not started. Phase 0 was done on 23 October.

How to keep this plan up to date:
- Tick a step (`- [ ]` → `- [x]`) in the same commit as the work, once its tests pass.
- A phase is done when its **Exit** condition holds, not just when its boxes are ticked. Then move
  **Current phase** on.
- Under a step, add a short indented line for anything learned that the next session needs (numbers,
  surprises, where the code ended up).
- When reality changes the plan, change the plan: add or reword steps, or strike out (`~~…~~`) ones that
  turned out unnecessary, with a word on why.

## Decisions

- **Lockstep simulation.** Both browsers run the whole game and exchange only the players' orders. The server
  never runs a game. This replaces the earlier host-authoritative idea (one player's browser runs the game and
  streams state): lockstep is fair (both players get the same delay), needs almost no bandwidth, and keeps the
  server tiny.
- **The mouse never waits for the network.** Drawing routes, ink, snapping, building ghosts, hover highlights,
  info boxes, town menus, camera and click sounds all stay local. Only the finished action (an *order*, sent
  when the mouse is released or a choice is made) goes over the wire.
- **Orders take effect a few ticks ahead**, about 100–150 ms, on the same tick in both browsers. The route
  shows at once, drawn faintly as "ordered", and turns solid when the soldiers set off.
- **Pairing by invite link and code**, no public lobby to begin with. "Play a friend" gives a link such as
  `frontlines.mkjems.dk/#KX7Q` and a 4-character code that can be read aloud.
- **You are always blue, on your own side.** The maps are mirrored, so each browser draws its own kingdom as
  blue in the usual place. The simulation itself still has team 0 and team 1.
- **No accounts.** An optional name, remembered in the browser.
- **Single player gains from it:** with the same map number, difficulty and orders, a game plays out
  identically. That makes replays (map number plus the list of orders, a few KB), a fair "map of the day"
  and exact bug reports possible later.

## How lockstep works here

- The simulation already advances in fixed steps of 1/40 s (`STEP`, `step()`) and has a seeded random
  generator (`rng`, `rand`). Both are what lockstep needs.
- Ticks are grouped into **turns** of 2 ticks (50 ms). Each browser sends one message per turn with its
  orders for that turn, even when there are none. A browser may simulate turn N only once it has the other
  player's message for turn N.
- An order made now is scheduled for turn *now + delay*, where the delay is about 3 turns (150 ms). It can
  adapt to the connection: shorter on a good line, longer on a jittery one.
- **Desync check:** every second (40 ticks) each browser sends a short checksum of the game state (towns,
  units, gold and so on). If they ever differ, the host sends its full state and the guest takes it over.
  During development a mismatch is logged loudly, because it means a source of difference has slipped in.
- **Reconnecting** uses the same full-state message: the returning player loads it and catches up.
- No fog of war exists, so each player's browser knowing the whole state (lockstep's usual weakness) costs
  nothing.

### Rules for code that affects the battle

Once phase 1 lands, anything that changes the game state must:
- use `rng`/`rand`, never `Math.random()` (visual effects may keep `Math.random()`)
- use the game's own `sin`, `cos`, `atan2` and `exp`, and `Math.sqrt(x*x + y*y)` instead of `Math.hypot`.
  `+ − × ÷` and `Math.sqrt` give identical results in every browser; the other `Math` functions may not.
- never depend on wall-clock time, frame rate or screen size
- change state only through orders (for players and the computer alike), not straight from input handlers

## Phases

### Phase 0: measure (no change to the game)
- [x] A test runs two copies of the simulation side by side with the same map number and the same scripted
      orders, and reports when and where they first differ.
      `cd tests && npm run drift` (or `npm run drift -- valley 120` for one landscape and 120 game seconds).
      It uses two test-only hooks, `__t.freeze()` and `__t.snapshot()`. A full run takes about 15 minutes,
      because once the scripted blue side loses, the enemy grows to about 1,600 soldiers.
      Results on 23 October, map 4821, same window size in both copies:
      - **As is:** the two copies differ from the 1st or 2nd second on every landscape (soldier positions
        first). After 2–4 minutes they're different battles: on River Valley one copy had 155 enemy soldiers
        and the other 303, and in one copy blue still held out.
      - **Seeded** (`Math.random` replaced by the same seeded generator in both, drawing stopped): identical
        for the full 10 game minutes on all ten landscapes, with up to 1,650 soldiers.
      - So within one browser engine, `Math.random` is the only source of difference. Caveat: the scripted
        blue side loses after 2–4 minutes, so the later minutes are mostly the enemy's soldiers alone.
- [x] Compare the maths functions between browser engines. `tests/math-engines.js` runs in Node (V8, as in
      Chrome and Edge) and in macOS's built-in `jsc` (JavaScriptCore, as in Safari and every iPhone browser).
      Over 200,000 inputs each: `Math.sin`, `cos`, `atan2`, `hypot` and `exp` sometimes differ in the last bit
      (in samples: sin 7%, cos 1%, atan2 19%, exp 12%, hypot 33%). `Math.sqrt` and `Math.sqrt(x*x + y*y)` were
      identical every time. Firefox wasn't tested (not installed).
- [x] List every `Math.random()` and `Math.sin/cos/atan2/hypot/exp` call and mark each as simulation or visual.
      By section of `frontlines.html`, simulation (world, town layouts, terrain, economy, territory, routes,
      units, structures, AI, game flow, placing items): random 13, sin 20, cos 13, atan2 0, hypot 83, exp 0,
      sqrt 4. Visual or local (sound, 3D scene, render, input, hover, tips): random 10, sin 30, cos 13, atan2 4,
      hypot 29, exp 3, sqrt 2. Most battle randomness goes through `rand()`, which is `Math.random` once the
      map is built (`rng = Math.random` in `newGame`). The 3D ground already uses its own seeded stream.
- [x] Other sources of difference found while reading:
      - **The board's size comes from the window.** `newGame` sets `W`/`H` from `innerWidth`/`innerHeight`:
        the long side is 1,000–1,500 units depending on the screen, and a portrait screen gets a tall board.
        The same map number gives a different board on a phone and a laptop. A match needs one board size,
        chosen by the host and sent to the guest, with each screen's camera fitting it.
      - `t.smokeUntil` uses `performance.now()`, but only for the smoke effect, so it's harmless.
      - The weekly choices are shuffled with `Math.random`, so the two copies offer different rewards.

Exit: we know how far today's game is from deterministic, and the size of phase 1.

### Phase 1: deterministic simulation
- [ ] Simulation randomness through `rng`. The AI's choices included.
- [ ] Own `sin`, `cos`, `atan2`, `exp`; `hypot` replaced in simulation code. Map generation counts as
      simulation, because both browsers build the map from the map number. (Map numbers will produce
      slightly different layouts once, when this lands.)
- [ ] The board size is a setting of the match, not taken from the window (see phase 0). In single player it
      can keep following the screen.
- [ ] Simulation never reads `performance.now()`, the frame time or the screen size.
- [ ] `checksum()` of the game state.
- [ ] Test: two copies, with native `Math.random` and drawing on, identical checksums on every landscape. In
      `npm test` a few game minutes each, to keep it quick; `npm run drift` for the full 10 minutes.
- [ ] A check that the simulation gives the same results in Safari's engine as in Chrome's: for example, run
      the simulation without drawing in Node and in `jsc` and compare checksums. That needs the simulation
      to run without the page, which ties in with the open question on splitting the file.

Exit: the determinism test passes reliably; single player plays as before.

### Phase 2: everything is an order
- [ ] One function, `order(team, o)`, for every action: route, troop type, purchase, placing a building,
      Charge, weekly reward, reinforcement. Orders are queued for a tick and applied inside `step()`.
- [ ] The mouse and the computer opponent both go through it. In single player orders run on the next tick,
      with no delay.
- [ ] Optional along the way: record the orders of a game and play it back (replays).

Exit: no input handler or AI routine changes the game state directly.

### Phase 3: both sides are equal
- [ ] Per-team economy: gold, purchases, inventory, route ink and weekly rewards per team. Today blue's
      and red's are separate variables (`gold`/`redGold`, `bought`/`redBought` and so on).
- [ ] "Me" is a setting (team 0 or 1), not assumed to be team 0. The HUD, tray, hints, toasts and sounds
      follow "me".
- [ ] Drawing mirrored for team 1 so that player also sees their kingdom as blue on the near side.
- [ ] The computer opponent becomes "a player on team 1" that can be switched off.

Exit: a test can play team 1 by hand while the computer plays team 0.

### Phase 4: the relay server
- [ ] A small Node service with WebSockets: create a room, join with a code, pass turn messages and checksums
      between the two players, hand over full state on reconnect. Rooms hold two players and expire after
      about 30 minutes without activity.
- [ ] Its own container next to the existing nginx one (for example on `127.0.0.1:8084`), with Caddy sending
      `frontlines.mkjems.dk/ws` to it. The Caddy config lives with the VPS setup (`~/Code/infrastructure`).
- [ ] The deploy workflow builds and starts both containers.
- [ ] Network code in the game: connect, send and receive turns, wait for the other player, adapt the delay,
      checksum comparison and resync.

Exit: two browsers on different machines play a whole battle through the VPS.

### Phase 5: the UI
- [ ] Start screen, first step: **Play the computer** or **Play a friend**.
- [ ] Host: picks a map (the existing map step, difficulty skipped), then a waiting screen with the link,
      **Copy**, **Share** (the phone's share menu) and the code in large letters. The map can still be changed
      while waiting, and the guest sees it.
- [ ] Guest: the link opens "Join the battle on *map*", an optional name and **Ready**. Without the link, a
      "Have a code?" field on the start screen.
- [ ] Both ready: a 3-2-1 countdown.
- [ ] In the battle: opponent panel in the HUD (name, connection dot, delay in ms), pause by request, Surrender.
- [ ] End of week: the game pauses for both, each picks a reward, 15 seconds at most.
- [ ] Dropouts: "Waiting for your opponent to reconnect… 30 s", then a win by walkover.
- [ ] End of battle: **Rematch**, a new layout through the same link.

Exit: a friend who has never seen the game can join from a link on a phone and finish a battle.

### Phase 6: try it out
- [ ] Browser tests with two pages against a local relay, including an artificial delay and a dropped connection.
- [ ] Real matches between two people in different places; note the delay and anything that feels laggy.
- [ ] Rules sheet, tips and README updated.

## Open questions

- **Splitting the file into modules** (paused since 22 October): lockstep doesn't require it, but a
  separate simulation file would make phase 0/1 tests and a later Worker easier. Decide before phase 1.
- **Pauses:** must the other player accept, or does each player get a few pauses of their own?
- **Background tabs:** browsers slow hidden tabs, which stalls both players in lockstep. Pause the match when
  either tab is hidden, or run the simulation in a Worker?
- **Phones:** the slower device sets the pace for both. Needs checking on an older phone in phase 6.
- **Later, if there's traffic:** "Find an opponent" (pair the next two waiting), quick messages ("Good game"),
  two players against the computer.
