# Gomoku AI Difficulty Design

**Date:** 2026-03-27

**Goal**

Add `Easy`, `Normal`, and `Hard` computer difficulty levels to `/games/gomoku` so solo play is less punishing while keeping the current stronger AI available.

## Scope

This spec covers only the existing `Vs Computer` mode in `src/app/games/gomoku/`.

Included:
- Difficulty selection UI for solo mode
- Difficulty-aware move selection in the AI helper
- Reset behavior when difficulty changes
- Deterministic tests for difficulty-specific AI behavior

Excluded:
- Full minimax or multi-turn search
- Online play or matchmaking
- Persisting difficulty across page reloads

## Existing Context

- The route is a client page in `src/app/games/gomoku/page.tsx`.
- Board rules and AI scoring already live in `src/app/games/gomoku/utils.ts`.
- Current AI is effectively one fixed strong mode:
  - always takes an immediate win
  - always blocks the player's immediate win
  - otherwise selects the top-scoring move

## Product Behavior

### Modes

- `Local 2P` remains unchanged and does not show difficulty controls.
- `Vs Computer` shows a second segmented control with:
  - `Easy`
  - `Normal`
  - `Hard`

### Difficulty Change

- Difficulty is only configurable while `Vs Computer` is active.
- Changing difficulty immediately resets the solo board to a fresh game.
- Switching between `Local 2P` and `Vs Computer` still resets the game as it does today.

### Difficulty Semantics

- `Hard`
  - keeps current behavior
  - takes immediate wins
  - blocks immediate losses
  - otherwise plays the highest-scoring move

- `Normal`
  - still takes immediate wins
  - still blocks immediate losses
  - otherwise chooses from a small top-ranked candidate pool instead of always taking the single best move
  - uses weighted randomness so higher-scoring moves are still favored

- `Easy`
  - still takes immediate wins
  - still blocks immediate losses
  - otherwise chooses from a larger candidate pool
  - reduces defensive weighting so the AI misses some of the stronger positional replies
  - keeps enough bias toward the center and good shapes to avoid obviously random play

## Technical Design

### File Responsibilities

- `src/app/games/gomoku/page.tsx`
  - own UI state for selected difficulty
  - show/hide difficulty controls based on current mode
  - reset the game when difficulty changes
  - pass selected difficulty into AI turn resolution

- `src/app/games/gomoku/utils.ts`
  - define `AiDifficulty`
  - expose `getComputerMove(board, difficulty, rng?)`
  - centralize difficulty profiles and candidate selection rules

- `src/app/games/gomoku/utils.test.ts`
  - preserve current strong-mode checks
  - add difficulty-specific tests using injected RNG

### AI API

Add a public difficulty type:

```ts
export type AiDifficulty = "easy" | "normal" | "hard";
```

Change the AI entrypoint to:

```ts
export function getComputerMove(
  board: Board,
  difficulty: AiDifficulty,
  rng: () => number = Math.random,
): Move | null
```

### Candidate Selection Strategy

All difficulties share the same candidate generation and immediate tactical checks:

1. Generate local candidates near existing stones
2. If White has an immediate winning move, play it
3. If Black has an immediate winning move next turn, block it
4. Otherwise score all candidates and apply a difficulty-specific chooser

Difficulty-specific chooser:

- `Hard`
  - sort by score descending
  - return the best move

- `Normal`
  - sort by score descending
  - keep a small top pool
  - choose with weighted randomness based on rank/score

- `Easy`
  - sort by score descending
  - use lower defense influence in the score blend
  - keep a larger top pool
  - choose with flatter weighted randomness

## UI Design

- Reuse the existing amber segmented-control style from the mode switcher.
- Place difficulty controls adjacent to the mode switcher in the top-right action area.
- Only render the difficulty controls when `gameMode === "computer"`.
- Highlight the current difficulty clearly.
- Keep labels in English to match existing route copy: `Easy`, `Normal`, `Hard`.

## State Flow

When the player switches to `Vs Computer`:
- initialize a fresh solo game
- keep default difficulty at `Normal`

When the player changes difficulty during `Vs Computer`:
- update `difficulty`
- clear any scheduled AI timeout
- reset to a fresh board

When the AI turn runs:
- read the current `difficulty`
- call `getComputerMove(board, difficulty)`
- apply the returned move as White

## Testing

### Unit Tests

Keep current tests:
- center opening on an empty board
- immediate winning move
- immediate blocking move

Add difficulty coverage:
- `Hard` still picks the highest-scoring move in a deterministic non-forced position
- `Normal` can pick a second-tier move when RNG pushes it away from the top option
- `Easy` can pick from a wider pool and uses weaker defense weighting in non-forced positions

### Manual Verification

Smoke-test `/games/gomoku`:
- switch to `Vs Computer`
- confirm `Easy / Normal / Hard` controls render
- confirm changing difficulty resets the board
- confirm the AI still responds after a player move on every difficulty
- confirm `Local 2P` hides the difficulty controls

## Risks

- Too much randomness can make `Easy` feel broken instead of approachable
- Too little randomness can make `Normal` feel identical to `Hard`
- Difficulty tests can become flaky if randomness is not injected

## Acceptance Criteria

- Solo mode exposes `Easy`, `Normal`, and `Hard`
- Difficulty changes reset the solo board
- `Hard` preserves current tactical strength
- `Normal` and `Easy` feel weaker without missing immediate win/block tactics
- AI logic remains in `utils.ts`
- Difficulty behavior is covered by deterministic unit tests
