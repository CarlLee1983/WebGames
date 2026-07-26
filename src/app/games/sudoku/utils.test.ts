import { describe, expect, test } from "bun:test";
import {
  applySudokuHint,
  countSolutions,
  createSudokuGame,
  createSeededRandom,
  findErrors,
  formatElapsed,
  generateSudoku,
  getCandidates,
  getEditableCount,
  getSudokuCompletion,
  getSudokuErrorKeys,
  getSudokuRating,
  inputSudokuValue,
  isGridSolved,
  parseBestMoves,
  selectSudokuCell,
  sudokuStateToRows,
  tickSudoku,
  toggleSudokuNotes,
  toggleSudokuPause,
  type Difficulty,
  type Grid,
  undoSudoku,
} from "./utils";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const EXPECTED_CLUES: Record<Difficulty, number> = {
  easy: 42,
  medium: 36,
  hard: 30,
};

describe("generateSudoku", () => {
  test("creates valid uniquely solvable rounds for every difficulty", () => {
    DIFFICULTIES.forEach((difficulty, index) => {
      const round = generateSudoku(
        difficulty,
        createSeededRandom(100 + index),
      );
      const clues = round.puzzle.flat().filter((value) => value !== null);

      expect(clues).toHaveLength(EXPECTED_CLUES[difficulty]);
      expect(countSolutions(round.puzzle)).toBe(1);
      expect(isGridSolved(round.solution, round.solution)).toBe(true);
      round.puzzle.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
          if (value !== null) {
            expect(value).toBe(round.solution[rowIndex][columnIndex]);
          }
        });
      });
    });
  });

  test("varies the transformed puzzle with the random seed", () => {
    const first = generateSudoku("easy", createSeededRandom(1));
    const second = generateSudoku("easy", createSeededRandom(2));
    expect(first.puzzle).not.toEqual(second.puzzle);
  });
});

describe("Sudoku rules", () => {
  test("returns candidates excluded by the row, column, and box", () => {
    const grid: Grid = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => null),
    );
    grid[0][1] = 1;
    grid[1][0] = 2;
    grid[1][1] = 3;

    expect(getCandidates(grid, 0, 0)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  test("marks every participant in row, column, and box conflicts", () => {
    const grid: Grid = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => null),
    );
    grid[0][0] = 5;
    grid[0][1] = 5;
    grid[1][0] = 5;

    const errorKeys = findErrors(grid).map(
      (cell) => `${cell.row}-${cell.column}`,
    );
    expect(new Set(errorKeys)).toEqual(new Set(["0-0", "0-1", "1-0"]));
  });
});

describe("Sudoku round state", () => {
  test("creates a deterministic ready round with the first editable cell selected", () => {
    const state = createSudokuGame("medium", createSeededRandom(2_026));
    const { row, column } = state.selectedCell;

    expect(state.phase).toBe("ready");
    expect(state.puzzle[row][column]).toBeNull();
    expect(state.grid).toEqual(state.puzzle);
    expect(getEditableCount(state.puzzle)).toBe(45);
    expect(getSudokuCompletion(state)).toBe(0);
  });

  test("adds candidate notes and undoes them without changing move count", () => {
    const opening = createSudokuGame("easy", createSeededRandom(8));
    const notesOn = toggleSudokuNotes(opening);
    const noted = inputSudokuValue(notesOn, 3);
    const { row, column } = noted.selectedCell;
    const restored = undoSudoku(noted);

    expect(notesOn.notesMode).toBe(true);
    expect(noted.notes[row][column]).toEqual([3]);
    expect(noted.moves).toBe(0);
    expect(restored.notes[row][column]).toEqual([]);
    expect(restored.phase).toBe("ready");
  });

  test("records a wrong value, exposes its error, and restores the prior grid", () => {
    const opening = createSudokuGame("easy", createSeededRandom(9));
    const { row, column } = opening.selectedCell;
    const wrong = opening.solution[row][column] === 1 ? 2 : 1;
    const entered = inputSudokuValue(opening, wrong);

    expect(entered.moves).toBe(1);
    expect(entered.phase).toBe("playing");
    expect(getSudokuErrorKeys(entered)).toContain(`${row}-${column}`);
    expect(undoSudoku(entered).grid).toEqual(opening.grid);
  });

  test("places a preferred hint and counts the assistance", () => {
    const opening = toggleSudokuNotes(
      createSudokuGame("hard", createSeededRandom(10)),
    );
    const hinted = applySudokuHint(opening);
    const { row, column } = opening.selectedCell;

    expect(hinted.grid[row][column]).toBe(opening.solution[row][column]);
    expect(hinted.hintsUsed).toBe(1);
    expect(hinted.moves).toBe(1);
    expect(hinted.notesMode).toBe(true);
    expect(hinted.feedback).toContain("Hint placed");
  });

  test("finishes a perfect round through immutable cell selections", () => {
    let state = createSudokuGame("easy", createSeededRandom(11));
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        if (state.puzzle[row][column] !== null) continue;
        state = selectSudokuCell(state, row, column);
        state = inputSudokuValue(state, state.solution[row][column]);
      }
    }

    const editable = getEditableCount(state.puzzle);
    expect(state.phase).toBe("won");
    expect(state.moves).toBe(editable);
    expect(getSudokuCompletion(state)).toBe(100);
    expect(getSudokuRating(editable, state.moves, state.hintsUsed)).toBe(3);
    expect(undoSudoku(state)).toBe(state);
  });

  test("pauses only active play and freezes elapsed time", () => {
    const opening = createSudokuGame("easy", createSeededRandom(12));
    const playing = applySudokuHint(opening);
    const paused = toggleSudokuPause(playing);

    expect(toggleSudokuPause(opening)).toBe(opening);
    expect(paused.phase).toBe("paused");
    expect(tickSudoku(paused)).toBe(paused);
    expect(tickSudoku(playing).elapsedSeconds).toBe(1);
    expect(toggleSudokuPause(paused).phase).toBe("playing");
  });

  test("sanitizes records, ratings, clocks, and inspectable rows", () => {
    const state = createSudokuGame("easy", createSeededRandom(13));
    const editable = getEditableCount(state.puzzle);

    expect(getSudokuRating(editable, editable + 4, 2)).toBe(2);
    expect(getSudokuRating(editable, editable + 10, 4)).toBe(1);
    expect(formatElapsed(-3)).toBe("00:00");
    expect(formatElapsed(65.9)).toBe("01:05");
    expect(parseBestMoves("39")).toBe(39);
    expect(parseBestMoves("0")).toBeNull();
    expect(parseBestMoves("2.5")).toBeNull();
    expect(sudokuStateToRows(state)).toHaveLength(9);
  });
});
