import { describe, expect, test } from "bun:test";

import {
  BOARD_SIZE,
  applyGameMove,
  checkWinner,
  createEmptyBoard,
  createInitialGameState,
  getComputerMove,
  getWinningLine,
  stateToRows,
  undoGame,
  type AiDifficulty,
  type Board,
  type Player,
} from "./utils";

function createBoard(moves: Array<[number, number, Player]>): Board {
  const board = createEmptyBoard();

  for (const [row, col, player] of moves) {
    board[row][col] = player;
  }

  return board;
}

describe("checkWinner", () => {
  test("detects a diagonal five-in-a-row", () => {
    const board = createBoard([
      [3, 4, "black"],
      [4, 5, "black"],
      [5, 6, "black"],
      [6, 7, "black"],
      [7, 8, "black"],
    ]);

    expect(checkWinner(7, 8, "black", board)).toBe(true);
    expect(getWinningLine(7, 8, "black", board)).toEqual([
      { row: 3, col: 4 },
      { row: 4, col: 5 },
      { row: 5, col: 6 },
      { row: 6, col: 7 },
      { row: 7, col: 8 },
    ]);
  });
});

describe("game state", () => {
  test("applies legal alternating moves without mutating the prior board", () => {
    const initial = createInitialGameState();
    const afterBlack = applyGameMove(initial, 7, 7, "black");
    const afterWhite = applyGameMove(afterBlack, 7, 8, "white");

    expect(initial.board[7][7]).toBeNull();
    expect(afterBlack.board[7][7]).toBe("black");
    expect(afterBlack.lastMove).toEqual({ row: 7, col: 7, player: "black" });
    expect(afterWhite.board[7][8]).toBe("white");
    expect(afterWhite.history).toHaveLength(2);
    expect(applyGameMove(afterWhite, 7, 8, "black")).toBe(afterWhite);
    expect(applyGameMove(afterWhite, 6, 6, "white")).toBe(afterWhite);
  });

  test("records the winning line and freezes further placement", () => {
    let state = createInitialGameState();
    for (let col = 3; col <= 6; col += 1) {
      state = applyGameMove(state, 7, col, "black");
      state = applyGameMove(state, 8, col, "white");
    }
    const won = applyGameMove(state, 7, 7, "black");

    expect(won.winner).toBe("black");
    expect(won.winningLine).toEqual([
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
      { row: 7, col: 7 },
    ]);
    expect(applyGameMove(won, 1, 1, "white")).toBe(won);
  });

  test("undoes one local move or a full answered computer turn", () => {
    const initial = createInitialGameState();
    const afterBlack = applyGameMove(initial, 7, 7, "black");
    const afterWhite = applyGameMove(afterBlack, 7, 8, "white");

    const localUndo = undoGame(afterWhite, "local");
    expect(localUndo.board[7][7]).toBe("black");
    expect(localUndo.board[7][8]).toBeNull();
    expect(localUndo.isBlackNext).toBe(false);

    const computerUndo = undoGame(afterWhite, "computer");
    expect(computerUndo.board).toEqual(initial.board);
    expect(computerUndo.isBlackNext).toBe(true);
    expect(computerUndo.history).toHaveLength(0);
  });

  test("renders a stable text board for inspection", () => {
    const state = applyGameMove(createInitialGameState(), 7, 7, "black");
    const rows = stateToRows(state);

    expect(rows).toHaveLength(BOARD_SIZE);
    expect(rows[7][7]).toBe("B");
    expect(rows.join("").match(/B/g)).toHaveLength(1);
  });
});

describe("getComputerMove", () => {
  const difficulties: AiDifficulty[] = ["easy", "normal", "hard"];

  test("chooses the center on an empty board for every difficulty", () => {
    for (const difficulty of difficulties) {
      expect(getComputerMove(createEmptyBoard(), difficulty, () => 0.5)).toEqual({
        row: Math.floor(BOARD_SIZE / 2),
        col: Math.floor(BOARD_SIZE / 2),
      });
    }
  });

  test("takes an immediate winning move for every difficulty", () => {
    const board = createBoard([
      [7, 5, "black"],
      [7, 6, "white"],
      [7, 7, "white"],
      [7, 8, "white"],
      [7, 9, "white"],
    ]);

    for (const difficulty of difficulties) {
      expect(getComputerMove(board, difficulty, () => 0.5)).toEqual({ row: 7, col: 10 });
    }
  });

  test("blocks the opponent's immediate win for every difficulty", () => {
    const board = createBoard([
      [4, 4, "white"],
      [8, 5, "black"],
      [8, 6, "black"],
      [8, 7, "black"],
      [8, 8, "black"],
    ]);

    for (const difficulty of difficulties) {
      expect(getComputerMove(board, difficulty, () => 0.5)).toEqual({ row: 8, col: 9 });
    }
  });

  test("hard keeps the same move regardless of rng in a non-forced position", () => {
    const board = createBoard([
      [7, 7, "white"],
      [7, 8, "black"],
      [8, 7, "white"],
      [8, 8, "black"],
    ]);

    const lowRoll = getComputerMove(board, "hard", () => 0.01);
    const highRoll = getComputerMove(board, "hard", () => 0.99);

    expect(lowRoll).toEqual(highRoll);
  });

  test("normal can vary with rng in a non-forced position", () => {
    const board = createBoard([
      [7, 7, "white"],
      [7, 8, "black"],
      [8, 7, "white"],
      [8, 8, "black"],
    ]);

    const lowRoll = getComputerMove(board, "normal", () => 0.01);
    const highRoll = getComputerMove(board, "normal", () => 0.99);

    expect(lowRoll).not.toEqual(highRoll);
  });

  test("easy can drift farther from hard than normal in a non-forced position", () => {
    const board = createBoard([
      [7, 7, "white"],
      [7, 8, "black"],
      [8, 7, "white"],
      [8, 8, "black"],
    ]);

    const hardMove = getComputerMove(board, "hard", () => 0.99);
    const normalMove = getComputerMove(board, "normal", () => 0.99);
    const easyMove = getComputerMove(board, "easy", () => 0.99);

    expect(normalMove).not.toEqual(hardMove);
    expect(easyMove).not.toEqual(hardMove);
    expect(easyMove).not.toEqual(normalMove);
  });
});
