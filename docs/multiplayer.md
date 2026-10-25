# Multiplayer plan: two players online

The plan for playing Frontlines against another person, agreed on 23 October 2026. Work through the phases
in order. Single player against the computer must keep working, and feel the same, after every phase.

**Current phase:** 6, trying it out. Phases 4 and 5 are deployed (23 October): matches work on frontlines.mkjems.dk,
checked with two browsers through the VPS (about 60 ms round trip). The user is playing and reporting bugs; the
first, the guest's route drawn red while dragging, is fixed. More to come. Bots playing real matches are in
(`npm run matches`, 25 October); the two dropout bugs they found are fixed. Next: real matches between people.

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
- **The mouse never waits for the network.** Drawing routes, snapping, building ghosts, hover highlights,
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

Since phase 1, anything that changes the game state must:
- use `rng`/`rand`, never `Math.random()`. Looks and sound must use `fxRand` or `Math.random()` instead, never
  `rand`, because drawing and sound run differently on each machine (muted, hidden tab, particle limits).
- use the game's own `sin`, `cos` and `hypot`, never `Math.sin`, `Math.cos`, `Math.hypot`, `Math.atan2` or
  `Math.exp`. `+ − × ÷`, `Math.sqrt`, `Math.round`/`floor` and `**` give identical results in every browser.
- never shuffle by sorting with a random comparison (browsers sort differently); use a Fisher-Yates shuffle.
- never depend on wall-clock time, frame rate, screen size or anything left over from an earlier game:
  counters the battle uses (such as unit and route numbers) are reset in `newGame`.
- change state only through orders (for players and the computer alike), not straight from input handlers
  (from phase 2).

The test "two copies of a battle stay identical" in `npm test` catches most slips.

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
- [x] Simulation randomness through `rng`. The AI's choices included.
      After the map is built, `rng` is a seeded stream for the battle (`seeded(mapSeed * 104729 + 13)`), so in
      single player too the same map and the same orders replay the same battle. Visual randomness moved to
      `fxRand`: puffs, sparks, particles, scars, coins, camera shake and bird song all used to draw from
      `rand`, and particles drew a varying amount depending on how many were on screen.
- [x] Own `sin`, `cos`; `hypot` replaced in simulation code (world through placing items: sin 20, cos 13,
      hypot 83). `atan2` and `exp` aren't used in the simulation. `sin`/`cos` are fdlibm's kernels; in
      V8 and JavaScriptCore they give bit-identical results, within one rounding step of `Math.sin`/`cos`.
      Map numbers did **not** change: 30 layouts checked (10 landscapes × 3 map numbers) are identical.
- [x] The board size is a setting of the match, not taken from the window (see phase 0). In single player it
      can keep following the screen. `board = { w, h }` (a window size) in `newGame`; `__t.board()` sets it.
- [x] Simulation never reads `performance.now()`, the frame time or the screen size.
      Also found: unit numbers, route numbers and the step counter weren't reset between games, and soldiers
      look for enemies on the tick given by `(u.id + frameNo) % 5`. So a copy that had played another game
      first (a rematch) drifted. Now reset in `newGame`.
- [x] `checksum()` of the game state, by part (clock, towns, units, economy, buildings, enemy plan).
- [x] Test: two copies, with native `Math.random` and drawing on, identical checksums on every landscape. In
      `npm test` a few game minutes each, to keep it quick; `npm run drift` for the full 10 minutes.
      `tests/twins.mjs` runs both copies with different windows (laptop and portrait phone) and history (one
      plays another battle first). In `npm test` 45 game seconds per landscape (it took 3½ minutes on GitHub at 90). Checked that it fails if the
      counter reset or one `rng()` in the AI is undone.
      Full run on 23 October (`npm run drift`): identical for 10 game minutes on all ten landscapes, up to
      1,650 soldiers.
      Each copy runs in its own browser profile with the same saved settings; see phase 3 for why.
- [x] A check that the battle comes out the same in Safari as in Chrome. Done with real Safari, not by
      splitting the file: `cd tests && npm run safari` (macOS only) runs the twins with one copy in Chrome and
      one in Safari, controlled through `safaridriver`. Safari's automation must be switched on once:
      `sudo safaridriver --enable`, and in Safari's settings "Show features for web developers", then under
      Developer "Allow remote automation". Safari must be closed, or at least have no dialog open, or the
      session times out. Run from Claude Code, the command needs to run outside the sandbox to start Safari.
      Results on 23 October: identical for 10 game minutes on River Valley, Great Lake, Two Rivers, Mountain
      Pass and Open Border, and for 2 game minutes on the other five. That's slow: about 15 minutes per
      landscape at 10 game minutes, as Safari draws the full game. As a check that the test can catch a
      difference, switching the game back to `Math.sin`/`cos`/`hypot` made Chrome and Safari differ from
      second 6. Firefox is still untested (not installed).

Exit: the determinism test passes reliably; single player plays as before.

### Phase 2: everything is an order
- [x] One function, `order(team, o)`, for every action: route, troop type, purchase, placing a building,
      Charge, weekly reward, reinforcement. Orders are queued for a tick and applied inside `step()`.
      The section "orders" in `frontlines.html`. Order types: `route` (a drawn route, a target town or point,
      or none to clear it, with `recall` to send marching soldiers home), `group`, `train`, `charge`, `build`
      (bridge, barracks, farm, watchtower) and `reward` (the weekly reinforcement). Orders are plain
      data: towns by name, soldiers by id, bridges by index, points as x/y. While the battle stands still
      (paused, or the weekly choice) the player's orders are carried out at once, which gives the same result,
      since no step comes between. `build` checks the player's order again when it's carried out.
- [x] The mouse and the computer opponent both go through it. In single player orders run on the next tick,
      with no delay.
      The computer runs inside `step()` alike on every copy, so it calls `carryOut(1, o)` and its orders take
      effect at once, with the same rules as the player's. Its behaviour is unchanged.
- [x] Optional along the way: record the orders of a game and play it back (replays).
      `orderLog` holds the player's orders as carried out, each with the step it came before; the test hooks
      `__t.record()` and `__t.replay()` use it. The test "a battle replays exactly from its orders" plays a
      game with the mouse in real time (route, troop type, watchtower, Charge, weekly reward), replays the
      record in a fresh copy and compares checksums. It found a last `rand` in the birdsong, which drew from
      the battle's stream every frame; the twins test can't see that, as frozen copies play no birdsong.
      A record needs the map: `land` and `map` are part of it (and in a match, the board and settings).

Exit: no input handler or AI routine changes the game state directly.

### Phase 3: both sides are equal
- [x] Per-team economy: gold, purchases, inventory and weekly rewards per team. Today blue's
      and red's are separate variables (`gold`/`redGold`, `bought`/`redBought` and so on).
      Now `gold`, `bought`, `inventory` and `chargeCd` are arrays by team, with
      `priceOf(team, k)`, `goldPerSecond(team)` and `placeCheck(team, kind, p)`. The enemy's free
      bridge on Broken Bridges is an ordinary bridge in its tray. Orders follow the same rules for either team;
      a player's are checked again when carried out (`carryOut(team, o, check)`), the computer's aren't, as it
      only picks allowed moves. Weekly rewards: every side played by a person gets its own two offers
      (`offers[team]`), and the next week begins once all have chosen.
- [x] "Me" is a setting (team 0 or 1), not assumed to be team 0. The HUD, tray, hints, toasts and sounds
      follow "me".
      `me` is the team this browser plays. The interface, tips, hover info, toasts, sounds, the end of the game
      and the end-of-game stats compare with `me`; so do gathered groups you can drag. The capitals' names are
      fixed per side (`CAPITAL`). The one rule that differed by team now depends on who plays it: the computer's
      soldiers follow their town's current orders, a person's keep the route they set out on.
- [x] Drawing mirrored for team 1 so that player also sees their kingdom as blue on the near side.
      Not a mirror image but a half turn, as the maps are point-symmetric: the camera looks from the north
      (`VIEWDIR`), and `paintTeams()` swaps the two entries of every team palette (`COL.team/light/mid`, `KEEPC`,
      `TEAMC`, `LIGHTC`, `ROUTE`, `CHEVRON`), so code that colours by team needs no change; "mine" is
      `COL.team[me]`. The territory wash flips sign and the sun turns with the camera. Found along the way: the
      sun's `target.position.set()` sat inside a comment in `fitCamera`, so it shone at the board's corner and
      its direction depended on the board's shape: on a phone's tall board the river never caught the light.
      Now it's aimed at the centre from a fixed direction (what a 1280×800 window had), so desktop looks the
      same and phones get the river's highlights.
- [x] The computer opponent becomes "a player on team 1" that can be switched off.
      It plays `match.ai` (0, 1, or -1 for none) against the other team; the AI code uses `aiTeam`/`aiFoe`
      instead of 1/0. Checked: against an idle opponent it takes the whole map as blue just as it does as red.
      A browser never plays the computer's side: `newGame` moves `me` if needed.
- [x] Settings that change the battle are settings of the match, the same for both players, not read from
      each browser's saved settings: difficulty (`D()` also sets blue's training speed), classic towns, and the
      tutorial (a player who hasn't finished it gets a 25-second grace before the first enemy push, `aiT`).
      Found in phase 1, when a copy that had finished the tutorial drifted from one that hadn't.
      `match = { ai, difficulty, classic, grace }`. In single player `newGame` builds it from this browser's
      settings (and a difficulty picked afterwards updates it); `presetMatch` fixes it instead (`__t.match()` in
      tests; the host, later). Records carry it, and the twins no longer depend on saved settings. With no
      computer, both sides train at the same speed.

Exit: a test can play team 1 by hand while the computer plays team 0.
Done: the test "playing red by hand while the computer plays blue" draws a route, builds a watchtower and takes
the weekly reward with the mouse in the turned view, while the computer takes towns as blue.

### Phase 4: the relay server
- [x] A small Node service with WebSockets: create a room, join with a code, pass turn messages and checksums
      between the two players, hand over full state on reconnect. Rooms hold two players and expire after
      about 30 minutes without activity.
      [server/relay.mjs](../server/relay.mjs), with the `ws` package. A rejoining player gets every turn so far
      and replays them, instead of a full state: the battle is deterministic, so that's exact, and it spares
      writing the whole game state out and back in. Each player has a key to rejoin with; a code can't be
      joined by a third person, even while the guest is away.
- [x] ~~Its own container next to the existing nginx one (for example on `127.0.0.1:8084`), with Caddy sending
      `frontlines.mkjems.dk/ws` to it. The Caddy config lives with the VPS setup (`~/Code/infrastructure`).~~
      Simpler: the one container now runs the Node server, which serves the game's files as well as the relay
      on `/ws`. Same image name, port 8080 inside, 8083 outside, so `compose.yaml` on the VPS and Caddy (which
      passes WebSocket connections through) need no change. The image runs as the `node` user and stops cleanly.
- [x] The deploy workflow builds and starts both containers.
      One container; the workflow now also installs the server's package and runs the match tests.
- [x] Network code in the game: connect, send and receive turns, wait for the other player, adapt the delay,
      checksum comparison and resync.
      The section "two-player matches" in `frontlines.html`. Turns of 2 steps (50 ms); each browser sends its
      orders for 3 turns ahead (150 ms) and runs a turn only once both players' orders are in. Checksums every
      20 turns (half a second). Not done: adapting the delay (fixed at 3 turns for now), and repairing a
      mismatch (it's reported; it would mean a determinism bug, to be fixed rather than papered over).
      While waiting for the other player the hint says so, and the battle holds still for both.
- [x] Orders waiting in the queue are drawn: a route faintly until it takes effect. In single player the wait
      is one step (25 ms) and invisible; with the network delay it's 100–150 ms.
- [x] Tests: `tests/match.test.mjs` starts the server on a free port; a host on a laptop and a guest on a
      phone play through it, each drawing a route. They check that both games get both routes, that
      checksums are compared and agree, that it holds with 60 ms added to every message, and that a player
      who drops out holds the battle still, rejoins, replays and carries on in sync.

Found: the board's shape is the host's window, so a laptop host and a phone guest play on a wide board that
looks small on the phone. See the open questions.

Exit: two browsers on different machines play a whole battle through the VPS.

### Phase 5: the UI
- [x] Start screen, first step: **Play the computer** or **Play a friend**.
      "Play a friend" sits beside "Choose a map", with "Have a code from a friend?" below for joining without
      a link.
- [x] Host: picks a map (the existing map step, difficulty skipped), then a waiting screen with the link,
      **Copy**, **Share** (the phone's share menu) and the code in large letters. The map can still be changed
      while waiting, and the guest sees it.
      The map step's button becomes "Invite a friend ›"; the waiting card has a name field too.
- [x] Guest: the link opens "Join the battle on *map*", an optional name and **Ready**. Without the link, a
      "Have a code?" field on the start screen.
      The link (`#CODE`) opens a welcome card with a name field and "Join the battle"; once joined it names the
      map, with the host's map drawn behind it. A link pasted into an open tab works too, and a tab that was
      already in that match rejoins it (after a reload, say).
- [x] Both ready: a 3-2-1 countdown.
      Simpler: the host presses "Start the battle" once the guest has joined; both then count down.
- [x] In the battle: opponent panel in the HUD (name, connection dot, delay in ms), pause by request, Surrender.
      The opponent's chip replaces the speed button (no speeds in a match), and the difficulty panel is hidden.
      Pausing is an order: either player pauses or resumes both battles on the same turn (a `held` flag, not
      the local `paused`). "Give up this battle" is in the Rules sheet, also an order. The first-game tutorial
      is left out of matches: it's written for blue against the computer.
- [x] End of week: the game pauses for both, each picks a reward, 15 seconds at most.
      After choosing: "Waiting for Bo to choose…". The limit is counted in turns (`WEEK_PICK`), so both
      browsers agree when the first reward is picked for a slow player.
- [x] Dropouts: "Waiting for your opponent to reconnect… 30 s", then a win by walkover.
      The relay then marks the game over, so a late rejoin is told so.
- [x] End of battle: **Rematch**, a new layout through the same link.
      Once both press it. "Leave" goes back to the start screen.

Found on GitHub's slow machines after deploying: a player who finished the countdown later than the other
(a slow phone) cleared the other's first turns on starting, and both waited forever. Turns are now collected
from the moment a match is announced, and turns and checksums carry the match's id, so a late one from before a
rematch is ignored. The first match test makes the guest's countdown slow (`&count=700`) to cover it.
Board shape: the host's window, unless one screen is tall and the other wide; then a square board (1000 × 1000)
suits both. Tests can shorten a week, the time away, the weekly limit and the countdown with `?test&week=2&away=2&pick=60&count=700`.
Tests: "playing a friend through the screens" (invite, join by link, a map change seen by the guest, start,
pause and resume, give up, rematch), the weekly choice with its limit, and a walkover.

Exit: a friend who has never seen the game can join from a link on a phone and finish a battle.

### Phase 6: try it out
- [x] Browser tests with two pages against a local relay, including an artificial delay and a dropped connection.
      [tests/match.test.mjs](../tests/match.test.mjs) has six short, scripted matches (join, a few route drags,
      120 ms round trip, a slow phone, drop and rejoin, the weekly choice and its limit, walkover, rematch) and a
      short bot match (next step). The helpers for two players are in [tests/players.mjs](../tests/players.mjs).
- [x] **Bots playing real matches** (agreed 25 October 2026). Each browser runs a computer player for
      its own side that sends its orders through the relay like a person's clicks, so whole matches can be played
      many at a time and checked: in sync to the end (checksums), the same winner on both screens, no stalls, no
      page errors.
      - Start from the stand-in (`match.standin`, `makeAI` in frontlines.html, built for tests/balance.mjs): it
        already plays the person's side by the person's rules, at a person's pace (one order every 1.5 s).
      - The catch: `makeAI` draws from the battle's shared stream (`rng`, and `rand`, which uses it; about 11 calls:
        `pickTarget`, `chooseRedKinds`, `aiSpot`, the 50% "help a threatened town" roll). A bot runs in only one
        browser, so it must have its own stream (a `seeded(...)` of its own, or `fxRand`), or the two browsers
        drift apart at once. The computer in single player must keep using `rng`, so single player is unchanged.
      - Its orders must go through `order(team, o)` (sent to both browsers for a turn ahead) instead of
        `carryOut` in `carryOutNext`, and its weekly choice through `order(me, { type: 'reward', key })` instead
        of the direct `ORDERS.reward` call in `offerUpgrades`. Orders land `DELAY` turns (about 150 ms) later, so
        `changes()` may see an order as not yet done; the 1.5 s pace covers it, but check it isn't sent twice.
      - Harness: reuse `player()`, `match()`, `until()` and the relay's `start({ port, site, delay })` from
        match.test.mjs. Matches run in real time (turns of 50 ms), so run several side by side (say 8 pairs, on
        different maps) for 5 to 10 minutes. A separate command, `npm run matches`, prints per match: in sync or
        the turn it diverged, the winner on each side, the game length, stalls, errors. A short version (one bot
        match for about a minute) goes into `npm test`.
      - Rough conditions on top: delay and jitter on the relay, a player dropping out and rejoining mid-game, CPU
        throttling (a slow phone), a hidden tab, a slow weekly choice, a rematch at the end.
      - Bots won't find bugs in mouse and touch handling (like the guest's route drawn red), since they send
        orders directly; those stay with scripted-input tests.
      Done 25 October. `?test&bot` (or `&bot=20`: 20 game seconds over each weekly choice) makes a bot of this
      browser's side: `makeAI(me, Math.random)`, kept out of `ais` so it isn't in the checksum, run once per turn
      from `runTurn` (`botTurn`), not while a rejoining browser replays. `&speed=3` runs turns 3 times faster than
      real time, so a whole match takes 2–4 minutes. The relay takes `jitter` too (messages stay in order).
      `npm run matches` plays one match per scenario side by side: plain, lag (40–120 ms), drop (the guest's line
      down 8 s, twice), gone (down 40 s: a walkover), slow (guest's CPU ×4), hidden (host's tab frozen 10 s),
      reload (guest, then host, reloads), pick (the guest's weekly choice made for them), rematch. About 5 minutes
      for all nine. "hidden" freezes the page through CDP; headless Chrome then leaves it hidden (no frames) until
      `Emulation.setFocusEmulationEnabled`, which stands for the player looking at the tab again.
      `npm test` has the short version: 60 game seconds at double speed with a drop and rejoin (34 s).
      Checked that it catches the bot drawing from `rng`: out of sync at turn 140.
      First run: plain, lag, drop, slow, pick and rematch played whole matches in sync, with the same winner on
      both screens, no stalls and no page errors. Two bugs found, both about losing the connection:
- [x] **A lost connection never comes back by itself.** Found by "hidden": when a player's socket closes (a frozen
      tab; on a phone, switching apps often does the same), nothing reconnects. Their battle stands still with
      "Lost the connection to the game server", the other player wins by walkover after 30 s, and the stuck player
      is never told. The existing rejoin works, but only the test hook (`netRejoin`) or a reload starts it.
      Fixed: `netConnect` opens the connection again (after 0.5, 1, 2, 4 s, then every 5 s) and rejoins. The
      page still has its battle, so it doesn't replay: it takes the turns it missed from the catch-up and sends
      again its own that never reached the relay (`net.mine`, the last 200 it sent). Back after the walkover, the
      relay answers `error {over}` and the player sees "You were away too long". Test hooks: `netDrop` (the line
      stays down until `netUp`), `netBlip` (the connection drops once).
- [x] **A host who reloads can't get back in.** Found by "reload": a guest's address has `#CODE` (from the link,
      or the code box), so a reload rejoins; the host's has none, so `fromLink` never runs and the host loses by
      walkover. The rejoin key is in sessionStorage already.
      Fixed: both players' addresses get `#CODE` once they have a room. A reload while the host is still
      inviting brings back the invitation (or the guest's welcome card): the catch-up now carries the lobby.
- [ ] Smaller: after a walkover the winner's hint still reads "Waiting for Ann…".
      - Safari later: real Safari through `safaridriver` (as [tests/safari.mjs](../tests/safari.mjs) does for the
        twins; the iPhone's engine, but macOS only, a visible window, one at a time), or Playwright's WebKit
        (headless and parallel, also on GitHub's machines, but not Safari itself, and a new dependency).
- [ ] Real matches between two people in different places; note the delay and anything that feels laggy.
- [ ] Rules sheet, tips and README updated.

## Open questions

- **Splitting the file into modules** (paused since 22 October): lockstep doesn't require it, and the Safari
  check was done in real Safari instead. Decided on 23 October to stay in the single file for now; revisit if
  the simulation needs to run in a Worker (see Background tabs).
- **Pauses:** must the other player accept, or does each player get a few pauses of their own?
- **Background tabs:** browsers slow hidden tabs, which stalls both players in lockstep. Pause the match when
  either tab is hidden, or run the simulation in a Worker?
- ~~**Board shape in a match:** it's the host's window.~~ Decided in phase 5: the host's window, or a square
  board when one screen is tall and the other wide.
- **Phones:** the slower device sets the pace for both. Needs checking on an older phone in phase 6.
- **Later, if there's traffic:** "Find an opponent" (pair the next two waiting), quick messages ("Good game"),
  two players against the computer.
