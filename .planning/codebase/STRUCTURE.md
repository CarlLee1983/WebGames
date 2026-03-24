# Structure

## Top-Level Layout

- `src/`: application source (App Router).
- `public/`: static assets served as-is (including embedded game builds under `public/games/`).
- `out/`: generated static export output (do not hand-edit).
- `.next/`: Next.js build artifacts (generated).
- `.planning/`: planning artifacts (this mapping lives in `.planning/codebase/`).

## App Router Entry Points

- `src/app/layout.tsx`: root layout shell, global fonts, navbar/footer, `<main>` region.
- `src/app/page.tsx`: hub page listing games from the registry.
- `src/app/globals.css`: UnoCSS entry (`@unocss;`) plus minimal body defaults.

## Shared UI Components

- `src/components/common/Container.tsx`: reusable width/padding wrapper.
- `src/components/GameCard.tsx`: hub card component; renders registry metadata and links to game routes.
- `src/components/layout/Navbar.tsx`: global navigation.
- `src/components/layout/Footer.tsx`: global footer.

## Game Registry (Source Of Truth)

- `src/games/registry.ts`
  - `GAME_REGISTRY`: list of games with `href` and display metadata.
  - `status` is used to filter what appears on the hub (`getPublishedGames()`).

## Game Route Layout

Every game is organized as a folder under `src/app/games/<slug>/`:

- Required: `page.tsx`
- Optional (common): `utils.ts` for game logic/state transitions and constants.
- Optional (less common): additional modules (`renderer.ts`, `maps.ts`, `ai.ts`, `game.ts`) when a game grows beyond a single file.
- Optional docs: `progress.md` as a lightweight design/dev log.

Current game route folders (each contains `page.tsx`):

- `src/app/games/babylon-rpg/`
- `src/app/games/battle-city/`
- `src/app/games/battleship-blitz/`
- `src/app/games/city-builder/`
- `src/app/games/deep-sea-penguin/`
- `src/app/games/farm/`
- `src/app/games/fire-emblem/`
- `src/app/games/gomoku/`
- `src/app/games/ice-blocks/`
- `src/app/games/kids-stair-rush/`
- `src/app/games/lights-out/`
- `src/app/games/memory-match/`
- `src/app/games/monopoly/`
- `src/app/games/puzzle-bobble/`
- `src/app/games/snake/`
- `src/app/games/sudoku/`
- `src/app/games/tetris/`
- `src/app/games/whack-a-mole/`
- `src/app/games/zookeeper/`

## Static Embedded Game Assets

- `public/games/babylon-rpg/`
  - `app.html`: embedded build entrypoint loaded by the Babylon RPG route.
  - `levels/*.json`: data-driven chapter configuration.

## Configuration Files That Shape Structure

- `next.config.ts`: static export settings and production `basePath`.
- `tsconfig.json`: TypeScript config including the `@/*` path alias to `src/*`.
- `uno.config.ts`: UnoCSS presets (including Iconify preset used via `i-ph-*` classnames).
- `postcss.config.mjs`: UnoCSS PostCSS plugin hookup.

