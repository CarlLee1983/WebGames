import { describe, expect, test } from "bun:test";

import {
  findFloating,
  findMatches,
  getGridPos,
  getNeighbors,
  type Bubble,
} from "./utils";

const RED = "#ef4444";
const BLUE = "#3b82f6";

function bubble(row: number, col: number, color = RED): Bubble {
  return { row, col, color };
}

describe("getGridPos", () => {
  test("clamps shots to valid columns on staggered rows", () => {
    expect(getGridPos(-100, 45)).toEqual({ row: 1, col: 0 });
    expect(getGridPos(999, 45)).toEqual({ row: 1, col: 9 });
  });
});

describe("getNeighbors", () => {
  test("does not return cells outside the board", () => {
    expect(getNeighbors(0, 0)).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ]);
  });
});

describe("findMatches", () => {
  test("finds a connected same-color group across staggered rows", () => {
    const board = [
      bubble(0, 0),
      bubble(0, 1),
      bubble(1, 0),
      bubble(1, 1, BLUE),
    ];

    expect(findMatches(board, board[2])).toHaveLength(3);
  });
});

describe("findFloating", () => {
  test("returns bubbles no longer connected to the ceiling", () => {
    const anchored = bubble(0, 0, BLUE);
    const attached = bubble(1, 0, BLUE);
    const floating = bubble(4, 4);

    expect(findFloating([anchored, attached, floating])).toEqual([floating]);
  });
});
