import { describe, expect, test } from "bun:test";

import {
  COLORS,
  advanceCeiling,
  bubbleBoardToRows,
  findFloating,
  findMatches,
  getBubblePressure,
  getGridPos,
  getLandingPosition,
  getNeighbors,
  getShotsUntilDrop,
  hasCrossedDangerLine,
  parseBestScore,
  resolveBubblePlacement,
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

describe("Puzzle Bobble round rules", () => {
  test("resolves a match, drops unsupported bubbles, and scores both groups", () => {
    const opening = [
      bubble(0, 0),
      bubble(0, 1),
      bubble(1, 0, BLUE),
      bubble(2, 0, BLUE),
    ];

    const result = resolveBubblePlacement(opening, bubble(1, 1), 0);

    expect(result.matches).toHaveLength(3);
    expect(result.floating).toHaveLength(2);
    expect(result.points).toBe(70);
    expect(result.combo).toBe(1);
    expect(result.won).toBe(true);
    expect(result.board).toEqual([]);
    expect(opening).toHaveLength(4);
  });

  test("adds a combo bonus on consecutive clears", () => {
    const result = resolveBubblePlacement(
      [bubble(0, 0), bubble(0, 1), bubble(0, 4, BLUE)],
      bubble(1, 0),
      2,
    );

    expect(result.points).toBe(60);
    expect(result.combo).toBe(3);
    expect(result.board).toEqual([bubble(0, 4, BLUE)]);
  });

  test("anchors a miss and resets the active combo without mutating the board", () => {
    const opening = [bubble(0, 0), bubble(0, 1, BLUE)];
    const result = resolveBubblePlacement(opening, bubble(1, 0), 4);

    expect(result.points).toBe(0);
    expect(result.combo).toBe(0);
    expect(result.board).toHaveLength(3);
    expect(opening).toEqual([bubble(0, 0), bubble(0, 1, BLUE)]);
  });

  test("lands beside an occupied collision cell instead of tunneling down its column", () => {
    const opening = [bubble(0, 0)];
    const landing = getLandingPosition(opening, 16, 16);

    expect(landing).toEqual({ row: 1, col: 0 });
    expect(opening).toEqual([bubble(0, 0)]);
  });

  test("advances the ceiling immutably and detects the danger boundary", () => {
    const opening = [bubble(13, 0, BLUE)];
    const result = advanceCeiling(opening, Array(11).fill(RED));

    expect(result.board[0]).toEqual(bubble(14, 0, BLUE));
    expect(result.board.slice(1)).toHaveLength(11);
    expect(result.lost).toBe(true);
    expect(opening[0]).toEqual(bubble(13, 0, BLUE));
    expect(() => advanceCeiling(opening, [RED])).toThrow();
  });

  test("reports pressure bands from the lowest occupied row", () => {
    expect(getBubblePressure([bubble(4, 0)])).toBe("safe");
    expect(getBubblePressure([bubble(8, 0)])).toBe("pressured");
    expect(getBubblePressure([bubble(11, 0)])).toBe("critical");
  });

  test("judges loss from the resolved board rather than the bubble's former landing row", () => {
    const dangerous = [bubble(14, 0), bubble(14, 1)];
    const rescue = resolveBubblePlacement(dangerous, bubble(13, 0), 0);

    expect(hasCrossedDangerLine(dangerous)).toBe(true);
    expect(rescue.won).toBe(true);
    expect(hasCrossedDangerLine(rescue.board)).toBe(false);
  });

  test("sanitizes records and exposes stable shot and board inspection helpers", () => {
    expect(parseBestScore(null)).toBe(0);
    expect(parseBestScore("981.8")).toBe(981);
    expect(parseBestScore("-2")).toBe(0);
    expect(parseBestScore("not-a-score")).toBe(0);
    expect(getShotsUntilDrop(0, 6)).toBe(6);
    expect(getShotsUntilDrop(7, 6)).toBe(5);
    expect(() => getShotsUntilDrop(2, 0)).toThrow();

    const rows = bubbleBoardToRows([
      bubble(0, 0, COLORS[0]),
      bubble(1, 9, COLORS[5]),
      bubble(2, 0, "unknown"),
    ]);
    expect(rows).toHaveLength(15);
    expect(rows[0]).toBe("1..........");
    expect(rows[1]).toBe(".........6");
    expect(rows[2]).toBe("?..........");
  });
});
