"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";

import Container from "@/components/common/Container";

import {
  DIFFICULTY_CONFIG,
  GRID_SIZE,
  changeDifficulty,
  createInitialState,
  getLevel,
  getTickInterval,
  parseBestScore,
  queueDirection,
  restartGame,
  startGame,
  stateToRows,
  stepGame,
  togglePause,
  type Difficulty,
  type DirectionName,
  type Point,
  type SnakeGameState,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
  }
}

const BEST_SCORE_KEY = "web-games:snake:best-score";
const INITIAL_STATE = createInitialState("normal", 0, () => 0.42);
const DIRECTIONS: DirectionName[] = ["up", "left", "down", "right"];

const DIRECTION_ROTATION: Record<DirectionName, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: -90,
};

const DIRECTION_ICON: Record<DirectionName, string> = {
  up: "i-ph-caret-up-bold",
  down: "i-ph-caret-down-bold",
  left: "i-ph-caret-left-bold",
  right: "i-ph-caret-right-bold",
};

function renderGameToText(state: SnakeGameState): string {
  return JSON.stringify({
    coordinateSystem: `top-left origin; x increases right 0-${GRID_SIZE - 1}; y increases down 0-${GRID_SIZE - 1}; edges wrap`,
    mode: state.mode,
    difficulty: state.difficulty,
    score: state.score,
    bestScore: state.bestScore,
    foodsEaten: state.foodsEaten,
    level: getLevel(state.foodsEaten),
    wraps: state.wraps,
    tickIntervalMs: getTickInterval(state),
    direction: state.direction,
    queuedDirection: state.queuedDirection,
    food: state.food,
    snakeLength: state.snake.length,
    snake: state.snake,
    board: stateToRows(state),
  });
}

export default function SnakeGame() {
  const [game, setGame] = useState<SnakeGameState>(INITIAL_STATE);
  const gameRef = useRef(game);
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<Point | null>(null);
  const hasLoadedBestRef = useRef(false);
  const tickInterval = getTickInterval(game);

  const commitGame = useCallback((next: SnakeGameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const updateGame = useCallback((transform: (state: SnakeGameState) => SnakeGameState) => {
    setGame((previous) => {
      const next = transform(previous);
      gameRef.current = next;
      return next;
    });
  }, []);

  const focusBoard = useCallback(() => {
    window.requestAnimationFrame(() => boardRef.current?.focus());
  }, []);

  const handlePrimaryAction = useCallback(() => {
    updateGame((state) => startGame(state));
    focusBoard();
  }, [focusBoard, updateGame]);

  const handleRestart = useCallback(() => {
    updateGame((state) => restartGame(state));
    focusBoard();
  }, [focusBoard, updateGame]);

  const handleDirection = useCallback(
    (direction: DirectionName) => {
      updateGame((state) => queueDirection(state, direction));
      focusBoard();
    },
    [focusBoard, updateGame],
  );

  useEffect(() => {
    const storedBest = parseBestScore(window.localStorage.getItem(BEST_SCORE_KEY));
    hasLoadedBestRef.current = true;
    updateGame((state) => ({
      ...state,
      bestScore: Math.max(state.bestScore, storedBest),
    }));
  }, [updateGame]);

  useEffect(() => {
    if (!hasLoadedBestRef.current) return;
    window.localStorage.setItem(BEST_SCORE_KEY, String(game.bestScore));
  }, [game.bestScore]);

  useEffect(() => {
    if (game.mode !== "playing") return;
    const interval = window.setInterval(() => {
      updateGame((state) => stepGame(state));
    }, tickInterval);

    return () => window.clearInterval(interval);
  }, [game.mode, tickInterval, updateGame]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const directionByKey: Record<string, DirectionName | undefined> = {
        ArrowUp: "up",
        w: "up",
        W: "up",
        ArrowDown: "down",
        s: "down",
        S: "down",
        ArrowLeft: "left",
        a: "left",
        A: "left",
        ArrowRight: "right",
        d: "right",
        D: "right",
      };
      const direction = directionByKey[event.key];

      if (direction || [" ", "Enter", "Escape", "p", "P", "r", "R"].includes(event.key)) {
        event.preventDefault();
      }

      if (direction) {
        handleDirection(direction);
        return;
      }

      if (event.key === "Enter") {
        handlePrimaryAction();
        return;
      }

      if (event.key === " ") {
        if (["ready", "gameOver", "won"].includes(gameRef.current.mode)) {
          handlePrimaryAction();
        } else {
          updateGame(togglePause);
        }
        return;
      }

      if (["Escape", "p", "P"].includes(event.key)) {
        updateGame(togglePause);
        return;
      }

      if (["r", "R"].includes(event.key)) {
        handleRestart();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDirection, handlePrimaryAction, handleRestart, updateGame]);

  useEffect(() => {
    const pauseActiveRun = () => {
      if (gameRef.current.mode === "playing") {
        commitGame(togglePause(gameRef.current));
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) pauseActiveRun();
    };

    window.addEventListener("blur", pauseActiveRun);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", pauseActiveRun);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [commitGame]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(gameRef.current);
    window.advanceTime = (ms: number) => {
      let remaining = Math.max(0, ms);
      let next = gameRef.current;

      while (next.mode === "playing" && remaining >= getTickInterval(next)) {
        remaining -= getTickInterval(next);
        next = stepGame(next);
      }

      commitGame(next);
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [commitGame]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < 24) {
      if (["ready", "paused", "gameOver", "won"].includes(gameRef.current.mode)) {
        handlePrimaryAction();
      }
      return;
    }

    handleDirection(absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  const changeModeDifficulty = (difficulty: Difficulty) => {
    updateGame((state) => changeDifficulty(state, difficulty));
  };

  const primaryLabel =
    game.mode === "paused" ? "Resume" : game.mode === "gameOver" || game.mode === "won" ? "New Run" : game.mode === "playing" ? "Running" : "Start";
  const modeLabel =
    game.mode === "playing"
      ? "Portal run active"
      : game.mode === "paused"
        ? "Run paused"
        : game.mode === "gameOver"
          ? "Tail collision"
          : game.mode === "won"
            ? "Board conquered"
            : "Ready at the portal";
  const level = getLevel(game.foodsEaten);
  const speed = Math.round((1000 / tickInterval) * 10) / 10;
  const foodStatus = game.food?.type === "golden" ? "Golden fruit live" : `${5 - (game.foodsEaten % 5)} fruit to gold`;
  const controlsDisabled = game.mode !== "playing" && game.mode !== "ready";
  const difficultyDisabled = game.mode === "playing" || game.mode === "paused";

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.18),_transparent_36%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] py-4 sm:py-6">
      <Container size="lg">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
          <header className="text-center">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-emerald-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
              <span className="i-ph-infinity-bold text-base" /> Wrap portals · Golden fruit
            </div>
            <h1 className="flex items-center justify-center gap-2 text-4xl font-black tracking-tight text-emerald-950">
              <span className="i-ph-snake-duotone text-emerald-500" /> Snake Circuit
            </h1>
            <p className="mx-auto mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
              Cross every edge through a portal, collect every fifth golden fruit, and avoid folding into your own tail.
            </p>
          </header>

          <div className="grid w-full gap-3 lg:grid-cols-[minmax(320px,500px)_minmax(280px,320px)] lg:items-start lg:justify-center lg:gap-5">
            <div className="flex min-w-0 justify-center lg:justify-end">
              <div
                ref={boardRef}
                role="application"
                tabIndex={0}
                aria-describedby="snake-status snake-controls-help"
                aria-label={`Snake board. ${modeLabel}. Score ${game.score}, best ${game.bestScore}, length ${game.snake.length}, level ${level}.`}
                onClick={() => {
                  if (["ready", "paused", "gameOver", "won"].includes(gameRef.current.mode)) {
                    handlePrimaryAction();
                  }
                }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="relative aspect-square max-w-full touch-none overflow-hidden rounded-[30px] border-[6px] border-emerald-950 bg-emerald-950 shadow-[0_24px_70px_rgba(6,78,59,0.25)] outline-none ring-emerald-400 transition focus-visible:ring-4"
                style={{
                  width: "min(100%, 460px, calc(100vh - 270px))",
                  backgroundImage:
                    "linear-gradient(rgba(52,211,153,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.08) 1px, transparent 1px), radial-gradient(circle at center, #0f3b32 0%, #062a24 100%)",
                  backgroundSize: "5% 5%, 5% 5%, 100% 100%",
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[5%] bg-gradient-to-b from-cyan-300/25 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[5%] bg-gradient-to-t from-cyan-300/25 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-[5%] bg-gradient-to-r from-cyan-300/25 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-[5%] bg-gradient-to-l from-cyan-300/25 to-transparent" />

                {game.food && (
                  <div
                    aria-hidden="true"
                    className={`absolute z-10 flex items-center justify-center rounded-full ${
                      game.food.type === "golden"
                        ? "animate-pulse bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)]"
                        : "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.65)]"
                    }`}
                    style={{
                      width: "5%",
                      height: "5%",
                      left: `${game.food.x * 5}%`,
                      top: `${game.food.y * 5}%`,
                      transform: "scale(0.76)",
                    }}
                  >
                    <span className={`${game.food.type === "golden" ? "i-ph-star-fill text-amber-800" : "i-ph-apple-logo-fill text-white"} text-[70%]`} />
                  </div>
                )}

                {game.snake.map((segment, index) => {
                  const isHead = index === 0;
                  const isTail = index === game.snake.length - 1;
                  return (
                    <div
                      key={`${segment.x}-${segment.y}-${index}`}
                      aria-hidden="true"
                      className={`absolute flex items-center justify-center ${isHead ? "z-20 rounded-[32%] bg-lime-300" : isTail ? "rounded-full bg-emerald-400" : "rounded-[28%] bg-emerald-400"}`}
                      style={{
                        width: "5%",
                        height: "5%",
                        left: `${segment.x * 5}%`,
                        top: `${segment.y * 5}%`,
                        transform: `scale(${isHead ? 0.96 : isTail ? 0.62 : Math.max(0.7, 0.88 - index * 0.008)})`,
                        boxShadow: isHead ? "0 0 12px rgba(190,242,100,0.75)" : "inset 0 0 0 1px rgba(255,255,255,0.2)",
                      }}
                    >
                      {isHead && (
                        <span
                          className="relative block h-full w-full"
                          style={{ transform: `rotate(${DIRECTION_ROTATION[game.direction]}deg)` }}
                        >
                          <span className="absolute right-[15%] top-[18%] h-[20%] w-[20%] rounded-full bg-emerald-950" />
                          <span className="absolute bottom-[18%] right-[15%] h-[20%] w-[20%] rounded-full bg-emerald-950" />
                        </span>
                      )}
                    </div>
                  );
                })}

                {game.mode !== "playing" && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-950/80 px-6 text-center text-white backdrop-blur-sm">
                    <span
                      className={`mb-2 text-5xl ${
                        game.mode === "gameOver"
                          ? "i-ph-warning-octagon-duotone text-rose-300"
                          : game.mode === "won"
                            ? "i-ph-trophy-duotone text-amber-300"
                            : game.mode === "paused"
                              ? "i-ph-pause-circle-duotone text-cyan-200"
                              : "i-ph-play-circle-duotone text-lime-300"
                      }`}
                    />
                    <h2 className="text-2xl font-black sm:text-3xl">{modeLabel}</h2>
                    <p className="mt-2 max-w-xs text-sm text-emerald-100">
                      {game.mode === "gameOver"
                        ? `Final score ${game.score} · length ${game.snake.length}`
                        : game.mode === "won"
                          ? `Perfect circuit! Final score ${game.score}.`
                          : game.mode === "paused"
                            ? "Your position is frozen. Resume when ready."
                            : "Press Enter, swipe, or choose a direction to begin."}
                    </p>
                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      className="mt-5 min-h-12 rounded-2xl bg-lime-300 px-7 py-3 text-sm font-black text-emerald-950 shadow-lg transition hover:bg-lime-200 active:scale-95"
                    >
                      {primaryLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <aside className="box-border flex min-w-0 flex-col gap-3 rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-[0_18px_60px_rgba(6,78,59,0.12)] backdrop-blur lg:sticky lg:top-24">
              <div className="order-1 grid grid-cols-4 gap-2 lg:order-2">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={game.mode === "playing"}
                  className="col-span-2 min-h-12 rounded-2xl bg-emerald-950 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-900 disabled:cursor-default disabled:bg-emerald-100 disabled:text-emerald-700"
                >
                  {primaryLabel}
                </button>
                <button
                  type="button"
                  onClick={() => updateGame(togglePause)}
                  disabled={game.mode !== "playing"}
                  className="min-h-12 rounded-2xl bg-white px-2 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {game.mode === "paused" ? "Paused" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="min-h-12 rounded-2xl bg-white px-2 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  Restart
                </button>
              </div>

              <div id="snake-status" aria-live="polite" className="order-2 rounded-2xl bg-emerald-950 px-4 py-3 text-white lg:order-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">{modeLabel}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${game.food?.type === "golden" ? "bg-amber-300 text-amber-950" : "bg-emerald-300 text-emerald-950"}`}>
                    {foodStatus}
                  </span>
                </div>
                <p className="mt-2 min-h-5 text-xs text-emerald-100">
                  {game.feedback ?? `Level ${level} · ${speed} moves/sec · ${game.snake.length} segments`}
                </p>
              </div>

              <dl className="order-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ["Score", game.score, "text-emerald-950"],
                  ["Best", game.bestScore, "text-violet-600"],
                  ["Fruit", game.foodsEaten, "text-rose-500"],
                  ["Level", level, "text-amber-600"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-2xl bg-white px-1 py-2 shadow-sm ring-1 ring-slate-200">
                    <dt className="text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className={`mt-1 text-lg font-black ${color}`}>{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="order-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Difficulty</p>
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
                  {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((difficulty) => (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => changeModeDifficulty(difficulty)}
                      disabled={difficultyDisabled}
                      aria-pressed={game.difficulty === difficulty}
                      className={`min-h-10 rounded-xl px-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
                        game.difficulty === difficulty ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {DIFFICULTY_CONFIG[difficulty].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="order-5 mx-auto grid w-fit grid-cols-3 gap-2">
                <span />
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => handleDirection("up")}
                  disabled={controlsDisabled}
                  className="flex h-13 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 active:scale-95"
                >
                  <span className="i-ph-caret-up-bold text-2xl" />
                </button>
                <span />
                {DIRECTIONS.slice(1).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    aria-label={`Move ${direction}`}
                    onClick={() => handleDirection(direction)}
                    disabled={controlsDisabled}
                    className="flex h-13 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 active:scale-95"
                  >
                    <span className={`${DIRECTION_ICON[direction]} text-2xl`} />
                  </button>
                ))}
              </div>

              <div className="order-6 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                <span>{game.wraps} portal wraps</span>
                <span>{tickInterval} ms/tick</span>
              </div>

              <p id="snake-controls-help" className="order-7 border-t border-slate-200 pt-3 text-[11px] leading-4 text-slate-500">
                Arrows / WASD steer · Space or P pauses · R resets · Swipe or tap the board on touch screens
              </p>
            </aside>
          </div>
        </div>
      </Container>
    </div>
  );
}
