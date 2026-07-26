export const COLS = 10;
export const ROWS = 20;
export const CELL_SIZE = 28;
export const CANVAS_WIDTH = 520;
export const CANVAS_HEIGHT = 700;
export const BOARD_LEFT = 28;
export const BOARD_TOP = 84;
export const BOARD_WIDTH = COLS * CELL_SIZE;
export const BOARD_HEIGHT = ROWS * CELL_SIZE;
export const PANEL_LEFT = BOARD_LEFT + BOARD_WIDTH + 28;
export const PANEL_TOP = BOARD_TOP;
export const PANEL_WIDTH = 156;

export type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
export type Cell = PieceType | null;
export type Board = Cell[][];
export type GameMode = "ready" | "playing" | "paused" | "gameOver";
export type DangerLevel = "safe" | "warning" | "critical";
export type RotationDirection = 1 | -1;
export type RotationState = 0 | 1 | 2 | 3;

export interface PieceDefinition {
  matrix: number[][];
  fill: string;
  stroke: string;
  glow: string;
}

export interface ActivePiece {
  type: PieceType;
  matrix: number[][];
  x: number;
  y: number;
  rotation: RotationState;
}

export interface GameState {
  mode: GameMode;
  board: Board;
  active: ActivePiece;
  queue: PieceType[];
  hold: PieceType | null;
  canHold: boolean;
  rngSeed: number;
  score: number;
  level: number;
  lines: number;
  lastClear: number;
  lastScoreGain: number;
  clearMessage: string | null;
  feedbackRemainingMs: number;
  combo: number;
  bestCombo: number;
  piecesPlaced: number;
  dropAccumulator: number;
}

export interface LineClearResult {
  combo: number;
  lineScore: number;
  comboBonus: number;
  perfectClearBonus: number;
  total: number;
  message: string | null;
}

export const PIECES: Record<PieceType, PieceDefinition> = {
  I: {
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    fill: "#38bdf8",
    stroke: "#0f172a",
    glow: "rgba(56, 189, 248, 0.28)",
  },
  J: {
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    fill: "#3b82f6",
    stroke: "#0f172a",
    glow: "rgba(59, 130, 246, 0.28)",
  },
  L: {
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    fill: "#f97316",
    stroke: "#0f172a",
    glow: "rgba(249, 115, 22, 0.28)",
  },
  O: {
    matrix: [
      [1, 1],
      [1, 1],
    ],
    fill: "#facc15",
    stroke: "#0f172a",
    glow: "rgba(250, 204, 21, 0.28)",
  },
  S: {
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    fill: "#4ade80",
    stroke: "#0f172a",
    glow: "rgba(74, 222, 128, 0.28)",
  },
  T: {
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    fill: "#a855f7",
    stroke: "#0f172a",
    glow: "rgba(168, 85, 247, 0.28)",
  },
  Z: {
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    fill: "#ef4444",
    stroke: "#0f172a",
    glow: "rgba(239, 68, 68, 0.28)",
  },
};

const JLSTZ_KICKS: Record<string, Array<[number, number]>> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const I_KICKS: Record<string, Array<[number, number]>> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

const PIECE_ORDER: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];
const LINE_SCORES = [0, 100, 300, 500, 800];
const DEFAULT_SEED = 1337;
export const CLEAR_FEEDBACK_MS = 1300;

export function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => [...row]);
}

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function shuffleBag(seed: number): { bag: PieceType[]; seed: number } {
  const bag = [...PIECE_ORDER];
  let currentSeed = seed;

  for (let index = bag.length - 1; index > 0; index -= 1) {
    currentSeed = nextSeed(currentSeed);
    const swapIndex = currentSeed % (index + 1);
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }

  return { bag, seed: currentSeed };
}

function ensureQueue(queue: PieceType[], seed: number): { queue: PieceType[]; seed: number } {
  let nextQueue = [...queue];
  let currentSeed = seed;

  while (nextQueue.length < 6) {
    const batch = shuffleBag(currentSeed);
    nextQueue = nextQueue.concat(batch.bag);
    currentSeed = batch.seed;
  }

  return { queue: nextQueue, seed: currentSeed };
}

function spawnPiece(type: PieceType): ActivePiece {
  const matrix = cloneMatrix(PIECES[type].matrix);
  const width = matrix[0]?.length ?? 0;

  return {
    type,
    matrix,
    x: Math.floor((COLS - width) / 2),
    y: 0,
    rotation: 0,
  };
}

function takePiece(queue: PieceType[], seed: number): { piece: ActivePiece; queue: PieceType[]; seed: number } {
  const prepared = ensureQueue(queue, seed);
  const [type, ...rest] = prepared.queue;

  return {
    piece: spawnPiece(type),
    queue: rest,
    seed: prepared.seed,
  };
}

function getKickOffsets(type: PieceType, from: RotationState, to: RotationState): Array<[number, number]> {
  if (type === "O") {
    return [[0, 0]];
  }

  const key = `${from}>${to}`;
  return (type === "I" ? I_KICKS[key] : JLSTZ_KICKS[key]) ?? [[0, 0]];
}

export function getDropInterval(level: number): number {
  return Math.max(120, 920 - (level - 1) * 65);
}

export function canPlace(board: Board, piece: ActivePiece, offsetX = 0, offsetY = 0, matrix = piece.matrix): boolean {
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < matrix[rowIndex].length; colIndex += 1) {
      if (matrix[rowIndex][colIndex] === 0) continue;

      const nextX = piece.x + offsetX + colIndex;
      const nextY = piece.y + offsetY + rowIndex;

      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
        return false;
      }

      if (nextY >= 0 && board[nextY][nextX] !== null) {
        return false;
      }
    }
  }

  return true;
}

export function rotateMatrix(matrix: number[][], direction: RotationDirection = 1): number[][] {
  if (direction === 1) {
    return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]).reverse());
  }

  return matrix[0].map((_, columnIndex) => matrix.map((row) => row[row.length - 1 - columnIndex]));
}

function mergePiece(board: Board, piece: ActivePiece): Board {
  const nextBoard = board.map((row) => [...row]);

  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) return;
      const boardY = piece.y + rowIndex;
      const boardX = piece.x + colIndex;

      if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        nextBoard[boardY][boardX] = piece.type;
      }
    });
  });

  return nextBoard;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const survivors = board.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - survivors.length;

  if (cleared === 0) {
    return { board, cleared: 0 };
  }

  const emptyRows = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(null));
  return {
    board: [...emptyRows, ...survivors],
    cleared,
  };
}

export function getLineClearResult(
  linesCleared: number,
  level: number,
  previousCombo: number,
  isPerfectClear = false,
): LineClearResult {
  const normalizedLines = Math.max(0, Math.min(4, Math.floor(linesCleared)));
  const normalizedLevel = Math.max(1, Math.floor(level));
  const combo = normalizedLines > 0 ? previousCombo + 1 : 0;
  const lineScore = LINE_SCORES[normalizedLines] * normalizedLevel;
  const comboBonus = combo > 1 ? (combo - 1) * 50 * normalizedLevel : 0;
  const perfectClearBonus = normalizedLines > 0 && isPerfectClear ? 1200 * normalizedLevel : 0;
  const clearLabels = [null, "Single", "Double", "Triple", "Tetris"] as const;
  let message: string | null = clearLabels[normalizedLines];

  if (perfectClearBonus > 0) {
    message = "Perfect Clear";
  } else if (message && combo > 1) {
    message = `${message} · ${combo}× Combo`;
  }

  return {
    combo,
    lineScore,
    comboBonus,
    perfectClearBonus,
    total: lineScore + comboBonus + perfectClearBonus,
    message,
  };
}

function lockActivePiece(state: GameState, scoreBonus = 0): GameState {
  const merged = mergePiece(state.board, state.active);
  const clearedResult = clearLines(merged);
  const totalLines = state.lines + clearedResult.cleared;
  const nextLevel = Math.floor(totalLines / 10) + 1;
  const isPerfectClear = clearedResult.cleared > 0 && clearedResult.board.every((row) => row.every((cell) => cell === null));
  const clearResult = getLineClearResult(clearedResult.cleared, nextLevel, state.combo, isPerfectClear);
  const scoreGain = scoreBonus + clearResult.total;
  const nextDraw = takePiece(state.queue, state.rngSeed);
  const nextState: GameState = {
    ...state,
    board: clearedResult.board,
    active: nextDraw.piece,
    queue: nextDraw.queue,
    rngSeed: nextDraw.seed,
    score: state.score + scoreGain,
    level: nextLevel,
    lines: totalLines,
    lastClear: clearedResult.cleared,
    lastScoreGain: scoreGain,
    clearMessage: clearResult.message,
    feedbackRemainingMs: clearResult.message ? CLEAR_FEEDBACK_MS : 0,
    combo: clearResult.combo,
    bestCombo: Math.max(state.bestCombo, clearResult.combo),
    piecesPlaced: state.piecesPlaced + 1,
    dropAccumulator: 0,
    canHold: true,
  };

  if (!canPlace(nextState.board, nextState.active)) {
    return {
      ...nextState,
      mode: "gameOver",
    };
  }

  return nextState;
}

export function createInitialState(seed = DEFAULT_SEED): GameState {
  const firstDraw = takePiece([], seed);

  return {
    mode: "ready",
    board: createEmptyBoard(),
    active: firstDraw.piece,
    queue: firstDraw.queue,
    hold: null,
    canHold: true,
    rngSeed: firstDraw.seed,
    score: 0,
    level: 1,
    lines: 0,
    lastClear: 0,
    lastScoreGain: 0,
    clearMessage: null,
    feedbackRemainingMs: 0,
    combo: 0,
    bestCombo: 0,
    piecesPlaced: 0,
    dropAccumulator: 0,
  };
}

export function restartGame(seed = DEFAULT_SEED): GameState {
  return {
    ...createInitialState(seed),
    mode: "playing",
  };
}

export function startGame(state: GameState): GameState {
  if (state.mode === "ready") {
    return {
      ...state,
      mode: "playing",
    };
  }

  if (state.mode === "gameOver") {
    return restartGame();
  }

  return state;
}

export function togglePause(state: GameState): GameState {
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

export function movePiece(state: GameState, direction: -1 | 1): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  if (!canPlace(state.board, state.active, direction, 0)) {
    return state;
  }

  return {
    ...state,
    active: {
      ...state.active,
      x: state.active.x + direction,
    },
  };
}

export function rotatePiece(state: GameState, direction: RotationDirection = 1): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  const nextRotation = ((state.active.rotation + direction + 4) % 4) as RotationState;

  if (state.active.type === "O") {
    return {
      ...state,
      active: {
        ...state.active,
        rotation: nextRotation,
      },
    };
  }

  const rotated = rotateMatrix(state.active.matrix, direction);
  const kicks = getKickOffsets(state.active.type, state.active.rotation, nextRotation);

  for (const [offsetX, offsetY] of kicks) {
    if (canPlace(state.board, state.active, offsetX, offsetY, rotated)) {
      return {
        ...state,
        active: {
          ...state.active,
          matrix: rotated,
          x: state.active.x + offsetX,
          y: state.active.y + offsetY,
          rotation: nextRotation,
        },
      };
    }
  }

  return state;
}

export function holdPiece(state: GameState): GameState {
  if (state.mode !== "playing" || !state.canHold) {
    return state;
  }

  const currentType = state.active.type;
  const nextHeldType = currentType;
  let nextActive: ActivePiece;
  let nextQueue = state.queue;
  let nextSeed = state.rngSeed;

  if (state.hold === null) {
    const nextDraw = takePiece(state.queue, state.rngSeed);
    nextActive = nextDraw.piece;
    nextQueue = nextDraw.queue;
    nextSeed = nextDraw.seed;
  } else {
    nextActive = spawnPiece(state.hold);
  }

  const nextState: GameState = {
    ...state,
    active: nextActive,
    queue: nextQueue,
    hold: nextHeldType,
    canHold: false,
    rngSeed: nextSeed,
    dropAccumulator: 0,
  };

  if (!canPlace(nextState.board, nextState.active)) {
    return {
      ...nextState,
      mode: "gameOver",
    };
  }

  return nextState;
}

export function softDrop(state: GameState): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  if (canPlace(state.board, state.active, 0, 1)) {
    return {
      ...state,
      active: {
        ...state.active,
        y: state.active.y + 1,
      },
      score: state.score + 1,
      dropAccumulator: 0,
    };
  }

  return lockActivePiece(state);
}

export function hardDrop(state: GameState): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  let distance = 0;
  let dropped = state;

  while (canPlace(dropped.board, dropped.active, 0, 1)) {
    dropped = {
      ...dropped,
      active: {
        ...dropped.active,
        y: dropped.active.y + 1,
      },
    };
    distance += 1;
  }

  return lockActivePiece(dropped, distance * 2);
}

export function tick(state: GameState, deltaMs: number): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  let nextState = {
    ...state,
    dropAccumulator: state.dropAccumulator + deltaMs,
    feedbackRemainingMs: Math.max(0, state.feedbackRemainingMs - deltaMs),
  };

  if (nextState.feedbackRemainingMs === 0 && state.feedbackRemainingMs > 0) {
    nextState = {
      ...nextState,
      lastClear: 0,
      lastScoreGain: 0,
      clearMessage: null,
    };
  }
  const interval = getDropInterval(nextState.level);

  while (nextState.dropAccumulator >= interval) {
    nextState = {
      ...nextState,
      dropAccumulator: nextState.dropAccumulator - interval,
    };

    if (canPlace(nextState.board, nextState.active, 0, 1)) {
      nextState = {
        ...nextState,
        active: {
          ...nextState.active,
          y: nextState.active.y + 1,
        },
      };
      continue;
    }

    nextState = lockActivePiece(nextState);
    if (nextState.mode === "gameOver") {
      break;
    }
  }

  return nextState;
}

export function getGhostY(board: Board, piece: ActivePiece): number {
  let ghostY = piece.y;

  while (
    canPlace(
      board,
      {
        ...piece,
        y: ghostY,
      },
      0,
      1,
    )
  ) {
    ghostY += 1;
  }

  return ghostY;
}

export function boardToRows(board: Board): string[] {
  return board.map((row) => row.map((cell) => cell ?? ".").join(""));
}

export function getDangerLevel(board: Board): DangerLevel {
  const firstOccupiedRow = board.findIndex((row) => row.some((cell) => cell !== null));

  if (firstOccupiedRow === -1 || firstOccupiedRow >= 8) {
    return "safe";
  }

  return firstOccupiedRow < 4 ? "critical" : "warning";
}

export function getLinesUntilNextLevel(lines: number): number {
  const normalizedLines = Math.max(0, Math.floor(lines));
  return 10 - (normalizedLines % 10);
}
