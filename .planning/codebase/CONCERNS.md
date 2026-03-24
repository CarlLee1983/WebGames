# Codebase Concerns

This document lists risks and maintenance concerns observed in `/Users/carl/Dev/Carl/web-games`, with emphasis on static export constraints, route/registry mismatches, duplication, and verification gaps.

## P0: Static Export + `basePath` Breakages

- **Hard-coded absolute asset paths bypass `basePath`.**
  - `next.config.ts` sets `basePath: "/WebGames"` in production. Anything using raw `"/..."` URLs will likely break when deployed under `/WebGames`.
  - Example: `src/app/games/babylon-rpg/page.tsx` embeds `public/games/babylon-rpg/app.html` via an iframe `src="/games/babylon-rpg/app.html"`, which points to site-root, not `/WebGames/...`.
  - Impact: Babylon RPG route can render, but the iframe can 404 in production hosting (GitHub Pages style).
  - Mitigation: avoid absolute paths inside app code. Prefer `next/link` for navigation and introduce a single `NEXT_PUBLIC_BASE_PATH` (or similar) for raw asset URLs used by iframes/canvas apps, then build `src={`${basePath}/games/babylon-rpg/app.html`}`.

- **Embedded Babylon RPG HTML uses a brittle `basePath` detector.**
  - `public/games/babylon-rpg/app.html` uses `location.pathname.includes("/WebGames/")` to infer basePath.
  - Impact: basePath rename breaks runtime loads of JSON chapters; behavior differs between local/dev/prod hosting.
  - Mitigation: make base path explicit (query param like `?base=/WebGames`, `<base href>`, or inject a known global from the parent page) rather than hard-coding the string.

## P1: Registry vs Route Integrity (Drift Risk)

- **Registry is the source of truth, but there’s no enforcement that `published` implies “route exists and is playable”.**
  - Today: many `published` entries exist and corresponding routes appear present under `src/app/games/*`.
  - Risk: future entries can drift (a `published` registry entry without a working route) and the hub will surface broken links.
  - Mitigation: add a lightweight verification step (script or CI check) that compares `GAME_REGISTRY` `href`s against `src/app/games/<slug>/page.tsx` existence, and optionally runs a minimal Playwright navigation smoke for all `published` games.

- **Project docs appear stale relative to actual routes.**
  - `AGENTS.md` lists only a small set of “published game routes”, but the repo contains many more.
  - Impact: contributors can follow the wrong rules (e.g., status expectations) and accidentally regress publish readiness.
  - Mitigation: keep `AGENTS.md` updated or make it describe rules rather than enumerating specific routes.

## P1: Production Pollution From Test Hooks

- **Several games export test helpers on `window` (`render_game_to_text`, `advanceTime`).**
  - Examples include `kids-stair-rush`, `ice-blocks`, `tetris`, `zookeeper`, `fire-emblem`, `monopoly`, `battleship-blitz`.
  - Some routes gate behavior with `navigator.webdriver`, others attach helpers unconditionally.
  - Impact: increased surface area, accidental API compatibility commitments, and potential for conflicting names across games.
  - Mitigation: gate these behind `process.env.NODE_ENV !== "production"` (or a dedicated `NEXT_PUBLIC_TEST_HOOKS=1`), and namespace them (e.g. `window.__webGamesTestHooks = { tetris: {...} }`) to avoid collisions.

## P2: “Client-Only” Boundaries Are Easy To Accidentally Violate

- **Browser APIs used in utility modules can become footguns if imported by non-client components.**
  - Example: direct `localStorage` usage exists in some `utils.ts` modules.
  - Today: these modules are imported from `"use client"` pages, so they’re safe.
  - Risk: importing these utils from a server component (even indirectly) will crash builds or exports.
  - Mitigation: keep browser-API code in clearly named modules (`*.client.ts`) or guard access consistently (`typeof window !== "undefined"`).

## P2: Performance / Bundle Size Risks

- **Large client pages and heavy dependencies can degrade build and runtime.**
  - `@babylonjs/*`, `pixi.js`, and `matter-js` are installed. If accidentally imported into shared components or the hub page, the baseline JS payload can balloon.
  - Impact: slow initial load, slow static export build, potential memory spikes during `next build`.
  - Mitigation: ensure heavy libs are only imported within their specific game route modules; consider dynamic imports or iframe isolation for the heaviest experiences.

## P3: UX/Correctness Nits That Can Become Issues

- **Whack-a-mole audio uses placeholder `data:` URIs with `...` in the base64 string.**
  - `new Audio("data:audio/wav;base64,UklGRl9vT19XQVZF...")` is not valid base64 as written.
  - Impact: noisy console errors or inconsistent audio init across browsers.
  - Mitigation: remove placeholders or replace with valid audio assets.

- **Footer year is computed at build time if rendered as a server component.**
  - `src/components/layout/Footer.tsx` uses `new Date().getFullYear()`.
  - Impact: the year won’t update unless the site is rebuilt after New Year (minor for a static hub).
  - Mitigation: accept it, or render it client-side if “always current” matters.

## Verification Gaps (Cross-Cutting)

- **No centralized smoke test suite for “published” games.**
  - Playwright exists in dependencies, and some ad-hoc scripts appear to exist, but there’s no uniform “all published routes load and respond to basic inputs” check.
  - Recommendation: add a minimal Playwright runner that:
    - loads `/` and verifies cards render,
    - navigates each `published` game route,
    - waits for a stable “ready” signal (per-game),
    - captures a screenshot and checks console errors.

