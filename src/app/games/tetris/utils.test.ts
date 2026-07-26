import { describe, expect, test } from "bun:test";

import {
  CLEAR_FEEDBACK_MS,
  COLS,
  PIECES,
  createInitialState,
  getDangerLevel,
  getLineClearResult,
  getLinesUntilNextLevel,
  hardDrop,
  holdPiece,
  movePiece,
  restartGame,
  rotatePiece,
  startGame,
  tick,
  togglePause,
  type GameState,
} from "./utils";

function singleLineState(previous?: GameState): GameState {
  const base = previous ?? restartGame(41);
  const board = base.board.map((row) => [...row]);
  board[board.length - 1] = Array.from({ length: COLS }, (_, index) => (index < 6 ? "J" : null));

  return {
    ...base,
    mode: "playing",
    board,
    active: {
      type: "I",
      matrix: PIECES.I.matrix.map((row) => [...row]),
      x: 6,
      y: 18,
      rotation: 0,
    },
    dropAccumulator: 0,
  };
}

describe("Tetris state and controls", () => {
  test("creates a deterministic complete seven-piece opening bag", () => {
    const first = createInitialState(1337);
    const second = createInitialState(1337);
    const openingBag = [first.active.type, ...first.queue.slice(0, 6)];

    expect(first).toEqual(second);
    expect(openingBag).toHaveLength(7);
    expect(new Set(openingBag).size).toBe(7);
    expect(first.mode).toBe("ready");
  });

  test("starts, pauses, resumes, and ignores movement outside active play", () => {
    const ready = createInitialState();
    expect(movePiece(ready, -1)).toBe(ready);

    const playing = startGame(ready);
    const moved = movePiece(playing, -1);
    expect(moved.active.x).toBe(playing.active.x - 1);
    expect(togglePause(moved).mode).toBe("paused");
    expect(togglePause(togglePause(moved)).mode).toBe("playing");
  });

  test("rotates pieces and hard drops exactly one locked tetromino", () => {
    const playing = restartGame(17);
    const rotated = rotatePiece(playing, 1);
    const dropped = hardDrop(rotated);
    const occupied = dropped.board.flat().filter(Boolean);

    expect(rotated.active.rotation).toBe(1);
    expect(occupied).toHaveLength(4);
    expect(dropped.piecesPlaced).toBe(1);
    expect(dropped.score).toBeGreaterThan(0);
    expect(dropped.canHold).toBe(true);
  });

  test("allows one hold per piece and unlocks hold after placement", () => {
    const playing = restartGame(29);
    const held = holdPiece(playing);

    expect(held.hold).toBe(playing.active.type);
    expect(held.canHold).toBe(false);
    expect(holdPiece(held)).toBe(held);

    const placed = hardDrop(held);
    expect(placed.canHold).toBe(true);
    expect(holdPiece(placed).canHold).toBe(false);
  });

  test("tops out when a held replacement cannot enter the board", () => {
    const playing = restartGame(73);
    const blocked = {
      ...playing,
      board: playing.board.map((row, index) => (index === 0 ? Array(COLS).fill("Z") : [...row])),
    } as GameState;

    expect(holdPiece(blocked).mode).toBe("gameOver");
  });
});

describe("Tetris scoring feedback", () => {
  test("calculates line, combo, and perfect-clear bonuses", () => {
    expect(getLineClearResult(4, 2, 1)).toEqual({
      combo: 2,
      lineScore: 1600,
      comboBonus: 100,
      perfectClearBonus: 0,
      total: 1700,
      message: "Tetris · 2× Combo",
    });
    expect(getLineClearResult(1, 1, 0, true)).toEqual({
      combo: 1,
      lineScore: 100,
      comboBonus: 0,
      perfectClearBonus: 1200,
      total: 1300,
      message: "Perfect Clear",
    });
  });

  test("awards a perfect clear and retains its feedback long enough to read", () => {
    const cleared = hardDrop(singleLineState());

    expect(cleared.lines).toBe(1);
    expect(cleared.score).toBe(1300);
    expect(cleared.combo).toBe(1);
    expect(cleared.bestCombo).toBe(1);
    expect(cleared.clearMessage).toBe("Perfect Clear");
    expect(cleared.feedbackRemainingMs).toBe(CLEAR_FEEDBACK_MS);
    expect(cleared.board.flat().every((cell) => cell === null)).toBe(true);

    const almostExpired = tick(cleared, CLEAR_FEEDBACK_MS - 1);
    expect(almostExpired.clearMessage).toBe("Perfect Clear");
    expect(tick(almostExpired, 1).clearMessage).toBeNull();
  });

  test("tracks consecutive clears and resets a combo on an empty placement", () => {
    const firstClear = hardDrop(singleLineState());
    const secondClear = hardDrop(singleLineState(firstClear));
    const noClear = hardDrop({
      ...secondClear,
      board: secondClear.board.map((row) => [...row]),
      active: {
        type: "O",
        matrix: PIECES.O.matrix.map((row) => [...row]),
        x: 4,
        y: 0,
        rotation: 0,
      },
    });

    expect(secondClear.combo).toBe(2);
    expect(secondClear.bestCombo).toBe(2);
    expect(noClear.combo).toBe(0);
    expect(noClear.bestCombo).toBe(2);
  });
});

describe("Tetris progress helpers", () => {
  test("reports level progress and stack danger bands", () => {
    const state = createInitialState();
    const warningBoard = state.board.map((row) => [...row]);
    const criticalBoard = state.board.map((row) => [...row]);
    warningBoard[6][0] = "T";
    criticalBoard[2][0] = "T";

    expect(getLinesUntilNextLevel(0)).toBe(10);
    expect(getLinesUntilNextLevel(9)).toBe(1);
    expect(getLinesUntilNextLevel(10)).toBe(10);
    expect(getDangerLevel(state.board)).toBe("safe");
    expect(getDangerLevel(warningBoard)).toBe("warning");
    expect(getDangerLevel(criticalBoard)).toBe("critical");
  });
});
