"use client";

import { useCallback, useEffect, useRef } from "react";
import Container from "@/components/common/Container";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FRAME_MS,
  GameState,
  createInitialState,
  drawScene,
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

export default function KidsStairRushPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());

  const lastTimeRef = useRef<number>(0);
  const leftPressed = useRef(false);
  const rightPressed = useRef(false);

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
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        drawScene(ctx, stateRef.current);
      }
    }
  }, []);

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
    const updateInputState = () => {
      if (leftPressed.current && !rightPressed.current) {
        stateRef.current = setPlayerInput(stateRef.current, "left");
      } else if (rightPressed.current && !leftPressed.current) {
        stateRef.current = setPlayerInput(stateRef.current, "right");
      } else {
        stateRef.current = setPlayerInput(stateRef.current, "none");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;

      switch (e.key) {
        case " ":
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
          break;

        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          leftPressed.current = true;
          updateInputState();
          break;

        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          rightPressed.current = true;
          updateInputState();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          leftPressed.current = false;
          updateInputState();
          break;

        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          rightPressed.current = false;
          updateInputState();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 觸控事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;

      if (x < CANVAS_WIDTH / 2) {
        leftPressed.current = true;
      } else {
        rightPressed.current = true;
      }
      
      if (leftPressed.current && !rightPressed.current) {
        stateRef.current = setPlayerInput(stateRef.current, "left");
      } else if (rightPressed.current && !leftPressed.current) {
        stateRef.current = setPlayerInput(stateRef.current, "right");
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      leftPressed.current = false;
      rightPressed.current = false;
      stateRef.current = setPlayerInput(stateRef.current, "none");
    };

    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);
    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Window hooks for testing
  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
      stateRef.current = tick(stateRef.current, ms);

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          drawScene(ctx, stateRef.current);
        }
      }
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, []);

  return (
    <div className="min-h-screen py-8 sm:py-12 bg-[#0A0A0A] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-[#0A0A0A] to-black">
      <Container size="lg">
        {/* 標題 */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center gap-4 mb-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <i className="i-ph-game-controller-duotone text-3xl text-yellow-400" />
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
              小朋友下樓梯
            </h1>
            <span className="text-xl md:text-2xl font-bold text-gray-500 -ml-2">(NS-Shaft)</span>
          </div>
          <p className="text-gray-400 text-lg md:text-xl font-medium tracking-wide drop-shadow-sm">
            CLASSIC ARCADE SURVIVAL
          </p>
        </div>

        {/* 遊戲區域（大型機台風格） */}
        <div className="flex justify-center mb-12">
          <div className="relative group">
            {/* 發光特效 */}
            <div className="absolute -inset-1 sm:-inset-1.5 bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500 rounded-[32px] sm:rounded-[40px] opacity-30 group-hover:opacity-50 blur-xl transition duration-500" />
            
            {/* 機台外殼 */}
            <div className="relative bg-gradient-to-b from-gray-900 to-[#121215] rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 sm:pb-8 shadow-2xl border border-gray-700/50">
              {/* 頂部裝飾 */}
              <div className="w-24 h-1.5 bg-gray-800 rounded-full mx-auto mb-4 border-b border-white/5" />
              
              {/* 螢幕主體 */}
              <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border-[4px] sm:border-[8px] border-black bg-black shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="block w-full max-w-full"
                  style={{
                    boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                    imageRendering: 'pixelated', // 若想要有點復古感可加，或移除
                  }}
                />
                {/* CRT 螢幕反光特效 */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
              </div>
              
              {/* 底部投幣孔/裝飾 */}
              <div className="mt-5 flex justify-center gap-6 opacity-30">
                <div className="w-10 h-3 bg-red-500/50 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                <div className="w-10 h-3 bg-red-500/50 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              </div>
            </div>
          </div>
        </div>

        {/* 說明區塊 Grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          
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
                </div>
                <span className="text-gray-400 flex-1">開始 / 暫停 / 重新遊戲</span>
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
