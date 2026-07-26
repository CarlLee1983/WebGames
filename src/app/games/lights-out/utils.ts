export type CellPosition = { row: number; column: number };
export type GridSize = 3 | 5 | 7;
export type LightsOutPhase = "ready" | "playing" | "paused" | "won";

export type LightsOutGameState = {
  size: GridSize;
  board: boolean[][];
  phase: LightsOutPhase;
  moves: number;
  hintsUsed: number;
  elapsedSeconds: number;
  history: CellPosition[];
  parMoves: number;
  feedback: string;
};

export const GRID_SHUFFLE_COUNTS: Record<GridSize, number> = {
  3: 9,
  5: 24,
  7: 42,
};

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function assertSize(size: number) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("size must be a positive integer");
  }
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function getAffectedCells(
  size: number,
  row: number,
  column: number,
): CellPosition[] {
  assertSize(size);

  return DIRECTIONS.map(([rowOffset, columnOffset]) => ({
    row: row + rowOffset,
    column: column + columnOffset,
  })).filter(
    (cell) =>
      cell.row >= 0 &&
      cell.row < size &&
      cell.column >= 0 &&
      cell.column < size,
  );
}

export function toggleLightsInPlace(
  board: boolean[][],
  row: number,
  column: number,
  size: number,
) {
  for (const cell of getAffectedCells(size, row, column)) {
    board[cell.row][cell.column] = !board[cell.row][cell.column];
  }
}

export function toggleLights(
  board: boolean[][],
  row: number,
  column: number,
): boolean[][] {
  const nextBoard = board.map((boardRow) => [...boardRow]);
  toggleLightsInPlace(nextBoard, row, column, board.length);
  return nextBoard;
}

export function generateBoard(
  size: number,
  initialShuffles = 20,
  random: () => number = Math.random,
): boolean[][] {
  assertSize(size);
  const board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  for (let index = 0; index < initialShuffles; index += 1) {
    const row = Math.floor(random() * size);
    const column = Math.floor(random() * size);
    toggleLightsInPlace(board, row, column, size);
  }

  // Repeated random moves can cancel out. Keep every generated round playable.
  if (checkIsSolved(board)) {
    const center = Math.floor(size / 2);
    toggleLightsInPlace(board, center, center, size);
  }

  return board;
}

export function countLights(board: boolean[][]): number {
  return board.reduce(
    (total, row) => total + row.filter(Boolean).length,
    0,
  );
}

export function checkIsSolved(board: boolean[][]): boolean {
  return countLights(board) === 0;
}

/** Solve the board as a GF(2) linear system. */
export function solveLightsOut(
  board: boolean[][],
  size: number,
): boolean[][] | null {
  const cellCount = size * size;
  const matrix: number[][] = Array.from({ length: cellCount }, () =>
    Array.from({ length: cellCount + 1 }, () => 0),
  );

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const matrixRow = row * size + column;
      matrix[matrixRow][cellCount] = board[row][column] ? 1 : 0;

      for (const affectedCell of getAffectedCells(size, row, column)) {
        const matrixColumn =
          affectedCell.row * size + affectedCell.column;
        matrix[matrixRow][matrixColumn] = 1;
      }
    }
  }

  let pivot = 0;
  for (let column = 0; column < cellCount && pivot < cellCount; column += 1) {
    let selectedRow = pivot;
    while (
      selectedRow < cellCount &&
      matrix[selectedRow][column] === 0
    ) {
      selectedRow += 1;
    }
    if (selectedRow === cellCount) continue;

    [matrix[pivot], matrix[selectedRow]] = [
      matrix[selectedRow],
      matrix[pivot],
    ];

    for (let row = 0; row < cellCount; row += 1) {
      if (row === pivot || matrix[row][column] !== 1) continue;

      for (let valueIndex = column; valueIndex <= cellCount; valueIndex += 1) {
        matrix[row][valueIndex] ^= matrix[pivot][valueIndex];
      }
    }
    pivot += 1;
  }

  const result = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  for (let row = 0; row < cellCount; row += 1) {
    const hasCoefficient = matrix[row]
      .slice(0, cellCount)
      .some((value) => value !== 0);
    if (!hasCoefficient && matrix[row][cellCount] !== 0) return null;

    const pivotColumn = matrix[row]
      .slice(0, cellCount)
      .findIndex((value) => value === 1);
    if (pivotColumn < 0) continue;

    result[Math.floor(pivotColumn / size)][pivotColumn % size] =
      matrix[row][cellCount] === 1;
  }

  return result;
}

export function findHintCell(
  board: boolean[][],
  size: number,
): CellPosition | null {
  const solution = solveLightsOut(board, size);
  if (!solution) return null;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (solution[row][column]) return { row, column };
    }
  }

  return null;
}

export function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function countSolutionMoves(board: boolean[][], size: number): number {
  const solution = solveLightsOut(board, size);
  if (!solution) return 0;
  return countLights(solution);
}

export function createLightsOutGame(
  size: GridSize,
  random: () => number = Math.random,
): LightsOutGameState {
  const board = generateBoard(size, GRID_SHUFFLE_COUNTS[size], random);

  return {
    size,
    board,
    phase: "ready",
    moves: 0,
    hintsUsed: 0,
    elapsedSeconds: 0,
    history: [],
    parMoves: countSolutionMoves(board, size),
    feedback: "Select a node to reroute its cross-shaped circuit.",
  };
}

function isValidCell(state: LightsOutGameState, row: number, column: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(column) &&
    row >= 0 &&
    row < state.size &&
    column >= 0 &&
    column < state.size
  );
}

export function pressLight(
  state: LightsOutGameState,
  row: number,
  column: number,
): LightsOutGameState {
  if (
    (state.phase !== "ready" && state.phase !== "playing") ||
    !isValidCell(state, row, column)
  ) {
    return state;
  }

  const board = toggleLights(state.board, row, column);
  const remaining = countLights(board);
  const won = remaining === 0;

  return {
    ...state,
    board,
    phase: won ? "won" : "playing",
    moves: state.moves + 1,
    history: [...state.history, { row, column }],
    feedback: won
      ? "Grid stabilized. Every light is now offline."
      : `Circuit rerouted. ${remaining} light${remaining === 1 ? "" : "s"} remain online.`,
  };
}

export function undoLightMove(state: LightsOutGameState): LightsOutGameState {
  if (state.phase === "paused" || state.phase === "won" || state.history.length === 0) {
    return state;
  }

  const previous = state.history[state.history.length - 1];
  const history = state.history.slice(0, -1);

  return {
    ...state,
    board: toggleLights(state.board, previous.row, previous.column),
    phase: history.length === 0 ? "ready" : "playing",
    moves: Math.max(0, state.moves - 1),
    history,
    feedback: `Undid row ${previous.row + 1}, column ${previous.column + 1}.`,
  };
}

export function requestLightsHint(state: LightsOutGameState): {
  state: LightsOutGameState;
  hint: CellPosition | null;
} {
  if (state.phase !== "ready" && state.phase !== "playing") {
    return { state, hint: null };
  }

  const hint = findHintCell(state.board, state.size);
  if (!hint) {
    return {
      state: { ...state, feedback: "No reroute suggestion is available for this grid." },
      hint: null,
    };
  }

  return {
    state: {
      ...state,
      hintsUsed: state.hintsUsed + 1,
      feedback: `Suggested node: row ${hint.row + 1}, column ${hint.column + 1}.`,
    },
    hint,
  };
}

export function toggleLightsPause(state: LightsOutGameState): LightsOutGameState {
  if (state.phase === "playing") {
    return {
      ...state,
      phase: "paused",
      feedback: "Grid operations paused. The timer is frozen.",
    };
  }
  if (state.phase === "paused") {
    return {
      ...state,
      phase: "playing",
      feedback: "Grid operations resumed.",
    };
  }
  return state;
}

export function tickLightsOut(state: LightsOutGameState): LightsOutGameState {
  if (state.phase !== "playing") return state;
  return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
}

export function getLightsRating(
  parMoves: number,
  moves: number,
  hintsUsed: number,
): 1 | 2 | 3 {
  if (hintsUsed === 0 && moves <= parMoves) return 3;
  if (hintsUsed <= 2 && moves <= parMoves + 3) return 2;
  return 1;
}

export function parseBestMoves(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function lightsOutStateToRows(state: LightsOutGameState): string[] {
  return state.board.map((row) => row.map((isOn) => (isOn ? "1" : "0")).join(" "));
}
