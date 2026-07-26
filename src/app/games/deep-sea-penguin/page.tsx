"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Container from "@/components/common/Container";
import { initGame, type GameController, type GameSnapshot } from "./game";
import { DAMAGE_COOLDOWN_MS, getCurrentProgress, renderGameToText } from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

type RunState = "loading" | "ready" | "playing" | "paused" | "gameover" | "error";
type Direction = "left" | "right";

const INITIAL_SNAPSHOT: GameSnapshot = {
  depth: 0,
  lives: 3,
  fishCount: 0,
  speedLevel: 1,
  scrollSpeed: 3.5,
  penguinX: 300,
  hazardCount: 0,
  fishInView: 0,
  damageCooldownMs: 0,
  feedback: "none",
  isGameOver: false,
};

export default function DeepSeaPenguinPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const snapshotRef = useRef(INITIAL_SNAPSHOT);
  const runStateRef = useRef<RunState>("loading");
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [runState, setRunState] = useState<RunState>("loading");
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    snapshotRef.current = snapshot;
    runStateRef.current = runState;
  }, [runState, snapshot]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(snapshotRef.current, runStateRef.current);
    return () => {
      delete window.render_game_to_text;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const controller = initGame(container, {
      onUpdate: (nextSnapshot) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        if (nextSnapshot.isGameOver) setRunState("gameover");
      },
    });
    controllerRef.current = controller;

    void controller.ready
      .then(() => {
        if (cancelled) {
          controller.destroy();
          return;
        }
        setRunState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Unable to initialize Deep Sea Penguin", error);
        setRunState("error");
      });

    return () => {
      cancelled = true;
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [runId]);

  const startDive = () => {
    controllerRef.current?.start();
    setRunState("playing");
  };

  const restartDive = () => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
    setSnapshot(INITIAL_SNAPSHOT);
    setRunState("loading");
    setRunId((current) => current + 1);
  };

  const togglePause = useCallback(() => {
    if (runState === "playing") {
      controllerRef.current?.pause();
      setRunState("paused");
    } else if (runState === "paused") {
      controllerRef.current?.resume();
      setRunState("playing");
    }
  }, [runState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key.toLowerCase() !== "p") return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (runState === "playing" || runState === "paused") {
        event.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runState, togglePause]);

  const setDirection = (direction: Direction, pressed: boolean) => {
    controllerRef.current?.setDirection(direction, pressed);
  };

  const directionButtonProps = (direction: Direction) => ({
    onPointerDown: () => setDirection(direction, true),
    onPointerUp: () => setDirection(direction, false),
    onPointerCancel: () => setDirection(direction, false),
    onPointerLeave: () => setDirection(direction, false),
    onClick: () => controllerRef.current?.nudge(direction),
  });

  const isActive = runState === "playing";
  const currentProgress = getCurrentProgress(snapshot.depth);
  const currentPercent = Math.round(currentProgress.percent);
  const protectionPercent = Math.min(100, Math.max(0, (snapshot.damageCooldownMs / DAMAGE_COOLDOWN_MS) * 100));
  const hazardCue = snapshot.depth <= 500
    ? "Pufferfish join beyond 500m"
    : snapshot.depth <= 1_200
      ? "Urchins join beyond 1,200m"
      : "All hazard families active";
  const eventMessage = runState === "playing" && snapshot.feedback === "damage" && snapshot.damageCooldownMs > 0
    ? `Hazard hit. ${snapshot.lives} hearts remaining. Recovery shield active for one second.`
    : runState === "playing" && snapshot.feedback === "fish"
      ? `Golden fish secured. ${snapshot.fishCount} collected.`
      : null;
  const statusMessage = eventMessage ?? (runState === "playing"
    ? "Dive in progress."
    : runState === "ready"
      ? "Dive ready"
      : runState === "paused"
        ? "Dive paused"
        : runState === "gameover"
          ? `Dive finished at ${Math.floor(snapshot.depth)} meters with ${snapshot.fishCount} fish.`
          : runState);

  return (
    <Container size="lg" className="py-6 sm:py-8">
      <section className="overflow-hidden rounded-[28px] border border-sky-400/20 bg-gradient-to-b from-slate-950 via-blue-950 to-cyan-950 p-4 text-white shadow-[0_24px_80px_rgba(8,47,73,0.25)] sm:p-7 lg:p-9">
        <header className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sky-200/75 transition hover:text-white"
            >
              <span className="i-ph-arrow-left" aria-hidden="true" />
              Back to Hub
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
              <span className="i-ph-penguin-duotone shrink-0 text-4xl text-cyan-300 sm:text-5xl" aria-hidden="true" />
              Deep Sea Penguin
            </h1>
            <p className="mt-1 text-sm font-medium text-sky-200/70 sm:text-base">Steer through the current, collect fish, and dive as deep as you can.</p>
          </div>
          <div className="hidden rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200 sm:block">
            Endless dive
          </div>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:gap-8">
          <div className="order-2 mx-auto w-full max-w-[400px] lg:order-1 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[24px] border-4 border-sky-300/25 bg-slate-950 shadow-[0_20px_60px_rgba(2,132,199,0.22)]">
              <div ref={containerRef} className="h-full w-full" />

              {snapshot.speedLevel > 1 && runState === "playing" && (
                <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-yellow-200/40 bg-slate-950/60 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yellow-200 backdrop-blur-md">
                  <span className="i-ph-lightning-fill mr-1 text-yellow-300" aria-hidden="true" />
                  Current level {snapshot.speedLevel}
                </div>
              )}

              {runState === "playing" && (snapshot.damageCooldownMs > 0 || snapshot.feedback === "fish") && (
                <div
                  className={`pointer-events-none absolute bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-[260px] -translate-x-1/2 overflow-hidden rounded-2xl border px-4 py-3 text-center shadow-xl backdrop-blur-md ${snapshot.damageCooldownMs > 0 ? "border-red-200/45 bg-red-950/78 text-red-50" : "border-yellow-200/45 bg-amber-950/78 text-yellow-50"}`}
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.12em]">
                    <span className={snapshot.damageCooldownMs > 0 ? "i-ph-shield-check-fill text-red-200" : "i-ph-fish-fill text-yellow-200"} aria-hidden="true" />
                    {snapshot.damageCooldownMs > 0 ? "Recovery shield" : "Golden fish +1"}
                  </div>
                  {snapshot.damageCooldownMs > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                      <div className="h-full rounded-full bg-red-200 transition-[width] duration-100" style={{ width: `${protectionPercent}%` }} />
                    </div>
                  )}
                </div>
              )}

              {runState === "loading" && (
                <div className="absolute inset-0 grid place-items-center bg-slate-950">
                  <div className="text-center">
                    <span className="i-ph-spinner-gap-bold inline-block animate-spin text-5xl text-cyan-300" aria-hidden="true" />
                    <p className="mt-3 font-bold text-sky-100">Preparing the current…</p>
                  </div>
                </div>
              )}

              {runState === "ready" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/72 px-8 pb-24 text-center backdrop-blur-sm sm:pb-20">
                  <span className="i-ph-waves-duotone text-7xl text-cyan-300" aria-hidden="true" />
                  <h2 className="mt-3 text-4xl font-black">Ready to dive?</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-sky-100/80">Drag across the water or steer with the arrow keys. Red creatures hurt; golden fish add to your bounty.</p>
                  <button
                    type="button"
                    onClick={startDive}
                    className="mt-7 min-h-12 rounded-full bg-cyan-300 px-8 py-3 text-lg font-black text-slate-950 shadow-[0_8px_30px_rgba(103,232,249,0.35)] transition hover:bg-white active:scale-95"
                  >
                    Start Dive
                  </button>
                </div>
              )}

              {runState === "paused" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/82 px-8 text-center backdrop-blur-md">
                  <span className="i-ph-pause-circle-duotone text-7xl text-cyan-300" aria-hidden="true" />
                  <h2 className="mt-3 text-4xl font-black">Current paused</h2>
                  <p className="mt-2 text-sky-100/75">Depth, hazards, and fish are frozen.</p>
                  <button
                    type="button"
                    onClick={togglePause}
                    className="mt-6 min-h-12 rounded-full bg-white px-7 py-3 text-lg font-black text-blue-950 shadow-lg"
                  >
                    Resume Dive
                  </button>
                </div>
              )}

              {runState === "gameover" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 px-6 text-center backdrop-blur-md">
                  <span className="i-ph-flag-checkered-duotone text-7xl text-cyan-300" aria-hidden="true" />
                  <h2 className="mt-2 text-4xl font-black">Dive complete</h2>
                  <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
                      <div className="text-xs font-black uppercase tracking-wider text-sky-300">Depth</div>
                      <div className="mt-1 text-2xl font-black">{Math.floor(snapshot.depth)}m</div>
                    </div>
                    <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
                      <div className="text-xs font-black uppercase tracking-wider text-yellow-300">Fish</div>
                      <div className="mt-1 text-2xl font-black">{snapshot.fishCount}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={restartDive}
                    className="mt-7 min-h-12 rounded-full bg-cyan-300 px-8 py-3 text-lg font-black text-slate-950 shadow-lg transition hover:bg-white active:scale-95"
                  >
                    Dive Again
                  </button>
                </div>
              )}

              {runState === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 px-8 text-center">
                  <span className="i-ph-warning-octagon-duotone text-6xl text-red-200" aria-hidden="true" />
                  <h2 className="mt-3 text-3xl font-black">The current stalled</h2>
                  <button type="button" onClick={restartDive} className="mt-6 min-h-12 rounded-full bg-white px-7 py-3 font-black text-red-800">
                    Try Again
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-3" aria-label="Touch controls">
              <button
                type="button"
                {...directionButtonProps("left")}
                disabled={!isActive}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 text-base font-black text-sky-100 transition hover:bg-sky-300/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Steer left"
              >
                <span className="i-ph-arrow-left-bold text-xl" aria-hidden="true" />
                Left
              </button>
              <button
                type="button"
                onClick={togglePause}
                disabled={runState !== "playing" && runState !== "paused"}
                className="grid min-h-14 min-w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/12 text-xl text-cyan-100 transition hover:bg-cyan-300/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={runState === "paused" ? "Resume dive" : "Pause dive"}
              >
                <span className={runState === "paused" ? "i-ph-play-fill" : "i-ph-pause-fill"} aria-hidden="true" />
              </button>
              <button
                type="button"
                {...directionButtonProps("right")}
                disabled={!isActive}
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 text-base font-black text-sky-100 transition hover:bg-sky-300/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Steer right"
              >
                Right
                <span className="i-ph-arrow-right-bold text-xl" aria-hidden="true" />
              </button>
            </div>
          </div>

          <aside className="order-1 min-w-0 space-y-4 lg:order-2 lg:col-start-2 lg:row-start-1">
            <div className="grid grid-cols-3 gap-1 rounded-2xl border border-sky-300/20 bg-white/7 p-2 backdrop-blur-md sm:gap-2 sm:p-3" aria-label="Dive status">
              <div className="min-w-0 rounded-xl bg-sky-300/8 px-2 py-3 text-center sm:px-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-sky-300 sm:text-xs">Depth</div>
                <div className="mt-1 truncate text-xl font-black tabular-nums sm:text-3xl">{Math.floor(snapshot.depth)}<span className="ml-0.5 text-xs text-sky-300">m</span></div>
              </div>
              <div className="min-w-0 rounded-xl bg-yellow-300/8 px-2 py-3 text-center sm:px-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300 sm:text-xs">Fish</div>
                <div className="mt-1 text-xl font-black tabular-nums text-yellow-100 sm:text-3xl">{snapshot.fishCount}</div>
              </div>
              <div className="min-w-0 rounded-xl bg-red-300/8 px-2 py-3 text-center sm:px-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-red-200 sm:text-xs">Health</div>
                <div className="mt-2 flex justify-center gap-0.5 sm:gap-1">
                  {Array.from({ length: 3 }, (_, index) => (
                    <span
                      key={index}
                      className={`text-lg transition sm:text-2xl ${index < snapshot.lives ? "i-ph-heart-fill text-red-400" : "i-ph-heart-break text-white/18"}`}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="sr-only">{snapshot.lives} hearts remaining</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/8 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Current</div>
                  <div className="mt-1 text-xl font-black">{currentProgress.label}</div>
                  <div className="mt-0.5 text-sm font-bold text-cyan-100/65">Level {snapshot.speedLevel} of 4 · {currentProgress.multiplier.toFixed(1)}× flow</div>
                </div>
                <span className="i-ph-gauge-duotone text-4xl text-cyan-300" aria-hidden="true" />
              </div>
              <div
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label={currentProgress.nextLevelAt === null ? "Maximum current reached" : "Progress to next current level"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={currentPercent}
              >
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-yellow-300 transition-[width] duration-200" style={{ width: `${currentPercent}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-cyan-100/70">
                <span>{currentProgress.nextLevelAt === null ? "Maximum current reached" : `Next surge in ${Math.ceil(currentProgress.metersRemaining)}m`}</span>
                <span>{currentPercent}%</span>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950/25 px-3 py-2 text-xs font-bold text-sky-100/75">
                <span className="i-ph-warning-diamond-duotone shrink-0 text-lg text-yellow-300" aria-hidden="true" />
                {hazardCue}
              </div>
            </div>

          </aside>

          <div className="order-3 rounded-2xl border border-white/10 bg-white/6 p-4 sm:p-5 lg:col-start-2 lg:row-start-2">
            <h2 className="text-lg font-black">Dive briefing</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-sky-100/75">
              <li className="flex gap-3"><span className="i-ph-hand-swipe-left-duotone mt-1 shrink-0 text-xl text-cyan-300" aria-hidden="true" />Drag anywhere in the water, use the buttons, or focus the canvas and press <kbd className="font-black text-white">A/D</kbd> or the arrow keys.</li>
              <li className="flex gap-3"><span className="i-ph-fish-duotone mt-1 shrink-0 text-xl text-yellow-300" aria-hidden="true" />Collect golden fish while keeping clear of jellyfish, puffers, and urchins.</li>
              <li className="flex gap-3"><span className="i-ph-shield-check-duotone mt-1 shrink-0 text-xl text-red-300" aria-hidden="true" />After a hit, one second of invulnerability prevents hazards from draining every heart at once.</li>
              <li className="flex gap-3"><span className="i-ph-pause-duotone mt-1 shrink-0 text-xl text-sky-300" aria-hidden="true" />Press <kbd className="font-black text-white">P</kbd> or use Pause to freeze the entire current.</li>
            </ul>
          </div>
        </div>

        <p className="sr-only" aria-live="polite">{statusMessage}</p>
      </section>
    </Container>
  );
}
