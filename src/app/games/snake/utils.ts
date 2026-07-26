export const GRID_SIZE = 20;
export const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

export type Point = { x: number; y: number };
export type DirectionName = "up" | "down" | "left" | "right";
export type Difficulty = "easy" | "normal" | "expert";
export type GameMode = "ready" | "playing" | "paused" | "gameOver" | "won";
export type FoodType = "apple" | "golden";

export interface Food extends Point {
  type: FoodType;
}

export interface DifficultyConfig {
  label: string;
  initialSpeed: number;
  minSpeed: number;
  speedStep: number;
  foodsPerStep: number;
}

export interface SnakeGameState {
  mode: GameMode;
  snake: Point[];
  food: Food | null;
  direction: DirectionName;
  queuedDirection: DirectionName;
  difficulty: Difficulty;
  score: number;
  bestScore: number;
  foodsEaten: number;
  wraps: number;
  feedback: string | null;
  feedbackTicks: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { label: "Easy", initialSpeed: 240, minSpeed: 90, speedStep: 8, foodsPerStep: 3 },
  normal: { label: "Normal", initialSpeed: 170, minSpeed: 65, speedStep: 10, foodsPerStep: 3 },
  expert: { label: "Expert", initialSpeed: 120, minSpeed: 45, speedStep: 8, foodsPerStep: 2 },
};

export const FOOD_SCORE: Record<FoodType, number> = {
  apple: 10,
  golden: 30,
};

const DIRECTION_VECTOR: Record<DirectionName, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function isOpposite(left: DirectionName, right: DirectionName): boolean {
  const first = DIRECTION_VECTOR[left];
  const second = DIRECTION_VECTOR[right];
  return first.x + second.x === 0 && first.y + second.y === 0;
}

function copySnake(snake: Point[]): Point[] {
  return snake.map((segment) => ({ ...segment }));
}

export function getFoodType(foodNumber: number): FoodType {
  return foodNumber > 0 && foodNumber % 5 === 0 ? "golden" : "apple";
}

export function createFood(
  snake: Point[],
  foodsEaten: number,
  random: () => number = Math.random,
): Food | null {
  const occupied = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
  const freeCells: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x}:${y}`)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) {
    return null;
  }

  const roll = Math.max(0, Math.min(0.999999, random()));
  const cell = freeCells[Math.floor(roll * freeCells.length)];
  return {
    ...cell,
    type: getFoodType(foodsEaten + 1),
  };
}

export function createInitialState(
  difficulty: Difficulty = "normal",
  bestScore = 0,
  random: () => number = Math.random,
): SnakeGameState {
  const snake = copySnake(INITIAL_SNAKE);
  return {
    mode: "ready",
    snake,
    food: createFood(snake, 0, random),
    direction: "up",
    queuedDirection: "up",
    difficulty,
    score: 0,
    bestScore: Math.max(0, Math.floor(bestScore)),
    foodsEaten: 0,
    wraps: 0,
    feedback: null,
    feedbackTicks: 0,
  };
}

export function restartGame(
  state: SnakeGameState,
  random: () => number = Math.random,
  startImmediately = false,
): SnakeGameState {
  return {
    ...createInitialState(state.difficulty, Math.max(state.bestScore, state.score), random),
    mode: startImmediately ? "playing" : "ready",
  };
}

export function changeDifficulty(
  state: SnakeGameState,
  difficulty: Difficulty,
  random: () => number = Math.random,
): SnakeGameState {
  if (state.difficulty === difficulty) {
    return state;
  }

  return createInitialState(difficulty, Math.max(state.bestScore, state.score), random);
}

export function startGame(state: SnakeGameState, random: () => number = Math.random): SnakeGameState {
  if (state.mode === "ready" || state.mode === "paused") {
    return {
      ...state,
      mode: "playing",
    };
  }

  if (state.mode === "gameOver" || state.mode === "won") {
    return restartGame(state, random, true);
  }

  return state;
}

export function togglePause(state: SnakeGameState): SnakeGameState {
  if (state.mode === "playing") {
    return {
      ...state,
      mode: "paused",
    };
  }

  if (state.mode === "paused") {
    return {
      ...state,
      mode: "playing",
    };
  }

  return state;
}

export function queueDirection(state: SnakeGameState, direction: DirectionName): SnakeGameState {
  if (state.mode !== "playing" && state.mode !== "ready") {
    return state;
  }

  if (state.snake.length > 1 && isOpposite(state.direction, direction)) {
    return state;
  }

  return {
    ...state,
    mode: state.mode === "ready" ? "playing" : state.mode,
    queuedDirection: direction,
  };
}

export function getTickInterval(state: Pick<SnakeGameState, "difficulty" | "foodsEaten">): number {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  const speedSteps = Math.floor(state.foodsEaten / config.foodsPerStep);
  return Math.max(config.minSpeed, config.initialSpeed - speedSteps * config.speedStep);
}

export function getLevel(foodsEaten: number): number {
  return Math.floor(Math.max(0, foodsEaten) / 5) + 1;
}

export function stepGame(state: SnakeGameState, random: () => number = Math.random): SnakeGameState {
  if (state.mode !== "playing" || !state.food) {
    return state;
  }

  const vector = DIRECTION_VECTOR[state.queuedDirection];
  const head = state.snake[0];
  const rawHead = { x: head.x + vector.x, y: head.y + vector.y };
  const wrapped = rawHead.x < 0 || rawHead.x >= GRID_SIZE || rawHead.y < 0 || rawHead.y >= GRID_SIZE;
  const nextHead = {
    x: (rawHead.x + GRID_SIZE) % GRID_SIZE,
    y: (rawHead.y + GRID_SIZE) % GRID_SIZE,
  };
  const eating = samePoint(nextHead, state.food);
  const collisionBody = eating ? state.snake : state.snake.slice(0, -1);

  if (collisionBody.some((segment) => samePoint(segment, nextHead))) {
    return {
      ...state,
      mode: "gameOver",
      direction: state.queuedDirection,
      bestScore: Math.max(state.bestScore, state.score),
      feedback: "Tail collision",
      feedbackTicks: 0,
    };
  }

  const nextSnake = [nextHead, ...copySnake(state.snake)];
  if (!eating) {
    nextSnake.pop();
  }

  if (eating) {
    const scoreGain = FOOD_SCORE[state.food.type];
    const foodsEaten = state.foodsEaten + 1;
    const score = state.score + scoreGain;
    const nextFood = createFood(nextSnake, foodsEaten, random);

    return {
      ...state,
      mode: nextFood ? "playing" : "won",
      snake: nextSnake,
      food: nextFood,
      direction: state.queuedDirection,
      score,
      bestScore: Math.max(state.bestScore, score),
      foodsEaten,
      wraps: state.wraps + (wrapped ? 1 : 0),
      feedback: state.food.type === "golden" ? "Golden fruit +30" : "Fresh apple +10",
      feedbackTicks: nextFood ? 4 : 0,
    };
  }

  const feedbackTicks = Math.max(0, state.feedbackTicks - 1);
  return {
    ...state,
    snake: nextSnake,
    direction: state.queuedDirection,
    wraps: state.wraps + (wrapped ? 1 : 0),
    feedback: wrapped ? "Portal wrap" : feedbackTicks > 0 ? state.feedback : null,
    feedbackTicks: wrapped ? 2 : feedbackTicks,
  };
}

export function parseBestScore(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function stateToRows(state: SnakeGameState): string[] {
  const rows = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("."));
  state.snake.forEach((segment, index) => {
    rows[segment.y][segment.x] = index === 0 ? "H" : "S";
  });
  if (state.food) {
    rows[state.food.y][state.food.x] = state.food.type === "golden" ? "G" : "A";
  }
  return rows.map((row) => row.join(""));
}
