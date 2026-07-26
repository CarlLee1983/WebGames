import { describe, expect, test } from "bun:test";

import {
  GRID_SIZE,
  changeDifficulty,
  createFood,
  createInitialState,
  getFoodType,
  getLevel,
  getTickInterval,
  parseBestScore,
  queueDirection,
  restartGame,
  startGame,
  stateToRows,
  stepGame,
  togglePause,
  type SnakeGameState,
} from "./utils";

function playingState(overrides: Partial<SnakeGameState> = {}): SnakeGameState {
  return {
    ...createInitialState("normal", 0, () => 0),
    mode: "playing",
    ...overrides,
  };
}

describe("Snake setup and controls", () => {
  test("starts ready with a three-segment snake and food on a free cell", () => {
    const state = createInitialState("normal", 42, () => 0);

    expect(state.mode).toBe("ready");
    expect(state.snake).toHaveLength(3);
    expect(state.bestScore).toBe(42);
    expect(state.food).not.toBeNull();
    expect(state.snake.some((segment) => segment.x === state.food?.x && segment.y === state.food?.y)).toBe(false);
  });

  test("starts explicitly, pauses safely, and preserves the chosen difficulty", () => {
    const ready = createInitialState("expert", 0, () => 0);
    const playing = startGame(ready);

    expect(playing.mode).toBe("playing");
    expect(togglePause(playing).mode).toBe("paused");
    expect(togglePause(togglePause(playing)).mode).toBe("playing");
    expect(restartGame(playing, () => 0).difficulty).toBe("expert");
    expect(changeDifficulty(playing, "easy", () => 0).mode).toBe("ready");
  });

  test("accepts one perpendicular turn and rejects an immediate reversal", () => {
    const playing = playingState();

    expect(queueDirection(playing, "left").queuedDirection).toBe("left");
    expect(queueDirection(playing, "down")).toBe(playing);
  });
});

describe("Snake movement rules", () => {
  test("wraps through an edge portal instead of ending the game", () => {
    const state = playingState({
      snake: [
        { x: 0, y: 8 },
        { x: 1, y: 8 },
        { x: 2, y: 8 },
      ],
      direction: "left",
      queuedDirection: "left",
      food: { x: 5, y: 5, type: "apple" },
    });
    const moved = stepGame(state, () => 0);

    expect(moved.mode).toBe("playing");
    expect(moved.snake[0]).toEqual({ x: GRID_SIZE - 1, y: 8 });
    expect(moved.wraps).toBe(1);
    expect(moved.feedback).toBe("Portal wrap");
  });

  test("allows the head to enter the tail cell that moves away", () => {
    const state = playingState({
      snake: [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 0, y: 1 },
      ],
      direction: "left",
      queuedDirection: "left",
      food: { x: 8, y: 8, type: "apple" },
    });

    expect(stepGame(state).snake[0]).toEqual({ x: 0, y: 1 });
    expect(stepGame(state).mode).toBe("playing");
  });

  test("ends the run on a genuine body collision", () => {
    const state = playingState({
      snake: [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
      ],
      direction: "left",
      queuedDirection: "left",
      food: { x: 8, y: 8, type: "apple" },
      score: 70,
    });
    const collided = stepGame(state);

    expect(collided.mode).toBe("gameOver");
    expect(collided.bestScore).toBe(70);
    expect(collided.feedback).toBe("Tail collision");
  });
});

describe("Snake rewards and progression", () => {
  test("grows for apples and awards every fifth golden fruit", () => {
    const appleState = playingState({
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 5, y: 7 },
      ],
      food: { x: 5, y: 4, type: "apple" },
    });
    const ateApple = stepGame(appleState, () => 0);
    const goldenState = {
      ...appleState,
      foodsEaten: 4,
      score: 40,
      food: { x: 5, y: 4, type: "golden" as const },
    };
    const ateGolden = stepGame(goldenState, () => 0);

    expect(ateApple.snake).toHaveLength(4);
    expect(ateApple.score).toBe(10);
    expect(ateApple.feedback).toBe("Fresh apple +10");
    expect(ateGolden.score).toBe(70);
    expect(ateGolden.food?.type).toBe("apple");
    expect(getFoodType(5)).toBe("golden");
  });

  test("accelerates by difficulty without exceeding safe caps", () => {
    expect(getTickInterval({ difficulty: "easy", foodsEaten: 0 })).toBe(240);
    expect(getTickInterval({ difficulty: "normal", foodsEaten: 9 })).toBe(140);
    expect(getTickInterval({ difficulty: "expert", foodsEaten: 500 })).toBe(45);
    expect(getLevel(0)).toBe(1);
    expect(getLevel(9)).toBe(2);
    expect(getLevel(10)).toBe(3);
  });

  test("wins cleanly when the final free cell is eaten", () => {
    const target = { x: 1, y: 0 };
    const snake = Array.from({ length: GRID_SIZE }, (_, y) =>
      Array.from({ length: GRID_SIZE }, (_, x) => ({ x, y })),
    )
      .flat()
      .filter((point) => point.x !== target.x || point.y !== target.y);
    const headIndex = snake.findIndex((point) => point.x === 0 && point.y === 0);
    const [head] = snake.splice(headIndex, 1);
    snake.unshift(head);
    const state = playingState({
      snake,
      direction: "right",
      queuedDirection: "right",
      food: { ...target, type: "golden" },
    });
    const won = stepGame(state, () => 0);

    expect(won.mode).toBe("won");
    expect(won.snake).toHaveLength(GRID_SIZE * GRID_SIZE);
    expect(won.food).toBeNull();
  });

  test("places food deterministically and exposes stable inspection rows", () => {
    const state = createInitialState("normal", 0, () => 0.5);
    const food = createFood(state.snake, 4, () => 0);
    const rows = stateToRows({ ...state, food });

    expect(food?.type).toBe("golden");
    expect(rows).toHaveLength(GRID_SIZE);
    expect(rows.every((row) => row.length === GRID_SIZE)).toBe(true);
    expect(rows.join("")).toContain("H");
    expect(rows.join("")).toContain("G");
  });

  test("sanitizes stored best scores", () => {
    expect(parseBestScore("120")).toBe(120);
    expect(parseBestScore("-4")).toBe(0);
    expect(parseBestScore("not-a-score")).toBe(0);
    expect(parseBestScore(null)).toBe(0);
  });
});
