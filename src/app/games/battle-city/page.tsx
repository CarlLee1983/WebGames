"use client";

import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Container from "@/components/common/Container";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  Direction,
  GameMode,
  GameState,
  PowerUpType,
  advanceStage,
  createInitialState,
  restartGame,
  setPlayerInput,
  shootBullet,
  startGame,
  tick,
  togglePause,
} from "./utils";
import { drawScene } from "./renderer";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void | Promise<void>;
  }
}

type UiSnapshot = {
  mode: GameMode;
  stage: number;
  lives: number;
  score: number;
  hiScore: number;
  health: number;
  maxHealth: number;
  enemiesRemaining: number;
  activeEnemies: number;
  enemiesDefeated: number;
  powerUp: { type: PowerUpType; x: number; y: number } | null;
  baseDestroyed: boolean;
  playerX: number;
  playerY: number;
  playerDirection: Direction;
  playerShells: number;
  playerLevel: number;
  bulletPower: number;
  moveSpeed: number;
  shieldActive: boolean;
  spawnProtectionMs: number;
  enemyFreezeMs: number;
  baseFortifyMs: number;
};

const FRAME_MS = 1000 / 60;

const makeSnapshot = (state: GameState): UiSnapshot => ({
  mode: state.mode,
  stage: state.stage,
  lives: state.lives,
  score: state.score,
  hiScore: Math.max(state.hiScore, state.score),
  health: state.player.health,
  maxHealth: state.player.maxHealth,
  enemiesRemaining: state.enemies.length + state.enemyQueue.length,
  activeEnemies: state.enemies.length,
  enemiesDefeated: state.enemiesDefeated,
  powerUp: state.powerUp
    ? { type: state.powerUp.type, x: Math.round(state.powerUp.x), y: Math.round(state.powerUp.y) }
    : null,
  baseDestroyed: state.baseDestroyed,
  playerX: Math.round(state.player.x),
  playerY: Math.round(state.player.y),
  playerDirection: state.player.direction,
  playerShells: state.bullets.filter((bullet) => bullet.isPlayer).length,
  playerLevel: state.player.level ?? 1,
  bulletPower: state.player.bulletPower,
  moveSpeed: state.player.speed,
  shieldActive: Boolean(state.player.shield),
  spawnProtectionMs: Math.max(0, Math.round(state.player.invincible)),
  enemyFreezeMs: Math.max(0, Math.round(state.frozenTimer)),
  baseFortifyMs: Math.max(0, Math.round(state.shovelTimer)),
});

const POWER_UP_DETAILS: Record<PowerUpType, { code: string; name: string; effect: string; tone: string }> = {
  tank: { code: "T", name: "Tank", effect: "+1 life", tone: "bg-amber-100 text-amber-800" },
  star: { code: "★", name: "Star", effect: "Upgrade", tone: "bg-orange-100 text-orange-800" },
  bomb: { code: "B", name: "Bomb", effect: "Clear squad", tone: "bg-red-100 text-red-800" },
  shield: { code: "H", name: "Shield", effect: "Block 1 hit", tone: "bg-emerald-100 text-emerald-800" },
  clock: { code: "C", name: "Clock", effect: "Freeze", tone: "bg-sky-100 text-sky-800" },
  shovel: { code: "L", name: "Shovel", effect: "Fortify base", tone: "bg-violet-100 text-violet-800" },
};

const modeMessage = (ui: UiSnapshot) => {
  switch (ui.mode) {
    case "menu":
      return "Awaiting deployment. Defend the Eagle Base and clear every enemy tank.";
    case "stageStart":
      return `Stage ${ui.stage} incoming. Prepare to defend the base.`;
    case "playing":
      return `${ui.enemiesRemaining} enemy tanks remain. Base integrity is stable.`;
    case "paused":
      return "Battle paused. Your position is secure.";
    case "stageComplete":
      return `Stage ${ui.stage} secured with ${ui.score} points.`;
    case "gameOver":
      return ui.baseDestroyed ? "The Eagle Base was destroyed." : "Your tank squad is out of lives.";
  }
};

function BattleOverlay({ ui, onAction }: { ui: UiSnapshot; onAction: () => void }) {
  if (ui.mode === "playing") return null;

  if (ui.mode === "stageStart") {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/45" aria-live="polite">
        <div className="rounded-2xl border border-amber-300/45 bg-slate-950/88 px-6 py-4 text-center shadow-2xl backdrop-blur-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-300">Deployment</p>
          <p className="mt-2 font-mono text-2xl font-black text-white">STAGE {ui.stage}</p>
        </div>
      </div>
    );
  }

  const content = {
    menu: {
      eyebrow: "Operation Eagle Shield",
      title: "Hold the line",
      body: "Break through brick cover, collect field upgrades, and keep the Eagle Base standing.",
      action: "Begin Sortie",
    },
    paused: {
      eyebrow: `Stage ${ui.stage}`,
      title: "Battle paused",
      body: "The battlefield is frozen until you are ready to resume.",
      action: "Resume Battle",
    },
    stageComplete: {
      eyebrow: `Score ${ui.score.toLocaleString()}`,
      title: `Stage ${ui.stage} secured`,
      body: `${ui.enemiesDefeated} enemy tanks eliminated. The next district is ready.`,
      action: "Advance Stage",
    },
    gameOver: {
      eyebrow: `Final score ${ui.score.toLocaleString()}`,
      title: ui.baseDestroyed ? "Base lost" : "Squad defeated",
      body: "Regroup, protect the center lane, and use power-ups to turn the next run.",
      action: "Retry Mission",
    },
  }[ui.mode];

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(30,41,59,0.78),_rgba(2,6,23,0.96))] p-4">
      <section role="dialog" aria-labelledby="battle-city-overlay-title" className="max-w-sm rounded-[24px] border border-white/14 bg-slate-950/88 p-5 text-center shadow-2xl backdrop-blur-md">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">{content.eyebrow}</p>
        <h2 id="battle-city-overlay-title" className="mt-2 text-2xl font-black tracking-tight text-white">{content.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{content.body}</p>
        <button type="button" onClick={onAction} className="mt-5 min-h-12 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-105 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white">
          {content.action}
        </button>
      </section>
    </div>
  );
}

export default function BattleCityPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTimeRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const dprRef = useRef(1);
  const [initialState] = useState(createInitialState);
  const stateRef = useRef<GameState>(initialState);
  const [ui, setUi] = useState<UiSnapshot>(() => makeSnapshot(initialState));

  const drawCurrentState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
    drawScene(ctx, stateRef.current);
  }, []);

  const commitState = useCallback(
    (state: GameState, resetClock = false) => {
      stateRef.current = state;
      if (resetClock) lastTimeRef.current = 0;
      setUi(makeSnapshot(state));
      drawCurrentState();
    },
    [drawCurrentState],
  );

  const handlePrimaryAction = useCallback(() => {
    const state = stateRef.current;
    if (state.mode === "menu") {
      commitState(startGame(state), true);
    } else if (state.mode === "paused") {
      commitState(togglePause(state), true);
    } else if (state.mode === "stageComplete") {
      commitState(advanceStage(state), true);
    } else if (state.mode === "gameOver") {
      commitState(startGame(restartGame()), true);
    }
  }, [commitState]);

  const restartRun = useCallback(() => {
    commitState(startGame(restartGame()), true);
  }, [commitState]);

  const pauseOrResume = useCallback(() => {
    commitState(togglePause(stateRef.current), true);
  }, [commitState]);

  useEffect(() => {
    const syncCanvasResolution = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      canvas.width = Math.round(CANVAS_WIDTH * dpr);
      canvas.height = Math.round(CANVAS_HEIGHT * dpr);
      drawCurrentState();
    };

    syncCanvasResolution();
    window.addEventListener("resize", syncCanvasResolution);
    return () => window.removeEventListener("resize", syncCanvasResolution);
  }, [drawCurrentState]);

  useEffect(() => {
    let animationFrameId = 0;

    const rafLoop = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const deltaMs = Math.min(now - lastTimeRef.current, FRAME_MS * 4);
      lastTimeRef.current = now;
      stateRef.current = tick(stateRef.current, deltaMs);
      drawCurrentState();

      if (now - lastUiUpdateRef.current >= 100) {
        lastUiUpdateRef.current = now;
        setUi(makeSnapshot(stateRef.current));
      }
      animationFrameId = requestAnimationFrame(rafLoop);
    };

    animationFrameId = requestAnimationFrame(rafLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawCurrentState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable='true']")) return;

      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        restartRun();
        return;
      }
      if (key === "p") {
        event.preventDefault();
        pauseOrResume();
        return;
      }

      const state = stateRef.current;
      if (["menu", "paused", "stageComplete", "gameOver"].includes(state.mode) && (key === "enter" || key === " ")) {
        event.preventDefault();
        handlePrimaryAction();
        return;
      }
      if (state.mode !== "playing") return;

      const directions: Record<string, Direction> = {
        w: "UP",
        arrowup: "UP",
        s: "DOWN",
        arrowdown: "DOWN",
        a: "LEFT",
        arrowleft: "LEFT",
        d: "RIGHT",
        arrowright: "RIGHT",
      };
      const direction = directions[key];
      if (direction) {
        event.preventDefault();
        const movingState = setPlayerInput(stateRef.current, direction);
        stateRef.current = event.repeat ? movingState : tick(movingState, FRAME_MS);
      } else if ((key === "enter" || key === " ") && !event.repeat) {
        event.preventDefault();
        commitState(shootBullet(stateRef.current));
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (["w", "s", "a", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) {
        stateRef.current = setPlayerInput(stateRef.current, "none");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [commitState, handlePrimaryAction, pauseOrResume, restartRun]);

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: "origin top-left; battlefield is 416 by 416 logical pixels",
      ...makeSnapshot(stateRef.current),
      player: {
        x: Math.round(stateRef.current.player.x),
        y: Math.round(stateRef.current.player.y),
        direction: stateRef.current.player.direction,
        level: stateRef.current.player.level ?? 1,
      },
      enemies: stateRef.current.enemies.map((enemy) => ({
        type: enemy.type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        health: enemy.health,
      })),
    });
    window.advanceTime = (ms: number) => {
      let remaining = Math.max(0, ms);
      while (remaining > 0) {
        const step = Math.min(FRAME_MS, remaining);
        stateRef.current = tick(stateRef.current, step);
        remaining -= step;
      }
      setUi(makeSnapshot(stateRef.current));
      drawCurrentState();
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [drawCurrentState]);

  const beginMove = (direction: Direction) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    stateRef.current = setPlayerInput(stateRef.current, direction);
  };

  const endMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    stateRef.current = setPlayerInput(stateRef.current, "none");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const keyboardNudge = (direction: Direction) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    stateRef.current = setPlayerInput(stateRef.current, direction);
    window.setTimeout(() => {
      stateRef.current = setPlayerInput(stateRef.current, "none");
    }, 140);
  };

  const tapNudge = (direction: Direction) => () => {
    stateRef.current = setPlayerInput(stateRef.current, direction);
    window.setTimeout(() => {
      stateRef.current = setPlayerInput(stateRef.current, "none");
    }, 140);
  };

  const directionButtons: Array<{ direction: Direction; label: string; icon: string; position: string }> = [
    { direction: "UP", label: "Move up", icon: "i-ph-caret-up-bold", position: "col-start-2 row-start-1" },
    { direction: "LEFT", label: "Move left", icon: "i-ph-caret-left-bold", position: "col-start-1 row-start-2" },
    { direction: "DOWN", label: "Move down", icon: "i-ph-caret-down-bold", position: "col-start-2 row-start-3" },
    { direction: "RIGHT", label: "Move right", icon: "i-ph-caret-right-bold", position: "col-start-3 row-start-2" },
  ];
  // Fast Refresh can briefly retain a snapshot created before these fields existed.
  const playerX = ui.playerX ?? 0;
  const playerY = ui.playerY ?? 0;
  const playerDirection = ui.playerDirection ?? "UP";
  const playerShells = ui.playerShells ?? 0;
  const activeEnemies = ui.activeEnemies ?? 0;

  return (
    <Container size="full" className="py-4 sm:py-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-900/8 bg-[radial-gradient(circle_at_8%_6%,_rgba(251,191,36,0.2),_transparent_26%),radial-gradient(circle_at_95%_12%,_rgba(239,68,68,0.15),_transparent_24%),linear-gradient(145deg,_#fffdf5,_#eef2f7)] p-4 shadow-[0_30px_100px_rgba(15,23,42,0.14)] sm:p-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-red-700/70">Armored arcade campaign</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Battle City</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Break the siege, recover tactical upgrades, and keep the Eagle Base alive through five shifting districts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ui.mode === "menu" ? (
              <button type="button" onClick={handlePrimaryAction} className="min-h-12 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 shadow-md transition hover:bg-amber-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-600">Start Mission</button>
            ) : null}
            <button type="button" onClick={pauseOrResume} disabled={ui.mode !== "playing" && ui.mode !== "paused"} aria-pressed={ui.mode === "paused"} className="min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-md transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
              {ui.mode === "paused" ? "Resume" : "Pause"} <span className="ml-1 text-white/55">P</span>
            </button>
            <button type="button" onClick={restartRun} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-md transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-500">
              Restart <span className="ml-1 text-slate-400">R</span>
            </button>
          </div>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,440px)_minmax(280px,1fr)] lg:items-start 2xl:grid-cols-[minmax(0,480px)_minmax(280px,1fr)]">
          <div className="min-w-0">
            <div className="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-[24px] border-4 border-slate-950 bg-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.3)] lg:max-w-[440px] 2xl:max-w-[480px]">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                tabIndex={0}
                role="application"
                aria-label={`Battle City battlefield. ${modeMessage(ui)} ${activeEnemies} enemy tanks currently deployed. Player at sector ${Math.floor(playerX / 16) + 1}, ${Math.floor(playerY / 16) + 1}, facing ${playerDirection.toLowerCase()}. Player health ${ui.health} of ${ui.maxHealth}, tank level ${ui.playerLevel}, shell power ${ui.bulletPower}${ui.shieldActive ? ", shield ready" : ""}. ${playerShells} player shells in flight. Use W A S D or arrow keys to move, Enter or Space to fire, and P to pause.`}
                className="block aspect-[15/13] h-auto w-full bg-slate-950 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-amber-300"
                style={{ imageRendering: "pixelated" }}
              />
              <BattleOverlay ui={ui} onAction={handlePrimaryAction} />
            </div>
            <p className="sr-only" aria-live="polite">{modeMessage(ui)}</p>
          </div>

          <aside className="grid min-w-0 gap-4">
            <div className="order-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                ["Stage", ui.stage, "i-ph-flag-checkered-bold"],
                ["Lives", ui.lives, "i-ph-heart-bold"],
                ["Score", ui.score.toLocaleString(), "i-ph-star-four-bold"],
                ["Hostiles", ui.enemiesRemaining, "i-ph-crosshair-bold"],
              ].map(([label, value, icon]) => (
                <div key={label} className="rounded-2xl border border-white/70 bg-white/78 p-3 shadow-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500"><span className={`${icon} text-base text-red-600`} />{label}</div>
                  <p className="mt-1 font-mono text-xl font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <div className="order-3 rounded-[24px] bg-slate-950 p-4 text-white shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Mission status</p>
                  <p className="mt-1 text-sm font-bold">{modeMessage(ui)}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-black text-slate-200">HI {ui.hiScore.toLocaleString()}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-300"><span>Armor integrity</span><span>{Math.max(0, ui.health)} / {ui.maxHealth}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 transition-[width]" style={{ width: `${Math.max(0, Math.min(100, (ui.health / ui.maxHealth) * 100))}%` }} /></div>
              <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Sector {Math.floor(playerX / 16) + 1}, {Math.floor(playerY / 16) + 1} · Facing {playerDirection} · {playerShells} shells</p>
              <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Tank loadout">
                {[
                  ["Tank", `Lv ${ui.playerLevel}`],
                  ["Shell", `P${ui.bulletPower}`],
                  ["Speed", `${ui.moveSpeed}px`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/8 px-2 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-sm font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Active combat effects">
                <EffectBadge label="Shield" value={ui.shieldActive ? "Ready" : "Empty"} active={ui.shieldActive} />
                <EffectBadge label="Freeze" value={formatEffectTime(ui.enemyFreezeMs)} active={ui.enemyFreezeMs > 0} />
                <EffectBadge label="Base" value={formatEffectTime(ui.baseFortifyMs)} active={ui.baseFortifyMs > 0} />
                {ui.spawnProtectionMs > 0 && ui.mode !== "menu" ? <EffectBadge label="Guard" value={formatEffectTime(ui.spawnProtectionMs)} active /> : null}
              </div>
            </div>

            <div className="order-1 grid gap-4 rounded-[24px] border border-slate-200/90 bg-white/82 p-4 shadow-sm sm:grid-cols-[auto_1fr] lg:grid-cols-1 xl:grid-cols-[auto_1fr]">
              <div className="mx-auto grid h-[176px] w-[176px] touch-none grid-cols-3 grid-rows-3 gap-2" role="group" aria-label="Tank movement controls">
                {directionButtons.map(({ direction, label, icon, position }) => (
                  <button
                    key={direction}
                    type="button"
                    aria-label={label}
                    disabled={ui.mode !== "playing"}
                    onPointerDown={beginMove(direction)}
                    onPointerUp={endMove}
                    onPointerCancel={endMove}
                    onClick={tapNudge(direction)}
                    onKeyDown={keyboardNudge(direction)}
                    className={`${position} flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-md transition active:scale-95 enabled:hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-500`}
                  >
                    <span className={`${icon} text-2xl`} aria-hidden="true" />
                  </button>
                ))}
                <div className="col-start-2 row-start-2 flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400" aria-hidden="true"><span className="i-ph-crosshair-bold text-xl" /></div>
              </div>

              <div className="flex min-w-0 flex-col justify-center gap-3">
                <button type="button" onClick={() => commitState(shootBullet(stateRef.current))} disabled={ui.mode !== "playing"} className="min-h-14 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3 font-black text-white shadow-lg shadow-red-500/20 transition active:scale-[0.98] enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-500">
                  <span className="i-ph-target-bold mr-2 text-lg" aria-hidden="true" /> Fire
                </button>
                <div className="rounded-2xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">
                  <p className="font-black text-slate-900">Keyboard crew</p>
                  <p className="mt-1"><kbd className="font-mono font-black text-red-700">WASD / arrows</kbd> move · <kbd className="font-mono font-black text-red-700">Enter / Space</kbd> fire</p>
                  <p><kbd className="font-mono font-black text-red-700">P</kbd> pause · <kbd className="font-mono font-black text-red-700">R</kbd> restart</p>
                </div>
              </div>
            </div>

            {ui.powerUp ? (
              <div role="status" className="order-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Field supply detected</p>
                  <p className="mt-1 text-sm font-black">{POWER_UP_DETAILS[ui.powerUp.type].name} · {POWER_UP_DETAILS[ui.powerUp.type].effect}</p>
                </div>
                <span className="shrink-0 font-mono text-xs font-bold text-amber-800">Sector {Math.floor(ui.powerUp.x / 16) + 1}, {Math.floor(ui.powerUp.y / 16) + 1}</span>
              </div>
            ) : null}

            <div className="order-5 grid grid-cols-3 gap-2 text-center text-[10px] font-bold sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6" aria-label="Power-up guide">
              {(Object.entries(POWER_UP_DETAILS) as [PowerUpType, (typeof POWER_UP_DETAILS)[PowerUpType]][]).map(([type, detail]) => (
                <div key={type} className={`rounded-xl px-2 py-2 ${detail.tone}`}>
                  <span className="font-black">{detail.code}</span> {detail.effect}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </Container>
  );
}

function formatEffectTime(milliseconds: number) {
  return milliseconds > 0 ? `${(milliseconds / 1000).toFixed(1)}s` : "Idle";
}

function EffectBadge({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${active ? "border-cyan-300/45 bg-cyan-300/16 text-cyan-100" : "border-white/8 bg-white/5 text-slate-500"}`}>
      {label} · {value}
    </span>
  );
}
