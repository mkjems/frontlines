This project is about creating a new game that I can put on my website mkjems.dk.
This game has to be visually impressive and fun to play.

We will be working on a completely seperate subdomain on my VPS. So any tech stack is possible.
I would like to see what it is possible to achieve using AI for coding. So think big 

Ideas:
- See [docs/ideas.md](docs/ideas.md) for ideas that have been discussed but not built yet, the agreed next
  step (formations for archers, spearmen and cavalry), and ideas that were decided against.

## Working on the project

- **The whole game is [frontlines.html](frontlines.html)**: one file, no framework. [build.sh](build.sh)
  wraps it into `site/index.html` and copies [art/](art/) (paintings, icons, share image) into `site/`.
  [docs/art.md](docs/art.md) describes the art style, where each picture is used, and prompts for more.
  Don't edit `site/`; it's rebuilt every time.
- **Tests:** `cd tests && npm test` builds the page and runs the browser tests in headless Chrome. Run them
  after every change, and check the exit code before committing.
- **Test addresses:** `?test` exposes `window.__t`, the hook the tests use, and draws the board small and
  rarely to keep tests quick; add `&lite=0` for the full picture (for screenshots). Other switches:
  `?land=highlands` picks a landscape, `&map=4821` a map number, `&layout=classic` the hand-made town layout.
- **Deploying:** every push to `main` runs the tests on GitHub and deploys to frontlines.mkjems.dk.
  Ask before pushing. After a push, don't poll GitHub Actions or the live site; the user checks deploys.
  Fetch before pushing: Copilot or other agents sometimes push to `main` too.
- **Look:** one dark colour scheme only (no seasons or light themes); soldiers should be the brightest
  things on the board.
- **Two-player online play** is being built in phases; [docs/multiplayer.md](docs/multiplayer.md) holds the
  plan and the progress. Splitting the file into modules is still undecided (an open question there).
