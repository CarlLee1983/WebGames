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

  // 將遊戲狀態同步到 UI（現在只用於觸發渲染）
  const commitSnapshot = useCallback(() => {
    // Canvas 會通過 gameLoop 自動更新
  }, []);

  // 主遊戲迴圈
  const gameLoop = useCallback(() => {
    const now = performance.now();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = now;
    }

    const deltaMs = Math.min(now - lastTimeRef.current, FRAME_MS * 2);
    lastTimeRef.current = now;

    // 更新遊戲狀態
    stateRef.current = tick(stateRef.current, deltaMs);
    commitSnapshot();

    // 繪製畫面
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        drawScene(ctx, stateRef.current);
      }
    }
  }, [commitSnapshot]);

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
            commitSnapshot();
          } else if (state.mode === "gameOver") {
            stateRef.current = restartGame();
            lastTimeRef.current = 0;
            commitSnapshot();
          } else if (state.mode === "playing") {
            stateRef.current = togglePause(state);
            commitSnapshot();
          }
          break;

        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          stateRef.current = movePlayer(state, "left");
          commitSnapshot();
          break;

        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          stateRef.current = movePlayer(state, "right");
          commitSnapshot();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commitSnapshot]);

  // 觸控事件（行動裝置）
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

      commitSnapshot();
    };

    canvas.addEventListener("touchstart", handleTouchStart);
    return () => canvas.removeEventListener("touchstart", handleTouchStart);
  }, [commitSnapshot]);

  // 遊戲測試用 window hooks
  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
      stateRef.current = tick(stateRef.current, ms);
      commitSnapshot();

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
  }, [commitSnapshot]);

  return (
    <div className="py-12 sm:py-16">
      <Container size="md">
        <div className="mb-8 flex items-center gap-3">
          <i className="i-ph-stairs-duotone text-4xl text-sky-500" />
          <h1 className="text-4xl font-bold">Kids Stair Rush</h1>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="mx-auto block bg-sky-100"
          />

          {/* 行動裝置按鈕 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
            <button
              onClick={() => {
                const state = stateRef.current;
                stateRef.current = movePlayer(state, "left");
                commitSnapshot();
              }}
              className="rounded-lg bg-blue-500 py-3 text-center font-semibold text-white active:bg-blue-600"
            >
              ← Left
            </button>
            <button
              onClick={() => {
                const state = stateRef.current;
                stateRef.current = movePlayer(state, "right");
                commitSnapshot();
              }}
              className="rounded-lg bg-blue-500 py-3 text-center font-semibold text-white active:bg-blue-600"
            >
              Right →
            </button>
          </div>

          {/* 鍵盤控制說明 */}
          <div className="mt-6 text-center text-sm text-gray-600">
            <p className="mb-2">
              <kbd className="rounded bg-gray-200 px-2 py-1">SPACE</kbd>
              {" - "}
              <span>Start / Restart / Pause</span>
            </p>
            <p>
              <kbd className="rounded bg-gray-200 px-2 py-1">← / A</kbd>
              {" / "}
              <kbd className="rounded bg-gray-200 px-2 py-1">→ / D</kbd>
              {" - "}
              <span>Move left / right</span>
            </p>
          </div>

          {/* 遊戲說明 */}
          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-gray-700">
            <p className="mb-2 font-semibold">How to play:</p>
            <ul className="space-y-1">
              <li>• 幫小朋友快速躲避樓梯上的障礙物</li>
              <li>• 踩錯平台或踩到障礙物 = Game Over</li>
              <li>• 難度隨著分數自動提升</li>
              <li>• 挑戰最高分吧！</li>
            </ul>
          </div>
        </div>
      </Container>
    </div>
  );
}
