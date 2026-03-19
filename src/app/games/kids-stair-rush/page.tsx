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
  movePlayer,
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
          } else if (state.mode === "playing") {
            stateRef.current = togglePause(state);
          }
          break;

        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          stateRef.current = movePlayer(state, "left");
          break;

        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          stateRef.current = movePlayer(state, "right");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 觸控事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;

      const state = stateRef.current;

      if (x < CANVAS_WIDTH / 2) {
        stateRef.current = movePlayer(state, "left");
      } else {
        stateRef.current = movePlayer(state, "right");
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart);
    return () => canvas.removeEventListener("touchstart", handleTouchStart);
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
    <div className="py-8 sm:py-12">
      <Container size="lg">
        {/* 標題 */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <i className="i-ph-stairs-duotone text-5xl text-yellow-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Kids Stair Rush
            </h1>
          </div>
          <p className="text-lg text-gray-600">幫小朋友快速躲避樓梯上的障礙物！</p>
        </div>

        {/* 遊戲區域 */}
        <div className="flex justify-center">
          <div className="relative bg-white rounded-3xl shadow-2xl p-6 overflow-hidden" style={{width: CANVAS_WIDTH + 48}}>
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block bg-sky-100 rounded-2xl shadow-lg"
            />

            {/* 行動控制按鈕 */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:hidden">
              <button
                onClick={() => {
                  stateRef.current = movePlayer(stateRef.current, "left");
                }}
                className="py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-xl active:from-blue-700 active:to-blue-800 transition-all"
              >
                ← 左
              </button>
              <button
                onClick={() => {
                  stateRef.current = movePlayer(stateRef.current, "right");
                }}
                className="py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-xl active:from-blue-700 active:to-blue-800 transition-all"
              >
                右 →
              </button>
            </div>
          </div>
        </div>

        {/* 控制說明 */}
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
            <h2 className="text-2xl font-bold text-yellow-700 mb-4">🎮 遊戲控制</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-400 text-white font-bold px-3 py-2 rounded-lg text-sm">
                  SPACE
                </div>
                <span>開始 / 重新開始 / 暫停</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-yellow-400 text-white font-bold px-3 py-2 rounded-lg text-sm">
                  ← → 或 A D
                </div>
                <span>左右移動</span>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-400 text-white font-bold px-3 py-2 rounded-lg text-sm">
                    觸控/點擊
                  </div>
                  <span>在螢幕左側點擊向左，右側點擊向右</span>
                </div>
              </div>
            </div>
          </div>

          {/* 遊戲規則 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200 mt-6">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">📖 遊戲規則</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="text-2xl">👶</span>
                <span>小朋友會自動向下踩樓梯，你需要快速按鍵控制他左右移動</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">🎯</span>
                <span>每踩對一個平台就得 1 分，連續踩對可累積 combo 加分</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <span>踩到障礙物（球、熊、積木）或踩空就會 Game Over</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">🔥</span>
                <span>分數越高難度越大，樓梯速度會加快，障礙物會增多</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">⭐</span>
                <span>挑戰最高分，看看你能帶小朋友衝到第幾級樓梯！</span>
              </li>
            </ul>
          </div>

          {/* 難度提示 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200 mt-6">
            <h2 className="text-2xl font-bold text-green-700 mb-4">💪 難度等級</h2>
            <div className="space-y-2 text-gray-700 text-sm">
              <p>🥉 初級 (0-10 分): 速度 100 px/s, 障礙物機率 12%</p>
              <p>🥈 中級 (10-30 分): 速度 120 px/s, 障礙物機率 25%</p>
              <p>🥇 高級 (30-60 分): 速度 150 px/s, 障礙物機率 35%</p>
              <p>🔥 瘋狂 (60-100+ 分): 速度 180-220 px/s, 障礙物機率 42-50%</p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
