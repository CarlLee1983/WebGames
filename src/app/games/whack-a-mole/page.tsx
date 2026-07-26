"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";
import {
  INTRO_DURATION_MS,
  LEVEL_GOALS,
  getLevelProgress,
  generateRandomHoles,
  getLevelConfig,
  createInitialGameState,
  renderGameToText,
  whackGameReducer,
  type MoleState,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

type Tone = "hit" | "clank";

function MoleCharacter({
  holeNumber,
  mole,
  onWhack,
}: {
  holeNumber: number;
  mole: MoleState;
  onWhack: () => void;
}) {
  const isUp = mole.status === "up";
  const label = mole.type === "helmet"
    ? `Helmet mole in hole ${holeNumber}, ${mole.health} hits remaining`
    : `Mole in hole ${holeNumber}`;

  return (
    <button
      type="button"
      aria-label={`${label}. Press ${holeNumber} to whack.`}
      aria-hidden={!isUp}
      disabled={!isUp}
      tabIndex={isUp ? 0 : -1}
      onClick={onWhack}
      className={`absolute bottom-4 z-10 h-[75px] w-full appearance-none border-0 bg-transparent p-0 transition-transform duration-150 ease-out origin-bottom focus-visible:outline-3 focus-visible:outline-white focus-visible:outline-offset-3 ${
        mole.status === "up"
          ? "translate-y-0 scale-100 cursor-pointer opacity-100"
          : mole.status === "hit"
            ? "translate-y-3 scale-95 rotate-3 opacity-100"
            : "-translate-x-1 translate-y-0 scale-100 opacity-100"
      }`}
    >
      <span className="relative block h-full w-full">
        {mole.type === "helmet" && mole.health === 1 && mole.status === "up" && (
          <span className="absolute -top-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-yellow-200 bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
            Again!
          </span>
        )}
        <span className="absolute inset-0 overflow-hidden rounded-t-[40px] border-x-4 border-t-4 border-amber-950 bg-amber-800">
          <span className="absolute bottom-0 left-1/2 h-3/5 w-4/5 -translate-x-1/2 rounded-t-full bg-amber-200/20 blur-sm" />
        </span>

        <span className="absolute left-0 right-0 top-3 flex flex-col items-center">
          <span className="mb-2 flex gap-4">
            {mole.status === "up" && (
              <>
                <span className="relative h-2.5 w-2.5 rounded-full bg-black">
                  <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white/80" />
                </span>
                <span className="relative h-2.5 w-2.5 rounded-full bg-black">
                  <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white/80" />
                </span>
              </>
            )}
            {mole.status === "hit" && (
              <>
                <span className="relative flex h-3 w-3 items-center justify-center rounded-full border-2 border-black">
                  <span className="absolute h-px w-full rotate-45 bg-black" />
                  <span className="absolute h-px w-full -rotate-45 bg-black" />
                </span>
                <span className="relative flex h-3 w-3 items-center justify-center rounded-full border-2 border-black">
                  <span className="absolute h-px w-full rotate-45 bg-black" />
                  <span className="absolute h-px w-full -rotate-45 bg-black" />
                </span>
              </>
            )}
            {mole.status === "escaped" && (
              <>
                <span className="h-1 w-3 rotate-12 rounded-full bg-black" />
                <span className="h-1 w-3 -rotate-12 rounded-full bg-black" />
              </>
            )}
          </span>

          <span className="relative h-3 w-4 rounded-full bg-pink-400 shadow-inner">
            <span className="absolute left-1 top-0.5 h-1 w-1 rounded-full bg-white/40" />
          </span>
          {mole.status === "escaped" && (
            <span className="mt-1 h-3 w-4 rounded-full border-b-2 border-pink-500" />
          )}
        </span>

        {mole.type === "helmet" && (
          <span
            className={`absolute -left-1 -right-1 -top-4 z-10 h-10 rounded-t-[30px] border-x-4 border-t-4 border-yellow-700 bg-gradient-to-b from-yellow-300 to-yellow-500 transition-all duration-300 ${
              mole.health === 1 ? "-translate-y-24 rotate-[60deg] opacity-0" : ""
            }`}
          >
            <span className="absolute -left-[5%] bottom-0 h-3 w-[110%] rounded-full border-2 border-yellow-800 bg-yellow-600 shadow-md" />
            <span className="absolute left-2 top-1 h-1.5 w-1/3 rounded-full bg-white/40" />
          </span>
        )}
      </span>
    </button>
  );
}

export default function WhackAMolePage() {
  const [game, dispatch] = useReducer(whackGameReducer, undefined, createInitialGameState);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === gameContainerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) void audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(game);
    return () => {
      delete window.render_game_to_text;
    };
  }, [game]);

  useEffect(() => {
    if (game.phase !== "intro") return;
    const introTimer = window.setTimeout(
      () => dispatch({ type: "INTRO_COMPLETE" }),
      INTRO_DURATION_MS,
    );
    return () => window.clearTimeout(introTimer);
  }, [game.phase]);

  useEffect(() => {
    if (game.phase !== "playing") return;
    const timer = window.setInterval(() => dispatch({ type: "TICK" }), 1_000);
    return () => window.clearInterval(timer);
  }, [game.phase]);

  useEffect(() => {
    if (game.phase !== "playing") return;
    const motionTimer = window.setInterval(
      () => dispatch({ type: "ADVANCE_MOLES", now: Date.now() }),
      80,
    );
    return () => window.clearInterval(motionTimer);
  }, [game.phase]);

  useEffect(() => {
    if (game.phase !== "playing") return;

    const spawn = () => dispatch({
      type: "SPAWN",
      now: Date.now(),
      holeRoll: Math.random(),
      typeRoll: Math.random(),
    });
    const openingMole = window.setTimeout(spawn, 300);
    const spawner = window.setInterval(spawn, getLevelConfig(game.level).spawnRate);

    return () => {
      window.clearTimeout(openingMole);
      window.clearInterval(spawner);
    };
  }, [game.level, game.phase]);

  const playTone = useCallback((tone: Tone) => {
    if (!soundEnabled) return;

    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = tone === "hit" ? "triangle" : "square";
    oscillator.frequency.setValueAtTime(tone === "hit" ? 220 : 720, now);
    oscillator.frequency.exponentialRampToValueAtTime(tone === "hit" ? 110 : 420, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }, [soundEnabled]);

  const handleWhack = useCallback((id: number) => {
    const mole = game.moles[id];
    if (game.phase !== "playing" || !mole || mole.status !== "up") return;
    playTone(mole.type === "helmet" && mole.health === 2 ? "clank" : "hit");
    dispatch({ type: "WHACK", id, now: Date.now() });
  }, [game.moles, game.phase, playTone]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      if (event.key.toLowerCase() === "p" && (game.phase === "playing" || game.phase === "paused")) {
        event.preventDefault();
        dispatch({ type: game.phase === "playing" ? "PAUSE" : "RESUME" });
        return;
      }

      if (game.phase === "playing" && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        handleWhack(Number(event.key) - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.phase, handleWhack]);

  const startLevel = (level: number) => {
    dispatch({ type: "START_LEVEL", level, holes: generateRandomHoles() });
  };

  const toggleFullscreen = async () => {
    if (!gameContainerRef.current) return;

    try {
      if (document.fullscreenElement === gameContainerRef.current) {
        await document.exitFullscreen();
      } else {
        await gameContainerRef.current.requestFullscreen();
      }
    } catch (error: unknown) {
      console.error("Unable to change fullscreen mode", error);
    }
  };

  const togglePause = () => {
    dispatch({ type: game.phase === "paused" ? "RESUME" : "PAUSE" });
  };

  const progress = getLevelProgress(game);
  const goal = progress.goal;
  const activeMoles = Object.values(game.moles).filter((mole) => mole.status === "up").length;
  const statusMessage = game.phase === "paused"
    ? "Game paused"
    : game.phase === "playing"
      ? `${game.timeLeft} seconds left. Score ${game.score}. ${progress.remaining} points to target. Combo ${game.combo}. ${game.misses} escaped. ${activeMoles} active targets.`
      : game.phase;

  return (
    <Container size="md" className="py-6 sm:py-8">
      <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <span className="i-ph-arrow-left" aria-hidden="true" />
            Back to Hub
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-black text-gray-900 sm:gap-3 sm:text-3xl">
            <span className="i-ph-hammer-duotone shrink-0 text-lime-600" aria-hidden="true" />
            Whack-A-Mole
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <span className={isFullscreen ? "i-ph-corners-in-bold" : "i-ph-corners-out-bold"} aria-hidden="true" />
          <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
        </button>
      </div>

      <div
        ref={gameContainerRef}
        className={`relative mx-auto max-w-[600px] overflow-hidden border-4 border-lime-800 bg-lime-950 shadow-xl ${
          isFullscreen
            ? "flex h-dvh w-screen max-w-none flex-col rounded-none border-0"
            : "rounded-2xl"
        }`}
      >
        <div className="relative z-30 flex flex-wrap items-center gap-2 bg-lime-950 px-3 py-2 text-white sm:px-4">
          <div className="grid min-w-[230px] flex-1 grid-cols-3 gap-2" aria-label="Game status">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-lime-300">Level</div>
              <div className="text-base font-black sm:text-lg">{game.level}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-lime-300">Score</div>
              <div className="text-base font-black tabular-nums sm:text-lg">{game.score}<span className="text-xs text-lime-300"> / {goal}</span></div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-lime-300">Time</div>
              <div className={`text-base font-black tabular-nums sm:text-lg ${game.timeLeft <= 5 && game.phase === "playing" ? "animate-pulse text-red-300" : ""}`}>
                {game.timeLeft}s
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(game.phase === "playing" || game.phase === "paused") && (
              <button
                type="button"
                onClick={togglePause}
                className="flex min-h-11 items-center gap-1 rounded-lg bg-white/12 px-3 text-sm font-bold hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                aria-label={game.phase === "paused" ? "Resume game" : "Pause game"}
              >
                <span className={game.phase === "paused" ? "i-ph-play-fill" : "i-ph-pause-fill"} aria-hidden="true" />
                {game.phase === "paused" ? "Resume" : "Pause"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg bg-white/12 text-lg hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
              aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
              aria-pressed={!soundEnabled}
            >
              <span className={soundEnabled ? "i-ph-speaker-high-fill" : "i-ph-speaker-slash-fill"} aria-hidden="true" />
            </button>
          </div>
          <div className="flex w-full basis-full items-center gap-3 border-t border-white/10 pt-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-lime-200">
                <span>Level progress</span>
                <span className="tabular-nums">{progress.percent}% · {progress.remaining.toLocaleString()} left</span>
              </div>
              <div
                role="progressbar"
                aria-label={`Level ${game.level} score progress`}
                aria-valuemin={0}
                aria-valuemax={goal}
                aria-valuenow={Math.min(game.score, goal)}
                className="h-2 overflow-hidden rounded-full bg-black/30"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-lime-300 to-yellow-300 transition-[width] duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5 text-center">
              <div className="min-w-14 rounded-lg bg-white/10 px-2 py-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-lime-300">Combo</div>
                <div className="text-sm font-black tabular-nums">{game.combo}×</div>
              </div>
              <div className="min-w-14 rounded-lg bg-white/10 px-2 py-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-lime-300">Escaped</div>
                <div className="text-sm font-black tabular-nums">{game.misses}</div>
              </div>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">{statusMessage}</p>
        </div>

        <div
          className={`relative w-full select-none overflow-hidden bg-lime-500 ${
            isFullscreen ? "min-h-0 flex-1" : "aspect-[4/5] sm:aspect-[3/2]"
          }`}
          style={{
            backgroundImage: "radial-gradient(circle, #84cc16 20%, #65a30d 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => (
              <span
                key={index}
                className="absolute h-4 w-2 rounded-full bg-lime-900"
                style={{
                  left: `${(index * 137) % 100}%`,
                  top: `${(index * 197) % 100}%`,
                  transform: `rotate(${(index * 45) % 360}deg)`,
                }}
              />
            ))}
          </div>

          {(game.phase === "playing" || game.phase === "paused") && game.holes.map((hole) => {
            const mole = game.moles[hole.id];
            return (
              <div
                key={hole.id}
                className="absolute h-20 w-20"
                style={{ left: `${hole.x}%`, top: `${hole.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <span className="absolute bottom-0 h-1/2 w-full rounded-full bg-amber-900 shadow-inner" aria-hidden="true" />
                <span className="absolute -top-2 left-1 z-20 grid h-6 w-6 place-items-center rounded-full bg-lime-950/75 text-xs font-black text-white shadow" aria-hidden="true">
                  {hole.id + 1}
                </span>
                {mole && mole.status !== "hiding" && (
                  <MoleCharacter
                    holeNumber={hole.id + 1}
                    mole={mole}
                    onWhack={() => handleWhack(hole.id)}
                  />
                )}
                <span className="pointer-events-none absolute -bottom-3.5 -left-[20%] z-20 flex h-8 w-[140%] items-center justify-center rounded-[50%] border-t-2 border-lime-700 bg-lime-600 shadow-md" aria-hidden="true">
                  <span className="mb-4 h-3 w-1 rotate-12 rounded-t-full bg-lime-400" />
                  <span className="mx-1 mb-3 h-4 w-1 -rotate-6 rounded-t-full bg-lime-400" />
                  <span className="mb-4 h-2 w-1 rotate-[30deg] rounded-t-full bg-lime-400" />
                </span>
              </div>
            );
          })}

          {game.combo > 1 && game.phase === "playing" && (
            <div className="pointer-events-none absolute right-4 top-4 z-20 animate-bounce text-2xl font-black italic text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              {game.combo}× combo
            </div>
          )}

          {game.phase === "start" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-lime-950/78 px-6 text-center backdrop-blur-sm">
              <span className="i-ph-hammer-duotone mb-4 text-7xl text-lime-300 drop-shadow-lg sm:text-8xl" aria-hidden="true" />
              <h2 className="text-3xl font-black text-white">Ready to rumble?</h2>
              <p className="mt-2 max-w-xs text-sm font-medium text-lime-100">Tap a mole or press its numbered key. Helmet moles need two hits.</p>
              <button
                type="button"
                onClick={() => startLevel(1)}
                className="mt-6 min-h-12 rounded-full bg-lime-400 px-8 py-3 text-xl font-black text-lime-950 shadow-[0_6px_0_#4d7c0f] transition hover:-translate-y-1 active:translate-y-1 active:shadow-none"
              >
                Start Game
              </button>
            </div>
          )}

          {game.phase === "intro" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-lime-950/70 px-6 text-center backdrop-blur-sm">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-lime-200">Round ready</p>
              <h2 className="mt-2 text-5xl font-black text-white drop-shadow-lg sm:text-6xl">Level {game.level}</h2>
              <p className="mt-3 text-xl font-bold text-yellow-300">Target: {goal.toLocaleString()} pts</p>
            </div>
          )}

          {game.phase === "paused" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-lime-950/80 px-6 text-center backdrop-blur-sm">
              <span className="i-ph-pause-circle-duotone text-7xl text-lime-300" aria-hidden="true" />
              <h2 className="mt-3 text-4xl font-black text-white">Paused</h2>
              <p className="mt-2 text-lime-100">Your timer and combo are safe.</p>
              <button
                type="button"
                onClick={togglePause}
                className="mt-6 min-h-12 rounded-full bg-white px-7 py-3 text-lg font-black text-lime-900 shadow-lg"
              >
                Resume Game
              </button>
            </div>
          )}

          {game.phase === "win" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-lime-950/84 px-6 text-center backdrop-blur-sm">
              <span className="i-ph-trophy-duotone text-7xl text-yellow-300" aria-hidden="true" />
              <h2 className="mt-2 text-4xl font-black text-white sm:text-5xl">
                {game.level === LEVEL_GOALS.length ? "Champion!" : "Level Cleared!"}
              </h2>
              <p className="mt-2 text-xl font-bold text-lime-200">Score: {game.score.toLocaleString()}</p>
              <button
                type="button"
                onClick={() => startLevel(game.level < LEVEL_GOALS.length ? game.level + 1 : 1)}
                className="mt-7 min-h-12 rounded-full bg-yellow-300 px-8 py-3 text-lg font-black text-amber-950 shadow-[0_6px_0_#b45309] transition active:translate-y-1 active:shadow-none"
              >
                {game.level < LEVEL_GOALS.length ? "Next Level" : "Play Again"}
              </button>
            </div>
          )}

          {game.phase === "gameover" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/84 px-6 text-center backdrop-blur-sm">
              <span className="i-ph-timer-duotone text-7xl text-red-200" aria-hidden="true" />
              <h2 className="mt-2 text-4xl font-black text-white sm:text-5xl">Time&apos;s Up!</h2>
              <p className="mt-2 text-xl font-bold text-red-100">Final score: {game.score.toLocaleString()}</p>
              <button
                type="button"
                onClick={() => startLevel(1)}
                className="mt-7 min-h-12 rounded-full bg-white px-8 py-3 text-lg font-black text-red-700 shadow-[0_6px_0_#cbd5e1] transition active:translate-y-1 active:shadow-none"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-[600px] rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-gray-900">How to Play</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600 sm:text-base">
          <li className="flex gap-2"><span className="i-ph-cursor-click-duotone mt-1 shrink-0 text-lime-600" aria-hidden="true" />Tap a visible mole, or press the matching number from 1–9.</li>
          <li className="flex gap-2"><span className="i-ph-hard-hat-duotone mt-1 shrink-0 text-amber-600" aria-hidden="true" />Normal moles need one hit; helmet moles need two and are worth 20 points.</li>
          <li className="flex gap-2"><span className="i-ph-lightning-duotone mt-1 shrink-0 text-yellow-600" aria-hidden="true" />Every clean hit grows a combo bonus by 2 points, up to +20. A miss breaks the combo.</li>
          <li className="flex gap-2"><span className="i-ph-keyboard-duotone mt-1 shrink-0 text-gray-700" aria-hidden="true" />Press <kbd className="font-bold">P</kbd> or use the toolbar to pause without losing time.</li>
        </ul>
      </div>
    </Container>
  );
}
