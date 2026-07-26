"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import Container from "@/components/common/Container";

import {
  type Difficulty,
  type SudokuGameState,
  applySudokuHint,
  createSeededRandom,
  createSudokuGame,
  formatElapsed,
  getCandidates,
  getEditableCount,
  getSudokuCompletion,
  getSudokuErrorKeys,
  getSudokuRating,
  inputSudokuValue,
  parseBestMoves,
  selectSudokuCell,
  sudokuStateToRows,
  tickSudoku,
  toggleSudokuNotes,
  toggleSudokuPause,
  undoSudoku,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

const DIFFICULTIES: Array<{ value: Difficulty; label: string; detail: string }> = [
  { value: "easy", label: "Calm", detail: "42 clues" },
  { value: "medium", label: "Focus", detail: "36 clues" },
  { value: "hard", label: "Master", detail: "30 clues" },
];

const BEST_KEY_PREFIX = "web-games:sudoku:best-moves:";
const EMPTY_BEST: Record<Difficulty, number | null> = {
  easy: null,
  medium: null,
  hard: null,
};

function renderGameToText(state: SudokuGameState, bestMoves: number | null): string {
  const editable = getEditableCount(state.puzzle);
  return JSON.stringify({
    phase: state.phase,
    difficulty: state.difficulty,
    moves: state.moves,
    hintsUsed: state.hintsUsed,
    elapsedSeconds: state.elapsedSeconds,
    completion: getSudokuCompletion(state),
    conflicts: getSudokuErrorKeys(state).size,
    bestMoves,
    selectedCell: state.selectedCell,
    notesMode: state.notesMode,
    rating: state.phase === "won"
      ? getSudokuRating(editable, state.moves, state.hintsUsed)
      : null,
    feedback: state.feedback,
    board: sudokuStateToRows(state),
  });
}

export default function SudokuGame() {
  const [game, setGame] = useState<SudokuGameState>(() =>
    createSudokuGame("easy", createSeededRandom(2_026)),
  );
  const [bestMoves, setBestMoves] = useState<Record<Difficulty, number | null>>(EMPTY_BEST);
  const gameRef = useRef(game);
  const bestMovesRef = useRef(bestMoves);
  const hasLoadedBestRef = useRef(false);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const isPaused = game.phase === "paused";
  const isSolved = game.phase === "won";
  const selectedCell = game.selectedCell;
  const selectedValue = game.grid[selectedCell.row][selectedCell.column];
  const selectedCandidates = useMemo(
    () => getCandidates(game.grid, selectedCell.row, selectedCell.column),
    [game.grid, selectedCell.column, selectedCell.row],
  );
  const errorKeys = useMemo(() => getSudokuErrorKeys(game), [game]);
  const completion = getSudokuCompletion(game);
  const editableCells = getEditableCount(game.puzzle);
  const currentBest = bestMoves[game.difficulty];
  const rating = isSolved
    ? getSudokuRating(editableCells, game.moves, game.hintsUsed)
    : null;
  const digitCounts = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
        (digit) => game.grid.flat().filter((value) => value === digit).length,
      ),
    [game.grid],
  );

  const commitGame = useCallback((next: SudokuGameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const focusCell = useCallback((row: number, column: number) => {
    const safeRow = Math.max(0, Math.min(8, row));
    const safeColumn = Math.max(0, Math.min(8, column));
    const next = selectSudokuCell(gameRef.current, safeRow, safeColumn);
    if (next !== gameRef.current) commitGame(next);
    window.requestAnimationFrame(() => {
      cellRefs.current[safeRow * 9 + safeColumn]?.focus({ preventScroll: true });
    });
  }, [commitGame]);

  const startRound = useCallback(
    (difficulty: Difficulty, shouldFocus = true) => {
      const next = createSudokuGame(difficulty);
      commitGame(next);
      cellRefs.current = [];
      if (shouldFocus) {
        const index = next.selectedCell.row * 9 + next.selectedCell.column;
        window.requestAnimationFrame(() => cellRefs.current[index]?.focus());
      }
    },
    [commitGame],
  );

  const recordBest = useCallback((completed: SudokuGameState) => {
    if (!hasLoadedBestRef.current || completed.phase !== "won") return;
    const current = bestMovesRef.current[completed.difficulty];
    if (current !== null && current <= completed.moves) return;

    const next = { ...bestMovesRef.current, [completed.difficulty]: completed.moves };
    bestMovesRef.current = next;
    setBestMoves(next);
    window.localStorage.setItem(`${BEST_KEY_PREFIX}${completed.difficulty}`, String(completed.moves));
  }, []);

  const enterValue = useCallback((value: number | null) => {
    const next = inputSudokuValue(gameRef.current, value);
    if (next === gameRef.current) return;
    commitGame(next);
    recordBest(next);
  }, [commitGame, recordBest]);

  const undo = useCallback(() => {
    const next = undoSudoku(gameRef.current);
    if (next !== gameRef.current) commitGame(next);
  }, [commitGame]);

  const showHint = useCallback(() => {
    const next = applySudokuHint(gameRef.current);
    if (next === gameRef.current) return;
    commitGame(next);
    recordBest(next);
    const index = next.selectedCell.row * 9 + next.selectedCell.column;
    window.requestAnimationFrame(() => cellRefs.current[index]?.focus({ preventScroll: true }));
  }, [commitGame, recordBest]);

  const toggleNotes = useCallback(() => {
    const next = toggleSudokuNotes(gameRef.current);
    if (next !== gameRef.current) commitGame(next);
  }, [commitGame]);

  const pauseOrResume = useCallback(() => {
    const wasPaused = gameRef.current.phase === "paused";
    const next = toggleSudokuPause(gameRef.current);
    if (next === gameRef.current) return;
    commitGame(next);
    if (wasPaused) {
      const index = next.selectedCell.row * 9 + next.selectedCell.column;
      window.requestAnimationFrame(() => cellRefs.current[index]?.focus({ preventScroll: true }));
    }
  }, [commitGame]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    bestMovesRef.current = bestMoves;
  }, [bestMoves]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => startRound("easy", false));
    return () => window.cancelAnimationFrame(frame);
  }, [startRound]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = { ...EMPTY_BEST };
      for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
        loaded[difficulty] = parseBestMoves(
          window.localStorage.getItem(`${BEST_KEY_PREFIX}${difficulty}`),
        );
      }
      hasLoadedBestRef.current = true;
      bestMovesRef.current = loaded;
      setBestMoves(loaded);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (game.phase !== "playing") return;
    const timer = window.setInterval(() => commitGame(tickSudoku(gameRef.current)), 1000);
    return () => window.clearInterval(timer);
  }, [commitGame, game.phase]);

  useEffect(() => {
    const pauseActiveGame = () => {
      if (gameRef.current.phase === "playing") {
        commitGame(toggleSudokuPause(gameRef.current));
      }
    };
    const handleVisibility = () => {
      if (document.hidden) pauseActiveGame();
    };

    window.addEventListener("blur", pauseActiveGame);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", pauseActiveGame);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [commitGame]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!["h", "H", "u", "U", "n", "N", "p", "P", "Escape", "r", "R"].includes(event.key)) return;
      event.preventDefault();
      if (["h", "H"].includes(event.key)) showHint();
      if (["u", "U"].includes(event.key)) undo();
      if (["n", "N"].includes(event.key)) toggleNotes();
      if (["p", "P", "Escape"].includes(event.key)) pauseOrResume();
      if (["r", "R"].includes(event.key)) startRound(gameRef.current.difficulty);
    };

    window.addEventListener("keydown", handleShortcut, { passive: false });
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [pauseOrResume, showHint, startRound, toggleNotes, undo]);

  useEffect(() => {
    const renderTextState = () =>
      renderGameToText(gameRef.current, bestMovesRef.current[gameRef.current.difficulty]);
    window.render_game_to_text = renderTextState;
    return () => {
      if (window.render_game_to_text === renderTextState) delete window.render_game_to_text;
    };
  }, []);

  function handleCellKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    row: number,
    column: number,
  ) {
    if (event.key >= "1" && event.key <= "9") {
      event.preventDefault();
      enterValue(Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      enterValue(null);
      return;
    }

    const rowStart = row * 9;
    const movement: Record<string, number | undefined> = {
      ArrowLeft: rowStart + Math.max(0, column - 1),
      ArrowRight: rowStart + Math.min(8, column + 1),
      ArrowUp: Math.max(0, row - 1) * 9 + column,
      ArrowDown: Math.min(8, row + 1) * 9 + column,
      Home: rowStart,
      End: rowStart + 8,
    };
    const nextIndex = movement[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    focusCell(Math.floor(nextIndex / 9), nextIndex % 9);
  }

  const selectedIsEditable = game.puzzle[selectedCell.row][selectedCell.column] === null;
  const canEnterDigit = selectedIsEditable && (!game.notesMode || selectedValue === null) && !isPaused && !isSolved;
  const pauseDisabled = game.phase === "ready" || isSolved;

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#11152b] py-3 text-white sm:py-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 12% 8%, rgba(99,102,241,.2), transparent 30%), radial-gradient(circle at 88% 12%, rgba(245,158,11,.15), transparent 28%), radial-gradient(circle at 50% 88%, rgba(6,182,212,.12), transparent 36%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)", backgroundSize: "42px 42px", maskImage: "linear-gradient(to bottom, black, transparent 75%)" }} />

      <Container size="lg" className="relative">
        <header className="mb-3 flex flex-col items-center justify-between gap-3 lg:flex-row lg:items-end">
          <div className="text-center lg:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row lg:justify-start">
              <div className="inline-flex min-h-7 items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
                <span className="i-ph-pencil-line-fill h-4 w-4" aria-hidden="true" /> Logic atelier
              </div>
              <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight sm:text-4xl">
                <span className="i-ph-grid-nine-duotone h-9 w-9 text-indigo-300" aria-hidden="true" /> Sudoku
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-300/75">
              Shape a complete 1–9 pattern across every row, column, and nine-cell room.
            </p>
          </div>

          <div aria-label="Difficulty" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-indigo-950 p-1.5 shadow-2xl shadow-black/25" role="group">
            {DIFFICULTIES.map((option) => {
              const isActive = game.difficulty === option.value;
              return (
                <button key={option.value} type="button" aria-pressed={isActive} onClick={() => startRound(option.value)} className={`min-h-10 rounded-xl px-3 py-1.5 text-center transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${isActive ? "bg-amber-300 text-slate-950 shadow-lg shadow-amber-950/30" : "bg-indigo-900 text-slate-300 hover:bg-indigo-800 hover:text-white"}`}>
                  <span className="block text-xs font-black">{option.label}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">{option.detail}</span>
                </button>
              );
            })}
          </div>
        </header>

        <main className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <section className="min-w-0 rounded-[28px] border border-indigo-100/10 bg-[#171c38]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Puzzle manuscript</p>
                  <span className="rounded-full bg-amber-300/12 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">{completion}% inked</span>
                </div>
                <p id="sudoku-status" className="mt-1 min-h-5 truncate text-xs font-semibold text-slate-400" aria-live="polite">{game.feedback}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <ToolButton icon="i-ph-pencil-simple-line-duotone" label="Notes" pressed={game.notesMode} onClick={toggleNotes} disabled={isPaused || isSolved} />
                <ToolButton icon="i-ph-lightbulb-duotone" label="Hint" onClick={showHint} disabled={isPaused || isSolved} />
                <ToolButton icon="i-ph-arrow-u-up-left-duotone" label="Undo" onClick={undo} disabled={game.history.length === 0 || isPaused || isSolved} />
                <ToolButton icon={isPaused ? "i-ph-play-fill" : "i-ph-pause-fill"} label={isPaused ? "Resume" : "Pause"} accessibleLabel={isPaused ? "Resume game" : "Pause game"} onClick={pauseOrResume} disabled={pauseDisabled} />
              </div>
            </div>

            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/35" role="progressbar" aria-label="Puzzle completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}>
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-cyan-300 to-amber-300 transition-[width] duration-500" style={{ width: `${completion}%` }} />
            </div>

            <div className="relative -mx-1 sm:mx-auto sm:max-w-[380px]">
              <div aria-label="9 by 9 Sudoku grid. Arrow keys move between cells." className="mx-auto grid aspect-square w-full overflow-hidden border-2 border-slate-800 bg-slate-800 shadow-xl shadow-black/25" role="grid" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))", gridTemplateRows: "repeat(9, minmax(0, 1fr))" }}>
                {game.grid.map((row, rowIndex) =>
                  row.map((value, columnIndex) => {
                    const index = rowIndex * 9 + columnIndex;
                    const isGiven = game.puzzle[rowIndex][columnIndex] !== null;
                    const isSelected = selectedCell.row === rowIndex && selectedCell.column === columnIndex;
                    const key = `${rowIndex}-${columnIndex}`;
                    const isError = errorKeys.has(key);
                    const selectedInSameUnit = selectedCell.row === rowIndex || selectedCell.column === columnIndex || (Math.floor(selectedCell.row / 3) === Math.floor(rowIndex / 3) && Math.floor(selectedCell.column / 3) === Math.floor(columnIndex / 3));
                    const isSameNumber = selectedValue !== null && value === selectedValue;
                    const notes = game.notes[rowIndex][columnIndex];
                    const labelState = isGiven
                      ? `given ${value}`
                      : value !== null
                        ? `editable ${value}${isError ? ", conflict" : ""}`
                        : notes.length > 0
                          ? `empty, notes ${notes.join(", ")}`
                          : "empty";

                    return (
                      <button
                        key={key}
                        ref={(element) => { cellRefs.current[index] = element; }}
                        type="button"
                        role="gridcell"
                        aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}: ${labelState}`}
                        aria-selected={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        disabled={isPaused || isSolved}
                        onClick={() => commitGame(selectSudokuCell(gameRef.current, rowIndex, columnIndex))}
                        onFocus={() => {
                          const next = selectSudokuCell(gameRef.current, rowIndex, columnIndex);
                          if (next !== gameRef.current) commitGame(next);
                        }}
                        onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                        className={`relative box-border flex aspect-square min-h-0 min-w-0 items-center justify-center border-slate-300 text-base font-black transition sm:text-lg ${columnIndex === 2 || columnIndex === 5 ? "border-r-2 border-r-slate-800" : columnIndex < 8 ? "border-r" : ""} ${rowIndex === 2 || rowIndex === 5 ? "border-b-2 border-b-slate-800" : rowIndex < 8 ? "border-b" : ""} ${isSelected ? "z-10 bg-amber-200 text-slate-950 shadow-[inset_0_0_0_2px_rgba(245,158,11,.8)]" : isError ? "bg-rose-100 text-rose-700" : isSameNumber ? "bg-cyan-100 text-cyan-900" : selectedInSameUnit ? "bg-indigo-50 text-slate-900" : isGiven ? "bg-amber-50 text-slate-950" : "bg-white text-indigo-700"} focus-visible:z-20 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-indigo-600 disabled:cursor-default`}
                      >
                        {value ?? (
                          <span aria-hidden="true" className="grid h-full w-full grid-cols-3 grid-rows-3 p-px text-[6px] font-bold leading-none text-indigo-500 sm:text-[8px]">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((note) => <span key={note} className="flex items-center justify-center">{notes.includes(note) ? note : ""}</span>)}
                          </span>
                        )}
                        {isGiven && <span aria-hidden="true" className="absolute left-0.5 top-0.5 h-1 w-1 rounded-full bg-slate-500" />}
                        {isError && <span aria-hidden="true" className="absolute right-0.5 top-0 text-[8px] font-black">!</span>}
                      </button>
                    );
                  }),
                )}
              </div>

              {isPaused && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center border border-indigo-100/10 bg-slate-950/96 p-5 text-center backdrop-blur-md">
                  <span className="i-ph-book-open-text-duotone h-12 w-12 text-indigo-300" aria-hidden="true" />
                  <h2 className="mt-2 text-xl font-black">Manuscript closed</h2>
                  <p className="mt-1 text-xs text-slate-400">Puzzle and timer are paused.</p>
                  <button type="button" onClick={pauseOrResume} className="mt-4 min-h-10 rounded-xl bg-indigo-400 px-5 text-xs font-black text-slate-950 transition hover:bg-indigo-300">Resume study</button>
                </div>
              )}

              {isSolved && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center border border-amber-200/20 bg-slate-950/96 p-5 text-center backdrop-blur-md">
                  <div className="text-2xl tracking-[0.18em] text-amber-300" aria-label={`${rating} star rating`}>{"★".repeat(rating ?? 1)}{"☆".repeat(3 - (rating ?? 1))}</div>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.24em] text-indigo-300">Pattern complete</p>
                  <h2 className="mt-1 text-2xl font-black">Every number belongs</h2>
                  <p className="mt-2 text-xs text-slate-400">{game.moves} moves · {formatElapsed(game.elapsedSeconds)} · {game.hintsUsed} hints</p>
                  <p className="mt-1 text-[10px] text-slate-500">Best {currentBest ?? game.moves} moves</p>
                  <button type="button" onClick={() => startRound(game.difficulty)} className="mt-4 min-h-10 rounded-xl bg-amber-300 px-6 text-xs font-black text-slate-950 transition hover:bg-amber-200">Begin another puzzle</button>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon="i-ph-timer-duotone" label="Time" value={formatElapsed(game.elapsedSeconds)} accent="text-cyan-300" />
              <StatCard icon="i-ph-footprints-duotone" label="Moves" value={String(game.moves)} accent="text-indigo-300" />
              <StatCard icon="i-ph-warning-circle-duotone" label="Conflicts" value={String(errorKeys.size)} accent="text-rose-300" />
              <StatCard icon="i-ph-trophy-duotone" label="Best" value={currentBest === null ? "—" : String(currentBest)} accent="text-amber-300" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1a2040] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Number palette</p>
                  <p className="mt-0.5 text-xs text-slate-400">{game.notesMode ? "Candidate notes" : "Value entry"}</p>
                </div>
                <button type="button" aria-pressed={game.notesMode} onClick={toggleNotes} disabled={isPaused || isSolved} className={`min-h-9 rounded-xl px-3 text-xs font-black transition disabled:opacity-35 ${game.notesMode ? "bg-amber-300 text-slate-950" : "bg-indigo-900 text-white"}`}>{game.notesMode ? "Notes on" : "Notes off"}</button>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number, index) => (
                  <button key={number} type="button" aria-label={`Enter ${number}; ${digitCounts[index]} of 9 placed`} onClick={() => enterValue(number)} disabled={!canEnterDigit} className="relative flex min-h-10 items-center justify-center rounded-xl bg-slate-50 text-lg font-black text-indigo-800 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:scale-95 disabled:opacity-35">
                    {number}<span aria-hidden="true" className="absolute bottom-0.5 right-1 text-[7px] font-bold text-slate-400">{digitCounts[index]}/9</span>
                  </button>
                ))}
                <button type="button" aria-label="Erase selected cell" onClick={() => enterValue(null)} disabled={!selectedIsEditable || selectedValue === null || isPaused || isSolved} className="flex min-h-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 transition hover:bg-rose-200 disabled:opacity-35"><span className="i-ph-eraser-duotone h-5 w-5" aria-hidden="true" /></button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1a2040] p-3 text-[10px] leading-4 text-slate-400">
              <div className="flex items-center justify-between gap-2 font-black text-white">
                <span>R{selectedCell.row + 1} · C{selectedCell.column + 1}</span>
                <span className="rounded-full bg-indigo-300/10 px-2 py-0.5 text-indigo-200">Hints {game.hintsUsed}</span>
              </div>
              <p className="mt-1">Candidates: {selectedCandidates.length > 0 ? selectedCandidates.join(" · ") : "—"}</p>
              <p className="mt-2 border-t border-white/8 pt-2">Arrows move · 1–9 enter · Backspace erases · N notes · H hint · U undo · P/Esc pause · R new.</p>
            </div>

            <button type="button" onClick={() => startRound(game.difficulty)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/10 px-4 text-xs font-black text-amber-100 transition hover:bg-amber-200/20">
              <span className="i-ph-arrow-counter-clockwise-bold h-4 w-4" aria-hidden="true" /> New {game.difficulty} puzzle
            </button>
          </aside>
        </main>
      </Container>
    </div>
  );
}

function ToolButton({ icon, label, accessibleLabel, pressed, disabled = false, onClick }: { icon: string; label: string; accessibleLabel?: string; pressed?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={accessibleLabel ?? label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className={`flex min-h-10 min-w-10 items-center justify-center rounded-xl border px-2.5 transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${pressed ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/10 bg-indigo-900 text-white hover:bg-indigo-800"}`}>
      <span className={`${icon} h-4 w-4`} aria-hidden="true" /><span className="sr-only">{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a2040] p-3 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span><span className={`${icon} h-4 w-4 ${accent}`} aria-hidden="true" /></div>
      <span className="mt-1 block text-xl font-black tracking-tight text-white">{value}</span>
    </div>
  );
}
