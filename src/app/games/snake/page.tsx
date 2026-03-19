"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Container from "@/components/common/Container";

const GRID_SIZE = 20;
const CELL_SIZE = 30; // 放大尺寸
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 }; // UP
const INITIAL_SPEED = 150;
const MIN_SPEED = 50;

type Point = { x: number; y: number };

export default function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);

  const directionRef = useRef(INITIAL_DIRECTION);
  const nextDirectionRef = useRef(INITIAL_DIRECTION);

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      const onSnake = currentSnake.some(
        (segment) => segment.x === newFood.x && segment.y === newFood.y
      );
      if (!onSnake) break;
    }
    setFood(newFood);
  }, []);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    directionRef.current = INITIAL_DIRECTION;
    nextDirectionRef.current = INITIAL_DIRECTION;
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    generateFood(INITIAL_SNAKE);
  }, [generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (gameOver) return;
      if (e.key === " " || e.key === "Escape") {
        setIsPaused((p) => !p);
        return;
      }
      const currentDir = directionRef.current;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          if (currentDir.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
          break;
        case "ArrowDown":
        case "s":
        case "S":
          if (currentDir.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          if (currentDir.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
          break;
        case "ArrowRight":
        case "d":
        case "D":
          if (currentDir.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameOver]);

  useEffect(() => {
    if (gameOver || isPaused) return;
    const moveSnake = () => {
      setSnake((prevSnake) => {
        const currentDir = nextDirectionRef.current;
        directionRef.current = currentDir;
        const head = prevSnake[0];
        
        // 穿牆 (Wrap-around) 邏輯
        const newHead = {
          x: (head.x + currentDir.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + currentDir.y + GRID_SIZE) % GRID_SIZE,
        };

        if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
          setGameOver(true);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore((s) => s + 10);
          generateFood(newSnake);
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    };
    const currentSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(score / 50) * 10);
    const intervalId = setInterval(moveSnake, currentSpeed);
    return () => clearInterval(intervalId);
  }, [food, gameOver, isPaused, score, generateFood]);

  return (
    <div className="py-12 sm:py-16">
      <Container size="md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 flex items-center justify-center gap-3 text-4xl font-extrabold text-green-600 sm:text-5xl">
            <span className="i-ph-snake-duotone" /> Snake
          </h1>
          <p className="text-gray-600">Now with wrap-around walls! Use Arrows or WASD. Space to pause.</p>
        </div>

        <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-6 flex w-full max-w-[600px] items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Score</span>
              <span className="text-3xl font-black text-gray-800">{score}</span>
            </div>
            <button
              onClick={resetGame}
              className="flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-200 active:scale-95"
            >
              <span className="i-ph-arrows-clockwise-duotone h-5 w-5" />
              Restart
            </button>
          </div>

          <div 
            className="relative overflow-hidden rounded-xl border-4 border-gray-100 bg-gray-50 shadow-inner"
            style={{ 
              width: `${GRID_SIZE * CELL_SIZE}px`, 
              height: `${GRID_SIZE * CELL_SIZE}px`,
              maxWidth: '100%',
              aspectRatio: '1 / 1'
            }}
          >
            <div
              className="absolute rounded-full bg-red-500 shadow-sm"
              style={{
                width: `${CELL_SIZE}px`,
                height: `${CELL_SIZE}px`,
                left: `${food.x * CELL_SIZE}px`,
                top: `${food.y * CELL_SIZE}px`,
                transform: 'scale(0.8)',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)'
              }}
            />

            {snake.map((segment, index) => {
              const isHead = index === 0;
              return (
                <div
                  key={`${segment.x}-${segment.y}-${index}`}
                  className={`absolute rounded-sm ${isHead ? 'bg-green-600 z-10' : 'bg-green-400'}`}
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    left: `${segment.x * CELL_SIZE}px`,
                    top: `${segment.y * CELL_SIZE}px`,
                    transform: isHead ? 'scale(1.05)' : 'scale(0.9)',
                    transition: 'left 0.1s linear, top 0.1s linear'
                  }}
                >
                  {isHead && (
                    <div className="relative h-full w-full">
                      <div className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-white/80" />
                      <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white/80" />
                    </div>
                  )}
                </div>
              );
            })}

            {gameOver && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-sm">
                <div className="i-ph-skull-duotone mb-2 h-16 w-16 text-red-400" />
                <h2 className="mb-1 text-3xl font-black text-red-400">Game Over!</h2>
                <p className="mb-6 text-lg font-medium text-gray-200">Final Score: {score}</p>
                <button
                  onClick={resetGame}
                  className="rounded-xl bg-green-500 px-8 py-3 font-bold text-white shadow-lg shadow-green-500/30 transition hover:-translate-y-1 hover:bg-green-600 active:scale-95"
                >
                  Play Again
                </button>
              </div>
            )}
            
            {isPaused && !gameOver && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 text-white backdrop-blur-sm">
                <div className="i-ph-pause-circle-duotone mb-2 h-16 w-16 text-white/80" />
                <h2 className="text-3xl font-black tracking-widest text-white/90">PAUSED</h2>
                <p className="mt-2 font-medium text-gray-200">Press Space to resume</p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}