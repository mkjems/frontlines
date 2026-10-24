# Ideas

Ideas for Frontlines that have been discussed but not built yet, collected on 23 October 2026. Each has
enough detail to pick it up without the original conversation. The **Decided against** list at the end
records ideas that were tried or weighed and dropped, so they aren't proposed again.

## Next up: formations for the three troop types

The three types differ mostly in numbers today, so a big army of archers fights much like a big army of
spearmen. The aim is to give each type something it can only do **as a group**, without breaking the core
rule that the player never commands individual soldiers: formations form by themselves when enough
soldiers of one type gather together (at the end of a route on open ground, or as a town's garrison).

Agreed order: archers first (the most visible), then spearmen (so archers have something to stand behind),
then cavalry.

1. **Archers: volleys.** About 8 or more archers standing together stop shooting one by one and fire
   volleys: every few seconds the whole group looses a swarm of arrows in a high arc at the densest enemy
   cluster in range.
   - Range about double a single archer's, so they hit an army before it arrives.
   - Damage spread over an area, so tight blocks suffer most.
   - Counters: woods still halve arrow damage, and cavalry that reach the archers wreck them.
   - Visuals: a cloud of arcing arrows (the instanced 3D arrows in the FX module already exist) and a
     whistling sound.
2. **Spearmen: shield wall.** 8 or more spearmen standing still close ranks into a tight block facing the
   nearest enemy.
   - They take about 35% less damage.
   - Cavalry charging into the wall get hurt instead of dealing triple damage.
   - A formed block moves slowly and loses the formation when it marches.
   - Visuals: the soldiers line up in visible rows.
3. **Cavalry: raids and hit-and-run.**
   - Raids: a group of 6 or more sent deep into enemy land goes for the economy. They burn farms (smoke,
     and the farm stops earning for a while) and raid mines, stealing gold, avoiding big fights on the way.
   - Hit-and-run: after a charge they pull back a short way and charge again, so the triple-damage charge
     keeps coming.
   - Visuals: a wedge, with dust behind.

Around all three:
- Hovering over a formed group (Shift) shows what it does, for example "Archer company · volley every 4 s".
- The enemy uses formations too. Its habit of countering the player's most common troop type then matters more.
- Rules sheet, tips and browser tests need updating, and fights will need balance tuning.

Each formation is roughly one focused session.

## Sound

- **Fanfare and cheering when you take the enemy capital** ([GitHub issue #5](https://github.com/mkjems/frontlines/issues/5)).
  Today `Sound.victory()` plays a short synthesized sound. All sound is made in code, with no audio files.
  - Synthesized option: a rising brass-like fanfare (layered sawtooth tones through a filter) with a crowd
    cheer made of filtered noise swelling underneath. Sounds game-like rather than orchestral.
  - Recorded option: a short fanfare and cheer from a free sound library, added as audio files. More real.
    The first audio files in the project, so `build.sh` and the Docker image would need to carry them.

## Visual polish (the dark board)

The project keeps one dark colour scheme (see Decided against). Ideas that were listed and not done yet:
- **Living water:** the river got its own shader on 24 October (dark and cold, with ripples flowing downstream,
  foam and lapping waves along the banks, and white water over the fords). Still open: foam and a wake
  round bridge piers and the ruined piers on Broken Bridges.
- **Battle readability:** a brief bright flash where groups clash, and fallen soldiers fading into small
  dark marks, so the front lines show.
- **A hint of winter:** a light frosting on roofs, pines and hilltops, keeping the board dark.

## Maps and levels

There are ten landscapes, random but mirrored layouts with map numbers, and a Classic towns option.
- **A campaign of designed levels:** a fixed sequence that unlocks one by one, each a chosen landscape and
  map number plus special rules, for example: start outnumbered; hold out for 6 weeks; the enemy has two
  capitals; no bridges (build your own). The game would remember which levels are beaten.
- **A map of the day:** everyone gets the same map number on the same date.
- **A completely bare Steppe:** no roads and no hills at all, if The Steppe should be even emptier.
- **Borderlands:** an open map with a few patches of woods and bogs as soft cover instead of hard barriers.
- **Sparser roads everywhere:** Open Border and The Steppe turned out fun partly because of fewer roads. Other
  maps could link each town to one neighbour instead of two (the `roads` setting per landscape).
- **Roads to new bridges:** roads are laid out once when a map is made, so bridges built during a game
  (Broken Bridges especially) get no road and no road speed bonus.
- **Balance per landscape is untested:** gold income varies a lot between landscapes (Highlands earns about
  half of River Valley), so difficulty differs from map to map. Worth playing whole campaigns on each.
- **Watch The Greenwood's performance:** about 2,000 trees, the most the game draws. Thin it if phones struggle.

## The fort needs a real job

From play (23 October 2026) the fort doesn't seem to be of any use, and the code agrees. Its only effect
is that soldiers of its side inside its 80 px circle take 55% less damage (`defense()`), plus a bit of
territory tint, the same as a watchtower's. Why that rarely matters:
- Nothing brings soldiers into it. They fight where routes and armies meet, so you'd have to park a group
  there on purpose.
- The enemy doesn't need to go through it: the AI walks to a target town and passes a fort by.
- Near your own towns soldiers already take 40% less damage, so a fort there only adds 0.6× → 0.45×.
- The watchtower (40 gold) shoots by itself, needs no soldiers and reaches across the river; the fort
  costs 60 and does nothing without a garrison.
- An empty fort changes sides when 8 enemies crowd it, and then protects them at your bridgehead.
- The wording disagrees: the upgrade card says "half damage", the info box "55% less damage", the
  Rules sheet "55% tougher".

Lighter options discussed, none chosen yet:
- **Healing post:** your soldiers inside slowly get hit points back. Nothing heals today, so it becomes the
  place to pull a worn army back to.
- **Rally point:** idle soldiers nearby walk into it by themselves, so it's manned and harder to take.
- **Remove it:** fold the protection into the watchtower, or replace the fort with another building.

## The enemy

- **Smarter on open maps:** its planning was written around bridges. On Open Border and The Steppe it could
  split into two armies and try to flank instead of striking at one target.
- **Charge for the enemy:** the enemy has no Charge. It could charge when its army meets the player's.

## The computer against the computer

Discussed on 24 October 2026, after the [design review](designreview.md). Both sides played by the computer,
in three steps, each worth having on its own:
1. **A balance runner:** both sides computer-run, played many times at full speed in headless Chrome (like
   the tests), reporting win rates per side and landscape, game length in weeks, which troop type wins each
   pairing, and gold per week. It turns the review's "to check" items into numbers and checks every balance
   change afterwards. Needs the AI's single-side assumptions lifted: `match.ai` names one team, and `plan`,
   `redBuys` and `aiT` are single values.
2. **A battle behind the start screen:** a live computer-vs-computer game on the board while the start screen
   is up, so visitors see armies clash before learning a rule.
3. **A watch mode**, only if 1 and 2 show it's fun to watch. The scripted AI plays much the same way every
   time, so it needs personalities (aggressive, economic, turtling), a camera that follows the biggest fight,
   and a speed control. The personalities are the real work.

The computer has to play by the player's rules first (done 24 October: no turning armies on the march, route
ink, the same building checks), or the numbers from 1 won't describe the real game.

## Visitor analytics

Options weighed for counting visitors (none set up yet):
- **Server logs only:** turn on access logging for frontlines.mkjems.dk in Caddy and read them with
  GoAccess. No change to the game, no cookies, but it counts requests rather than people and can't see
  inside the game.
- **Recommended: self-hosted cookieless analytics** on the VPS, e.g. GoatCounter (one small container with
  SQLite) or Umami (nicer dashboard, needs Postgres), at something like stats.mkjems.dk for all the
  mkjems.dk sites. No cookies, so no cookie banner in the EU. Custom game events are the real prize:
  games started (landscape, difficulty), victory or defeat and in which week, how far people get in the
  tutorial. Best set up through `~/Code/infrastructure` so it's reproducible.
- **Hosted:** Plausible (paid), GoatCounter's free hosted plan, or Cloudflare Web Analytics. Avoid Google
  Analytics (needs a cookie banner, overkill).

## Human against human

Being planned: see [multiplayer.md](multiplayer.md) (lockstep, invite links, phases). Notes on splitting the
file into modules, kept for when that question comes up: a first pass (`src/` files such as `sound.js`,
`world.js`, `units.js`, `ai.js`, `render.js`, concatenated in order by `build.sh` into the same single page)
was built and verified identical, then reset unpushed. The deeper step is a game-state object, because many
module-level variables are reassigned across sections (`towns`, `units`, `W`, `H`, `P`, `state`, `view`).

## Tooling

- **Install the GitHub CLI** (`brew install gh`, then `gh auth login`) so an agent can read deploy logs,
  including failed test runs, and issues without the 60-requests-an-hour limit for unauthenticated use.

## Decided against

- **Summer and winter themes:** a light summer board was built and dropped. Two themes doubled every visual
  decision. The project keeps the one dark board.
- **Peek on the start screen:** replaced by the three-step start, whose map step shows the board anyway.
- **Old Forest and Open Plains landscapes:** removed. The Greenwood and The Steppe cover them better.
- **The fort as a gate:** a fort that snaps to the end of a bridge, ford or pass and blocks enemies until
  they break it (hit points), so they must break through or use another crossing. Not to be built in that
  form (23 October 2026).
- **Removing the bridges from River Valley:** kept as the classic, beginner-friendly map; Broken Bridges
  does the no-bridge game instead.
