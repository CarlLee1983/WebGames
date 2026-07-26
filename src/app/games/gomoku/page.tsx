"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import Container from "@/components/common/Container";

import {
  type AiDifficulty,
  BOARD_SIZE,
  type GameMode,
  type GomokuGameState,
  applyGameMove,
  createInitialGameState,
  getComputerMove,
  getCurrentPlayer,
  stateToRows,
  undoGame,
  type Player,
  type Winner,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

const CENTER = Math.floor(BOARD_SIZE / 2);
const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, index) => String.fromCharCode(65 + index));
const STAR_POINTS = new Set(["3:3", "3:7", "3:11", "7:3", "7:7", "7:11", "11:3", "11:7", "11:11"]);

const DIFFICULTY_META: Record<AiDifficulty, { label: string; detail: string }> = {
  easy: { label: "Easy", detail: "Explores wider choices" },
  normal: { label: "Normal", detail: "Balances attack and defense" },
  hard: { label: "Hard", detail: "Always selects its top line" },
};

function clearScheduledAiMove(timeoutRef: { current: number | null }) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

function getCoordinate(row: number, col: number): string {
  return `${COLUMN_LABELS[col]}${row + 1}`;
}

function getWinnerTitle(winner: Winner, gameMode: GameMode): string {
  if (winner === "draw") return "Board filled — draw";
  if (gameMode === "computer") return winner === "black" ? "You found five!" : "Computer found five";
  return `${winner === "black" ? "Black" : "White"} found five`;
}

function getWinnerSubtitle(winner: Winner, gameMode: GameMode): string {
  if (winner === "draw") return "Every intersection is occupied without a winning line.";
  if (gameMode === "computer") {
    return winner === "black" ? "Your sequence landed before the computer could close it." : "Study the highlighted line and try a new opening.";
  }
  return "The winning sequence is highlighted on the board.";
}

function renderGameToText(state: GomokuGameState, gameMode: GameMode, difficulty: AiDifficulty): string {
  return JSON.stringify({
    coordinateSystem: `top-left origin; rows 1-${BOARD_SIZE}; columns ${COLUMN_LABELS[0]}-${COLUMN_LABELS.at(-1)}`,
    gameMode,
    difficulty: gameMode === "computer" ? difficulty : null,
    currentPlayer: state.winner ? null : getCurrentPlayer(state.isBlackNext),
    winner: state.winner,
    movesPlayed: state.history.length,
    lastMove: state.lastMove
      ? { ...state.lastMove, coordinate: getCoordinate(state.lastMove.row, state.lastMove.col) }
      : null,
    winningLine: state.winningLine?.map((move) => ({
      ...move,
      coordinate: getCoordinate(move.row, move.col),
    })) ?? null,
    board: stateToRows(state),
  });
}

export default function GomokuGame() {
  const [gameMode, setGameMode] = useState<GameMode>("local");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");
  const [game, setGame] = useState<GomokuGameState>(() => createInitialGameState());
  const [cursor, setCursor] = useState({ row: CENTER, col: CENTER });
  const aiTimeoutRef = useRef<number | null>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const gameRef = useRef(game);

  const currentPlayer = getCurrentPlayer(game.isBlackNext);
  const isComputerMode = gameMode === "computer";
  const isComputerTurn = isComputerMode && currentPlayer === "white" && !game.winner;
  const canPlaceStone = !game.winner && (!isComputerMode || currentPlayer === "black");
  const moveCount = game.history.length;

  const commitGame = useCallback((next: GomokuGameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    const nextRow = Math.max(0, Math.min(BOARD_SIZE - 1, row));
    const nextCol = Math.max(0, Math.min(BOARD_SIZE - 1, col));
    setCursor({ row: nextRow, col: nextCol });
    window.requestAnimationFrame(() => cellRefs.current[nextRow * BOARD_SIZE + nextCol]?.focus());
  }, []);

  const resetRound = useCallback(() => {
    clearScheduledAiMove(aiTimeoutRef);
    commitGame(createInitialGameState());
    focusCell(CENTER, CENTER);
  }, [commitGame, focusCell]);

  const undoMove = useCallback(() => {
    clearScheduledAiMove(aiTimeoutRef);
    const next = undoGame(gameRef.current, gameMode);
    commitGame(next);
    const target = next.lastMove ?? { row: CENTER, col: CENTER };
    focusCell(target.row, target.col);
  }, [commitGame, focusCell, gameMode]);

  const placeStone = useCallback(
    (row: number, col: number) => {
      const previous = gameRef.current;
      const player = getCurrentPlayer(previous.isBlackNext);
      if (previous.winner || (gameMode === "computer" && player === "white")) return;

      const next = applyGameMove(previous, row, col, player);
      if (next !== previous) {
        commitGame(next);
        setCursor({ row, col });
      }
    },
    [commitGame, gameMode],
  );

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!isComputerTurn) {
      clearScheduledAiMove(aiTimeoutRef);
      return;
    }

    clearScheduledAiMove(aiTimeoutRef);
    aiTimeoutRef.current = window.setTimeout(() => {
      const previous = gameRef.current;
      const move = getComputerMove(previous.board, difficulty);
      if (move) {
        const next = applyGameMove(previous, move.row, move.col, "white");
        commitGame(next);
        setCursor(move);
      }
      aiTimeoutRef.current = null;
    }, 420);

    return () => clearScheduledAiMove(aiTimeoutRef);
  }, [commitGame, difficulty, isComputerTurn]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (["r", "R", "u", "U"].includes(event.key)) event.preventDefault();
      if (["r", "R"].includes(event.key)) resetRound();
      if (["u", "U"].includes(event.key) && gameRef.current.history.length > 0) undoMove();
    };

    window.addEventListener("keydown", handleShortcut, { passive: false });
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [resetRound, undoMove]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(gameRef.current, gameMode, difficulty);
    return () => {
      delete window.render_game_to_text;
    };
  }, [difficulty, gameMode]);

  function changeMode(nextMode: GameMode) {
    if (nextMode === gameMode) return;
    clearScheduledAiMove(aiTimeoutRef);
    setGameMode(nextMode);
    if (nextMode === "computer") setDifficulty("normal");
    commitGame(createInitialGameState());
    focusCell(CENTER, CENTER);
  }

  function changeDifficulty(nextDifficulty: AiDifficulty) {
    if (nextDifficulty === difficulty) return;
    clearScheduledAiMove(aiTimeoutRef);
    setDifficulty(nextDifficulty);
    commitGame(createInitialGameState());
    focusCell(CENTER, CENTER);
  }

  function handleBoardKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    const movement: Record<string, { row: number; col: number } | undefined> = {
      ArrowUp: { row: row - 1, col },
      ArrowDown: { row: row + 1, col },
      ArrowLeft: { row, col: col - 1 },
      ArrowRight: { row, col: col + 1 },
      Home: { row, col: 0 },
      End: { row, col: BOARD_SIZE - 1 },
    };
    const next = movement[event.key];

    if (next) {
      event.preventDefault();
      focusCell(next.row, next.col);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      placeStone(row, col);
    }
  }

  const turnTitle = game.winner
    ? getWinnerTitle(game.winner, gameMode)
    : isComputerTurn
      ? "Computer is reading the board"
      : isComputerMode
        ? "Your move — Black"
        : `${currentPlayer === "black" ? "Black" : "White"} to move`;

  const turnDetail = game.winner
    ? getWinnerSubtitle(game.winner, gameMode)
    : isComputerTurn
      ? `${DIFFICULTY_META[difficulty].label} AI replies after a short pause.`
      : game.lastMove
        ? `Last stone ${getCoordinate(game.lastMove.row, game.lastMove.col)} · move ${moveCount}`
        : "Black opens. Select any intersection to begin.";

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.17),_transparent_34%),linear-gradient(180deg,#fffbeb_0%,#f8fafc_68%)] py-4 sm:py-5">
      <Container size="lg">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <header className="flex flex-col items-center justify-between gap-3 lg:flex-row lg:items-end">
            <div className="text-center lg:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row lg:justify-start">
                <div className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                  <span className="i-ph-intersect-three-duotone text-base" /> Fifteen lines · one winning sequence
                </div>
                <h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Gomoku Atelier</h1>
              </div>
              <p className="mt-1 max-w-xl text-sm text-stone-600">
                Read the intersections, shape a threat, and connect five before your rival closes the line.
              </p>
            </div>

            <div aria-label="Game mode" className="grid grid-cols-2 rounded-2xl bg-amber-100 p-1.5 shadow-inner shadow-amber-950/10">
              {(["local", "computer"] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={gameMode === mode}
                  onClick={() => changeMode(mode)}
                  className={`min-h-10 rounded-xl px-4 text-xs font-black transition ${
                    gameMode === mode ? "bg-white text-amber-800 shadow-sm" : "text-amber-800/60 hover:text-amber-950"
                  }`}
                >
                  {mode === "local" ? "Local 2P" : "Vs Computer"}
                </button>
              ))}
            </div>
          </header>

          <main className="grid gap-4 lg:grid-cols-[minmax(320px,540px)_minmax(270px,310px)] lg:items-start lg:justify-center">
            <section className="flex min-w-0 justify-center" aria-label="Gomoku board area">
              <div
                className="relative box-border w-full rounded-[28px] border border-amber-300/70 bg-gradient-to-br from-[#e8b86f] via-[#dca65b] to-[#c88e45] p-2.5 shadow-[0_24px_70px_rgba(120,53,15,0.22)] sm:p-3"
                style={{ width: "min(100%, 540px, calc(100vh - 230px))" }}
              >
                <div className="grid grid-cols-[16px_1fr] grid-rows-[16px_1fr] gap-1 sm:grid-cols-[18px_1fr] sm:grid-rows-[18px_1fr]">
                  <span />
                  <div aria-hidden="true" className="grid grid-cols-15 text-center text-[8px] font-black text-amber-950/60 sm:text-[9px]">
                    {COLUMN_LABELS.map((label) => <span key={label}>{label}</span>)}
                  </div>
                  <div aria-hidden="true" className="grid grid-rows-15 items-center text-center text-[8px] font-black text-amber-950/60 sm:text-[9px]">
                    {Array.from({ length: BOARD_SIZE }, (_, index) => <span key={index}>{index + 1}</span>)}
                  </div>

                  <div
                    role="grid"
                    aria-label={`Gomoku board. ${turnTitle}. Arrow keys move; Enter or Space places a stone.`}
                    aria-rowcount={BOARD_SIZE}
                    aria-colcount={BOARD_SIZE}
                    aria-busy={isComputerTurn}
                    className="grid aspect-square w-full outline-none"
                    style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
                  >
                    {game.board.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        const isLastMove = game.lastMove?.row === rowIndex && game.lastMove.col === colIndex;
                        const isWinningCell = game.winningLine?.some((move) => move.row === rowIndex && move.col === colIndex) ?? false;
                        const coordinate = getCoordinate(rowIndex, colIndex);
                        const cellLabel = cell ? `${coordinate}, ${cell} stone${isLastMove ? ", last move" : ""}${isWinningCell ? ", winning line" : ""}` : `${coordinate}, empty`;

                        return (
                          <button
                            key={`${rowIndex}-${colIndex}`}
                            ref={(element) => { cellRefs.current[rowIndex * BOARD_SIZE + colIndex] = element; }}
                            type="button"
                            role="gridcell"
                            aria-label={cellLabel}
                            aria-selected={isLastMove}
                            tabIndex={cursor.row === rowIndex && cursor.col === colIndex ? 0 : -1}
                            onFocus={() => setCursor({ row: rowIndex, col: colIndex })}
                            onKeyDown={(event) => handleBoardKeyDown(event, rowIndex, colIndex)}
                            onClick={() => placeStone(rowIndex, colIndex)}
                            className="group relative flex aspect-square min-w-0 appearance-none items-center justify-center rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-600"
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                              <span className={`absolute left-0 right-0 top-1/2 h-px bg-amber-950/35 ${colIndex === 0 ? "left-1/2" : ""} ${colIndex === BOARD_SIZE - 1 ? "right-1/2" : ""}`} />
                              <span className={`absolute bottom-0 top-0 left-1/2 w-px bg-amber-950/35 ${rowIndex === 0 ? "top-1/2" : ""} ${rowIndex === BOARD_SIZE - 1 ? "bottom-1/2" : ""}`} />
                            </span>

                            {STAR_POINTS.has(`${rowIndex}:${colIndex}`) && !cell && (
                              <span aria-hidden="true" className="absolute z-0 h-1.5 w-1.5 rounded-full bg-amber-950/55" />
                            )}

                            {!cell && canPlaceStone && (
                              <span
                                aria-hidden="true"
                                className={`absolute z-10 h-[78%] w-[78%] scale-75 rounded-full opacity-0 transition group-hover:scale-100 group-hover:opacity-25 group-focus-visible:scale-100 group-focus-visible:opacity-25 ${currentPlayer === "black" ? "bg-stone-950" : "bg-white"}`}
                              />
                            )}

                            {cell && (
                              <span
                                aria-hidden="true"
                                className={`relative z-10 h-[82%] w-[82%] rounded-full shadow-[0_3px_5px_rgba(69,26,3,0.38)] transition ${
                                  cell === "black"
                                    ? "bg-[radial-gradient(circle_at_35%_28%,#78716c_0%,#292524_34%,#0c0a09_76%)]"
                                    : "border border-stone-300 bg-[radial-gradient(circle_at_35%_28%,#fff_0%,#fafaf9_38%,#d6d3d1_100%)]"
                                } ${isWinningCell ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-amber-800" : ""}`}
                              >
                                {isLastMove && <span className={`absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full ${cell === "black" ? "bg-cyan-300" : "bg-cyan-600"}`} />}
                              </span>
                            )}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>

                {isComputerTurn && (
                  <div className="pointer-events-none absolute right-4 top-4 z-40 flex items-center gap-2 rounded-full bg-stone-950/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200 shadow-xl backdrop-blur">
                    <span className="i-ph-brain-duotone text-base" /> Thinking
                  </div>
                )}

                {game.winner && (
                  <div className="absolute inset-x-5 bottom-5 z-40 rounded-2xl border border-white/30 bg-stone-950/92 p-4 text-white shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-black">{getWinnerTitle(game.winner, gameMode)}</p>
                        <p className="mt-1 text-xs text-stone-300">{getWinnerSubtitle(game.winner, gameMode)}</p>
                      </div>
                      <button type="button" onClick={resetRound} className="shrink-0 rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-stone-950 transition hover:bg-amber-200 active:scale-95">
                        New Round
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className="box-border flex min-w-0 flex-col gap-2 rounded-[28px] border border-white/80 bg-white/88 p-3 shadow-[0_18px_55px_rgba(120,53,15,0.12)] backdrop-blur lg:sticky lg:top-24">
              <div id="gomoku-status" aria-live="polite" className="rounded-2xl bg-stone-950 p-3 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">Round status</p>
                    <p className="mt-1 text-base font-black leading-tight">{turnTitle}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-stone-200">{moveCount}/225</span>
                </div>
                <p className="mt-2 min-h-8 text-xs leading-4 text-stone-300">{turnDetail}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(["black", "white"] as Player[]).map((player) => {
                  const active = !game.winner && currentPlayer === player;
                  return (
                    <div key={player} className={`rounded-2xl border p-2.5 transition ${active ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-5 w-5 rounded-full shadow ${player === "black" ? "bg-stone-950" : "border border-stone-300 bg-white"}`} />
                        <div>
                          <p className="text-xs font-black capitalize text-stone-900">{player}</p>
                          <p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">
                            {isComputerMode ? (player === "black" ? "You" : "Computer") : player === "black" ? "Player 1" : "Player 2"}
                          </p>
                        </div>
                      </div>
                      <p className={`mt-2 text-[9px] font-black uppercase tracking-wide ${active ? "text-amber-700" : "text-stone-300"}`}>{active ? (isComputerTurn ? "Thinking" : "Current turn") : "Waiting"}</p>
                    </div>
                  );
                })}
              </div>

              {isComputerMode && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-500">Computer level</p>
                    <span className="text-[10px] text-stone-400">{DIFFICULTY_META[difficulty].detail}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-stone-100 p-1.5">
                    {(Object.keys(DIFFICULTY_META) as AiDifficulty[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={difficulty === level}
                        onClick={() => changeDifficulty(level)}
                        className={`min-h-9 rounded-xl px-2 text-[11px] font-black transition ${difficulty === level ? "bg-white text-amber-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
                      >
                        {DIFFICULTY_META[level].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={undoMove}
                  disabled={game.history.length === 0}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 text-xs font-black text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                >
                  <span className="i-ph-arrow-u-up-left-bold text-base" /> {isComputerMode ? "Undo Turn" : "Undo"}
                </button>
                <button
                  type="button"
                  onClick={resetRound}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-3 text-xs font-black text-stone-950 transition hover:bg-amber-200 active:scale-95"
                >
                  <span className="i-ph-arrows-clockwise-bold text-base" /> New Round
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-stone-50 p-2.5 ring-1 ring-stone-200">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-stone-400">Last stone</p>
                  <p className="mt-1 text-sm font-black text-stone-800">{game.lastMove ? getCoordinate(game.lastMove.row, game.lastMove.col) : "—"}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-2.5 ring-1 ring-stone-200">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-stone-400">Opening</p>
                  <p className="mt-1 text-sm font-black text-stone-800">Black first</p>
                </div>
              </div>

              <p className="border-t border-stone-200 pt-3 text-[10px] leading-4 text-stone-500">
                Click or tap an intersection. Keyboard: arrows move, Enter/Space places, <kbd className="font-black">U</kbd> undoes, <kbd className="font-black">R</kbd> starts a new round.
              </p>
            </aside>
          </main>
        </div>
      </Container>
    </div>
  );
}
