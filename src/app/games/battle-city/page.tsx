"use client";

import { useCallback, useEffect, useRef } from "react";
import Container from "@/components/common/Container";
import {
  GameState,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  createInitialState,
  setPlayerInput,
  shootBullet,
  tick,
  togglePause,
  startGame,
  restartGame,
} from "./utils";
import { getMap } from "./maps";
import { drawScene } from "./renderer";

export default function BattleCityPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const lastTimeRef = useRef<number>(0);

  const gameLoop = useCallback(() => {
    const now = performance.now();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = now;
    }

    const deltaMs = Math.min(now - lastTimeRef.current, 33.33 * 2);
    lastTimeRef.current = now;

    // Update game state
    stateRef.current = tick(stateRef.current, deltaMs);

    // Draw scene
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        drawScene(ctx, stateRef.current);
      }
    }
  }, []);

  // rAF loop
  useEffect(() => {
    let animationFrameId: number;

    const rafLoop = () => {
      gameLoop();
      animationFrameId = requestAnimationFrame(rafLoop);
    };

    animationFrameId = requestAnimationFrame(rafLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameLoop]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (stateRef.current.mode === "menu") {
            stateRef.current = startGame(stateRef.current);
            lastTimeRef.current = 0;
          } else if (stateRef.current.mode === "gameOver") {
            stateRef.current = restartGame();
            lastTimeRef.current = 0;
            stateRef.current = startGame(stateRef.current);
          } else if (stateRef.current.mode === "stageComplete") {
            const nextStage = stateRef.current.stage + 1;
            const map = getMap(nextStage);
            stateRef.current = {
              ...stateRef.current,
              stage: nextStage,
              mapGrid: map.grid,
              brickHealth: map.grid.map((row) => row.map((tile) => (tile === 1 ? 1 : 0))),
              baseDestroyed: false,
              enemyQueue: ["basic", "basic", "fast", "basic", "armored", "basic", "basic", "fast"],
              enemiesDefeated: 0,
            };
            stateRef.current = startGame(stateRef.current);
            lastTimeRef.current = 0;
          } else if (stateRef.current.mode === "playing" || stateRef.current.mode === "paused") {
            stateRef.current = togglePause(stateRef.current);
          }
          break;

        case "p":
        case "P":
          e.preventDefault();
          if (stateRef.current.mode === "playing" || stateRef.current.mode === "paused") {
            stateRef.current = togglePause(stateRef.current);
          }
          break;

        case "w":
        case "W":
        case "ArrowUp":
          e.preventDefault();
          stateRef.current = setPlayerInput(stateRef.current, "UP");
          break;

        case "s":
        case "S":
        case "ArrowDown":
          e.preventDefault();
          stateRef.current = setPlayerInput(stateRef.current, "DOWN");
          break;

        case "a":
        case "A":
        case "ArrowLeft":
          e.preventDefault();
          stateRef.current = setPlayerInput(stateRef.current, "LEFT");
          break;

        case "d":
        case "D":
        case "ArrowRight":
          e.preventDefault();
          stateRef.current = setPlayerInput(stateRef.current, "RIGHT");
          break;

        case "Enter":
          e.preventDefault();
          stateRef.current = shootBullet(stateRef.current);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Stop movement when key is released
      if (
        ["w", "W", "s", "S", "a", "A", "d", "D", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.key
        )
      ) {
        stateRef.current = setPlayerInput(stateRef.current, "none");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <Container>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-yellow-400">Battle City</h1>
          <p className="text-gray-400 mt-2">Retro Tank Warfare Game</p>
        </div>

        <div className="flex flex-col gap-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-4 border-gray-700 bg-black"
            style={{ imageRendering: "crisp-edges" }}
          />

          <div className="text-center text-gray-400 text-sm hidden sm:block">
            <p className="font-mono">
              <span className="text-yellow-400">W/A/S/D</span> or{" "}
              <span className="text-yellow-400">Arrow Keys</span> to move
            </p>
            <p className="font-mono">
              <span className="text-yellow-400">ENTER</span> to shoot
            </p>
            <p className="font-mono">
              <span className="text-yellow-400">SPACE</span> to start/resume
            </p>
            <p className="font-mono">
              <span className="text-yellow-400">P</span> to pause
            </p>
          </div>

          {/* Mobile Controls */}
          <div className="mt-6 flex flex-col gap-4 sm:hidden">
            {/* Movement D-pad */}
            <div className="grid grid-cols-3 gap-2">
              <div />
              <button
                className="flex h-14 w-14 items-center justify-center rounded-lg bg-yellow-600 text-white shadow-md active:bg-yellow-700 active:scale-95 transition"
                onClick={() => stateRef.current = setPlayerInput(stateRef.current, "UP")}
                onTouchStart={() => stateRef.current = setPlayerInput(stateRef.current, "UP")}
                onTouchEnd={() => stateRef.current = setPlayerInput(stateRef.current, "none")}
                aria-label="Up"
              >
                <span className="i-ph-caret-up-bold text-xl" />
              </button>
              <div />
              <button
                className="flex h-14 w-14 items-center justify-center rounded-lg bg-yellow-600 text-white shadow-md active:bg-yellow-700 active:scale-95 transition"
                onClick={() => stateRef.current = setPlayerInput(stateRef.current, "LEFT")}
                onTouchStart={() => stateRef.current = setPlayerInput(stateRef.current, "LEFT")}
                onTouchEnd={() => stateRef.current = setPlayerInput(stateRef.current, "none")}
                aria-label="Left"
              >
                <span className="i-ph-caret-left-bold text-xl" />
              </button>
              <button
                className="flex h-14 w-14 items-center justify-center rounded-lg bg-yellow-600 text-white shadow-md active:bg-yellow-700 active:scale-95 transition"
                onClick={() => stateRef.current = setPlayerInput(stateRef.current, "DOWN")}
                onTouchStart={() => stateRef.current = setPlayerInput(stateRef.current, "DOWN")}
                onTouchEnd={() => stateRef.current = setPlayerInput(stateRef.current, "none")}
                aria-label="Down"
              >
                <span className="i-ph-caret-down-bold text-xl" />
              </button>
              <button
                className="flex h-14 w-14 items-center justify-center rounded-lg bg-yellow-600 text-white shadow-md active:bg-yellow-700 active:scale-95 transition"
                onClick={() => stateRef.current = setPlayerInput(stateRef.current, "RIGHT")}
                onTouchStart={() => stateRef.current = setPlayerInput(stateRef.current, "RIGHT")}
                onTouchEnd={() => stateRef.current = setPlayerInput(stateRef.current, "none")}
                aria-label="Right"
              >
                <span className="i-ph-caret-right-bold text-xl" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-center">
              <button
                className="flex-1 rounded-lg bg-red-600 px-6 py-3 text-white font-bold shadow-md active:bg-red-700 active:scale-95 transition"
                onClick={() => stateRef.current = shootBullet(stateRef.current)}
              >
                SHOOT
              </button>
              <button
                className="rounded-lg bg-blue-600 px-6 py-3 text-white font-bold shadow-md active:bg-blue-700 active:scale-95 transition"
                onClick={() => stateRef.current = togglePause(stateRef.current)}
              >
                PAUSE
              </button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
