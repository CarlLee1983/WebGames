# Integrations

## External (Libraries)
- Next.js App Router: routing/layouts under `src/app/*` with `next/link` navigation.
- UnoCSS: PostCSS plugin `@unocss/postcss` and runtime utility-class styling; `presetIcons` configured with `cdn: "https://esm.sh/"`.
- Iconify (Phosphor): icon classes like `i-ph-...` with icon data via `@iconify-json/ph`.
- Rendering/engines:
  - Babylon.js: `@babylonjs/core`, `@babylonjs/loaders` for 3D-capable games/experiments.
  - Pixi.js: `pixi.js` for 2D rendering.
  - matter-js: physics simulation.
- Playwright (dev): present for browser automation/smoke testing, though not exposed via npm scripts.

## External (Hosting / Environment)
- Static export hosting: production `basePath` is `"/WebGames"` and `public/.nojekyll` exists, which aligns with GitHub Pages-style deployment.

## Browser APIs Used By Games
- Canvas rendering (e.g., `public/games/babylon-rpg/app.html` uses a `<canvas>` + JS loop).
- Persistence: IndexedDB (preferred) with localStorage fallback (Babylon RPG embed).
- Fullscreen, keyboard input, and other standard DOM APIs (varies per game).

## Internal (Repo Modules)
- Game registry (source of truth): `src/games/registry.ts`
  - Drives hub listing via `getPublishedGames()`.
  - Each entry specifies `href`, `status`, and UI metadata (icon/color).
- Shared chrome:
  - Layout: `src/app/layout.tsx` mounts `Navbar` + `Footer`.
  - `Navbar` links to the external GitHub repo.
- Shared UI primitives:
  - `src/components/common/Container.tsx` (layout wrapper sizing).
  - `src/components/GameCard.tsx` (home page cards, icon + color tokens).

## Embedded/Standalone Assets
- `public/games/babylon-rpg/app.html` is loaded via `<iframe>` from the Next route.
  - It contains its own JS/CSS and handles `basePath` detection for `"/WebGames"`.

