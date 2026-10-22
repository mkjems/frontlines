# Start screen artwork brief

A brief for creating start-screen artwork for Frontlines with an image AI. It describes the game's look,
setting and colours so the art matches what players see once they press **Start campaign**, and ends
with prompts ready to paste.

## Where the art goes

The start screen is a white card over the blurred battlefield. At the top of the card is a banner
(today a simple drawing of two castles facing each other across a river), then the title **Frontlines**,
the rules, the difficulty picker and the start button.

There are two possible places for new art:

| Slot | Shape | Size to deliver | Notes |
| --- | --- | --- | --- |
| **Card banner** (main target) | Wide strip, 8:3 | 1760 × 660 px | Shown about 440 px wide, with rounded top corners. Keep the subject in the middle 80%; the edges may be cropped slightly on phones. |
| **Full-screen background** (optional) | 16:9 | 2560 × 1440 px | Sits behind the card, so its centre is mostly covered. Put interest at the edges. It must stay calm enough that the card's text is easy to read. |

Most image AIs can't make 8:3 directly. Generate at 16:9 or 21:9 and crop to 8:3. Deliver as `.webp` or
`.jpg`, under about 300 KB for the banner.

Leave the title out of the image. The game sets **Frontlines** in its own font (Lexend) under the banner.

## Setting and era

- **Period:** a storybook take on the late Middle Ages, roughly the 1300s to 1400s in spirit, not
  historically exact. Stone keeps with battlements, walled capitals, village houses, farm fields, wooden
  and stone bridges, watchtowers, small forts.
- **Armies:** spearmen, archers and cavalry. No guns, cannons or gunpowder. No dragons or magic either:
  it's grounded, not fantasy.
- **The two sides:** two rival kingdoms facing each other across a river.
  - **Blue** is the player's kingdom, on the west bank, with **Ashford** as its capital.
  - **Red** is the enemy, on the east bank, with **Redmarsh** as its capital.
  - They are colours on a map, not real nations, so avoid real-world flags, heraldry or text on banners.
- **Landscape:** dark, cool slate-green land with dull fields, a winding slate-blue river with a shallow ford of
  stepping stones, terraced hills, dark green woods of round trees and pines, brown dirt roads linking
  the towns.
- **Mood:** calm before the battle. The tension comes from the two armies facing each other across the
  water, not from gore. Hopeful, a little epic, never grim. There's no blood in the game.

## Visual style

The game looks like a **miniature tabletop diorama** seen from above at a slight angle:

- **Low-poly, softly lit 3D.** Faceted trees, chunky keeps, simple shapes with flat colour and no fine
  texture detail. Think a painted wooden board game or a clean stylised strategy game, not
  photorealism and not pixel art.
- **High, three-quarter view** looking down onto the land. You see the tops of things and a little of
  their sides.
- **A low, warm sun** from the upper left (north-west), casting soft, clear shadows towards the
  lower right.
- **Dark and muted, with light on top.** Dark cool greens and greys for the land, light marks for what
  matters, and the team colours as the only strong colours. Gentle tilt-shift depth of field, so it reads as a miniature.
- **Clean and uncluttered:** generous open space, readable shapes, a calm composition.

## Colours

Use the game's palette so the art sits naturally on the card:

| Role | Colour |
| --- | --- |
| Blue kingdom | `#4a84f2`; soldiers `#5e98ff`, labels `#9fc0ff` |
| Red kingdom | `#df5448`; soldiers `#ff5d47`, labels `#ff9a88` |
| Open ground (cool, dark slate-green) | `#353b36`, `#323833` |
| Hills (catching the light towards the top) | `#3a413a` → `#444b42` |
| Faint roads | `#3e423b`, `#444840` |
| Fields (muted) | dull wheat `#4d4a3c`, dull green `#3c4535` |
| Trees | `#4d6745`, `#435d3d`; pines `#38513a` |
| River | `#365f74` over a dark bed `#243238` |
| Stone (walls, houses) | `#b4b3ab`, `#8e8d86` |
| Bridges (dark timber) | `#5f5545`, `#51493c` |
| Table around the board | `#1c201f` |
| Card (the white the banner sits on) | `#fbfbf7` |

The look is a dark war table at dusk: everything natural is dark and muted, and the two kingdoms glow
softly in their colours around their towns. Light marks on top (soldiers, names, flags) carry the eye.

Keep blue and red the only saturated colours, and roughly balanced, with blue on the left and red on
the right.

## Composition ideas

1. **Across the river (closest to today's banner).** The river runs down the middle. On the left bank, a
   blue walled castle with flags and a column of blue soldiers marching along a road. On the right, the
   red castle and its army. A stone bridge in between, where the two columns are about to meet.
2. **The eve of battle.** A wider view of the board at golden hour: two armies drawn up on either bank,
   long shadows, a little mist over the river, farm fields and woods around them.
3. **The diorama on the table.** The whole board as a miniature model on a table, slightly
   tilted, with its earth-coloured edges visible: blue castle on the left, red on the right, the river
   cutting between them. Works well as the optional full-screen background.

## Prompts

Adjust the aspect-ratio flag to whatever your tool uses (for example `--ar 21:9` in Midjourney).

**Banner, across the river:**

> Miniature tabletop diorama of a medieval battlefield seen from a high three-quarter view. A winding
> slate-blue river runs down the centre with a stone bridge and shallow stepping-stone ford. On the left
> bank a walled stone castle with royal-blue roofs and blue pennants, a column of small blue spearmen,
> archers and cavalry marching along a dirt road towards the bridge. On the right bank a matching castle
> with coral-red roofs and red pennants and a red army. Dark cool slate-green land, dull fields,
> faint dirt roads, terraced grassy hills, clusters of dark green low-poly round trees and pines, grey
> stone. Low-poly stylised 3D, soft matte materials, low warm sun from the upper left casting soft
> shadows to the lower right, dark muted palette with the two kingdoms glowing softly in blue and red, gentle tilt-shift depth
> of field, calm and hopeful mood, clean uncluttered composition, no text. Wide panoramic banner.

**Background, the diorama on the table:**

> A miniature strategy-game board on a near-black table, seen from above at a slight angle. The board
> shows a dark slate-green landscape at dusk, split by a winding slate-blue river; a blue kingdom's walled castle and towns
> on the left, a red kingdom's on the right, roads, fields, small woods and terraced hills. Low-poly
> stylised 3D, soft light from the upper left, soft shadows, dark muted palette with royal blue and
> coral red as the only strong colours, tilt-shift miniature look, lots of calm space in the centre, no
> text.

**Negative prompt** (for tools that support one):

> photorealistic, gritty, grim, blood, gore, guns, cannons, dragons, magic, fantasy creatures, text,
> letters, logos, real flags, heraldry, watermark, busy, cluttered, neon, oversaturated, pastel, beige

## Checking the result

Before using an image, check that:
- blue is on the left and red on the right;
- it still reads at 440 px wide, the banner's size on screen;
- nothing important sits in the outer 10% of the banner;
- it has the same earthy, muted feel as the game, not brighter or more saturated;
- there's no stray text or lettering.

Then add the image to the project, for example as `art/start-banner.webp`, and ask Claude to wire it in.
It would replace the drawn banner made by `heroSVG('intro')` in `frontlines.html`, and `build.sh` would
need to copy the image into `site/`. Don't put it straight into `site/`: that folder is rebuilt on every
build and isn't saved in git.
