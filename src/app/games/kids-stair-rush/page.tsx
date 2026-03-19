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
          } else if (state.mode === "playing") {
            stateRef.current = togglePause(state);
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
    <div className="py-8 sm:py-12">
      <Container size="lg">
        {/* 標題 */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <i className="i-ph-arrow-fat-lines-down-duotone text-5xl text-rose-500" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-rose-500 to-yellow-500 bg-clip-text text-transparent">
              小朋友下樓梯 (NS-Shaft)
            </h1>
          </div>
          <p className="text-lg text-gray-600">經典重現，持續向下跳躍閃避天花板！</p>
        </div>

        {/* 遊戲區域 */}
        <div className="flex justify-center">
          <div className="relative bg-[#1e1e24] rounded-3xl shadow-2xl p-4 overflow-hidden" style={{width: CANVAS_WIDTH + 32}}>
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block bg-black rounded-lg shadow-lg mx-auto"
            />
          </div>
        </div>

        {/* 控制說明 */}
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-2xl p-6 border-2 border-rose-200">
            <h2 className="text-2xl font-bold text-rose-700 mb-4">🎮 遊戲控制</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700">
              <div className="flex items-center gap-3">
                <div className="bg-rose-500 text-white font-bold px-3 py-2 rounded-lg text-sm">
                  SPACE
                </div>
                <span>開始 / 重新開始</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-rose-500 text-white font-bold px-3 py-2 rounded-lg text-sm">
                  ← → 或 A D
                </div>
                <span>左右移動</span>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-500 text-white font-bold px-3 py-2 rounded-lg text-sm">
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
                <span className="text-2xl">🏃</span>
                <span>控制角色左右移動，不斷踩在平台上下降，避免被螢幕上方的釘板刺死。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">💚</span>
                <span>踩到普通平台 (綠色/藍色輸送帶) 可以恢復生命值 1 格。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <span>踩到釘板平台 (銀色) 會失去 5 格生命值。掉出畫面下方或生命值歸零則 Game Over。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <span>留意彈簧 (黃色) 會把你彈飛，翻轉板 (紅色) 踩上去一下子就會消失！</span>
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </div>
  );
}
