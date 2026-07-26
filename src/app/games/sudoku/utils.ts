export type Difficulty = "easy" | "medium" | "hard";
export type Grid = Array<Array<number | null>>;
export type CellPosition = { row: number; column: number };
export type NotesGrid = number[][][];
export type SudokuPhase = "ready" | "playing" | "paused" | "won";

export interface SudokuHistoryEntry {
  grid: Grid;
  notes: NotesGrid;
  moves: number;
}

export interface SudokuGameState {
  difficulty: Difficulty;
  puzzle: Grid;
  solution: number[][];
  grid: Grid;
  notes: NotesGrid;
  history: SudokuHistoryEntry[];
  moves: number;
  hintsUsed: number;
  elapsedSeconds: number;
  phase: SudokuPhase;
  notesMode: boolean;
  selectedCell: CellPosition;
  feedback: string;
}

export interface SudokuRound {
  puzzle: Grid;
  solution: number[][];
}

const BASE_SOLUTION: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

// A classic 30-clue puzzle with one solution. Valid Sudoku transformations
// create varied rounds without sacrificing uniqueness.
const BASE_PUZZLE: Grid = [
  [5, 3, null, null, 7, null, null, null, null],
  [6, null, null, 1, 9, 5, null, null, null],
  [null, 9, 8, null, null, null, null, 6, null],
  [8, null, null, null, 6, null, null, null, 3],
  [4, null, null, 8, null, 3, null, null, 1],
  [7, null, null, null, 2, null, null, null, 6],
  [null, 6, null, null, null, null, 2, 8, null],
  [null, null, null, 4, 1, 9, null, null, 5],
  [null, null, null, null, 8, null, null, 7, 9],
];

const TARGET_CLUES: Record<Difficulty, number> = {
  easy: 42,
  medium: 36,
  hard: 30,
};

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function createUnitOrder(random: () => number): number[] {
  return shuffle([0, 1, 2], random).flatMap((group) =>
    shuffle([0, 1, 2], random).map((index) => group * 3 + index),
  );
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function generateSudoku(
  difficulty: Difficulty,
  random: () => number = Math.random,
): SudokuRound {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const rowOrder = createUnitOrder(random);
  const columnOrder = createUnitOrder(random);
  const mapDigit = (value: number) => digits[value - 1];

  const solution = rowOrder.map((sourceRow) =>
    columnOrder.map((sourceColumn) =>
      mapDigit(BASE_SOLUTION[sourceRow][sourceColumn]),
    ),
  );
  const puzzle: Grid = rowOrder.map((sourceRow) =>
    columnOrder.map((sourceColumn) => {
      const value = BASE_PUZZLE[sourceRow][sourceColumn];
      return value === null ? null : mapDigit(value);
    }),
  );

  const emptyCells = shuffle(
    puzzle.flatMap((row, rowIndex) =>
      row.flatMap((value, columnIndex) =>
        value === null ? [{ row: rowIndex, column: columnIndex }] : [],
      ),
    ),
    random,
  );
  const additionalClues = TARGET_CLUES[difficulty] - 30;

  emptyCells.slice(0, additionalClues).forEach((cell) => {
    puzzle[cell.row][cell.column] = solution[cell.row][cell.column];
  });

  return { puzzle, solution };
}

export function getCandidates(
  grid: Grid,
  row: number,
  column: number,
): number[] {
  if (grid[row][column] !== null) return [];

  const used = new Set<number>();
  grid[row].forEach((value) => {
    if (value !== null) used.add(value);
  });
  grid.forEach((gridRow) => {
    const value = gridRow[column];
    if (value !== null) used.add(value);
  });

  const blockRow = Math.floor(row / 3) * 3;
  const blockColumn = Math.floor(column / 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      const value = grid[blockRow + rowOffset][blockColumn + columnOffset];
      if (value !== null) used.add(value);
    }
  }

  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (value) => !used.has(value),
  );
}

export function countSolutions(grid: Grid, limit = 2): number {
  const workingGrid = cloneGrid(grid);

  const search = (): number => {
    let target: CellPosition | null = null;
    let targetCandidates: number[] = [];

    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        if (workingGrid[row][column] !== null) continue;
        const candidates = getCandidates(workingGrid, row, column);
        if (candidates.length === 0) return 0;

        if (!target || candidates.length < targetCandidates.length) {
          target = { row, column };
          targetCandidates = candidates;
        }
      }
    }

    if (!target) return 1;

    let solutions = 0;
    for (const candidate of targetCandidates) {
      workingGrid[target.row][target.column] = candidate;
      solutions += search();
      workingGrid[target.row][target.column] = null;
      if (solutions >= limit) return solutions;
    }

    return solutions;
  };

  return search();
}

export function findErrors(grid: Grid): CellPosition[] {
  const errorKeys = new Set<string>();
  const addDuplicates = (cells: Array<{ value: number; key: string }>) => {
    const counts = new Map<number, number>();
    cells.forEach((cell) => {
      counts.set(cell.value, (counts.get(cell.value) ?? 0) + 1);
    });
    cells.forEach((cell) => {
      if ((counts.get(cell.value) ?? 0) > 1) errorKeys.add(cell.key);
    });
  };

  for (let index = 0; index < 9; index += 1) {
    addDuplicates(
      grid[index].flatMap((value, column) =>
        value === null ? [] : [{ value, key: `${index}-${column}` }],
      ),
    );
    addDuplicates(
      grid.flatMap((row, rowIndex) => {
        const value = row[index];
        return value === null ? [] : [{ value, key: `${rowIndex}-${index}` }];
      }),
    );
  }

  for (let blockRow = 0; blockRow < 3; blockRow += 1) {
    for (let blockColumn = 0; blockColumn < 3; blockColumn += 1) {
      const cells: Array<{ value: number; key: string }> = [];
      for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
          const row = blockRow * 3 + rowOffset;
          const column = blockColumn * 3 + columnOffset;
          const value = grid[row][column];
          if (value !== null) cells.push({ value, key: `${row}-${column}` });
        }
      }
      addDuplicates(cells);
    }
  }

  return [...errorKeys].map((key) => {
    const [row, column] = key.split("-").map(Number);
    return { row, column };
  });
}

export function isGridFull(grid: Grid): boolean {
  return grid.every((row) => row.every((cell) => cell !== null));
}

export function isGridSolved(grid: Grid, solution: number[][]): boolean {
  return grid.every((row, rowIndex) =>
    row.every((value, columnIndex) => value === solution[rowIndex][columnIndex]),
  );
}

export function findHint(
  grid: Grid,
  puzzle: Grid,
  solution: number[][],
  preferredCell: CellPosition | null,
): (CellPosition & { value: number }) | null {
  if (
    preferredCell &&
    puzzle[preferredCell.row][preferredCell.column] === null &&
    grid[preferredCell.row][preferredCell.column] !==
      solution[preferredCell.row][preferredCell.column]
  ) {
    return {
      ...preferredCell,
      value: solution[preferredCell.row][preferredCell.column],
    };
  }

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (
        puzzle[row][column] === null &&
        grid[row][column] !== solution[row][column]
      ) {
        return { row, column, value: solution[row][column] };
      }
    }
  }

  return null;
}

export function createNotesGrid(): NotesGrid {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => []),
  );
}

export function cloneNotes(notes: NotesGrid): NotesGrid {
  return notes.map((row) => row.map((cellNotes) => [...cellNotes]));
}

export function firstEditableCell(puzzle: Grid): CellPosition {
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (puzzle[row][column] === null) return { row, column };
    }
  }
  return { row: 0, column: 0 };
}

export function createSudokuGame(
  difficulty: Difficulty,
  random: () => number = Math.random,
): SudokuGameState {
  const generated = generateSudoku(difficulty, random);
  return {
    difficulty,
    ...generated,
    grid: cloneGrid(generated.puzzle),
    notes: createNotesGrid(),
    history: [],
    moves: 0,
    hintsUsed: 0,
    elapsedSeconds: 0,
    phase: "ready",
    notesMode: false,
    selectedCell: firstEditableCell(generated.puzzle),
    feedback: "Select an open cell to begin the study.",
  };
}

export function selectSudokuCell(
  state: SudokuGameState,
  row: number,
  column: number,
): SudokuGameState {
  if (
    state.phase === "paused" ||
    state.phase === "won" ||
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    row > 8 ||
    column < 0 ||
    column > 8
  ) {
    return state;
  }

  const value = state.grid[row][column];
  const feedback = state.puzzle[row][column] !== null
    ? `Given ${value} at row ${row + 1}, column ${column + 1}.`
    : value !== null
      ? `Editable ${value} at row ${row + 1}, column ${column + 1}.`
      : `Open cell at row ${row + 1}, column ${column + 1}. ${getCandidates(state.grid, row, column).length} candidates remain.`;

  return { ...state, selectedCell: { row, column }, feedback };
}

function historyEntry(state: SudokuGameState): SudokuHistoryEntry {
  return {
    grid: cloneGrid(state.grid),
    notes: cloneNotes(state.notes),
    moves: state.moves,
  };
}

function removePeerNotes(
  notes: NotesGrid,
  row: number,
  column: number,
  value: number,
) {
  for (let index = 0; index < 9; index += 1) {
    notes[row][index] = notes[row][index].filter((note) => note !== value);
    notes[index][column] = notes[index][column].filter((note) => note !== value);
  }

  const blockRow = Math.floor(row / 3) * 3;
  const blockColumn = Math.floor(column / 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      const noteRow = blockRow + rowOffset;
      const noteColumn = blockColumn + columnOffset;
      notes[noteRow][noteColumn] = notes[noteRow][noteColumn].filter(
        (note) => note !== value,
      );
    }
  }
}

export function inputSudokuValue(
  state: SudokuGameState,
  value: number | null,
): SudokuGameState {
  if (state.phase === "paused" || state.phase === "won") return state;
  const { row, column } = state.selectedCell;
  if (state.puzzle[row][column] !== null) return state;
  if (value !== null && (!Number.isInteger(value) || value < 1 || value > 9)) return state;

  const existingValue = state.grid[row][column];
  if (state.notesMode && value !== null) {
    if (existingValue !== null) return state;
    const notes = cloneNotes(state.notes);
    const currentNotes = notes[row][column];
    const removing = currentNotes.includes(value);
    notes[row][column] = removing
      ? currentNotes.filter((note) => note !== value)
      : [...currentNotes, value].sort();

    return {
      ...state,
      notes,
      history: [...state.history, historyEntry(state)].slice(-80),
      phase: "playing",
      feedback: `Candidate ${value} ${removing ? "removed from" : "added to"} row ${row + 1}, column ${column + 1}.`,
    };
  }

  if (existingValue === value) return state;
  const grid = cloneGrid(state.grid);
  const notes = cloneNotes(state.notes);
  grid[row][column] = value;
  notes[row][column] = [];

  if (value !== null && value === state.solution[row][column]) {
    removePeerNotes(notes, row, column, value);
  }

  const won = isGridSolved(grid, state.solution);
  return {
    ...state,
    grid,
    notes,
    history: [...state.history, historyEntry(state)].slice(-80),
    moves: state.moves + 1,
    phase: won ? "won" : "playing",
    feedback: won
      ? "Pattern complete. Every number belongs."
      : value === null
        ? `Cell at row ${row + 1}, column ${column + 1} cleared.`
        : value !== state.solution[row][column]
          ? `${value} conflicts with this puzzle's final pattern.`
          : `${value} placed correctly.`,
  };
}

export function toggleSudokuNotes(state: SudokuGameState): SudokuGameState {
  if (state.phase === "paused" || state.phase === "won") return state;
  return {
    ...state,
    notesMode: !state.notesMode,
    feedback: `Candidate notes ${state.notesMode ? "disabled" : "enabled"}.`,
  };
}

export function undoSudoku(state: SudokuGameState): SudokuGameState {
  const previous = state.history.at(-1);
  if (!previous || state.phase === "paused" || state.phase === "won") return state;

  return {
    ...state,
    grid: cloneGrid(previous.grid),
    notes: cloneNotes(previous.notes),
    moves: previous.moves,
    history: state.history.slice(0, -1),
    phase: state.history.length === 1 && state.elapsedSeconds === 0 ? "ready" : "playing",
    feedback: "Last entry restored.",
  };
}

export function applySudokuHint(state: SudokuGameState): SudokuGameState {
  if (state.phase === "paused" || state.phase === "won") return state;
  const hint = findHint(state.grid, state.puzzle, state.solution, state.selectedCell);
  if (!hint) return state;

  const selected = selectSudokuCell(state, hint.row, hint.column);
  const placed = inputSudokuValue({ ...selected, notesMode: false }, hint.value);
  return {
    ...placed,
    notesMode: state.notesMode,
    hintsUsed: state.hintsUsed + 1,
    feedback: placed.phase === "won"
      ? placed.feedback
      : `Hint placed ${hint.value} at row ${hint.row + 1}, column ${hint.column + 1}.`,
  };
}

export function toggleSudokuPause(state: SudokuGameState): SudokuGameState {
  if (state.phase === "playing") {
    return {
      ...state,
      phase: "paused",
      feedback: "Study paused. The board and timer are hidden.",
    };
  }
  if (state.phase === "paused") {
    return { ...state, phase: "playing", feedback: "Study resumed." };
  }
  return state;
}

export function tickSudoku(state: SudokuGameState): SudokuGameState {
  if (state.phase !== "playing") return state;
  return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
}

export function getEditableCount(puzzle: Grid): number {
  return puzzle.flat().filter((value) => value === null).length;
}

export function getSudokuCompletion(state: SudokuGameState): number {
  const editable = getEditableCount(state.puzzle);
  const filled = state.grid.reduce(
    (total, row, rowIndex) =>
      total + row.filter(
        (value, columnIndex) =>
          state.puzzle[rowIndex][columnIndex] === null && value !== null,
      ).length,
    0,
  );
  return Math.round((filled / editable) * 100);
}

export function getSudokuErrorKeys(state: SudokuGameState): Set<string> {
  const keys = new Set(findErrors(state.grid).map((position) => `${position.row}-${position.column}`));
  state.grid.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (
        state.puzzle[rowIndex][columnIndex] === null &&
        value !== null &&
        value !== state.solution[rowIndex][columnIndex]
      ) {
        keys.add(`${rowIndex}-${columnIndex}`);
      }
    });
  });
  return keys;
}

export function getSudokuRating(
  editableCells: number,
  moves: number,
  hintsUsed: number,
): 1 | 2 | 3 {
  if (hintsUsed === 0 && moves <= editableCells) return 3;
  if (hintsUsed <= 3 && moves <= editableCells + 9) return 2;
  return 1;
}

export function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function parseBestMoves(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function sudokuStateToRows(state: SudokuGameState): string[] {
  return state.grid.map((row) => row.map((value) => value ?? ".").join(" "));
}
