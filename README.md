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
- Receive progressive results from a Web Worker that keeps searching until the modeled equipment combinations are exhausted or you pause it manually. Resume preserves search progress; the best 20 or 50 builds are retained without stopping the search when that result count is reached.
- Save builds in the browser and export/import JSON, validating imported builds against the installed dataset.
- Browse a local catalog of equipment, skills, items, and monsters.

The optimizer does not call external services. Initial loading requests static files from the website's own origin.

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

The engine/Worker tests cover an independent exhaustive oracle for 150 randomized decoration-placement cases, incompatible slots/ammunition, legal charm generation, set/group thresholds, transcendence, Gogma reinforcements, negative affinity and critical hits, conditional skills, traversal across all 14 weapon types, feasible/impossible searches, tampered-build detection, materials, and actual Worker pause/resume. Additional offline-cache tests check deployment-path isolation.

Component rendering is checked in both languages, and production checks verify the bundled database, local assets, and offline precache manifest.

The production build has been verified locally. Automated visual inspection was unavailable because the computer-use tool could not establish Brave's current URL with sufficient confidence. Responsive layouts and interactive browser behavior still need a visual review in an available browser.
