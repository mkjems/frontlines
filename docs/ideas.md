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

**Done first (24 October 2026): companies, the shared formation layer.** Every half second (`formCompanies`)
the soldiers gathered at a route's end (both sides) are counted up by route; routes ending within 50 make one
company, and 6 or more (`FORM_MIN`) form up. A company faces the nearest enemy within 320, else along its
route's last stretch, and only turns for a change of more than 30°. Each soldier gets a place (`u.slot`):
spearmen in close ranks at the front, archers in staggered lines behind, cavalry in a wedge on each wing. A mixed
group sorts itself that way. If places land in a river or on a crag, the whole formation steps aside (up to
60) to where fewest are blocked, staying on its bank. Standing soldiers turn the way the company faces, and a
banner stands over its middle. Shift over it describes it. `__t.companies()` reports companies for tests.
- Decided: garrisons don't form up (for now), since towns already give 40% protection; mixed groups sort themselves.
- Learned: deep formations got picked apart. Archers attacking a standing cavalry wedge stopped at the tip,
  out of the rear riders' sight, and won where they used to lose. So a company fights as one: while any member
  fights, the rest search for enemies across the company's radius too (`co.fight`). The duels came back to their
  old results, except that archers attacking cavalry is close either way (riders win with 2 to 9 left).
- Learned (later the same day): that last pairing was flaky (lost 2 runs in 5), and lost every time once the
  duel test was made repeatable. A wedge with riders 11 apart is about 55 deep, so it reached archers piecemeal.
  Riders now stand 8.5 apart, knee to knee: cavalry win again on every test map, by 4 to 9, as before formations.
- For tuning the next steps: `__t.duel(kindA, nA, kindB, nB, meet)` stages fights on open ground, and the
  defending side forms a company, so formation against formation can be measured.

**Done (24 October 2026): archer volleys** (`stepVolleys`). A company with 8 or more archers (`VOLLEY_MIN`)
shoots together every 4 s (`VOLLEY_T`) at the thickest crowd of enemies within 170 of its archers
(`VOLLEY_R`), each archer two arrows in a high arc; the arrows land after 1–2 s, scattered over a circle of 18,
and each hurts the enemy it lands on (within 4.5), so dense blocks suffer most. Archers keep shooting one by one
too; a volley takes the place of an archer's next shot. Enemies already at close quarters with the company's
side aren't aimed at. Arrows that land stay stuck in the ground for a few seconds, and a volley has its own sound.
`__t.standoff(kindsA, nA, kindsB, nB, gap)` stages two armies standing apart; `__t.volleys()` counts volleys.
- Learned: the range had to be well beyond the 100 at which standing soldiers go out to fight (130 hardly ever
  fired), so it's 170 rather than "double an archer's 44".
- Learned: with perfect aim ahead of the target, one volley on charging cavalry flipped cavalry-attacks-archers
  (riders won with 8–10 left, then lost 2 maps in 4), because damage spread over every rider makes them die
  to the next arrows. Volleys now aim only half as far ahead as the crowd will move, so cavalry mostly outrun
  them, a marching block takes them in its rear ranks, and a standing army takes them all. All duels are back to
  their old results; spearmen attacking archers now lose by more.
- Seen in a full game: an archer company parked 150 from an enemy town shells its garrison, and the computer
  answers by sending troops at it. The computer's own companies fire few volleys, since it rarely stands within
  170 of the player's armies. Worth watching in real games: whether players can use river banks to shell the
  computer's armies gathering at bridges.

**Done (24 October 2026): the shield wall** (`ofWall`, `inWall`). A company with 8 or more spearmen
(`WALL_MIN`) holds its ground: its spearmen wait in their places for spearmen and cavalry and step back into
place when pushed out, but go out after archers. Those in their places fight two ranks deep against spearmen
and cavalry (reach 17 instead of 8.5), take 65% of the damage in hand-to-hand fighting (`WALL_GUARD`), are hardly
pushed back, and a rider whose charge hits them takes 1.5 damage and is thrown back. Arrows hurt a wall as much
as anyone. Braced spearmen lower their spears and crouch; blows on the wall throw sparks and clang. "A formed
block moves slowly" wasn't needed: a company breaks up as soon as it's sent on. `__t.walls()` counts spearmen in
walls; `__t.standoff(…, attack)` marches blue on red.
- Learned: holding ground alone made the wall weaker, not stronger. Only the front rank fought while attackers
  wrapped round the block, and spearmen pushed out of place broke off to fight on their own. Stepping back into
  place and the second rank's reach fixed it. Against 33 standing spearmen: 33 attackers now lose every time (by
  8 to 20; before, the defenders won 5 in 6 by 1 to 13), 40 attackers are even (they used to win by 15 to 20),
  50 win; 20 riders leave 30–31 of the spearmen standing (25–28 before).
- Learned: with reach against everyone, archers and spearmen marching to meet each other (both stand at the
  same spot) gave the spearmen one map in 6. Reach now applies only against spearmen and cavalry, and archers
  win every such meeting again.

**Done (24 October 2026): cavalry ride out, and hit and run** (`rideOut`, `u.wheel`). Raids are still to do,
after the catapult team (see below).
- Riding out: a company with 6 or more riders (`RIDERS_MIN`) rides out at enemy archers and cavalry attacking
  its side within 200 (`SALLY_R`), hand to hand or shooting, and comes back to its place when they're dead or
  gone. It leaves spearmen alone. 28 archers attacking a wall of 24 spearmen with 12 riders standing 150 to the
  side used to win every time with 18–23 left, the riders standing idle; now red wins 4 maps in 6.
- Hit and run: riders of such a company, after charging other riders or anyone who stood the charge, wheel off
  about 50° to one side for 1.4 s and charge again. `__t.riding()`, `__t.wheeling()` and `__t.company()` help test it.
- Learned: hit and run as first described (wheel after every charge) did nothing you could see. A charge
  kills outright almost always (triple damage beats a rider's 3 and an archer's 2 hit points), and cavalry
  fights are over in about 1.5 s. Wheeling away from archers even lost riders the fight: it took them out of
  the melee, where archers are weak, into arrow range. So riders wheel only after charging riders (a standing
  cavalry company is then worth about 25% more against cavalry) or a target that survived, which will happen
  more as the computer's soldiers gain hit points over the weeks. Riding out was added to give cavalry a role
  you can see.

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

## Next up: the catapult team

Agreed on 24 October 2026, before cavalry raids (which wait until after it). A fourth kind of force: a heavy
catapult pushed along by a team of men. It moves very slowly and can't defend itself, but its stones fly high
and far and break what nothing else in the game can damage: town defences, city walls and bridges. It reloads
slowly.

How it fits the game:
- **Bought, not trained.** It's bought in the tray (around 120 gold, 50% more for each repeat like the other
  items) and placed in one of your towns. From there you draw its route like an army's, and its team pushes it
  slowly along, the last stretch towards the target included. At most one or two alive per side.
- **Aimed by its route.** A route ending on an enemy town makes it stop at its range and bombard the town; a
  route ending on a bridge bombards the bridge. No new command: the player still never commands individual
  soldiers. It has a minimum range, so it needs an escort (a shield wall in front is the natural one).
- **Towns are not destroyed** (decided: not to begin with). A hit knocks a big piece off the town's defence
  (its strength) and kills part of its garrison; about three hits leave it open for infantry to walk in. On a
  capital the stones breach the city wall first. Taking towns stays the core of the game.
- **Bridges are.** A broken bridge leaves ruined piers (as on Broken Bridges), soldiers on the deck fall into
  the river, routes find another crossing, and the tray's bridge is the way to rebuild. Bridges are used by
  both sides, so this is a choice, not a free win.
- **Capture:** enemies that reach a catapult whose team is dead or gone take it over, and it turns their colour.
  "Vulnerable" has a real price for one side and a prize for the other.
- **"Time freezes" as a short slow motion,** not a full stop: about a second, the camera following the stone,
  only for hits on a town, bridge or wall that are on screen. Ordinary shots fly normally. A full freeze on every
  shot would interrupt route drawing, get old with several catapults, and can't work in two-player lockstep
  unless both screens freeze together (so it stays visual only, or happens on both at once).
- Counters: cavalry riding out at it, any attack on its team. The computer should both use catapults and hunt
  the player's.

**Done (24 October 2026): step 1, the catapult team** (`stepEngines`, `engines`, `stones`). Bought in the tray
(120 gold, `CAT_MAX` 2 alive per side) and built beside one of your towns, facing the nearest enemy town, with a
team of 4 (`CREW`) who walk out of the town to it. Its team are real soldiers (spearmen, `u.crew`) with places
round it (`SEATS`): two push at the back, two at the wheels; they fight only enemies within 24 and never enter
towns. Dragging from it draws its route (free, like a gathered army). It moves at 35% of a spearman's speed
(`CAT_SPEED`), slower with men missing or out of place, and stops once the town its route ends on is within
215. Standing, it sets up for 2.5 s, then throws every 10 s (`CAT_RELOAD`; slower with men missing, and it needs
2 men) up to 230 (`CAT_RANGE`) but not under 60: at its target town, else an enemy catapult, else the nearest
enemy town, else the thickest crowd of 4 or more. A stone flies 2–3 s in a high arc with a dust trail, a shadow
and a ring where it will land; it crushes enemies within 14 (6 damage at the centre) and wrecks a catapult it
lands on. A hit on a town takes 30% of its strength (15% off a capital) but never below 1, and stops it
recovering for 12 s (`t.stun`), so three hits leave a town at 10%. Places left empty fill from idle soldiers of
its side within 50 (at home or gathered, not cavalry); a catapult with no team is taken by enemies within 30
when none of its side is within 60, and they become its team. The computer sends the nearest town's soldiers at
an enemy catapult that comes within 290 of one of its towns. `__t.siege`, `__t.engines`, `__t.shots`,
`__t.stones` and `__t.crewless` help test it.
- Learned: the computer's answer is strong. A lone catapult sent at a town is overrun and taken within about
  15 s, before its first stone, so it needs an army with it. Worth watching in real games whether that's
  too harsh.
- Not done yet: wrecking by soldiers (only stones wreck a catapult), a 3D ghost when placing it, and team
  members that look different from spearmen.

**Done (24 October 2026): step 2, breaking bridges** (`breakBridge`, `aimedAt`, `broken`). Dragging a catapult's
route onto a bridge (not a ford or a pass) aims it there: the bridge is ringed, "Smash bridge" shows, and the
catapult's reach is drawn round the bridge, where it will stop. Three stones (`BRIDGE_HP`) break it; each leaves a
splintered hole in the deck, and Shift over the bridge says how many more it takes. When it breaks, everyone on
the deck falls in (a catapult on it is wrecked), its timbers splash into the river, the stumps of its piers stay
(drawn like the ruins on Broken Bridges), and the world is rebuilt without it. The tray's bridge can be built on
the same spot again. The computer drops a plan that went over it. Route points left in the water are passed over,
so armies on a route drawn over the old bridge go round by the nearest other crossing. Breaking your own side's
bridge is a toast; the enemy breaking one (stage 5) raises an alert. `__t.bridgeSiege`, `__t.crossing`,
`__t.across` and `__t.bridgeCount` help test it.
- Changed on the way: a soldier on any crossing now heads straight over to the end on its target's side. Before,
  one going to a point up- or downstream waded the wide ford slantwise, pressed against its edge, and was
  slow to get over; a broken bridge sends more armies by the ford, so it showed.

**Changed (24 October 2026): the catapult follows its town's route.** Playing showed what wins games: gold,
troops and a steady chain of routes to the front, and watchtowers in the right places. A catapult that needed its
own drags and its own guard lost to one more route. Now it takes its town's route whenever the town gets a new one
(`e.home`, `e.townRoute`), guarded by the soldiers marching it, and a route ending on another of your towns hands
it on to that town, so it relays along a chain. Dragging from it still sends it its own way (onto a bridge, say)
until its town's route changes. Soldiers marching its route refill its team. It also halts while 4 or more enemies
(`HALT_N`) are within 140 and shells them, waits for 5 of its own soldiers within 150 (`ESCORT`) while any enemy is
within 300, and its team take half damage in their places (`CREW_GUARD`). Its reach went from 230 to 300, so it
can shell a town across a river from its own bank. The computer hunts a catapult only once it stands in reach of
one of its towns.
- Learned, from scripted games on Easy (three blue towns streaming at one enemy town, six maps): the catapult
  is lost when the computer's first big attack breaks the front, about 40–50 s in, whatever protects it.
  Waiting for an escort everywhere, even at home, kept it alive longer (62–81 s, 19 hits on towns against 5),
  but only because it reached the front after that attack, and it stalled at home behind a single town's thin
  stream. The scripted blue side loses its front in every game, so these games say little about a real
  player's; worth judging in real play.

Order of work, each step worth having on its own:
1. The catapult team: buying and placing it in a town, the team pushing it along its route, the high stone arc,
   hits on towns (defence and garrison), a wreck when it's destroyed, capture, Shift-hover text, rules sheet,
   tests.
2. Bridges: breaking them, ruins, soldiers falling in, routes and the computer's plans finding another way.
3. Breaching capital walls.
4. The slow-motion camera and the sound of the shot and the hit.
5. The computer buying catapults and hunting the player's.

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
- **Borderlands:** an open map with a few patches of woods and bogs as soft cover instead of hard barriers.
- **Sparser roads everywhere:** Open Border and The Steppe turned out fun partly because of fewer roads. Other
  maps could link each town to one neighbour instead of two (the `roads` setting per landscape).
- **Roads to new bridges:** roads are laid out once when a map is made, so bridges built during a game
  (Broken Bridges especially) get no road and no road speed bonus.
- **Balance per landscape is untested:** gold income varies a lot between landscapes (Highlands earns about
  half of River Valley), so difficulty differs from map to map. Worth playing whole campaigns on each.
- **Watch The Greenwood's performance:** about 2,000 trees, the most the game draws. Thin it if phones struggle.

## The enemy

- **Smarter on open maps:** its planning was written around bridges. On Open Border, The Steppe and The Plateau it could
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
- **Marshes:** removed on 24 October 2026 for The Plateau, to get more fighting in the open field and less town
  against town. Its bogs (ground that slowed everyone) went with it; they are in the git history if Borderlands
  wants them.
- **The fort:** removed on 24 October 2026. Its only effect was 55% less damage for its side's soldiers inside
  its circle, and nothing brought soldiers there; giving it a real job (a healing post, a rally point that
  draws idle soldiers in) would have made it another town. Holding ground is now the companies' job: a gathered
  army forms up and fights as one, and archers volley. On Normal and Easy the computer's free building every few
  weeks had in fact always been a fort (it came on odd weeks), so it now gets none; on Hard it still gets a
  watchtower every other week. Its gold buys farms, towers and barracks in turn.
- **The fort as a gate:** a fort that snaps to the end of a bridge, ford or pass and blocks enemies until
  they break it (hit points), so they must break through or use another crossing. Not to be built in that
  form (23 October 2026).
- **Removing the bridges from River Valley:** kept as the classic, beginner-friendly map; Broken Bridges
  does the no-bridge game instead.
