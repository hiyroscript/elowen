# Elowen

A quiet collection of browser-based productivity tools. This implementation follows the build brief in `upd` and uses the supplied `elowen.PNG` branding.

## Run locally

There is no build step or runtime dependency. Serve this directory with any static server, for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. The pages and calculator also work from local files where the browser allows localStorage; offline installation requires HTTP on localhost or HTTPS.

## Publish on GitHub Pages

After merging, select **Settings → Pages → Deploy from a branch → main → / (root)** in this repository. No backend, secrets, or build command is required. All ordinary page and asset links are relative and support the `/elowen/` project path.

The custom 404 page resolves nested missing URLs to `/elowen/` on this repository’s project site, or `/` on a root/custom-domain site. Update its small base-path resolver if the repository is renamed. A sitemap is intentionally omitted until the production URL is confirmed; `robots.txt` is included (search engines normally request robots at the domain root).

## Features

- Responsive, searchable tool directory with SVG icons and a warm neutral palette.
- Scientific calculator: safe expression parsing, precedence, parentheses, real-number functions, degrees/radians, factorial, percentages, memory, and keyboard input.
- Up to 500 local history entries, expression/result restoration, memory, and preferences.
- Versioned JSON export/import, field validation, safe text rendering, overwrite confirmation, and local-data deletion.
- Privacy, terms, data management, and custom 404 pages.
- Lightweight installable manifest and offline caching of the site’s own files. Online requests try the network first. A new service worker activates after existing tabs close; bump `CACHE` in `service-worker.js` whenever cached files change.
- No analytics, external scripts, external fonts, accounts, cookies, or data APIs.

## Calculator conventions

The parser never uses `eval` or `Function`. Expressions are bounded to 2,000 characters and a bounded nesting depth. Operations use JavaScript floating-point numbers and display up to 12 significant digits. Very small and large results use scientific notation. Real-number domain errors and overflow produce recoverable messages.

`%` always divides its preceding operand by 100: `150 * 20%` is 30; `150 * (1 + 20%)` is 180. Powers associate right-to-left, and precede unary minus. Implicit multiplication is supported for constants, functions, and parenthesized groups. Scientific buttons wrap selected text or a completed result, otherwise they insert at the cursor. See the calculator’s help panel for keyboard and memory controls.

## Data and maintenance

`js/storage.js` owns the localStorage key `elowen.data.v1` and backup schema. Backups contain a format identifier, version, export timestamp, tool data, and preferences. Imports are limited to 2 MB and known fields; unsupported versions are rejected. Storage failures show a warning and preserve the working session in memory so users can export it. Multiple tabs share browser storage; avoid editing separate sessions simultaneously, since the latest saved session wins.

Add a tool’s accessible HTML card in `index.html` and metadata in `js/tools.js`. Global styles and navigation are separate from calculator-specific code. Static headers/footers are intentionally present in each HTML document so navigation and legal content work without JavaScript; update all six pages when changing them. The PWA icons are size variants of the original logo, composited onto Warm Sand without distortion.

## Tests

Calculation and backup tests use the Node.js built-in test runner (Node 20+):

```sh
npm test
```

Browser tests use Playwright as a development-only dependency:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

The browser suite starts its own static server under `/elowen/`. It checks search, arithmetic, keyboard input, memory, saved history, reloads, backup download/import, destructive confirmations, hostile imported text, desktop/mobile layouts, asset URLs, visible focus, reduced motion, and offline use. Screenshots go to the ignored `test-results/` directory. No Node.js or npm installation is needed on GitHub Pages.
