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
  type MemoryGameState,
  type PairCount,
  createMemoryGame,
  formatElapsed,
  getRating,
  parseBestMoves,
  resolveTurn,
  revealCard,
  stateToCardRows,
  tickMemoryGame,
  togglePause,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

const DIFFICULTIES: Array<{ pairs: PairCount; label: string; detail: string }> = [
  { pairs: 6, label: "Quick", detail: "12 cards" },
  { pairs: 8, label: "Classic", detail: "16 cards" },
  { pairs: 12, label: "Expert", detail: "24 cards" },
];

const BEST_KEY_PREFIX = "web-games:memory-match:best-moves:";
const EMPTY_BEST: Record<PairCount, number | null> = { 6: null, 8: null, 12: null };

function getDesktopColumns(pairsCount: PairCount): number {
  return pairsCount === 6 ? 6 : pairsCount === 8 ? 8 : 12;
}

function renderGameToText(state: MemoryGameState, bestMoves: number | null): string {
  return JSON.stringify({
    phase: state.phase,
    pairsCount: state.pairsCount,
    moves: state.moves,
    matches: state.matches,
    streak: state.streak,
    score: state.score,
    elapsedSeconds: state.elapsedSeconds,
    bestMoves,
    selectedIndices: state.selectedIndices,
    rating: state.phase === "won" ? getRating(state.pairsCount, state.moves) : null,
    feedback: state.feedback,
    board: stateToCardRows(state, getDesktopColumns(state.pairsCount)),
    cards: state.deck.map((card, index) => ({
      index,
      label: card.isFlipped || card.isMatched ? card.label : null,
      state: card.isMatched ? "matched" : card.isFlipped ? "revealed" : "hidden",
    })),
  });
}

export default function MemoryMatchGame() {
  const [game, setGame] = useState<MemoryGameState>(() => createMemoryGame(8, () => 0.42));
  const [focusIndex, setFocusIndex] = useState(0);
  const [bestMoves, setBestMoves] = useState<Record<PairCount, number | null>>(EMPTY_BEST);
  const gameRef = useRef(game);
  const bestMovesRef = useRef(bestMoves);
  const cardButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resolveTimeoutRef = useRef<number | null>(null);
  const previousPhaseRef = useRef(game.phase);
  const hasLoadedBestRef = useRef(false);

  const isPaused = game.phase === "paused";
  const isSolved = game.phase === "won";
  const isResolving = game.phase === "resolving";
  const isTimerActive = game.phase === "playing" || game.phase === "resolving";
  const progress = Math.round((game.matches / game.pairsCount) * 100);
  const currentBest = bestMoves[game.pairsCount];
  const rating = isSolved ? getRating(game.pairsCount, game.moves) : null;
  const gridClass = useMemo(() => {
    if (game.pairsCount === 6) return "grid-cols-3 sm:grid-cols-6";
    if (game.pairsCount === 12) return "grid-cols-4 sm:grid-cols-6 lg:grid-cols-12";
    return "grid-cols-4 md:grid-cols-8";
  }, [game.pairsCount]);

  const commitGame = useCallback((next: MemoryGameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const cancelResolution = useCallback(() => {
    if (resolveTimeoutRef.current !== null) {
      window.clearTimeout(resolveTimeoutRef.current);
      resolveTimeoutRef.current = null;
    }
  }, []);

  const focusCard = useCallback((index: number) => {
    const nextIndex = Math.max(0, Math.min(gameRef.current.deck.length - 1, index));
    setFocusIndex(nextIndex);
    window.requestAnimationFrame(() => cardButtonRefs.current[nextIndex]?.focus());
  }, []);

  const startRound = useCallback(
    (pairsCount: PairCount, shouldFocus = true) => {
      cancelResolution();
      commitGame(createMemoryGame(pairsCount));
      cardButtonRefs.current = [];
      setFocusIndex(0);
      if (shouldFocus) window.requestAnimationFrame(() => cardButtonRefs.current[0]?.focus());
    },
    [cancelResolution, commitGame],
  );

  const pauseOrResume = useCallback(() => {
    commitGame(togglePause(gameRef.current));
  }, [commitGame]);

  const recordBest = useCallback((completed: MemoryGameState) => {
    if (!hasLoadedBestRef.current || completed.phase !== "won") return;
    const current = bestMovesRef.current[completed.pairsCount];
    if (current !== null && current <= completed.moves) return;

    const next = { ...bestMovesRef.current, [completed.pairsCount]: completed.moves };
    bestMovesRef.current = next;
    setBestMoves(next);
    window.localStorage.setItem(`${BEST_KEY_PREFIX}${completed.pairsCount}`, String(completed.moves));
  }, []);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    bestMovesRef.current = bestMoves;
  }, [bestMoves]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => startRound(8, false));
    return () => window.cancelAnimationFrame(frame);
  }, [startRound]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = { ...EMPTY_BEST };
      for (const pairsCount of [6, 8, 12] as PairCount[]) {
        loaded[pairsCount] = parseBestMoves(window.localStorage.getItem(`${BEST_KEY_PREFIX}${pairsCount}`));
      }
      hasLoadedBestRef.current = true;
      bestMovesRef.current = loaded;
      setBestMoves(loaded);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isTimerActive) return;
    const timer = window.setInterval(() => commitGame(tickMemoryGame(gameRef.current)), 1000);
    return () => window.clearInterval(timer);
  }, [commitGame, isTimerActive]);

  useEffect(() => {
    cancelResolution();
    if (game.phase !== "resolving") return;

    const [firstIndex, secondIndex] = game.selectedIndices;
    const isMatch = game.deck[firstIndex]?.icon === game.deck[secondIndex]?.icon;
    resolveTimeoutRef.current = window.setTimeout(() => {
      const resolved = resolveTurn(gameRef.current);
      const next = document.hidden && resolved.phase === "playing"
        ? togglePause(resolved)
        : resolved;
      commitGame(next);
      recordBest(next);
      resolveTimeoutRef.current = null;
    }, isMatch ? 450 : 850);

    return cancelResolution;
  }, [cancelResolution, commitGame, game.deck, game.phase, game.selectedIndices, recordBest]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = game.phase;
    if (previousPhase !== "resolving" || game.phase !== "playing") return;
    if (!game.deck[focusIndex]?.isMatched) return;

    const nextHidden = game.deck.findIndex((card, index) => index > focusIndex && !card.isMatched);
    const fallback = game.deck.findIndex((card) => !card.isMatched);
    focusCard(nextHidden >= 0 ? nextHidden : fallback);
  }, [focusCard, focusIndex, game.deck, game.phase]);

  useEffect(() => {
    const pauseActiveGame = () => {
      if (gameRef.current.phase === "playing") commitGame(togglePause(gameRef.current));
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
      if (["p", "P", "Escape", "r", "R"].includes(event.key)) event.preventDefault();
      if (["p", "P", "Escape"].includes(event.key)) pauseOrResume();
      if (["r", "R"].includes(event.key)) startRound(gameRef.current.pairsCount);
    };

    window.addEventListener("keydown", handleShortcut, { passive: false });
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [pauseOrResume, startRound]);

  useEffect(() => {
    const renderTextState = () =>
      renderGameToText(gameRef.current, bestMovesRef.current[gameRef.current.pairsCount]);
    window.render_game_to_text = renderTextState;

    return () => {
      if (window.render_game_to_text === renderTextState) delete window.render_game_to_text;
    };
  }, []);

  function reveal(index: number) {
    const next = revealCard(gameRef.current, index);
    if (next !== gameRef.current) {
      commitGame(next);
      setFocusIndex(index);
    }
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reveal(index);
      return;
    }

    const grid = event.currentTarget.closest('[role="grid"]');
    const columns = grid
      ? window.getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length
      : 1;
    const rowStart = Math.floor(index / columns) * columns;
    const rowEnd = Math.min(game.deck.length - 1, rowStart + columns - 1);
    const movement: Record<string, number | undefined> = {
      ArrowLeft: Math.max(rowStart, index - 1),
      ArrowRight: Math.min(rowEnd, index + 1),
      ArrowUp: Math.max(0, index - columns),
      ArrowDown: Math.min(game.deck.length - 1, index + columns),
      Home: rowStart,
      End: rowEnd,
    };
    const nextIndex = movement[event.key];
    if (nextIndex === undefined) return;

    event.preventDefault();
    focusCard(nextIndex);
  }

  const pauseDisabled = game.phase === "ready" || game.phase === "resolving" || game.phase === "won";

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#170d26] py-4 text-white sm:py-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 8% 10%, rgba(236,72,153,.22), transparent 30%), radial-gradient(circle at 88% 8%, rgba(168,85,247,.22), transparent 28%), radial-gradient(circle at 50% 85%, rgba(59,130,246,.13), transparent 34%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)", backgroundSize: "42px 42px", maskImage: "linear-gradient(to bottom, black, transparent 70%)" }} />

      <Container size="lg" className="relative">
        <header className="mb-3 flex flex-col items-center justify-between gap-3 lg:flex-row lg:items-end">
          <div className="text-center lg:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row lg:justify-start">
              <div className="inline-flex min-h-7 items-center gap-2 rounded-full border border-pink-300/20 bg-pink-300/10 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-pink-200">
                <span className="i-ph-sparkle-fill h-4 w-4" aria-hidden="true" /> Pattern Observatory
              </div>
              <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                <span className="i-ph-cards-three-duotone h-9 w-9 text-pink-400" aria-hidden="true" /> Memory Match
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-purple-100/65">
              Map each hidden symbol, protect your streak, and restore the cosmic archive.
            </p>
          </div>

          <div aria-label="Difficulty" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1.5 shadow-2xl shadow-black/20 backdrop-blur" role="group">
            {DIFFICULTIES.map((difficulty) => {
              const isActive = game.pairsCount === difficulty.pairs;
              return (
                <button
                  key={difficulty.pairs}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => startRound(difficulty.pairs)}
                  className={`min-h-10 min-w-0 rounded-xl px-3 py-1.5 text-center transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink-300 ${isActive ? "bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-lg shadow-pink-950/40" : "bg-[#2b193f] text-purple-100/70 hover:bg-[#3a214f] hover:text-white"}`}
                >
                  <span className="block text-xs font-black">{difficulty.label}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-wide opacity-65">{difficulty.detail}</span>
                </button>
              );
            })}
          </div>
        </header>

        <main className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start">
          <section className="min-w-0 rounded-[28px] border border-white/10 bg-[#241238]/90 p-3 shadow-2xl shadow-black/35 backdrop-blur sm:p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-300">Card constellation</p>
                  {game.streak > 0 && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">Streak ×{game.streak}</span>}
                  <span className="rounded-full bg-violet-300/15 px-2 py-0.5 text-[9px] font-black uppercase text-violet-200">{game.score} pts</span>
                </div>
                <p id="memory-status" className="mt-1 min-h-5 truncate text-xs font-semibold text-purple-100/70" aria-live="polite">{game.feedback}</p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={pauseOrResume}
                  disabled={pauseDisabled}
                  aria-label={isPaused ? "Resume game" : "Pause game"}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 text-xs font-black text-white transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink-300 active:scale-95"
                >
                  <span className={`${isPaused ? "i-ph-play-fill" : "i-ph-pause-fill"} h-4 w-4`} aria-hidden="true" />
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => startRound(game.pairsCount)}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-pink-300/25 bg-pink-300/10 px-3 text-xs font-black text-pink-100 transition hover:bg-pink-300/20 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pink-300 active:scale-95"
                >
                  <span className="i-ph-arrow-counter-clockwise-bold h-4 w-4" aria-hidden="true" /> Restart
                </button>
              </div>
            </div>

            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/25" role="progressbar" aria-label="Matched pairs" aria-valuemin={0} aria-valuemax={game.pairsCount} aria-valuenow={game.matches}>
              <div className="h-full rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-400 to-violet-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>

            <div className="relative">
              <div aria-label={`${game.pairsCount * 2} card memory board. Arrow keys move between cards.`} className={`grid ${gridClass} gap-2`} role="grid" aria-busy={isResolving}>
                {game.deck.map((card, index) => {
                  const isRevealed = card.isFlipped || card.isMatched;
                  const ariaState = card.isMatched ? `${card.label}, matched` : card.isFlipped ? `${card.label}, revealed` : "hidden";
                  return (
                    <button
                      key={card.id}
                      ref={(element) => { cardButtonRefs.current[index] = element; }}
                      type="button"
                      role="gridcell"
                      aria-label={`Card ${index + 1}: ${ariaState}`}
                      aria-selected={isRevealed}
                      tabIndex={focusIndex === index ? 0 : -1}
                      onFocus={() => setFocusIndex(index)}
                      onClick={() => reveal(index)}
                      onKeyDown={(event) => handleCardKeyDown(event, index)}
                      className="group relative aspect-[4/5] min-h-14 min-w-0 appearance-none rounded-xl border-0 bg-transparent p-0 outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-pink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#241238]"
                    >
                      <span aria-hidden="true" className="absolute inset-0 block transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                        <span className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-pink-200/20 bg-gradient-to-br from-[#823e9d] via-[#5d2b83] to-[#351c5c] shadow-lg shadow-black/25 transition group-hover:-translate-y-0.5 group-hover:border-pink-200/45">
                          <span className="absolute inset-1.5 rounded-lg border border-white/8" />
                          <span className="i-ph-stars-four-fill h-6 w-6 text-pink-200/65 sm:h-8 sm:w-8" />
                          <span className="mt-1 text-[8px] font-black tracking-[0.16em] text-pink-100/45">{String(index + 1).padStart(2, "0")}</span>
                        </span>
                        <span className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border bg-gradient-to-br shadow-lg ${card.isMatched ? "border-emerald-200/60 from-emerald-100 to-teal-200 text-emerald-900 shadow-emerald-900/25" : "border-white/60 from-white to-pink-100 text-[#49235d] shadow-pink-950/25"}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                          <span className={`${card.icon} h-7 w-7 sm:h-10 sm:w-10`} />
                          <span className="mt-1 max-w-[90%] truncate text-[8px] font-black uppercase tracking-wide sm:text-[10px]">{card.label}</span>
                          {card.isMatched && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 text-[8px] font-black text-white">✓</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {isPaused && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#170d26]/94 p-5 text-center backdrop-blur-md">
                  <span className="i-ph-lock-key-duotone h-12 w-12 text-pink-300" aria-hidden="true" />
                  <h2 className="mt-2 text-xl font-black">Archive sealed</h2>
                  <p className="mt-1 text-xs text-purple-100/65">Symbols and timer are frozen.</p>
                  <button type="button" onClick={pauseOrResume} className="mt-4 min-h-10 rounded-xl bg-pink-500 px-5 text-xs font-black text-white shadow-lg transition hover:bg-pink-400">Resume expedition</button>
                </div>
              )}

              {isSolved && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl border border-pink-200/20 bg-[#170d26]/95 p-5 text-center backdrop-blur-md">
                  <div className="text-2xl tracking-[0.18em] text-amber-300" aria-label={`${rating} star rating`}>{"★".repeat(rating ?? 1)}{"☆".repeat(3 - (rating ?? 1))}</div>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.24em] text-pink-300">Archive restored</p>
                  <h2 className="mt-1 text-2xl font-black">Constellation complete!</h2>
                  <p className="mt-2 text-xs text-purple-100/70">{game.score} points · {game.moves} moves · {formatElapsed(game.elapsedSeconds)}</p>
                  <p className="mt-1 text-[10px] text-purple-100/50">Best: {currentBest ?? game.moves} moves</p>
                  <button type="button" onClick={() => startRound(game.pairsCount)} className="mt-4 min-h-10 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-6 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5">Play again</button>
                </div>
              )}
            </div>
          </section>

          <aside className="grid grid-cols-2 gap-2">
            <StatCard icon="i-ph-footprints-duotone" label="Moves" value={String(game.moves)} accent="text-pink-300" />
            <StatCard icon="i-ph-cards-duotone" label="Pairs" value={`${game.matches}/${game.pairsCount}`} accent="text-violet-300" />
            <StatCard icon="i-ph-timer-duotone" label="Time" value={formatElapsed(game.elapsedSeconds)} accent="text-sky-300" />
            <StatCard icon="i-ph-star-duotone" label="Best" value={currentBest === null ? "—" : String(currentBest)} accent="text-amber-300" />
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-[10px] leading-4 text-purple-100/60">
              <div className="flex items-center gap-2 font-black text-purple-100"><span className="i-ph-keyboard-duotone h-4 w-4 text-pink-300" /> Explorer controls</div>
              <p className="mt-1">Arrows move · Enter/Space reveal · P/Esc pauses · R restarts. A perfect round earns three stars.</p>
            </div>
          </aside>
        </main>
      </Container>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-lg shadow-black/10 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-purple-100/50">{label}</span>
        <span className={`${icon} h-4 w-4 ${accent}`} aria-hidden="true" />
      </div>
      <span className="mt-1 block text-xl font-black tracking-tight text-white">{value}</span>
    </div>
  );
}
