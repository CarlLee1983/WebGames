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
  type CellPosition,
  type GridSize,
  type LightsOutGameState,
  countLights,
  createLightsOutGame,
  createSeededRandom,
  formatElapsed,
  getAffectedCells,
  getLightsRating,
  lightsOutStateToRows,
  parseBestMoves,
  pressLight,
  requestLightsHint,
  tickLightsOut,
  toggleLightsPause,
  undoLightMove,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

const DIFFICULTIES: Array<{ size: GridSize; label: string; detail: string }> = [
  { size: 3, label: "Relay", detail: "3 × 3" },
  { size: 5, label: "Grid", detail: "5 × 5" },
  { size: 7, label: "Network", detail: "7 × 7" },
];

const BEST_KEY_PREFIX = "web-games:lights-out:best-moves:";
const EMPTY_BEST: Record<GridSize, number | null> = { 3: null, 5: null, 7: null };

function cellKey(cell: CellPosition): string {
  return `${cell.row}-${cell.column}`;
}

function renderGameToText(state: LightsOutGameState, bestMoves: number | null): string {
  return JSON.stringify({
    phase: state.phase,
    size: state.size,
    moves: state.moves,
    lightsOn: countLights(state.board),
    hintsUsed: state.hintsUsed,
    elapsedSeconds: state.elapsedSeconds,
    targetMoves: state.parMoves,
    bestMoves,
    rating: state.phase === "won"
      ? getLightsRating(state.parMoves, state.moves, state.hintsUsed)
      : null,
    feedback: state.feedback,
    board: lightsOutStateToRows(state),
  });
}

export default function LightsOutGame() {
  const [game, setGame] = useState<LightsOutGameState>(() =>
    createLightsOutGame(5, createSeededRandom(2_026)),
  );
  const [focusIndex, setFocusIndex] = useState(0);
  const [previewCell, setPreviewCell] = useState<CellPosition | null>(null);
  const [hintCell, setHintCell] = useState<CellPosition | null>(null);
  const [bestMoves, setBestMoves] = useState<Record<GridSize, number | null>>(EMPTY_BEST);
  const gameRef = useRef(game);
  const bestMovesRef = useRef(bestMoves);
  const hasLoadedBestRef = useRef(false);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const litCount = countLights(game.board);
  const totalCells = game.size * game.size;
  const restoredPercent = Math.round(((totalCells - litCount) / totalCells) * 100);
  const isPaused = game.phase === "paused";
  const isSolved = game.phase === "won";
  const currentBest = bestMoves[game.size];
  const rating = isSolved
    ? getLightsRating(game.parMoves, game.moves, game.hintsUsed)
    : null;
  const previewKeys = useMemo(
    () =>
      new Set(
        previewCell
          ? getAffectedCells(game.size, previewCell.row, previewCell.column).map(cellKey)
          : [],
      ),
    [game.size, previewCell],
  );

  const commitGame = useCallback((next: LightsOutGameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const focusCell = useCallback((index: number) => {
    const maxIndex = gameRef.current.size ** 2 - 1;
    const nextIndex = Math.max(0, Math.min(maxIndex, index));
    setFocusIndex(nextIndex);
    window.requestAnimationFrame(() => cellRefs.current[nextIndex]?.focus());
  }, []);

  const startRound = useCallback(
    (size: GridSize, shouldFocus = true) => {
      commitGame(createLightsOutGame(size));
      cellRefs.current = [];
      setFocusIndex(0);
      setPreviewCell(null);
      setHintCell(null);
      if (shouldFocus) window.requestAnimationFrame(() => cellRefs.current[0]?.focus());
    },
    [commitGame],
  );

  const recordBest = useCallback((completed: LightsOutGameState) => {
    if (!hasLoadedBestRef.current || completed.phase !== "won") return;
    const current = bestMovesRef.current[completed.size];
    if (current !== null && current <= completed.moves) return;

    const next = { ...bestMovesRef.current, [completed.size]: completed.moves };
    bestMovesRef.current = next;
    setBestMoves(next);
    window.localStorage.setItem(`${BEST_KEY_PREFIX}${completed.size}`, String(completed.moves));
  }, []);

  const pauseOrResume = useCallback(() => {
    const wasPaused = gameRef.current.phase === "paused";
    const next = toggleLightsPause(gameRef.current);
    if (next === gameRef.current) return;
    commitGame(next);
    if (wasPaused) focusCell(focusIndex);
  }, [commitGame, focusCell, focusIndex]);

  const undo = useCallback(() => {
    const next = undoLightMove(gameRef.current);
    if (next === gameRef.current) return;
    commitGame(next);
    setHintCell(null);
  }, [commitGame]);

  const showHint = useCallback(() => {
    const result = requestLightsHint(gameRef.current);
    if (result.state !== gameRef.current) commitGame(result.state);
    setHintCell(result.hint);
    setPreviewCell(result.hint);
    if (result.hint) focusCell(result.hint.row * gameRef.current.size + result.hint.column);
  }, [commitGame, focusCell]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    bestMovesRef.current = bestMoves;
  }, [bestMoves]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => startRound(5, false));
    return () => window.cancelAnimationFrame(frame);
  }, [startRound]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = { ...EMPTY_BEST };
      for (const size of [3, 5, 7] as GridSize[]) {
        loaded[size] = parseBestMoves(window.localStorage.getItem(`${BEST_KEY_PREFIX}${size}`));
      }
      hasLoadedBestRef.current = true;
      bestMovesRef.current = loaded;
      setBestMoves(loaded);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (game.phase !== "playing") return;
    const timer = window.setInterval(() => commitGame(tickLightsOut(gameRef.current)), 1000);
    return () => window.clearInterval(timer);
  }, [commitGame, game.phase]);

  useEffect(() => {
    const pauseActiveGame = () => {
      if (gameRef.current.phase === "playing") {
        commitGame(toggleLightsPause(gameRef.current));
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
      if (!["h", "H", "p", "P", "Escape", "r", "R", "u", "U"].includes(event.key)) return;
      event.preventDefault();
      if (["h", "H"].includes(event.key)) showHint();
      if (["p", "P", "Escape"].includes(event.key)) pauseOrResume();
      if (["r", "R"].includes(event.key)) startRound(gameRef.current.size);
      if (["u", "U"].includes(event.key)) undo();
    };

    window.addEventListener("keydown", handleShortcut, { passive: false });
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [pauseOrResume, showHint, startRound, undo]);

  useEffect(() => {
    const renderTextState = () =>
      renderGameToText(gameRef.current, bestMovesRef.current[gameRef.current.size]);
    window.render_game_to_text = renderTextState;
    return () => {
      if (window.render_game_to_text === renderTextState) delete window.render_game_to_text;
    };
  }, []);

  function pressCell(row: number, column: number) {
    const next = pressLight(gameRef.current, row, column);
    if (next === gameRef.current) return;
    commitGame(next);
    setHintCell(null);
    setFocusIndex(row * next.size + column);
    recordBest(next);
  }

  function handleCellKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pressCell(Math.floor(index / game.size), index % game.size);
      return;
    }

    const row = Math.floor(index / game.size);
    const column = index % game.size;
    const rowStart = row * game.size;
    const movement: Record<string, number | undefined> = {
      ArrowLeft: rowStart + Math.max(0, column - 1),
      ArrowRight: rowStart + Math.min(game.size - 1, column + 1),
      ArrowUp: Math.max(0, row - 1) * game.size + column,
      ArrowDown: Math.min(game.size - 1, row + 1) * game.size + column,
      Home: rowStart,
      End: rowStart + game.size - 1,
    };
    const nextIndex = movement[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    focusCell(nextIndex);
  }

  const pauseDisabled = game.phase === "ready" || game.phase === "won";
  const undoDisabled = game.history.length === 0 || isPaused || isSolved;
  const hintDisabled = isPaused || isSolved;

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#07131f] py-4 text-white sm:py-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 12% 8%, rgba(14,165,233,.16), transparent 30%), radial-gradient(circle at 82% 10%, rgba(250,204,21,.13), transparent 28%), radial-gradient(circle at 55% 90%, rgba(20,184,166,.12), transparent 36%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.12) 1px, transparent 1px)", backgroundSize: "36px 36px", maskImage: "linear-gradient(to bottom, black, transparent 78%)" }} />

      <Container size="lg" className="relative">
        <header className="mb-3 flex flex-col items-center justify-between gap-3 lg:flex-row lg:items-end">
          <div className="text-center lg:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row lg:justify-start">
              <div className="inline-flex min-h-7 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <span className="i-ph-circuitry-fill h-4 w-4" aria-hidden="true" /> Midnight power lab
              </div>
              <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight sm:text-4xl">
                <span className="i-ph-lightbulb-filament-duotone h-9 w-9 text-yellow-300" aria-hidden="true" /> Lights Out
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-300/70">
              Reroute each node and its four neighbors until the entire night grid falls quiet.
            </p>
          </div>

          <div aria-label="Grid size" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-[#102234] p-1.5 shadow-2xl shadow-black/25" role="group">
            {DIFFICULTIES.map((difficulty) => {
              const isActive = game.size === difficulty.size;
              return (
                <button
                  key={difficulty.size}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => startRound(difficulty.size)}
                  className={`min-h-10 rounded-xl px-3 py-1.5 text-center transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 ${isActive ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-950/40" : "bg-[#132b40] text-slate-300 hover:bg-[#1a3851] hover:text-white"}`}
                >
                  <span className="block text-xs font-black">{difficulty.label}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">{difficulty.detail}</span>
                </button>
              );
            })}
          </div>
        </header>

        <main className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start">
          <section className="min-w-0 rounded-[28px] border border-cyan-100/10 bg-[#0d1c2a]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Live circuit map</p>
                  <span className="rounded-full bg-yellow-300/12 px-2 py-0.5 text-[9px] font-black uppercase text-yellow-200">Target {game.parMoves}</span>
                </div>
                <p id="lights-status" className="mt-1 min-h-5 truncate text-xs font-semibold text-slate-400" aria-live="polite">{game.feedback}</p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-1.5">
                <ControlButton label="Hint" icon="i-ph-crosshair-duotone" onClick={showHint} disabled={hintDisabled} />
                <ControlButton label="Undo" icon="i-ph-arrow-u-up-left-bold" onClick={undo} disabled={undoDisabled} />
                <ControlButton label={isPaused ? "Resume" : "Pause"} ariaLabel={isPaused ? "Resume game" : "Pause game"} icon={isPaused ? "i-ph-play-fill" : "i-ph-pause-fill"} onClick={pauseOrResume} disabled={pauseDisabled} />
                <ControlButton label="New" icon="i-ph-arrow-counter-clockwise-bold" onClick={() => startRound(game.size)} accent />
              </div>
            </div>

            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/35" role="progressbar" aria-label="Grid restored" aria-valuemin={0} aria-valuemax={100} aria-valuenow={restoredPercent}>
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-yellow-300 transition-[width] duration-500" style={{ width: `${restoredPercent}%` }} />
            </div>

            <div className="relative mx-auto w-full max-w-[350px] rounded-2xl border border-cyan-100/10 bg-[#08131e] p-1.5 sm:p-2.5">
              <div
                aria-label={`${game.size} by ${game.size} light grid. Arrow keys move between nodes.`}
                className="grid aspect-square w-full"
                role="grid"
                style={{ gap: game.size === 7 ? "3px" : "7px", gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))` }}
                onMouseLeave={() => setPreviewCell(null)}
              >
                {game.board.map((row, rowIndex) =>
                  row.map((isOn, columnIndex) => {
                    const index = rowIndex * game.size + columnIndex;
                    const position = { row: rowIndex, column: columnIndex };
                    const key = cellKey(position);
                    const isPreviewed = previewKeys.has(key);
                    const isHint = hintCell && cellKey(hintCell) === key;
                    return (
                      <button
                        key={key}
                        ref={(element) => { cellRefs.current[index] = element; }}
                        type="button"
                        role="gridcell"
                        aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}: ${isOn ? "on" : "off"}`}
                        aria-selected={isOn}
                        tabIndex={focusIndex === index ? 0 : -1}
                        disabled={isPaused || isSolved}
                        onClick={() => pressCell(rowIndex, columnIndex)}
                        onFocus={() => { setFocusIndex(index); setPreviewCell(position); }}
                        onBlur={() => setPreviewCell(null)}
                        onMouseEnter={() => setPreviewCell(position)}
                        onKeyDown={(event) => handleCellKeyDown(event, index)}
                        className={`group relative aspect-square min-w-0 overflow-hidden rounded-lg border transition duration-200 ${isOn ? "border-yellow-100/70 bg-gradient-to-br from-yellow-200 via-yellow-300 to-amber-500 text-amber-950 shadow-[0_0_16px_rgba(250,204,21,.3),inset_0_1px_2px_rgba(255,255,255,.75)]" : "border-cyan-100/10 bg-[#102033] text-cyan-100/35 shadow-[inset_0_3px_8px_rgba(0,0,0,.5)]"} ${isPreviewed && !isPaused ? "z-10 border-cyan-200 ring-2 ring-cyan-300/70 brightness-110" : ""} ${isHint ? "z-20 animate-pulse ring-3 ring-fuchsia-400 ring-offset-1 ring-offset-[#08131e]" : ""} focus-visible:z-30 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-90 disabled:cursor-default`}
                      >
                        <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center font-black ${game.size === 7 ? "text-sm" : "text-xl sm:text-2xl"}`}>{isOn ? "✦" : "·"}</span>
                        {isOn && <span aria-hidden="true" className="absolute inset-[25%] rounded-full bg-white/45 blur-[3px]" />}
                      </button>
                    );
                  }),
                )}
              </div>

              {isPaused && (
                <div className="absolute inset-2 z-40 flex flex-col items-center justify-center rounded-xl border border-cyan-100/10 bg-[#07131f]/95 p-5 text-center backdrop-blur-md">
                  <span className="i-ph-plugs-duotone h-12 w-12 text-cyan-300" aria-hidden="true" />
                  <h2 className="mt-2 text-xl font-black">Grid suspended</h2>
                  <p className="mt-1 text-xs text-slate-400">Nodes and timer are frozen.</p>
                  <button type="button" onClick={pauseOrResume} className="mt-4 min-h-10 rounded-xl bg-cyan-400 px-5 text-xs font-black text-slate-950 transition hover:bg-cyan-300">Resume grid</button>
                </div>
              )}

              {isSolved && (
                <div className="absolute inset-2 z-40 flex flex-col items-center justify-center rounded-xl border border-yellow-200/20 bg-[#07131f]/95 p-5 text-center backdrop-blur-md">
                  <div className="text-2xl tracking-[0.18em] text-yellow-300" aria-label={`${rating} star rating`}>{"★".repeat(rating ?? 1)}{"☆".repeat(3 - (rating ?? 1))}</div>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.24em] text-cyan-300">System stable</p>
                  <h2 className="mt-1 text-2xl font-black">All lights offline</h2>
                  <p className="mt-2 text-xs text-slate-400">{game.moves} moves · {formatElapsed(game.elapsedSeconds)} · {game.hintsUsed} hints</p>
                  <p className="mt-1 text-[10px] text-slate-500">Target {game.parMoves} · Best {currentBest ?? game.moves}</p>
                  <button type="button" onClick={() => startRound(game.size)} className="mt-4 min-h-10 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-500 px-6 text-xs font-black text-slate-950 transition hover:-translate-y-0.5">Charge new grid</button>
                </div>
              )}
            </div>
          </section>

          <aside className="grid grid-cols-2 gap-2">
            <StatCard icon="i-ph-footprints-duotone" label="Moves" value={String(game.moves)} accent="text-cyan-300" />
            <StatCard icon="i-ph-lightbulb-filament-duotone" label="Lights" value={`${litCount}/${totalCells}`} accent="text-yellow-300" />
            <StatCard icon="i-ph-timer-duotone" label="Time" value={formatElapsed(game.elapsedSeconds)} accent="text-teal-300" />
            <StatCard icon="i-ph-trophy-duotone" label="Best" value={currentBest === null ? "—" : String(currentBest)} accent="text-amber-300" />
            <div className="col-span-2 rounded-2xl border border-white/10 bg-[#102234] p-3 text-[10px] leading-4 text-slate-400">
              <div className="flex items-center gap-2 font-black text-white"><span className="i-ph-keyboard-duotone h-4 w-4 text-cyan-300" aria-hidden="true" /> Circuit controls</div>
              <p className="mt-1">Arrows move · Enter/Space reroute · H hint · U undo · P/Esc pause · R new grid.</p>
            </div>
          </aside>
        </main>
      </Container>
    </div>
  );
}

function ControlButton({ label, ariaLabel, icon, onClick, disabled = false, accent = false }: { label: string; ariaLabel?: string; icon: string; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={disabled} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${accent ? "border-yellow-200/20 bg-yellow-200/10 text-yellow-100 hover:bg-yellow-200/20" : "border-cyan-300/15 bg-cyan-300/8 text-cyan-100 hover:bg-cyan-300/15"}`}>
      <span className={`${icon} h-4 w-4`} aria-hidden="true" /> {label}
    </button>
  );
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#102234] p-3 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
        <span className={`${icon} h-4 w-4 ${accent}`} aria-hidden="true" />
      </div>
      <span className="mt-1 block text-xl font-black tracking-tight text-white">{value}</span>
    </div>
  );
}
