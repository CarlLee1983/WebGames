import { describe, expect, test } from "bun:test";
import {
  checkIsSolved,
  countSolutionMoves,
  countLights,
  createLightsOutGame,
  createSeededRandom,
  formatElapsed,
  generateBoard,
  getLightsRating,
  getAffectedCells,
  lightsOutStateToRows,
  parseBestMoves,
  pressLight,
  requestLightsHint,
  solveLightsOut,
  tickLightsOut,
  toggleLights,
  toggleLightsPause,
  undoLightMove,
} from "./utils";

describe("getAffectedCells", () => {
  test("returns the center cross and clips corners", () => {
    expect(getAffectedCells(5, 2, 2)).toHaveLength(5);
    expect(getAffectedCells(5, 0, 0)).toEqual([
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 0, column: 1 },
    ]);
  });
});

describe("toggleLights", () => {
  test("returns a new board with only the selected cross toggled", () => {
    const board = Array.from({ length: 3 }, () => [false, false, false]);
    const toggled = toggleLights(board, 1, 1);

    expect(countLights(toggled)).toBe(5);
    expect(countLights(board)).toBe(0);
  });
});

describe("solveLightsOut", () => {
  test("clears deterministic solvable boards at every supported size", () => {
    for (const size of [3, 5, 7]) {
      let board = generateBoard(size, size * 4, createSeededRandom(size));
      const solution = solveLightsOut(board, size);

      expect(solution).not.toBeNull();
      solution?.forEach((row, rowIndex) => {
        row.forEach((shouldToggle, columnIndex) => {
          if (shouldToggle) board = toggleLights(board, rowIndex, columnIndex);
        });
      });

      expect(checkIsSolved(board)).toBe(true);
    }
  });

  test("never generates an already-solved round", () => {
    const board = generateBoard(5, 2, () => 0);
    expect(checkIsSolved(board)).toBe(false);
  });
});

describe("Lights Out round state", () => {
  test("creates a deterministic playable round with an achievable par", () => {
    const game = createLightsOutGame(5, createSeededRandom(2_026));

    expect(game.phase).toBe("ready");
    expect(game.board).toHaveLength(5);
    expect(countLights(game.board)).toBeGreaterThan(0);
    expect(game.parMoves).toBe(countSolutionMoves(game.board, 5));
    expect(game.parMoves).toBeGreaterThan(0);
  });

  test("presses and undoes a node without mutating the opening board", () => {
    const opening = createLightsOutGame(3, createSeededRandom(9));
    const pressed = pressLight(opening, 1, 1);
    const restored = undoLightMove(pressed);

    expect(pressed).not.toBe(opening);
    expect(pressed.phase).toBe("playing");
    expect(pressed.moves).toBe(1);
    expect(opening.board).toEqual(restored.board);
    expect(restored.moves).toBe(0);
    expect(restored.phase).toBe("ready");
    expect(pressLight(opening, -1, 0)).toBe(opening);
  });

  test("provides a valid hint and records the assistance", () => {
    const opening = createLightsOutGame(5, createSeededRandom(5));
    const { state, hint } = requestLightsHint(opening);

    expect(hint).not.toBeNull();
    expect(state.hintsUsed).toBe(1);
    expect(hint && state.board[hint.row][hint.column]).toBeDefined();
    expect(state.feedback).toContain("Suggested node");
  });

  test("pauses only an active round and freezes its clock", () => {
    const opening = createLightsOutGame(3, createSeededRandom(3));
    const playing = pressLight(opening, 0, 0);
    const paused = toggleLightsPause(playing);

    expect(toggleLightsPause(opening)).toBe(opening);
    expect(paused.phase).toBe("paused");
    expect(tickLightsOut(paused)).toBe(paused);
    expect(tickLightsOut(playing).elapsedSeconds).toBe(1);
    expect(toggleLightsPause(paused).phase).toBe("playing");
  });

  test("finishes by applying the generated solution and awards three stars", () => {
    let game = createLightsOutGame(5, createSeededRandom(12));
    const solution = solveLightsOut(game.board, game.size);

    solution?.forEach((row, rowIndex) => {
      row.forEach((shouldPress, columnIndex) => {
        if (shouldPress) game = pressLight(game, rowIndex, columnIndex);
      });
    });

    expect(game.phase).toBe("won");
    expect(game.moves).toBe(game.parMoves);
    expect(undoLightMove(game)).toBe(game);
    expect(getLightsRating(game.parMoves, game.moves, game.hintsUsed)).toBe(3);
    expect(getLightsRating(game.parMoves, game.moves + 2, 1)).toBe(2);
    expect(getLightsRating(game.parMoves, game.moves + 8, 3)).toBe(1);
  });

  test("sanitizes records, clocks, and inspectable board rows", () => {
    const game = createLightsOutGame(3, createSeededRandom(4));

    expect(formatElapsed(-1)).toBe("00:00");
    expect(formatElapsed(65.9)).toBe("01:05");
    expect(parseBestMoves("7")).toBe(7);
    expect(parseBestMoves("0")).toBeNull();
    expect(parseBestMoves("7.5")).toBeNull();
    expect(lightsOutStateToRows(game)).toHaveLength(3);
    expect(lightsOutStateToRows(game)[0].split(" ")).toHaveLength(3);
  });
});
