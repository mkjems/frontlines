# Artwork guide

How Frontlines' artwork looks, where each piece is used, and how to make and add more in the same style
with an image AI. The paintings already in [art/](../art/) are the reference: new art should look as if
it came from the same artist and the same war.

## The style

Two kinds of art, kept apart on purpose:

- **Paintings** (start screen, end of game, link preview): rich, dramatic digital paintings, detailed
  enough to read like a book cover or a game's key art. Painterly texture, not photographs, and not the
  low-poly look of the game board itself.
- **Icons** (browser tab, home screen): flat, simple graphic shapes with no detail, readable at 16 pixels.

### Paintings

- **Period:** a storybook late Middle Ages, roughly the 1300s to 1400s in spirit, not historically exact.
  Mail shirts (chainmail), open steel kettle helmets with wide brims (chapel de fer), cloaks and hoods
  over the armour, long spears, longbows, kite and heater shields, horses in tack with cloth caparisons.
  No plate-armour knights, no guns, cannons, dragons or magic: grounded, not fantasy.
- **The two kingdoms:** told apart only by colour.
  - **Blue** is the player: deep **royal blue** cloaks, flags and shields, always on the **left**.
  - **Red** is the enemy: deep **crimson** cloaks, flags and shields, always on the **right**.
  - Avoid real heraldry, crests, symbols or text on flags and shields: plain colour only.
- **Soldiers:** weathered, bearded, fierce faces, shouting or snarling, in close-up or mid-shot. Gritty
  but never gory: no blood, no wounds, no dead.
- **Landscape behind them:** stone castles with towers and pennants on wooded hills, a fast river over
  boulders with a stone arch bridge, dark pine forests, mist in the valleys. The same world as the game:
  two castles, a river between them, a bridge.
- **Light and mood:** a dark, stormy sky with heavy blue-grey clouds, broken by **shafts of warm golden
  sunlight**. High contrast: the cool dark sky against the saturated blue and red of the armies and the
  warm light on faces and metal. Epic and tense, never cheerful-cartoony.
- **Colour:** muted, dark surroundings (slate greys, deep greens, cold river blues) so the **blue and red are
  the only saturated colours**, with gold sunlight as the accent.

### Icons

- Two overlapping **heater shields**, blue on the left and red on the right, each with a thick
  **cream outline**, on a flat **dark navy** background.
- Flat colour, no gradients, no texture, no text. Must stay clear at 16 × 16 pixels.

## Where art is used

| File in [art/](../art/) | Used for | Size | Notes |
| --- | --- | --- | --- |
| `start.jpg` | Top of the start screen's first step | 1200 × 800 (3:2) | Shown about 440 × 240 (190 tall on phones), cropped to the middle and a little above it, fading into the dark card at the bottom. The title **Frontlines** is set in the bottom-left corner, so keep that area calmer. Blue and red armies facing each other across the river. |
| `victory-blue.jpg` | End of game, when you win | 1200 × 675 (16:9) | Shown about 440 × 240, fading into the card. The blue army cheering in the foreground, its castle behind, the red army small and far off across the river. |
| `victory-red.jpg` | End of game, when you lose | 1200 × 675 (16:9) | The mirror of the blue one: the red army cheering, blue far off. |
| `share.jpg` | Link preview (Messenger, Slack, Discord and so on) | 1200 × 630 | The standard link-preview shape. Two soldiers face to face, blue left and red right, castles and river between them. Most apps crop the edges a little. |
| `favicon.ico` | Browser tab | 16, 32 and 48 px in one file | The shields icon. |
| `icon-180.png` | Home-screen icon on phones | 180 × 180 | The shields icon. |

## Ideas for more art

- **A picture for each landscape** in the map step of the start screen (River Valley, The Great Lake, Two
  Rivers, Mountain Pass, Open Border, The Steppe, The Greenwood, Highlands, The Plateau, Broken Bridges): small
  wide paintings of the place itself, with tiny armies, in the same light and sky.
- **A header for the Rules sheet:** a quieter scene, for example a war table with a map and tokens.
- **Formation art** for the planned archer volleys, shield walls and cavalry raids (see
  [ideas.md](ideas.md)), for tips or the rules.

## Prompts

Adjust the aspect ratio to the slot (for example `--ar 3:2`, `16:9` or `1.91:1` in Midjourney). Generate
larger than needed; the images are scaled down when added.

**Base style** (add to every painting prompt):

> Epic medieval battle painting, highly detailed digital painting with painterly texture, dramatic dark
> stormy sky with heavy blue-grey clouds and shafts of golden sunlight breaking through, weathered fierce
> bearded soldiers in chainmail and steel kettle helmets with wide brims, long spears and longbows, stone
> castles with towers on wooded hills, fast river over boulders, dark pine forests, mist, high contrast,
> deep royal blue and deep crimson as the only saturated colours against muted slate and green, no text.

**Example, a landscape picture (Mountain Pass):**

> [base style], a wide view of a wall of tall snow-capped mountains with a narrow pass through them, a
> small blue army with blue banners approaching from the left and a small red army with red banners from
> the right, a stone watchtower at the mouth of the pass, cinematic wide shot.

**Example, the start screen:**

> [base style], a blue army on the left bank and a red army on the right bank of a rocky river, facing each
> other, archers drawing bows and spearmen with lowered spears in the foreground, two castles on the hills
> behind, a stone arch bridge in the middle distance.

**Negative prompt** (for tools that support one):

> blood, gore, wounds, corpses, modern objects, guns, cannons, dragons, magic, fantasy creatures, plate
> armour, heraldry, crests, symbols on shields, text, letters, logos, watermark, cartoon, anime, low-poly,
> photograph, washed out, pastel

**The icon:**

> Flat vector icon, two overlapping heater shields, royal blue on the left and crimson red on the right,
> each with a thick cream outline, on a flat dark navy background, no gradients, no text, simple and bold,
> readable at very small size.

## Checking a new picture

- Blue is on the left and red on the right.
- No text, letters, symbols or crests anywhere.
- The blue and red are the only strong colours, and the sky and land stay dark.
- It still reads when shown about 440 pixels wide.
- Nothing important near the edges, or where the title or the fade sits.

## Adding it to the game

1. Scale and compress it into [art/](../art/) as a JPEG about 1200 pixels wide, under about 400 KB. On a
   Mac:

   ```sh
   sips -s format jpeg -s formatOptions 66 -Z 1200 new-picture.png --out art/new-picture.jpg
   ```

   For icons, keep PNG (or ICO for the tab icon).
2. Reference it from [frontlines.html](../frontlines.html) as `art/new-picture.jpg`. [build.sh](../build.sh)
   copies the whole `art/` folder into `site/` on every build. Don't put files straight into `site/`: it's
   rebuilt each time and isn't saved in git.
3. Run `./build.sh` and open `site/index.html` to check how it looks in place.
