import { describe, expect, test } from "bun:test";
import {
  COLS,
  MIN_CHAIN_LENGTH,
  ROWS,
  TARGET_SCORE,
  applyGravity,
  beginSelection,
  countValidMoves,
  createInitialState,
  extendSelection,
  findHintPath,
  getChainPreview,
  getRankOutlook,
  getSafariRank,
  isPathValid,
  requestHint,
  resolveSelection,
  scoreChain,
  startGame,
  type AnimalType,
  type Board,
  type GameState,
  type Point,
} from "./utils";

const lionBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array<AnimalType>(COLS).fill("lion"));

function playingState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...startGame(createInitialState(1234)),
    board: lionBoard(),
    validMoveCount: 1,
    ...overrides,
  };
}

describe("Zookeeper rules", () => {
  test("creates a deterministic playable six-by-six safari", () => {
    const first = createInitialState(2026);
    const second = createInitialState(2026);

    expect(first.mode).toBe("ready");
    expect(first.board).toEqual(second.board);
    expect(first.board).toHaveLength(ROWS);
    expect(first.board.every((row) => row.length === COLS)).toBe(true);
    expect(first.validMoveCount).toBeGreaterThan(0);
    expect(first.targetScore).toBe(TARGET_SCORE);
  });

  test("only accepts adjacent, unique paths of matching animals", () => {
    const board = lionBoard();
    const valid = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }];

    expect(isPathValid(board, valid)).toBe(true);
    expect(isPathValid(board, valid.slice(0, 2))).toBe(false);
    expect(isPathValid(board, [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }])).toBe(false);
    expect(isPathValid(board, [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 0 }])).toBe(false);
  });

  test("rewards longer chains with a quadratic bonus", () => {
    expect(scoreChain(3)).toBe(180);
    expect(scoreChain(4)).toBe(350);
    expect(scoreChain(5)).toBe(560);
    expect(scoreChain(6)).toBe(810);
    expect(getChainPreview(2)).toEqual({
      length: 2,
      points: 0,
      animalsNeeded: 1,
      isValid: false,
    });
    expect(getChainPreview(5)).toEqual({
      length: 5,
      points: 560,
      animalsNeeded: 0,
      isValid: true,
    });
  });

  test("finds a traceable three-animal hint without changing the board", () => {
    const state = playingState();
    const originalBoard = state.board.map((row) => [...row]);
    const hint = findHintPath(state.board);
    const hinted = requestHint(state);

    expect(hint).toHaveLength(MIN_CHAIN_LENGTH);
    expect(isPathValid(state.board, hint)).toBe(true);
    expect(hinted.hintPath).toEqual(hint);
    expect(hinted.hintsUsed).toBe(1);
    expect(hinted.board).toEqual(originalBoard);

    const repeated = requestHint(hinted);
    expect(repeated.hintsUsed).toBe(1);
    expect(repeated.hintPath).toEqual(hinted.hintPath);
    expect(repeated.message).toContain("already active");

    const started = beginSelection(repeated, repeated.hintPath[0]);
    expect(started.hintPath).toEqual([]);
    expect(started.message).toBeNull();
  });

  test("supports extending and backtracking a drag path", () => {
    let state = playingState();
    state = beginSelection(state, { row: 0, col: 0 });
    state = extendSelection(state, { row: 0, col: 1 });
    state = extendSelection(state, { row: 0, col: 2 });
    expect(state.selectedPath).toHaveLength(3);

    state = extendSelection(state, { row: 0, col: 1 });
    expect(state.selectedPath).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  test("clears a valid chain, applies gravity, and records progress", () => {
    const selectedPath: Point[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
    const result = resolveSelection(playingState({ selectedPath, selectedAnimal: "lion" }));

    expect(result.cleared).toBe(3);
    expect(result.state.score).toBe(180);
    expect(result.state.moves).toBe(1);
    expect(result.state.bestChain).toBe(3);
    expect(result.state.mode).toBe("playing");
    expect(result.state.selectedPath).toEqual([]);
    expect(countValidMoves(result.state.board)).toBeGreaterThan(0);
  });

  test("finishes at the target and awards a rank that locks further moves", () => {
    const selectedPath: Point[] = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
    const result = resolveSelection(playingState({
      score: TARGET_SCORE - scoreChain(3),
      selectedPath,
      selectedAnimal: "lion",
    }));

    expect(result.state.score).toBe(TARGET_SCORE);
    expect(result.state.mode).toBe("complete");
    expect(result.state.targetReached).toBe(true);
    expect(result.state.rank).toBe("Gold");
    expect(beginSelection(result.state, { row: 1, col: 1 })).toBe(result.state);
    expect(startGame(result.state)).toBe(result.state);
  });

  test("grades efficient, assisted, and long safari runs", () => {
    expect(getSafariRank(4, 0)).toBe("Gold");
    expect(getSafariRank(7, 1)).toBe("Silver");
    expect(getSafariRank(8, 0)).toBe("Bronze");
    expect(getSafariRank(4, 2)).toBe("Bronze");
    expect(getRankOutlook(3, 0)).toBe("Gold");
    expect(getRankOutlook(4, 0)).toBe("Silver");
    expect(getRankOutlook(6, 1)).toBe("Silver");
    expect(getRankOutlook(7, 0)).toBe("Bronze");
    expect(getRankOutlook(3, 2)).toBe("Bronze");
  });

  test("gravity preserves lower animals while filling emptied cells", () => {
    const board = lionBoard();
    board[4][0] = null;
    board[5][0] = "fox";
    const gravity = applyGravity(board, 99);

    expect(gravity.board[5][0]).toBe("fox");
    expect(gravity.board.flat().every(Boolean)).toBe(true);
  });
});
