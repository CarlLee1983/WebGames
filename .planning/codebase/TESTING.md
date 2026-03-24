# Testing

## What Exists Today

### Linting
- Primary quality gate is ESLint: `bun run lint`
  - Config: `eslint.config.mjs` uses `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.
  - Ignores include `.next/**`, `out/**`, `build/**`, `next-env.d.ts`.

### Browser Automation (Ad-Hoc)
Playwright is installed (`playwright` in `devDependencies`), but there is no formal Playwright config or `package.json` test script. Instead, the repo contains ad-hoc smoke scripts:

- `test-monopoly.js`
  - Opens `http://localhost:3000/games/monopoly`
  - Asserts a `<canvas>` exists
  - Reads `window.render_game_to_text()` snapshot if present
  - Sends an input (`d`) and re-reads snapshot
  - Captures a screenshot to `/tmp/monopoly-test.png`

- `test-monopoly-simple.js`
  - Tries multiple local ports (3000/4002/5173) and performs a basic load check.

- `scripts/babylon-rpg-smoke.mjs`
  - Opens a provided URL (default `http://localhost:3000/games/babylon-rpg`)
  - Waits for `<canvas>` visibility
  - Logs `SNAPSHOT:*` from `window.render_game_to_text()` if available
  - Sends a short key sequence and captures a screenshot (default `/tmp/babylon-rpg-smoke.png`)
  - Captures console/page errors for debugging

The presence of `test-results/.last-run.json` suggests some local harness usage, but there is no wired CI/test runner in repo scripts.

## Testability Hooks Built Into Games
Multiple game pages expose automation-friendly hooks:
- `window.render_game_to_text()`: returns a JSON string snapshot of current game state (or UI-relevant subset).
- `window.advanceTime(ms)`: advances simulation time deterministically for automation.

These are used by Playwright scripts to validate that:
- The route loads and renders (often via `<canvas>`),
- The game state can be introspected without scraping pixels,
- Input changes state predictably.

In at least one route, `navigator.webdriver` is used to alter runtime behavior under automation (for example, skipping rAF and relying on explicit time-advancement + redraw).

## Recommended Local Verification Loop (Current Reality)
- Start dev server: `bun dev`
- Smoke test manually in browser:
  - Visit `/` hub and click into new/changed game routes.
  - Verify keyboard/touch controls, pause/restart, and any persistence behavior.
- Run lint: `bun run lint`
- Validate static export build: `bun run build` (ensures static-export constraints continue to hold).
- Optional automation:
  - Run the existing Playwright smoke scripts against a running dev server for regression checks on the specific game.

## Gaps / Risks
- No unit test suite (no Vitest/Jest) for pure logic modules.
- No standardized Playwright project (`playwright.config.*`) or `bun test` script, so automation is not consistently run.
- Not all pages clean up `window.render_game_to_text` / `window.advanceTime` on unmount, which can cause cross-route leakage in long-lived SPA-like sessions or multi-route automation.

