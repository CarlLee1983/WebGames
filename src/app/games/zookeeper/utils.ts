export const ROWS = 6;
export const COLS = 6;
export const TILE_SIZE = 72;
export const BOARD_LEFT = 64;
export const BOARD_TOP = 172;
export const BOARD_WIDTH = COLS * TILE_SIZE;
export const BOARD_HEIGHT = ROWS * TILE_SIZE;
export const CANVAS_WIDTH = 560;
export const CANVAS_HEIGHT = 760;
export const TARGET_SCORE = 1500;
export const MIN_CHAIN_LENGTH = 3;
export const DEFAULT_SEED = 20260319;

export type AnimalType = "lion" | "panda" | "frog" | "fox" | "elephant" | "hippo";
export type BoardCell = AnimalType | null;
export type Board = BoardCell[][];
export type GameMode = "ready" | "playing";

export interface Point {
  row: number;
  col: number;
}

export interface GameState {
  mode: GameMode;
  board: Board;
  score: number;
  targetScore: number;
  targetReached: boolean;
  selectedPath: Point[];
  selectedAnimal: AnimalType | null;
  moves: number;
  reshuffles: number;
  validMoveCount: number;
  message: string | null;
  messageTimer: number;
  lastClearCount: number;
  seed: number;
}

export interface ResolveMoveResult {
  state: GameState;
  cleared: number;
  reshuffled: boolean;
}

export const ANIMAL_STYLES: Record<
  AnimalType,
  { label: string; fill: string; accent: string; stroke: string }
> = {
  lion: { label: "lion", fill: "#f59e0b", accent: "#fde68a", stroke: "#7c2d12" },
  panda: { label: "panda", fill: "#0f172a", accent: "#cbd5e1", stroke: "#e2e8f0" },
  frog: { label: "frog", fill: "#22c55e", accent: "#bbf7d0", stroke: "#14532d" },
  fox: { label: "fox", fill: "#f97316", accent: "#fed7aa", stroke: "#9a3412" },
  elephant: { label: "elephant", fill: "#3b82f6", accent: "#bfdbfe", stroke: "#1e3a8a" },
  hippo: { label: "hippo", fill: "#a855f7", accent: "#e9d5ff", stroke: "#581c87" },
};

const ANIMAL_ORDER = Object.keys(ANIMAL_STYLES) as AnimalType[];

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function randomAnimal(seed: number): { animal: AnimalType; seed: number } {
  const next = nextSeed(seed);
  return {
    animal: ANIMAL_ORDER[next % ANIMAL_ORDER.length],
    seed: next,
  };
}

function createRandomBoard(seed: number): { board: Board; seed: number } {
  const board: Board = [];
  let currentSeed = seed;

  for (let row = 0; row < ROWS; row += 1) {
    const nextRow: BoardCell[] = [];
    for (let col = 0; col < COLS; col += 1) {
      const value = randomAnimal(currentSeed);
      nextRow.push(value.animal);
      currentSeed = value.seed;
    }
    board.push(nextRow);
  }

  return { board, seed: currentSeed };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function isSamePoint(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function pointKey(point: Point): string {
  return `${point.row}:${point.col}`;
}

function getNeighbors(point: Point): Point[] {
  return [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter((neighbor) => neighbor.row >= 0 && neighbor.row < ROWS && neighbor.col >= 0 && neighbor.col < COLS);
}

function getConnectedGroup(board: Board, start: Point, visited: Set<string>): Point[] {
  const target = board[start.row]?.[start.col];
  if (!target) {
    return [];
  }

  const queue = [start];
  const group: Point[] = [];
  visited.add(pointKey(start));

  while (queue.length > 0) {
    const current = queue.shift()!;
    group.push(current);

    for (const neighbor of getNeighbors(current)) {
      const key = pointKey(neighbor);
      if (visited.has(key)) {
        continue;
      }
      if (board[neighbor.row][neighbor.col] !== target) {
        continue;
      }
      visited.add(key);
      queue.push(neighbor);
    }
  }

  return group;
}

export function countValidMoves(board: Board): number {
  const visited = new Set<string>();
  let count = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = `${row}:${col}`;
      if (visited.has(key)) {
        continue;
      }
      const group = getConnectedGroup(board, { row, col }, visited);
      if (group.length >= MIN_CHAIN_LENGTH) {
        count += 1;
      }
    }
  }

  return count;
}

export function isPathValid(board: Board, path: Point[]): boolean {
  if (path.length < MIN_CHAIN_LENGTH) {
    return false;
  }

  const first = path[0];
  const animal = board[first.row]?.[first.col];
  if (!animal) {
    return false;
  }

  const seen = new Set<string>();

  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (board[point.row]?.[point.col] !== animal) {
      return false;
    }

    const key = pointKey(point);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);

    if (index > 0 && !isAdjacent(path[index - 1], point)) {
      return false;
    }
  }

  return true;
}

export function scoreChain(length: number): number {
  return length * length * 20 + Math.max(0, length - MIN_CHAIN_LENGTH) * 30;
}

export function applyGravity(board: Board, seed: number): { board: Board; seed: number } {
  const nextBoard = cloneBoard(board);
  let currentSeed = seed;

  for (let col = 0; col < COLS; col += 1) {
    const compacted: AnimalType[] = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const cell = nextBoard[row][col];
      if (cell) {
        compacted.push(cell);
      }
    }

    for (let row = ROWS - 1, index = 0; row >= 0; row -= 1, index += 1) {
      const existing = compacted[index];
      if (existing) {
        nextBoard[row][col] = existing;
        continue;
      }
      const generated = randomAnimal(currentSeed);
      nextBoard[row][col] = generated.animal;
      currentSeed = generated.seed;
    }
  }

  return { board: nextBoard, seed: currentSeed };
}

export function reshuffleBoard(board: Board, seed: number): { board: Board; seed: number } {
  const flat = board.flat().filter((cell): cell is AnimalType => cell !== null);
  let currentSeed = seed;

  for (let index = flat.length - 1; index > 0; index -= 1) {
    currentSeed = nextSeed(currentSeed);
    const swapIndex = currentSeed % (index + 1);
    [flat[index], flat[swapIndex]] = [flat[swapIndex], flat[index]];
  }

  const nextBoard: Board = [];
  for (let row = 0; row < ROWS; row += 1) {
    nextBoard.push(flat.slice(row * COLS, row * COLS + COLS));
  }

  return { board: nextBoard, seed: currentSeed };
}

export function ensurePlayableBoard(board: Board, seed: number): { board: Board; seed: number; reshuffled: boolean } {
  let nextBoard = cloneBoard(board);
  let currentSeed = seed;

  if (countValidMoves(nextBoard) > 0) {
    return { board: nextBoard, seed: currentSeed, reshuffled: false };
  }

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const reshuffled = reshuffleBoard(nextBoard, currentSeed);
    nextBoard = reshuffled.board;
    currentSeed = reshuffled.seed;
    if (countValidMoves(nextBoard) > 0) {
      return { board: nextBoard, seed: currentSeed, reshuffled: true };
    }
  }

  const fallback = createRandomBoard(currentSeed);
  nextBoard = fallback.board;
  currentSeed = fallback.seed;

  while (countValidMoves(nextBoard) === 0) {
    const retry = createRandomBoard(currentSeed);
    nextBoard = retry.board;
    currentSeed = retry.seed;
  }

  return { board: nextBoard, seed: currentSeed, reshuffled: true };
}

function withComputedMoves(state: GameState): GameState {
  return {
    ...state,
    validMoveCount: countValidMoves(state.board),
  };
}

export function createInitialState(seed = DEFAULT_SEED): GameState {
  let currentSeed = seed;
  let board = createRandomBoard(currentSeed);
  currentSeed = board.seed;

  while (countValidMoves(board.board) === 0) {
    board = createRandomBoard(currentSeed);
    currentSeed = board.seed;
  }

  return withComputedMoves({
    mode: "ready",
    board: board.board,
    score: 0,
    targetScore: TARGET_SCORE,
    targetReached: false,
    selectedPath: [],
    selectedAnimal: null,
    moves: 0,
    reshuffles: 0,
    validMoveCount: 0,
    message: "Link 3+ matching animals to hit the target score.",
    messageTimer: 0,
    lastClearCount: 0,
    seed: currentSeed,
  });
}

export function startGame(state: GameState): GameState {
  if (state.mode === "playing") {
    return state;
  }

  return {
    ...state,
    mode: "playing",
    message: null,
    messageTimer: 0,
  };
}

export function restartGame(seed = DEFAULT_SEED): GameState {
  return createInitialState(seed);
}

export function clearSelection(state: GameState): GameState {
  return {
    ...state,
    selectedPath: [],
    selectedAnimal: null,
  };
}

export function beginSelection(state: GameState, point: Point): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  return {
    ...state,
    selectedPath: [point],
    selectedAnimal: state.board[point.row][point.col],
  };
}

export function extendSelection(state: GameState, point: Point): GameState {
  if (state.mode !== "playing" || !state.selectedAnimal) {
    return state;
  }

  if (state.board[point.row][point.col] !== state.selectedAnimal) {
    return state;
  }

  const lastPoint = state.selectedPath[state.selectedPath.length - 1];
  if (!lastPoint) {
    return beginSelection(state, point);
  }

  if (isSamePoint(lastPoint, point)) {
    return state;
  }

  if (state.selectedPath.some((entry) => isSamePoint(entry, point))) {
    return state;
  }

  if (!isAdjacent(lastPoint, point)) {
    return state;
  }

  return {
    ...state,
    selectedPath: [...state.selectedPath, point],
  };
}

export function resolveSelection(state: GameState): ResolveMoveResult {
  if (state.mode !== "playing" || !isPathValid(state.board, state.selectedPath)) {
    return {
      state: clearSelection(state),
      cleared: 0,
      reshuffled: false,
    };
  }

  const board = cloneBoard(state.board);
  for (const point of state.selectedPath) {
    board[point.row][point.col] = null as never;
  }

  const gravity = applyGravity(board, state.seed);
  const playable = ensurePlayableBoard(gravity.board, gravity.seed);
  const cleared = state.selectedPath.length;
  const score = state.score + scoreChain(cleared);
  const targetReached = state.targetReached || score >= state.targetScore;

  const nextState = withComputedMoves({
    ...state,
    board: playable.board,
    score,
    mode: "playing",
    targetReached,
    selectedPath: [],
    selectedAnimal: null,
    moves: state.moves + 1,
    reshuffles: state.reshuffles + (playable.reshuffled ? 1 : 0),
    message: targetReached
      ? null
      : playable.reshuffled
        ? "Board reshuffled. Fresh links available."
        : `Cleared ${cleared} animals for ${scoreChain(cleared)} points.`,
    messageTimer: targetReached ? 0 : 1100,
    lastClearCount: cleared,
    seed: playable.seed,
  });

  return {
    state: nextState,
    cleared,
    reshuffled: playable.reshuffled,
  };
}

export function advanceGame(state: GameState, ms: number): GameState {
  if (state.messageTimer <= 0) {
    return state;
  }

  const nextTimer = Math.max(0, state.messageTimer - ms);
  return {
    ...state,
    messageTimer: nextTimer,
    message: nextTimer === 0 && state.mode === "playing" ? null : state.message,
  };
}

export function boardToSymbols(board: Board): string[][] {
  return board.map((row) => row.map((cell) => (cell ? ANIMAL_STYLES[cell].label : ".")));
}

export function selectionToKeys(path: Point[]): string[] {
  return path.map(pointKey);
}
