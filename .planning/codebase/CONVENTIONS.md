# Conventions

## High-Level Patterns
- Next.js App Router code lives under `src/app/`.
- Each game route typically lives under `src/app/games/<slug>/` as `page.tsx` plus optional colocated modules (`utils.ts`, `renderer.ts`, `maps.ts`, `ai.ts`, `game.ts`, `progress.md`).
- Shared UI lives under `src/components/` (e.g. `layout/` chrome, `common/Container.tsx`, `GameCard.tsx`).
- The hub is registry-driven: `src/games/registry.ts` is the source of truth for metadata (id/title/icon/color/href/status).

## React / Component Style
- Predominantly function components with `export default function ...`.
- Interactive games are implemented as client components with `"use client";` at the top of the page module.
  - Exception exists for wrapper pages that embed standalone builds (e.g. `babylon-rpg` uses an `<iframe>` and does not declare `"use client"`).
- Hooks are used directly in pages; shared abstractions are minimal.
- Event listeners are generally installed via `useEffect()` with explicit cleanup.
  - When calling `preventDefault()` on key/touch handlers, listeners are often registered with `{ passive: false }` to allow it.

## Game Loop / State Management
Two common patterns appear:

1. React-state-driven (lower frequency, DOM-based UIs)
  - Games like Snake/Sudoku keep state in React via `useState()` and update on timers or input handlers.

2. Ref-driven (high frequency canvas games)
  - Canvas-heavy games maintain a mutable `stateRef` in `useRef()` and run a loop via `requestAnimationFrame` or fixed `setInterval`.
  - State transitions are often pure functions in colocated utils (e.g. `tick(state, dt)` returning a new state), with the page responsible for input mapping + drawing.
  - Persistence reads are guarded with `typeof window !== "undefined"` (e.g. hi-score from `localStorage`).

## Debug/Test Hooks (Window API)
Several games expose a minimal automation surface on `window`:
- `window.render_game_to_text?: () => string` returning a JSON string snapshot.
- `window.advanceTime?: (ms: number) => void | Promise<void>` to step the simulation deterministically in test runs.

Typical implementation details:
- Hooked up in a `useEffect()` after initialization.
- Some routes clean up on unmount (`delete window.render_game_to_text; delete window.advanceTime;`), but not all routes do.
- Some games detect automation via `navigator.webdriver` and switch behavior (for example: avoid rAF-driven loops and redraw from current state when driven externally).

## TypeScript Conventions
- Project is TypeScript strict (`tsconfig.json`), with `noEmit` and `moduleResolution: "bundler"`.
- Local types are commonly declared inline in the module (`type` and `interface` near the top).
- Utility modules export plain types + pure-ish functions; pages import and compose them.

## Styling / Icons
- Utility-first styling with UnoCSS.
  - Global entrypoint uses `@unocss;` in `src/app/globals.css`.
  - Classes are tailwind-like (e.g. `py-12 sm:py-16`, `rounded-3xl`, `shadow-xl`, `text-gray-600`).
- Icons are applied via Iconify classnames like `i-ph-...` on empty `<div/>` or `<span/>` elements.
- Many pages share layout rhythm:
  - Top-level vertical padding on pages (`py-*`).
  - A centered `Container` wrapper for consistent max width.
  - Mobile affordances via `sm:*` responsive utilities and explicit touch handlers.

## Formatting / Misc
- Quote style is mixed across the repo (both single and double quotes).
- Some modules include bilingual comments (English + Chinese), especially in utils.

