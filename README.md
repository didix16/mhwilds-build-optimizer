# Wilds Forge

A local **Monster Hunter Wilds** build optimizer built with React, Vite, Tailwind CSS, and PrimeReact (Lara dark theme with cyan accents). The interface and equipment names/descriptions are available in English and Spanish.

## Getting started

Use **Node.js 24**, matching the included `.nvmrc` and GitHub Actions workflow. The application also supports Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173/`.

On Windows, `./start.ps1` can also start the development server after installing dependencies. It locates Node.js through PATH, NVM, or the local development runtime when available. Use `./start.ps1 -Production` to preview an existing production build.

## Deploying to GitHub Pages

The included [deployment workflow](.github/workflows/deploy.yml) validates the project, builds it, and publishes **only `dist/`** to GitHub Pages. It runs automatically on pushes to `main` and can also be started manually. No personal access token or additional repository secret is required; deployment uses GitHub's built-in token.

### 1. Create a repository

Create an empty repository on GitHub, for example `mhwilds-build-optimizer`. For GitHub Free, use a **public** repository. Do not initialize it with a README, `.gitignore`, or license when following the first-upload commands below, since those commands assume an empty remote repository.

You can choose a different repository name: the application uses Vite's relative `base: './'`, including its database, icons, fonts, and module Worker. No username or repository name needs to be hardcoded in the app.

### 2. Push the project

Run these commands from the project directory. Replace `YOUR_USERNAME` and the repository name with your actual GitHub repository URL:

```sh
git init -b main
git add .
git commit -m "Initial Wilds Forge release"
git remote add origin https://github.com/YOUR_USERNAME/mhwilds-build-optimizer.git
git push -u origin main
```

These commands are for the first upload from a folder that is not already a Git repository. If it already has a repository or remote, use that existing setup instead.

Keep `package-lock.json`, `public/data/`, `public/icons/`, `src/`, `scripts/`, `tests/`, and `.github/workflows/deploy.yml` in Git. The existing `.gitignore` excludes `node_modules/`, `dist/`, `.cache/`, and `artifacts/`; you do not need to upload generated build files or a ZIP separately.

### 3. Enable Pages

In the GitHub repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. The repository owner or an administrator must configure this setting.

Do not select a branch or the `docs/` folder as the publishing source for this workflow.

### 4. Run the deployment

Open **Actions → Deploy to GitHub Pages → Run workflow**, select `main`, and run it. If an automatic run started before you enabled Pages, start it again after completing step 3.

The workflow:

1. Checks out the source and installs Node.js 24.
2. Installs the locked dependencies with `npm ci`.
3. Checks the bundled data, runs the engine/Worker tests, and checks component rendering in both languages.
4. Builds the static site and verifies its assets and offline cache manifest.
5. Uploads `dist/` and deploys it to the `github-pages` environment.

The build uses the **committed dataset**. It does not download fresh game data during deployment, so publishing does not depend on community data APIs being available.

### 5. Open the website

After the workflow finishes successfully, GitHub shows the deployed URL in the deployment job and in **Settings → Pages**. For a standard project repository, the address is:

```text
https://YOUR_USERNAME.github.io/mhwilds-build-optimizer/
```

A repository named `YOUR_USERNAME.github.io` is served at the domain root instead. Relative asset paths support both layouts.

### Updating the website

After making local changes:

```sh
git add .
git commit -m "Update Wilds Forge"
git push
```

Every push to `main` runs the checks and deploys the new build automatically. If you choose another deployment branch, update the workflow's `on.push.branches` setting and any protection rules on the `github-pages` environment.

If deployment fails, open the failed step in **Actions**. Check that Pages is enabled with **GitHub Actions** as its source, Actions are allowed for the repository, and the `github-pages` environment allows deployments from `main`. For an old cached version, close existing tabs and reload the site while online so the new service worker can install.

Official references: [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), and [Vite static deployment](https://vite.dev/guide/static-deploy.html#github-pages).

## Static production build

```sh
npm run check:data
npm test
npm run check:render
npm run build
npm run check:dist
npm run preview
```

`dist/` contains the complete website and its database. It can be hosted on any static HTTP server, including under a subdirectory, without a calculation backend. Do not open `index.html` through `file://`: module Workers require HTTP(S).

For offline use, load the production build once over HTTPS or localhost and wait for the offline-cache confirmation. The cache includes data, images, fonts, and JavaScript modules. Cache names are isolated by deployment path so separate projects on the same GitHub Pages domain do not clear each other's caches.

## Features

- Choose required skills and minimum levels, including set and group bonuses.
- Search all 14 weapon types, or filter by type, family, element/status, armor rank, and a specific weapon.
- Choose between defense → rarity and expected damage → defense → rarity. Only builds meeting the requirements are ranked.
- Use crafted charms and modeled legal random-charm combinations, including weapon/armor slot types. There are no charm inventory restrictions or decoration quantity limits.
- Explore theoretical Artian and Gogma Artian configurations: infusions, five-reinforcement profiles, focus, and set/group contributions.
- Inspect statistics, sharpness, skills, decoration placements, and documented crafting recipes.
- Configure a monster/body part or custom hitzones, wounds, conditional skills, consumables, weapon buffs, and combos for each weapon type.
- Receive progressive results from a Web Worker that keeps searching until the modeled equipment combinations are exhausted or you pause it manually. The best 20 or 50 builds are displayed; **all found builds** are archived locally.
- Resume an archived search after closing the page, using saved solver checkpoints.
- Export a self-contained, bilingual HTML report with filters, grouped equipment variants, detailed jewel placements, skills, base statistics, sharpness, and known crafting materials.
- Optionally explore additional jewel fillings that favor up to five selected optional skills, with a configurable maximum of 2, 4, or 8 variants per equipment combination.
- Save builds in the browser and export/import JSON, validating imported builds against the installed dataset.
- Browse a local catalog of equipment, skills, items, and monsters.

The optimizer does not call external services. Initial loading requests static files from the website's own origin.

## Search archives and resuming later

Every new search creates a separate entry under **Search archive / Archivo de búsquedas**. IndexedDB stores every unique emitted build, independently of the visible top-results limit. Identity includes the weapon and Artian configuration, five armor pieces and upgrade mode, exact charm, and decoration placements. Favorites remain a separate feature.

The Worker saves its frontier, heap ordering, visited combinations, counters, and top results approximately every five seconds, and on manual pause. Each checkpoint and its associated result batch commit in a single IndexedDB transaction. Closing the page does not continue computing in the background: reopen the same site and choose **Resume search** from the archive. Use **Save checkpoint** and wait for the saved confirmation before closing to preserve the current position. A sudden close, crash, or forced mobile suspension resumes from the last committed checkpoint and may repeat the last unsaved seconds of exploration.

Storage belongs to the browser profile, website origin, and deployment path. Use the same device, browser profile, and site address; localhost and GitHub Pages do not share archives. Clearing site data or private-browsing data can remove searches. A checkpoint cannot be resumed against a changed dataset or incompatible solver version. The archived dataset and base statistics are retained so its HTML report can still be exported after data changes. Resuming the same search in another tab protects the newer checkpoint and pauses the previous writer when it next attempts to save.

Browser storage and device memory are finite. There is no arbitrary build-count cap, but very large searches can exhaust either. If a transaction fails, the search pauses, the failed batch remains in memory for retry, and the interface reports the storage problem. Free space and retry saving before closing. Deleting an inactive archived search removes its results and checkpoint; its dataset copy is removed when no other search references it.

## Standalone HTML reports

Choose **Download HTML report** while searching, paused, or finished. An active search first commits a checkpoint, then exports an immutable snapshot of every result stored up to that checkpoint; it can continue searching during export. Later matches appear in a later export. Each file represents one search and indicates whether that search was partial or exhausted.

The downloaded HTML embeds its data, translations, styles, and filtering code. Open it directly from disk in a JavaScript-enabled browser; it requires no server, Internet connection, app installation, fonts, CDN, or external images. Its responsive layout supports desktop and mobile browsers that can open local HTML files. Some mobile file-preview apps disable JavaScript; open the file in a browser in that case. The report is for consultation and cannot resume or modify the original search.

Filters include bilingual text search, weapon types and weapons, armor pieces, element/status, minimum attack/defense/affinity, required skill levels, and excluded active skills. Skill minimums are combined with AND. Armor selections are OR within the same armor position and AND across positions. Equipment grouping keeps alternative charm/jewel configurations together; pagination and lazy details avoid rendering every build at once. Filters operate only on the saved matches; they do not generate new optional combinations.

Combat scenarios remain configurable in the optimizer but are **excluded from reports**. Reports show modeled attack, affinity, defense, resistances and sharpness without temporary items, conditional skill activations, or target bonuses. They omit scenario-dependent damage and combos. Every active skill and level is listed even when its numerical effect is not modeled. Material totals retain the documented recipe limitations described below.

Export reads archive rows in batches. The final HTML still contains all rows, so large files require enough RAM to generate, open and filter; pagination does not remove that requirement. There is no promise of unlimited report size, especially on mobile.

Optional jewel variants are disabled by default. When enabled, the solver retains distinct targeted greedy fillings and, when within the selected cap, required-only filling. It does not enumerate every legal charm, jewel permutation, or Artian profile. **All found** means all verified builds emitted by this modeled search, not all possible game builds.

## Bundled data

Snapshot downloaded on November 9, 2026:

| Type | Entries |
| --- | ---: |
| Skills | 179 |
| Armor pieces | 714 |
| Base weapons | 1,188 |
| Decorations | 361 |
| Crafted charms, counted by individual upgrade level | 183 |
| Random-charm templates | 29 |
| Monsters | 34 |

Sources include [MHDB](https://docs.wilds.mhdb.io/), [Monster Hunter Wiki](https://monsterhunterwiki.org/wiki/Module:MHWilds), [chanleyou/mhwilds-calculator](https://github.com/chanleyou/mhwilds-calculator), and the resources listed in [public/attributions.txt](public/attributions.txt). The adapted combat reference retains its MIT license and source revision. Game assets belong to CAPCOM.

Target game version: **1.042.00.03**. The snapshot includes 1.041 content such as Arkvulcan γ, as well as Gogmazios equipment. This does not certify that every value from every source includes all 1.042 hotfixes. The manifest records source URLs, revisions, and hashes; the interface explains coverage.

Transcendence data has been cross-checked with the wiki for **703 of 714 armor pieces**. The remaining 11 retain their documented standard upgrade maximum and display a warning rather than invented values.

## Engine guarantees and limitations

`src/engine/verify.js` reconstructs equipment from the catalog and checks every result: five distinct armor positions, permitted charm rolls, modeled legal Gogma configurations, decoration type/size/unique-slot use, and all required skill levels. It does not trust skill totals stored in imported JSON.

Required decorations are placed using exact backtracking and memoization, including combination jewels. Set/group bonuses use their documented piece thresholds, including Gogma weapon contributions. A bonus-vector feasibility check rejects impossible bonus combinations before exploring the equipment product.

The equipment search is progressive and visits weapon types in turns. Its exploration order is heuristic: a partial search cannot prove that a build is impossible. Each candidate represents equipment and one legal charm witness rather than every redundant charm roll. Charm rolls are projected onto required skills and selected relevant statistics while retaining distinct filler witnesses. The chosen charm is not exhaustively optimized for damage/defense. Optional jewels are filled by marginal improvement; Artian profiles are optimized for the scenario within the model. Therefore, **the ranking does not certify a global maximum**, although every emitted build passes the requirement verifier.

Damage is an **estimate per configured combo**, not DPS or a comparison normalized by attack duration. Reference formulas and motion values are not certified against every patch. Some skills and special mechanics are not modeled; builds list skills without a modeled numerical effect. Movements retain the reference source's names, while equipment and skills use game localization. Ammunition and shelling incompatible with a weapon are excluded from damage with a warning. Status buildup is not artificially converted into elemental damage per hit.

Theoretical profiles model attack/affinity infusions, attributes, and up to two sharpness/capacity reinforcements. Gogma uses the highest permitted tiers for each type within a profile; it does not enumerate every permutation or simulate a save file's RNG sequence. Ranged weapon properties and their changes with parts/ammunition are not fully simulated. Treat the optimizer as a planning tool pending in-game verification of all numerical special cases.

Material totals include documented forging recipes, prerequisite upgrade chains, and transcendence. They exclude Armor Spheres, random charm rolls, and guaranteed RNG costs for obtaining a specific Artian configuration.

## Updating data sources

Run these commands only during development, with Internet access:

```sh
npm run data:fetch
npm run data:build
npm run data:icons
npm run check:data
npm test
npm run build
npm run check:dist
```

Original downloads are stored in `.cache/sources/` (ignored by Git) and normalized into `public/data/database.json`. Commit the updated `public/data/` files and any new icons before pushing a release. Verify official patch notes and actual source coverage before increasing the target version. GitHub reference snapshots are pinned to revisions; changing those revisions requires reviewing the upstream changes.

To rebuild the adapted combat module:

```sh
npm run combat:fetch
npm run combat:build
```

`src/vendor/calculator/` retains the source files and license. `src/engine/combat-reference.mjs` is the generated module used by both the Worker and the tests.

## Verification

The engine/Worker tests cover an independent exhaustive oracle for 150 randomized decoration-placement cases, incompatible slots/ammunition, legal charm generation, set/group thresholds, transcendence, Gogma reinforcements, negative affinity and critical hits, conditional skills, traversal across all 14 weapon types, feasible/impossible searches, tampered-build detection, materials, and actual Worker pause/resume. Additional tests cover checkpoint serialization and exact continuation, archive transaction rollback, deduplication, snapshot pagination, another-tab protection, optional variants, and deployment-path isolation. A React/Worker/IndexedDB integration test closes and remounts the session and retries a failed storage transaction.

Component rendering is checked in both languages. Standalone reports execute in jsdom without external resources, exercising filtering, language switching, pagination, materials and escaped source text. A separate check executes the minified report client with a real Gogma configuration and writes `artifacts/example-search-report.html`. Production checks verify the bundled database, local assets, and offline precache manifest.

The production build has been verified locally. Automated visual inspection was unavailable because the browser access host was unavailable. Desktop and mobile appearance still need a visual review in an available browser; DOM-based interaction checks do not replace that review.
