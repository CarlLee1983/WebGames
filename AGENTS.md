<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Snapshot

- Stack: Next.js `16.2`, React `19`, TypeScript, UnoCSS, Iconify Phosphor icons.
- Package manager: `bun` (`bun.lock` is committed).
- The app is a static-exported game hub. `next.config.ts` sets `output: "export"` and `images.unoptimized = true`.
- Source code lives under `src/`.
- Main hub page: `src/app/page.tsx`.
- Shared layout shell: `src/app/layout.tsx`, `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`.
- Shared container wrapper: `src/components/common/Container.tsx`.
- Game registry/source of truth: `src/games/registry.ts`.

# Current Routes

- Published game routes currently exist for:
  - `src/app/games/snake/page.tsx`
  - `src/app/games/tetris/page.tsx`
  - `src/app/games/gomoku/page.tsx`
  - `src/app/games/sudoku/page.tsx`
- `src/games/registry.ts` also contains planned entries. Do not mark a game as `published` unless its route exists and is playable.

# Implementation Rules

- Interactive games should stay as client components (`"use client"`). This repo is UI-heavy and game state lives in the browser.
- Keep game-specific pure logic next to the page when useful, e.g. `src/app/games/<slug>/utils.ts`.
- Prefer shared layout/chrome changes in `src/components/common` or `src/components/layout` instead of duplicating wrappers inside each page.
- Use the existing `@/*` path alias from `tsconfig.json`.
- Styling is utility-first via UnoCSS. Reuse the existing visual language before introducing new patterns.
- Icons are used via Iconify class names like `i-ph-...`.

# Static Export Constraints

- Avoid server-only features that break static export: API routes, server actions tied to request state, dynamic runtime dependencies, or anything requiring a Node server at runtime.
- Treat `out/` as generated build output. Do not hand-edit files there.

# Local Workflow

- Dev server: `bun dev`
- Lint: `bun run lint`
- Production export build: `bun run build`

# Change Checklist

- When adding a new game:
  - create `src/app/games/<slug>/page.tsx`
  - add/update its entry in `src/games/registry.ts`
  - keep `status` aligned with actual route readiness
  - reuse `Container` and the existing card/navigation patterns unless there is a clear reason not to
- When changing gameplay logic, run `bun run lint` and manually smoke-test the affected route in the browser. There is no dedicated automated gameplay test suite yet.
