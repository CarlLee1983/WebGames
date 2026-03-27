# Gomoku AI Difficulty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Easy`, `Normal`, and `Hard` difficulty levels to Gomoku solo mode so the computer can feel less punishing without removing the current strong AI.

**Architecture:** Keep all board rules and AI selection logic in `src/app/games/gomoku/utils.ts`, and keep `src/app/games/gomoku/page.tsx` focused on UI state, controls, and AI turn scheduling. Add deterministic tests by injecting a custom RNG into the AI helper.

**Tech Stack:** Next.js 16 client page, React 19 state/effects, TypeScript, Bun test, ESLint

---

### Task 1: Add failing AI difficulty tests

**Files:**
- Modify: `src/app/games/gomoku/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe("getComputerMove difficulty", () => {
  test("hard keeps the strongest move in a non-forced position", () => {
    const move = getComputerMove(board, "hard", () => 0.99);
    expect(move).toEqual({ row: 7, col: 9 });
  });

  test("normal can pick a second-tier move when rng pushes it away from the best move", () => {
    const move = getComputerMove(board, "normal", () => 0.95);
    expect(move).toEqual({ row: 8, col: 9 });
  });

  test("easy can pick from a wider pool than normal", () => {
    const move = getComputerMove(board, "easy", () => 0.98);
    expect(move).toEqual({ row: 9, col: 8 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/games/gomoku/utils.test.ts`
Expected: FAIL because `getComputerMove` does not yet accept a difficulty or injected RNG.

- [ ] **Step 3: Commit**

```bash
git add src/app/games/gomoku/utils.test.ts
git commit -m "test: add gomoku ai difficulty coverage"
```

### Task 2: Implement difficulty-aware AI

**Files:**
- Modify: `src/app/games/gomoku/utils.ts`
- Test: `src/app/games/gomoku/utils.test.ts`

- [ ] **Step 1: Write the minimal public API**

```ts
export type AiDifficulty = "easy" | "normal" | "hard";

export function getComputerMove(
  board: Board,
  difficulty: AiDifficulty,
  rng: () => number = Math.random,
): Move | null
```

- [ ] **Step 2: Add difficulty profiles for non-forced move selection**

```ts
const DIFFICULTY_SETTINGS = {
  easy: { attackWeight: 1.05, defenseWeight: 0.58, poolSize: 8, randomnessBias: 0.45 },
  normal: { attackWeight: 1.1, defenseWeight: 0.82, poolSize: 4, randomnessBias: 0.72 },
  hard: { attackWeight: 1.15, defenseWeight: 1, poolSize: 1, randomnessBias: 1 },
} satisfies Record<AiDifficulty, {
  attackWeight: number;
  defenseWeight: number;
  poolSize: number;
  randomnessBias: number;
}>;
```

- [ ] **Step 3: Keep forced tactics, vary only the fallback chooser**

```ts
for (const candidate of candidates) {
  const result = playMove(board, candidate.row, candidate.col, "white");
  if (result?.winner === "white") return candidate;
}

for (const candidate of candidates) {
  const result = playMove(board, candidate.row, candidate.col, "black");
  if (result?.winner === "black") return candidate;
}
```

- [ ] **Step 4: Score candidates and pick from a difficulty-sized pool**

```ts
const ranked = candidates
  .map((candidate) => ({
    move: candidate,
    score:
      evaluateMove(board, candidate.row, candidate.col, "white") * settings.attackWeight +
      evaluateMove(board, candidate.row, candidate.col, "black") * settings.defenseWeight +
      centerBias(candidate),
  }))
  .sort((left, right) => right.score - left.score);

return chooseRankedMove(ranked.slice(0, settings.poolSize), settings.randomnessBias, rng);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/app/games/gomoku/utils.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/games/gomoku/utils.ts src/app/games/gomoku/utils.test.ts
git commit -m "feat: add gomoku ai difficulty profiles"
```

### Task 3: Wire difficulty controls into the page

**Files:**
- Modify: `src/app/games/gomoku/page.tsx`

- [ ] **Step 1: Add page state for solo difficulty**

```ts
const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");
```

- [ ] **Step 2: Reset solo state when difficulty changes**

```ts
function changeDifficulty(nextDifficulty: AiDifficulty) {
  if (nextDifficulty === difficulty) return;
  clearScheduledAiMove(aiTimeoutRef);
  setDifficulty(nextDifficulty);
  setGame(createInitialGameState());
}
```

- [ ] **Step 3: Pass difficulty into the AI turn**

```ts
const move = getComputerMove(game.board, difficulty);
```

- [ ] **Step 4: Render controls only in `Vs Computer`**

```tsx
{isComputerMode && (
  <div className="flex rounded-2xl bg-amber-100 p-1 shadow-inner shadow-amber-900/10">
    {(["easy", "normal", "hard"] as AiDifficulty[]).map((level) => (
      <button key={level} onClick={() => changeDifficulty(level)}>
        {level[0].toUpperCase() + level.slice(1)}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 5: Update copy to show current solo difficulty**

```tsx
<p className="mt-1 text-sm text-gray-500">
  {isComputerTurn
    ? `Computer is evaluating the board on ${difficulty}.`
    : `Difficulty: ${difficulty[0].toUpperCase() + difficulty.slice(1)}.`}
</p>
```

- [ ] **Step 6: Run target lint**

Run: `./node_modules/.bin/eslint src/app/games/gomoku/page.tsx src/app/games/gomoku/utils.ts src/app/games/gomoku/utils.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/games/gomoku/page.tsx
git commit -m "feat: add gomoku difficulty controls"
```

### Task 4: Manual verification and notes

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run manual verification commands**

Run:
```bash
bun test src/app/games/gomoku/utils.test.ts
./node_modules/.bin/eslint src/app/games/gomoku/page.tsx src/app/games/gomoku/utils.ts src/app/games/gomoku/utils.test.ts
```

Expected: PASS

- [ ] **Step 2: Smoke-test the route**

Run a local browser automation check against `http://localhost:3000/games/gomoku`.
Expected:
- `Vs Computer` shows `Easy / Normal / Hard`
- changing difficulty clears the board
- AI still responds after the player move
- `Local 2P` hides the difficulty controls

- [ ] **Step 3: Record verification in `progress.md`**

```md
- 2026-03-27: Added Gomoku AI difficulty levels with deterministic tests and verified the solo difficulty switch/reset flow.
```
