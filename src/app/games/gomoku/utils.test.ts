import { describe, expect, test } from "bun:test";

import {
  BOARD_SIZE,
  checkWinner,
  createEmptyBoard,
  getComputerMove,
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
