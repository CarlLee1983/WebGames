# Stack

## Summary
Static-exported Next.js game hub built with React + TypeScript and styled via UnoCSS utility classes. Games are implemented as client-side pages under the App Router, with some heavier experiences using dedicated render/engine libs (Babylon.js, Pixi.js, matter-js).

## Core Framework
- Next.js: `16.2.0` (App Router under `src/app/`)
- React / React DOM: `19.2.4`
- TypeScript: `^5` (strict; noEmit)
- Package manager/runtime: `bun` (lockfile committed: `bun.lock`)

## Rendering / Styling
- Styling: UnoCSS (`unocss`, `@unocss/postcss`)
  - Presets: `presetUno`, `presetTypography`, `presetIcons` (cdn configured as `https://esm.sh/`)
- Icons: Phosphor via Iconify classnames (e.g. `i-ph-...`)
  - Icon dataset dependency: `@iconify-json/ph`
- Fonts: `next/font/google` (Geist + Geist Mono in root layout)

## Game/Graphics/Physics Libraries
- `@babylonjs/core`, `@babylonjs/loaders` (3D engine + asset loading)
- `pixi.js` (2D renderer)
- `matter-js` (2D physics)

## Tooling
- Linting: ESLint `^9` with `eslint-config-next` (core-web-vitals + typescript)
- E2E tooling present: Playwright `^1.58.2` (no formal test suite appears wired into `package.json` scripts)

## Build & Deploy Constraints (Static Export)
From `next.config.ts`:
- `output: "export"`: site is built as static files (no Node server at runtime).
- `images.unoptimized = true`: Next image optimization is disabled (required for static export).
- `basePath`: production builds use `"/WebGames"` (common for GitHub Pages-style hosting).

Implications:
- Avoid server-only Next features (API routes, request-bound server actions, runtime SSR dependencies).
- Prefer browser-safe storage/input/rendering (Canvas/Web APIs) and keep gameplay logic client-side.

