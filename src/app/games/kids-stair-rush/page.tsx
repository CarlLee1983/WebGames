"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FRAME_MS,
  GameState,
  createInitialState,
  drawScene,
  getLandingForecast,
  getPaceProgress,
  parseHighScore,
  setPlayerInput,
  renderGameToText,
  restartGame,
  startGame,
  tick,
  togglePause,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
  }
}

function GameMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/25 px-1 py-2">
      <div className="text-[10px] font-bold tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function PlatformLegend({ color, label, detail }: { color: string; label: string; detail: string }) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-xl border border-white/6 bg-black/20 px-3 py-2">
      <span className={`h-2.5 w-8 shrink-0 rounded-full ${color}`} aria-hidden="true" />
      <span>
        <strong className="block text-gray-200">{label}</strong>
        <span className="text-[11px] text-gray-500">{detail}</span>
      </span>
    </div>
  );
}

const PLATFORM_LABELS = {
  normal: "綠色安全踏板",
  spike: "銀色尖刺踏板",
  trampoline: "黃色彈簧踏板",
  "conveyor-left": "向左藍色輸送帶",
  "conveyor-right": "向右藍色輸送帶",
  fake: "粉色崩落踏板",
} as const;

const DIRECTION_LABELS = {
  left: "往左修正",
  right: "往右修正",
  hold: "保持目前方向",
} as const;

function buildLiveState(state: GameState) {
  const pace = getPaceProgress(state.floor);
  return {
    mode: state.mode,
    floor: state.floor,
    hp: state.player.hp,
    highScore: state.highScore,
    streak: state.streak,
    feedback: state.feedback,
    feedbackTimer: state.feedbackTimer,
    scrollSpeed: state.scrollSpeed,
    pace,
    nextLanding: getLandingForecast(state),
  };
}

export default function KidsStairRushPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [initialState] = useState(() => createInitialState(Math.random, 0));
  const stateRef = useRef<GameState>(initialState);
  const [liveState, setLiveState] = useState(() => buildLiveState(initialState));

  const lastTimeRef = useRef<number>(0);
  const lastUiUpdateRef = useRef<number>(0);
  const leftPressed = useRef(false);
  const rightPressed = useRef(false);

  const publishLiveState = useCallback((state: GameState) => {
    setLiveState(buildLiveState(state));
  }, []);

  useEffect(() => {
    const highScore = parseHighScore(localStorage.getItem("nsShaftHighScore"));
    if (highScore !== stateRef.current.highScore) {
      stateRef.current = { ...stateRef.current, highScore };
      publishLiveState(stateRef.current);
    }
  }, [publishLiveState]);

  const drawCurrentState = useCallback((state: GameState) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      drawScene(ctx, state);
    }
  }, []);

  const applyDirectionalInput = useCallback(() => {
    if (leftPressed.current && !rightPressed.current) {
      stateRef.current = setPlayerInput(stateRef.current, "left");
    } else if (rightPressed.current && !leftPressed.current) {
      stateRef.current = setPlayerInput(stateRef.current, "right");
    } else {
      stateRef.current = setPlayerInput(stateRef.current, "none");
    }
  }, []);

  const setDirectionPressed = useCallback((dir: "left" | "right", pressed: boolean) => {
    if (dir === "left") {
      leftPressed.current = pressed;
    } else {
      rightPressed.current = pressed;
    }
    applyDirectionalInput();
  }, [applyDirectionalInput]);

  const startOrResumeGame = useCallback(() => {
    const state = stateRef.current;

    if (state.mode === "ready") {
      stateRef.current = startGame(state);
      lastTimeRef.current = 0;
      publishLiveState(stateRef.current);
      return;
    }

    if (state.mode === "gameOver") {
      stateRef.current = startGame(restartGame());
      lastTimeRef.current = 0;
      publishLiveState(stateRef.current);
      return;
    }

    if (state.mode === "paused") {
      stateRef.current = togglePause(state);
      lastTimeRef.current = 0;
      publishLiveState(stateRef.current);
    }
  }, [publishLiveState]);

  const restartFromMobile = useCallback(() => {
    stateRef.current = startGame(restartGame());
    lastTimeRef.current = 0;
    publishLiveState(stateRef.current);
  }, [publishLiveState]);

  const togglePauseFromMobile = useCallback(() => {
    const state = stateRef.current;

    if (state.mode === "playing" || state.mode === "paused") {
      stateRef.current = togglePause(state);
      lastTimeRef.current = 0;
      publishLiveState(stateRef.current);
    }
  }, [publishLiveState]);

  // 遊戲迴圈
  const gameLoop = useCallback(() => {
    const now = performance.now();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = now;
    }

    const deltaMs = Math.min(now - lastTimeRef.current, FRAME_MS * 2);
    lastTimeRef.current = now;

    // 更新遊戲狀態
    stateRef.current = tick(stateRef.current, deltaMs);

    // 繪製畫面
    drawCurrentState(stateRef.current);
    if (now - lastUiUpdateRef.current >= 150) {
      lastUiUpdateRef.current = now;
      publishLiveState(stateRef.current);
    }
  }, [drawCurrentState, publishLiveState]);

  // rAF 迴圈
  useEffect(() => {
    let animationFrameId: number;

    const rafLoop = () => {
      gameLoop();
      animationFrameId = requestAnimationFrame(rafLoop);
    };

    animationFrameId = requestAnimationFrame(rafLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameLoop]);

  // 鍵盤事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;

      switch (e.key) {
        case " ":
        case "p":
        case "P":
          e.preventDefault();
          if (state.mode === "ready") {
            stateRef.current = startGame(state);
            lastTimeRef.current = 0;
          } else if (state.mode === "gameOver") {
            stateRef.current = restartGame();
            lastTimeRef.current = 0;
            stateRef.current = startGame(stateRef.current);
          } else if (state.mode === "playing" || state.mode === "paused") {
            stateRef.current = togglePause(state);
            lastTimeRef.current = 0;
          }
          publishLiveState(stateRef.current);
          break;

        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          setDirectionPressed("left", true);
          break;

        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          setDirectionPressed("right", true);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          setDirectionPressed("left", false);
          break;

        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          setDirectionPressed("right", false);
          break;
      }
    };

    const handleBlur = () => {
      leftPressed.current = false;
      rightPressed.current = false;
      if (stateRef.current.mode === "playing") {
        stateRef.current = togglePause(stateRef.current);
      }
      publishLiveState(stateRef.current);
      drawCurrentState(stateRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [drawCurrentState, publishLiveState, setDirectionPressed]);

  // 觸控事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasHalf = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      return x < rect.width / 2 ? "left" : "right";
    };

    const handlePointerDown = (e: PointerEvent) => {
      const state = stateRef.current;
      e.preventDefault();

      if (state.mode === "ready") {
        startOrResumeGame();
        return;
      }

      if (state.mode === "gameOver") {
        restartFromMobile();
        return;
      }

      if (state.mode === "paused") {
        startOrResumeGame();
        return;
      }

      const dir = getCanvasHalf(e.clientX);
      setDirectionPressed(dir, true);
    };

    const clearPointerState = () => {
      leftPressed.current = false;
      rightPressed.current = false;
      applyDirectionalInput();
    };

    const handlePointerUp = (e: PointerEvent) => {
      e.preventDefault();
      clearPointerState();
    };

    const handlePointerCancel = (e: PointerEvent) => {
      e.preventDefault();
      clearPointerState();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [applyDirectionalInput, restartFromMobile, setDirectionPressed, startOrResumeGame]);

  // Window hooks for testing
  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
      stateRef.current = tick(stateRef.current, ms);
      drawCurrentState(stateRef.current);
      publishLiveState(stateRef.current);
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [drawCurrentState, publishLiveState]);

  const pacePercent = Math.round(liveState.pace.percent);
  const paceTarget = liveState.pace.nextFloor === null
    ? "已達最高捲動速度"
    : `距離 B${liveState.pace.nextFloor} 還有 ${liveState.pace.floorsRemaining} 層`;
  const landingGuide = liveState.nextLanding
    ? `${DIRECTION_LABELS[liveState.nextLanding.direction]} · ${PLATFORM_LABELS[liveState.nextLanding.type]}`
    : "等待下一塊踏板進入視野";
  const statusMessage = liveState.mode === "ready"
    ? "準備好後按 Space 或點擊開始"
    : liveState.mode === "paused"
      ? "遊戲已暫停，按 P、Space 或繼續"
      : liveState.mode === "gameOver"
        ? `${liveState.feedback} · 再試一次挑戰 B${liveState.floor}`
        : liveState.feedbackTimer > 0
          ? liveState.feedback
          : "保持移動，先看下一塊踏板再修正方向";

  return (
    <div className="min-h-screen bg-[#07090f] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#090b12] to-black py-3 sm:py-5">
      <Container size="lg">
        {/* 標題 */}
        <div className="mb-4 px-1 text-center sm:mb-6">
          <div className="mb-2 inline-flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <i className="i-ph-game-controller-duotone text-2xl sm:text-3xl text-yellow-400" />
            <h1 className="bg-gradient-to-b from-white to-gray-400 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl md:text-4xl">
              小朋友下樓梯
            </h1>
            <span className="text-sm font-bold text-gray-500 sm:text-lg">(NS-Shaft)</span>
          </div>
          <p className="text-xs font-medium tracking-[0.18em] text-gray-400 drop-shadow-sm sm:text-sm">
            DESCEND · REACT · SURVIVE
          </p>
        </div>

        {/* 遊戲區域（大型機台風格） */}
        <div className="mb-6 flex justify-center sm:mb-8">
          <div
            className="group relative w-full"
            style={{ maxWidth: "min(100%, calc(42.75vh + 3rem), 34rem)" }}
          >
            {/* 發光特效 */}
            <div className="absolute -inset-1 sm:-inset-1.5 bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500 rounded-[32px] sm:rounded-[40px] opacity-30 group-hover:opacity-50 blur-xl transition duration-500" />
            
            {/* 機台外殼 */}
            <div className="relative bg-gradient-to-b from-gray-900 to-[#121215] rounded-[24px] sm:rounded-[32px] p-3 sm:p-6 sm:pb-8 shadow-2xl border border-gray-700/50">
              {/* 頂部裝飾 */}
              <div className="w-20 sm:w-24 h-1.5 bg-gray-800 rounded-full mx-auto mb-3 sm:mb-4 border-b border-white/5" />
              
              {/* 螢幕主體 */}
              <div
                className="relative mx-auto aspect-[3/4] overflow-hidden rounded-xl border-[4px] border-black bg-black shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] sm:rounded-2xl sm:border-[8px]"
                style={{ width: "min(100%, 42.75vh, 30rem)" }}
              >
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  role="application"
                  aria-label={`Kids Stair Rush，地下 ${liveState.floor} 樓，體力 ${liveState.hp}，連續落地 ${liveState.streak}`}
                  aria-describedby="kids-stair-status"
                  tabIndex={0}
                  className="block h-full w-full select-none touch-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-sky-300"
                  style={{
                    boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                    imageRendering: 'pixelated',
                  }}
                />
                {/* CRT 螢幕反光特效 */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
              </div>
              
              <div className="mx-auto mt-4 grid max-w-md grid-cols-4 gap-2 text-center">
                <GameMetric label="樓層" value={`B${liveState.floor}`} />
                <GameMetric label="體力" value={`${Math.max(0, liveState.hp)}/10`} />
                <GameMetric label="連續" value={`${liveState.streak}x`} />
                <GameMetric label="最高" value={`B${liveState.highScore}`} />
              </div>
              <div className="mx-auto mt-2 grid max-w-md gap-2 text-left sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/8 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">
                    <span>{liveState.pace.label}</span>
                    <span>{Math.round(liveState.scrollSpeed)} px/s</span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-label="下一階段速度進度"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pacePercent}
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-300 transition-[width] duration-200" style={{ width: `${pacePercent}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] font-bold text-slate-400">{paceTarget}</div>
                </div>
                <div className="rounded-xl border border-violet-400/15 bg-violet-400/8 px-3 py-2.5">
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-300">下一個落點</div>
                  <div className="mt-1 text-xs font-bold leading-5 text-violet-50">{landingGuide}</div>
                </div>
              </div>
              <div
                id="kids-stair-status"
                aria-live="polite"
                className="mx-auto mt-2 min-h-9 max-w-md rounded-xl border border-sky-400/15 bg-sky-400/8 px-3 py-2 text-center text-xs font-bold text-sky-100 sm:text-sm"
              >
                {statusMessage}
              </div>
            </div>
          </div>
        </div>

        {/* 行動裝置控制列 */}
        <div className="md:hidden max-w-[30rem] mx-auto mb-8 px-2">
          <div className="rounded-2xl border border-gray-800 bg-[#141418]/95 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startOrResumeGame}
                disabled={liveState.mode === "playing" || liveState.mode === "paused"}
                className="min-h-12 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 active:translate-y-px disabled:cursor-default disabled:from-emerald-800 disabled:to-emerald-900 disabled:text-emerald-300 disabled:shadow-none"
              >
                {liveState.mode === "gameOver"
                  ? "重新挑戰"
                  : liveState.mode === "ready"
                    ? "開始遊戲"
                    : "本局進行中"}
              </button>
              <button
                type="button"
                onClick={togglePauseFromMobile}
                disabled={liveState.mode === "ready" || liveState.mode === "gameOver"}
                aria-pressed={liveState.mode === "paused"}
                aria-label={liveState.mode === "paused" ? "繼續遊戲" : "暫停遊戲"}
                className="min-h-12 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 active:translate-y-px disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 disabled:shadow-none"
              >
                {liveState.mode === "paused" ? "繼續遊戲" : "暫停遊戲"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={liveState.mode !== "playing"}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDirectionPressed("left", true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  setDirectionPressed("left", false);
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  setDirectionPressed("left", false);
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  setDirectionPressed("left", false);
                }}
                aria-label="向左移動"
                className="min-h-14 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-4 text-base font-black text-sky-100 shadow-inner shadow-sky-500/10 active:bg-sky-500/25 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-600"
              >
                <span className="i-ph-arrow-left-bold mr-2 inline-flex" aria-hidden="true" />
                左移
              </button>
              <button
                type="button"
                disabled={liveState.mode !== "playing"}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDirectionPressed("right", true);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  setDirectionPressed("right", false);
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  setDirectionPressed("right", false);
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  setDirectionPressed("right", false);
                }}
                aria-label="向右移動"
                className="min-h-14 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-4 text-base font-black text-sky-100 shadow-inner shadow-sky-500/10 active:bg-sky-500/25 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-600"
              >
                右移
                <span className="i-ph-arrow-right-bold ml-2 inline-flex" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-3 text-center text-xs leading-relaxed text-gray-400">
              也可以直接點住遊戲畫面左半 / 右半來移動。
            </p>
          </div>
        </div>

        <div className="mx-auto mb-8 max-w-4xl rounded-2xl border border-white/8 bg-[#11141d] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black tracking-wide text-white sm:text-base">看顏色選落點</h2>
            <span className="text-[10px] font-bold tracking-wider text-gray-500 sm:text-xs">越深平台越窄、速度越快</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            <PlatformLegend color="bg-emerald-400" label="綠色" detail="安全 +1 HP" />
            <PlatformLegend color="bg-slate-300" label="銀色" detail="尖刺 -5 HP" />
            <PlatformLegend color="bg-amber-400" label="黃色" detail="彈簧反彈" />
            <PlatformLegend color="bg-sky-400" label="藍色" detail="輸送帶推動" />
            <PlatformLegend color="bg-rose-400" label="粉色" detail="短暫後崩落" />
          </div>
        </div>

        {/* 說明區塊 Grid */}
        <div className="hidden md:grid max-w-4xl mx-auto grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 🎮 遊戲控制 */}
          <div className="bg-[#18181B] border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl transition hover:border-gray-700">
            <h2 className="flex items-center gap-3 text-xl font-bold text-white mb-6">
              <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <i className="i-ph-keyboard-duotone" />
              </span>
              操作說明
            </h2>

            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4 border-b border-white/5">
                <div className="flex gap-2">
                <kbd className="inline-flex items-center justify-center bg-gray-200 border border-gray-300 border-b-[3px] rounded-md px-3 py-1.5 text-sm font-mono font-bold text-gray-800 shadow-sm min-w-[5rem]">
                  SPACE
                </kbd>
                <kbd className="inline-flex items-center justify-center rounded-md border border-gray-300 border-b-[3px] bg-gray-200 px-3 py-1.5 font-mono text-sm font-bold text-gray-800 shadow-sm">
                  P
                </kbd>
              </div>
                <span className="text-gray-400 flex-1">開始 / 暫停 / 重新遊戲，行動裝置可直接點按螢幕</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4 border-b border-white/5">
                <div className="flex gap-1.5">
                  <kbd className="inline-flex items-center justify-center bg-gray-200 border border-gray-300 border-b-[3px] rounded-md px-2 py-1.5 text-sm font-mono font-black text-gray-800 shadow-sm w-9">
                    ←
                  </kbd>
                  <kbd className="inline-flex items-center justify-center bg-gray-200 border border-gray-300 border-b-[3px] rounded-md px-2 py-1.5 text-sm font-mono font-black text-gray-800 shadow-sm w-9">
                    →
                  </kbd>
                </div>
                <span className="text-gray-500 text-sm">或</span>
                <div className="flex gap-1.5">
                  <kbd className="inline-flex items-center justify-center bg-gray-200 border border-gray-300 border-b-[3px] rounded-md px-2 py-1.5 text-sm font-mono font-bold text-gray-800 shadow-sm w-9">
                    A
                  </kbd>
                  <kbd className="inline-flex items-center justify-center bg-gray-200 border border-gray-300 border-b-[3px] rounded-md px-2 py-1.5 text-sm font-mono font-bold text-gray-800 shadow-sm w-9">
                    D
                  </kbd>
                </div>
                <span className="text-gray-400 sm:ml-2">左右移動角色</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <div className="flex gap-2">
                  <span className="inline-flex items-center justify-center bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm font-bold text-gray-300">
                    <i className="i-ph-hand-pointing-duotone mr-1 text-lg" />
                    觸控
                  </span>
                </div>
                <span className="text-gray-400 flex-1">點擊螢幕左側/右側來移動</span>
              </div>
            </div>
          </div>

          {/* 📖 遊戲規則 */}
          <div className="bg-[#18181B] border border-gray-800/80 rounded-2xl p-6 md:p-8 shadow-xl transition hover:border-gray-700">
            <h2 className="flex items-center gap-3 text-xl font-bold text-white mb-6">
              <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <i className="i-ph-book-open-duotone" />
              </span>
              生存指南
            </h2>

            <ul className="space-y-4">
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                  <i className="i-ph-arrow-down-bold text-lg" />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed pt-1">
                  跟隨板子<span className="text-gray-300 font-bold">向下跳躍</span>，但千萬別掉出螢幕下方。
                </p>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
                  <i className="i-ph-warning-bold text-lg" />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed pt-1">
                  上方有佈滿尖刺的天花板！碰到會<span className="text-rose-400 font-bold">大量扣血</span>，請小心閃避。
                </p>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <i className="i-ph-heart-bold text-lg" />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed pt-1">
                  踩在普通階梯上可<span className="text-emerald-400 font-bold">恢復體力 (+1)</span>，但踩到釘板、彈簧或翻轉板會有危險！
                </p>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                  <i className="i-ph-activity-bold text-lg" />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed pt-1">
                  生存時間越久，可以獲得越高分。加油挑戰極限吧！
                </p>
              </li>
            </ul>
          </div>
          
        </div>
      </Container>
    </div>
  );
}
