# Design review

A review of Frontlines' rules as a whole, made on 24 October 2026 from reading the code and the rules sheet,
not from playing. Each system gets a verdict (**keep**, **simplify**, **fix** or **cut**), the reasons, and
how to check it. Numbers are quoted from [frontlines.html](../frontlines.html) as it was on that date.

Some findings are certain because they are plain in the code (the computer has no route ink, for example).
Others are predictions about how fights play out, and need a test: either the computer playing itself many
times (see the end), or a person playing. Those are marked *to check*.

[ideas.md](ideas.md) has the ideas not built yet. This review sometimes agrees with it (the fort) and
sometimes says what should come before it (fix the troop counters before adding formations).

## Summary

| System | Verdict | In one line |
| --- | --- | --- |
| Drawing routes, towns training soldiers | Keep | The heart of the game, and unusual. Protect it. |
| Taking towns by marching into them | Keep | Simple and readable. |
| Mirrored random maps, landscapes | Keep | Fair and varied. Measure balance per landscape. |
| The three troop types and their counters | Done | Measured backwards in two of three pairings; fixed 24 October. |
| The automatic charge vs the Charge button | Simplify | Every soldier but archers already charges by itself; the button mostly adds a sprint. |
| Route ink | **Cut** | A third resource with little gain. (The computer obeys it since 24 October.) |
| Weekly reinforcement cards | Simplify | Mostly the same five buildings the tray sells. Offer only things gold can't buy. |
| Gold: farms and mines | Keep, tune | Check that farms pay back before the game ends. |
| Watchtower, barracks, bridge | Keep | Each has a clear job. |
| Fort | Cut or replace | No job (already in ideas.md). |
| Terrain effects | Simplify | Too many invisible percentages; hills have three separate rules. |
| The enemy growing stronger each week | Keep, show it | Good pressure, but the player can't see it happen. |
| The computer redirecting armies already marching | Done | It plays by the player's rules since 24 October. |
| Tutorial, tips, carousel, hover, rules sheet | Simplify later | Five ways of teaching. Simplifying the rules shrinks them all. |

## Keep: the core

The core idea is strong: **you never command a soldier, you draw roads, and armies flow along them**. Towns
are the factories, routes are the orders, and a town falls when enough soldiers march into it to empty its
defence ring (20 for a town, 40 for a capital, refilling at 1.2 a second when nobody is hitting it). That's
easy to grasp, and it makes a battle look like a battle.

Most of the suggestions below take things away so this core shows more clearly. Any new feature should be
judged by whether it makes route drawing more interesting. Formations pass that test, because a formation is
something your routes create.

## Done: the three troop types

**Done on 24 October 2026.** Staged equal-cost fights (33 spearmen, 28 archers, 20 cavalry, on open ground)
showed the triangle backwards in two pairings: spearmen beat archers and archers beat cavalry, so spearmen
beat everything and cavalry nothing. The fix: spearmen charge only on a Charge order, and `K_MULT` became
archers ×1.6 against spearmen (was 1.2) and ×0.6 against cavalry (was 0.8), cavalry ×1 against spearmen (was
0.75). Each counter now wins every staged fight, keeping about 65% (archers), 45% (cavalry) and 80%
(spearmen) of its soldiers, and a browser test checks it. Fights turn on how many blows a kill takes, so small
changes to these numbers often do nothing, and a slightly softer set gave the archers back the fight against
cavalry. Still open: a mixed army loses to a single-type army of the same cost, partly because cavalry run
ahead of the rest. That makes switching to the counter the best play, and the computer's habit of countering
the player's most common type stronger.

The review as first written:

The rules sheet says spearmen beat cavalry, archers beat spearmen and cavalry beat archers. The code makes the
first and last strongly true, and probably not the middle one.

The numbers (`K_HP`, `K_TRAIN`, `K_MULT`, `strike()`):

| | Hit points | Training time | HP per second of training | Melee damage |
| --- | --- | --- | --- | --- |
| Spearmen | 4 | 0.85 | **4.7** | 1 |
| Archers | 2 | 1.0 | 2.0 | 0.4 (1 when shooting) |
| Cavalry | 3 | 1.4 | 2.1 | 1 |

Counter bonuses (`K_MULT`): spearmen ×1.4 against cavalry, archers **×1.2** against spearmen, cavalry ×1.8
against archers.

Then there is the charge in `strike()`. Any spearman or cavalryman that hasn't struck for 1.2 seconds hits
harder with its next blow, with no button pressed: cavalry ×3 (×1 against spearmen), **spearmen ×2.2 against
anything**. This is the "charge" the Rules sheet credits to cavalry. Spearmen get most of it as well.

What follows from that, soldier by soldier:
- **A spearman kills an archer with one blow**: 1 × 2.2 = 2.2 damage against 2 hit points. The archers get
  about 1.3 seconds of shooting while a spearman crosses their 44 px range, so one or two arrows of 1.2 each,
  against 4 hit points.
- **A spearman kills a cavalryman with one blow**: 1.4 × 2.2 = 3.1 against 3 hit points. Cavalry charging
  spearmen get no bonus at all and ×0.75. That counter works, very hard.
- **Spearmen train fastest and are the toughest per second of training.** A town making spearmen fields
  more hit points than one making anything else.

So the likely best strategy is to train **spearmen everywhere**. Archers can still win group fights when many
of them focus their arrows on an attack across open ground, but that depends on range and numbers, not on
the counter. *To check*: the computer-vs-computer runs can fight equal-cost groups of each pair and count the
winners. If spearmen beat archers, the triangle is broken.

This also explains the remark in ideas.md that "a big army of archers fights much like a big army of
spearmen".

**Suggestion, before formations:**
1. Give the automatic charge to cavalry only. Spearmen become the wall, not the hammer.
2. Make every counter clearly felt: about ×1.6 to ×2 each way, so one type is right for each job.
3. Then, with the counters working, build formations (volleys, shield wall, raids) as planned. A volley is
   wasted if spearmen can walk through it anyway.

## Simplify: two kinds of charge

There are two charges, and the rules sheet describes them as one:
- **The automatic one**, above: a soldier that has been out of a fight for 1.2 seconds hits two to three times
  as hard with its first blow.
- **The Charge button** (every 25 seconds): everyone within 140 px sprints at 1.5× speed for 4 seconds toward
  the spot you click, and its first blow is a charge.

Most of the first-blow bonus already happens without the button: soldiers arriving at a fight are usually
fresh. What the button really adds is the sprint and the choice of where to hit. That is good to have: it's
the only thing the player does with their hands in a fight, and it's satisfying. But "the first blow hits two
to three times as hard" mostly describes something that happens anyway.

**Suggestion:** keep the button. Make the automatic charge cavalry-only (as above), and let the button give
every type a real charge bonus. Then the button's promise is true, and cavalry are the type that charge
without it.

## Cut: route ink

Route ink limits how much route a side may draw: 600, plus 300 per town held, plus 400 for each Surveyors
card. Moving a gathered army is free.

**The computer had no ink** when this review was written: only the player's drawing checked the limit, so ink
was a handicap on the human alone. Since 24 October every route order checks it, for both sides.

Beyond that:
- It's a third resource (after soldiers and gold) with its own bar, rule and card.
- It overlaps with a rule that already exists: each town has one route.
- It snowballs: more towns give more ink, which lets you reach more towns.
- Freeing gathered armies from it makes the rule harder to explain ("free, costs no ink").

**Suggestion:** remove it, together with the Surveyors card. If very long routes from the back of the map turn
out to be too strong, try a gentler rule first, such as soldiers marching slower on very long routes. If
it stays, the computer should obey it too.

## Simplify: the weekly reinforcement cards

Every 45 seconds the battle stops and you pick one of two cards. Five of the seven cards are the five things
the gold tray sells (fort, watchtower, bridge, farm, barracks). The code always offers at least one of those
five. The other two are Surveyors (ink) and Drill sergeants (+15% training).

So the weekly choice is usually "a free version of something I could buy". The two systems do the same job.

**Suggestion:** keep the weekly moment (it gives the game a rhythm), but offer only things gold can't buy:
- Drill sergeants (+15% training);
- Veterans: +1 hit point for all new soldiers;
- a shorter Charge cooldown, or a second Charge;
- Scouts: see where the enemy is gathering earlier;
- once formations exist: a stronger volley, a tougher shield wall, faster raiders.

Then the tray is "what I build" and the cards are "how my army grows". *To check by playing*: does stopping the
game every 45 seconds feel like a breather or an interruption? A ten-week game has ten stops, and in a
two-player game both players wait for the slower one. An offer that waits in a corner while the battle goes
on is an alternative.

## Keep and tune: the economy

- **Farms**: 30 gold, earning 0.15 a second, which is about 7 a week. A farm pays for itself after about four
  and a half weeks (3.3 minutes). Each repeat costs 50% more, so the second farm (45 gold) takes almost seven
  weeks and the third (68) ten.
- **Gold mines**: 27 a week for whoever's colour covers the land around them. That's worth four farms, and it's
  a reason to fight over open ground, which is good.

*To check*: how many weeks a game lasts. If most games end around week 8, a farm bought after week 3 never
pays back, and the second farm is rarely worth it. The computer-vs-computer runs will give game lengths.
Farms are fine as a beginner's choice; the danger is only that they're a trap.

The price rise of 50% per repeat applies to each building separately. That's a reasonable way to stop one
thing being spammed; keep it.

## Buildings

- **Watchtower** (40): shoots by itself, even across the river. Clear job, easy to understand. **Keep.**
- **Barracks** (70): +50% training speed and +10 soldiers for one town. Clear job. **Keep.**
- **Bridge** (80): changes the map. The most strategic purchase. **Keep.**
- **Fort** (60): **cut or replace.** ideas.md already explains why it does nothing in practice. The enemy
  still buys it in its fixed buying order and gets one free every second week, so it wastes the computer's
  gold too. I'd remove it: four buildings that each matter are better than five. If a fifth is wanted, the
  healing post from ideas.md is the best of the options, because nothing heals today and it creates a reason
  to draw a route *back*.
- **Capture by crowding** (8 enemies within 50 px, no defenders within 80): fine, but it only shows as a
  toast. A building that is about to change hands could flash.

## Simplify: terrain

What terrain changes, from the rules sheet and the code:
- roads: 40% faster;
- woods: 35% slower, arrows half damage;
- marsh: 45% slower;
- fords: 55% slower;
- hills: archers +10 range per contour, **and** melee downhill +25%, **and** uphill −20%;
- near your own towns: 40% less damage taken;
- within a fort: 55% less;
- each nearby ally: +6% damage, up to +60%.

The things you can see (roads, woods, marsh, fords) are good: the player can plan around them when drawing a
route. The trouble is in the hidden ones:
- **Hills have three rules.** Archers shooting further from a hill is easy to picture. The up- and downhill
  melee bonuses are invisible in a crowd. **Suggestion:** keep only the archer range.
- **The 40% near your own towns** is a big effect with nothing on the board showing where it starts.
  **Suggestion:** draw the 90 px ring faintly, or tie it to the territory tint the player already sees.
- **The ally bonus** (+60% at ten neighbours) quietly rewards big blobs. That's fine, and it fits "gather an
  army". It needs no rule-sheet line if formations replace it later.

## Show it: the enemy growing stronger

On Normal, each week the computer's towns train 7% faster, its new soldiers get +1 hit point every five weeks,
and it gets a free fort or watchtower every second week. So every game is a race: the longer it lasts, the
worse it gets. That's good pressure and a fair way to make a scripted opponent dangerous.

But the player can't see it, and +1 hit point is not a small change: it's +50% for an archer and +33% for
cavalry. **Suggestion:** say it on the card screen ("The enemy's soldiers are now veterans: +1 hit point"),
so that a lost battle has a reason the player understood.

## Done: who can redirect armies on the march

**Done on 24 October 2026:** the computer now plays by the player's rules: its soldiers keep the route they set
out on, it moves gathered armies as groups, calls marching soldiers home by clearing a route, obeys the route
ink (relaying through its own towns when a route doesn't fit), and places buildings by the same checks.
Against an idle player it takes towns about as fast as before.

The player's soldiers keep the route they set out on: a new route for their town only affects soldiers trained
after it. The computer's soldiers always follow their town's *current* orders (`goalOf()`), so it can turn a
whole army already marching. That's how it gathers and then strikes.

That's a power the player doesn't have. Both choices are defensible:
- **Keep the player's rule** (routes are commitments, which is a good strategic idea) and make the computer
  obey it too, with its gathering done through gathered groups the way a player would do it.
- **Give the player the same power**, for example with a "recall" that sends marching soldiers onto the new route.

I'd keep the player's rule and hold the computer to it. Commitment is what makes drawing a route a decision.
The ink and this rule are the two places where the computer plays by different rules; after both are fixed,
the computer-vs-computer runs also become a fairer measure of the real game.

## Simplify later: teaching

The game teaches itself five ways: the welcome carousel, a four-step first-game tutorial, eleven tips that
appear when something becomes relevant, Shift-hover to inspect, and the Rules sheet. The hints in the
corner make six. Each one is well made, but the amount is a sign of how many rules there are.

**Suggestion:** don't work on this directly. Every rule removed above (ink, the fort, two hill rules, the card
overlap) removes text from several of these places. Revisit the teaching after the rule changes.

## Maps

Ten landscapes, mirrored random layouts and map numbers: keep. ideas.md already notes that gold income varies
a lot between landscapes (Highlands earns about half of River Valley). The computer-vs-computer runs can
measure that per landscape: game length, which side wins, and gold per week. If a landscape plays badly in
the numbers and in play, cutting it is fine: The Old Forest and Open Plains were cut before for the same reason.

## Suggested order

1. **Computer against computer**, as a test tool first (see below). It turns most of the *to check* items
   into numbers, and checks every later change.
2. **Fix the troop counters** (automatic charge for cavalry only, stronger counter bonuses), measured with 1.
3. **Remove route ink** and the Surveyors card.
4. **Remove the fort** (or replace it with a healing post).
5. **Weekly cards offer only what gold can't buy.**
6. **Hills: archer range only.** Show the ring around towns.
7. **Formations**, as planned in ideas.md.

Steps 2 to 6 are each small (an hour or so) and each removes or simplifies something. Formations add a lot,
so they come after the counters work.

## What only playing will tell

The computer playing itself measures balance. It can't tell:
- whether drawing a route feels good on a phone;
- whether the weekly stop is a breather or an interruption;
- whether a battle builds tension, or is decided by week 3 and then drags;
- whether a new player understands why they lost.

The best way to find those is to watch someone play for the first time without explaining anything, and note
where they hesitate, what they never touch, and when they look bored.


## Martins Thoughts

- Rules and features are only valuable if they are visible
- All elements of the game should be understandable and should have a role. 
- Players should know how everything on he screen plays together. How do you get more router ink for example.