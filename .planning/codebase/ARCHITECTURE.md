# Architecture

## System Overview

This repo is a **static-exported Next.js App Router** game hub. It has:

- A hub landing page that lists games from a single registry (`GAME_REGISTRY`).
- One route per game under `/games/<slug>`.
- No backend/API layer. Game state and rendering live entirely in the browser.

The production build is configured for static export (`output: "export"`), with a production `basePath` of `/WebGames` (see `next.config.ts`).

## Rendering Model (Server vs Client)

- App Router pages are **server components by default**.
- Interactive games are implemented as **client components** via `"use client"` and React state/effects.
- Non-interactive shell pages can remain server components.

Examples:

- `src/app/games/snake/page.tsx`: client component, pure React state, `setInterval` tick loop.
- `src/app/games/battle-city/page.tsx`: client component, `requestAnimationFrame` loop driving a canvas renderer.
- `src/app/games/babylon-rpg/page.tsx`: server component wrapping an `<iframe>` that loads a static build from `public/`.

## Navigation And Shared Shell

Global chrome is defined in the root layout:

- `src/app/layout.tsx`: `<Navbar />`, `<Footer />`, and `<main>` container; global metadata; fonts via `next/font/google`.
- `src/components/layout/Navbar.tsx`: sticky top nav, home link, and GitHub external link.
- `src/components/layout/Footer.tsx`: static footer with icon set and build stack text.

Most pages use a shared wrapper:

- `src/components/common/Container.tsx`: width/padding wrapper with `size` variants (sm/md/lg/xl/full).

## Hub Page And Registry-Driven Game Model

The hub page uses the registry as the source of truth:

- `src/games/registry.ts` defines `GameDef` metadata: `id`, `title`, `description`, `icon` (UnoCSS Iconify class), `href`, `color`, `status`.
- `getPublishedGames()` filters the registry by `status === "published"`.
- `src/app/page.tsx` renders the published list using `GameCard`.
- `src/components/GameCard.tsx` is a `next/link` card UI to `href`.

Status is the only gating mechanism on the hub today:

- `published`: appears on the hub and is expected to have a working route.
- `planned`/`beta`: currently excluded from the hub (but may be used later for “coming soon” UI).

## Route Organization (Games)

All game routes live under:

- `src/app/games/<slug>/page.tsx`

Each game typically follows one of these implementation styles:

1. **Pure React UI + small state machine**
   - State is managed with React hooks and DOM events.
   - Often no extra files beyond `page.tsx`.
   - Example: `snake`.

2. **React shell + functional core (local utils module)**
   - `page.tsx` handles input + lifecycle.
   - `utils.ts` holds pure logic/state transitions/constants (easy to test manually).
   - Examples: `tetris`, `lights-out`, `memory-match`, `zookeeper`, `monopoly`, `sudoku`, etc.

3. **Canvas/Pixi engine modules**
   - `page.tsx` mounts a canvas/container element and calls a local engine entrypoint.
   - Example: `deep-sea-penguin` uses Pixi (`src/app/games/deep-sea-penguin/game.ts`).

4. **Multi-module “mini engine”**
   - Clean separation between state updates, rendering, data, and AI.
   - Example: `battle-city`:
     - `utils.ts`: game state + tick/input actions
     - `renderer.ts`: draw routines
     - `maps.ts`: stage definitions
     - `ai.ts`: enemy behavior

## Static Assets And Embedded Builds

Some routes load assets from `public/` rather than bundling them into the React build:

- `public/games/babylon-rpg/app.html` and JSON level files are served statically.
- `src/app/games/babylon-rpg/page.tsx` embeds the HTML via an `<iframe>`.

This pattern keeps heavier non-React builds isolated and compatible with static export.

