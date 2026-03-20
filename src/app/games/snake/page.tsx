"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Container from "@/components/common/Container";

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 }; // UP

type Point = { x: number; y: number };
type Difficulty = 'EASY' | 'NORMAL';

const DIFFICULTY_CONFIG = {
  EASY: { initialSpeed: 250, minSpeed: 80, speedStep: 5 },
  NORMAL: { initialSpeed: 150, minSpeed: 50, speedStep: 10 }
};

export default function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');

  const directionRef = useRef(INITIAL_DIRECTION);
  const nextDirectionRef = useRef(INITIAL_DIRECTION);
  const touchStartRef = useRef<Point | null>(null);

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

  const changeDirection = useCallback((dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (gameOver || isPaused) return;
    const currentDir = directionRef.current;
    switch (dir) {
      case "UP":
        if (currentDir.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
        break;
      case "DOWN":
        if (currentDir.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
        break;
      case "LEFT":
        if (currentDir.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
        break;
      case "RIGHT":
        if (currentDir.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
        break;
    }
  }, [gameOver, isPaused]);

  // Touch handlers for mobile gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 30) { // Threshold
      if (absX > absY) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  };

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
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          changeDirection("UP");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          changeDirection("DOWN");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          changeDirection("LEFT");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          changeDirection("RIGHT");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameOver, changeDirection]);

  useEffect(() => {
    if (gameOver || isPaused) return;
    const moveSnake = () => {
      setSnake((prevSnake) => {
        const currentDir = nextDirectionRef.current;
        directionRef.current = currentDir;
        const head = prevSnake[0];
        
        // Wrap-around logic
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
    
    const config = DIFFICULTY_CONFIG[difficulty];
    const currentSpeed = Math.max(config.minSpeed, config.initialSpeed - Math.floor(score / 50) * config.speedStep);
    const intervalId = setInterval(moveSnake, currentSpeed);
    return () => clearInterval(intervalId);
  }, [food, gameOver, isPaused, score, difficulty, generateFood]);

  return (
    <div className="py-12 sm:py-16">
      <Container size="md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 flex items-center justify-center gap-3 text-4xl font-extrabold text-green-600 sm:text-5xl">
            <span className="i-ph-snake-duotone" /> Snake
          </h1>
          <p className="text-gray-600">Now with wrap-around walls! Use Arrows, WASD, or Swipe on mobile.</p>
        </div>

        <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-3xl bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-6 flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Score</span>
                <span className="text-3xl font-black text-gray-800">{score}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Difficulty</span>
                <div className="flex overflow-hidden rounded-lg bg-gray-100 p-1">
                  <button
                    onClick={() => { setDifficulty('EASY'); resetGame(); }}
                    className={`px-3 py-1 text-xs font-bold transition ${difficulty === 'EASY' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    EASY
                  </button>
                  <button
                    onClick={() => { setDifficulty('NORMAL'); resetGame(); }}
                    className={`px-3 py-1 text-xs font-bold transition ${difficulty === 'NORMAL' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    NORMAL
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={resetGame}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-200 active:scale-95 sm:w-auto"
            >
              <span className="i-ph-arrows-clockwise-duotone h-5 w-5" />
              Restart
            </button>
          </div>

          <div 
            className="relative w-full overflow-hidden rounded-xl border-4 border-gray-100 bg-gray-50 shadow-inner md:max-w-[500px]"
            style={{ 
              aspectRatio: '1 / 1',
              touchAction: 'none' // Prevent scrolling while playing
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Food */}
            <div
              className="absolute rounded-full bg-red-500 shadow-sm"
              style={{
                width: '5%',
                height: '5%',
                left: `${food.x * 5}%`,
                top: `${food.y * 5}%`,
                transform: 'scale(0.8)',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)',
                zIndex: 5
              }}
            />

            {/* Snake */}
            {snake.map((segment, index) => {
              const isHead = index === 0;
              return (
                <div
                  key={`${segment.x}-${segment.y}-${index}`}
                  className={`absolute rounded-sm ${isHead ? 'bg-green-600 z-10' : 'bg-green-400'}`}
                  style={{
                    width: '5%',
                    height: '5%',
                    left: `${segment.x * 5}%`,
                    top: `${segment.y * 5}%`,
                    transform: isHead ? 'scale(1.05)' : 'scale(0.9)',
                    transition: 'left 0.1s linear, top 0.1s linear'
                  }}
                >
                  {isHead && (
                    <div className="relative h-full w-full">
                      <div className="absolute left-[20%] top-[20%] h-[20%] w-[20%] rounded-full bg-white/80" />
                      <div className="absolute right-[20%] top-[20%] h-[20%] w-[20%] rounded-full bg-white/80" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Overlays */}
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
                <p className="mt-2 font-medium text-gray-200">Press Space or Tap to resume</p>
                <button 
                  onClick={() => setIsPaused(false)}
                  className="mt-6 rounded-lg bg-white/20 px-6 py-2 font-bold hover:bg-white/30"
                >
                  Resume
                </button>
              </div>
            )}
          </div>

          {/* D-Pad Controls (Better visible for touch users) */}
          <div className="mt-8 grid grid-cols-3 gap-2 sm:hidden">
            <div />
            <button
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 shadow-sm active:bg-gray-200 active:scale-95 active:bg-green-100 active:text-green-600"
              onClick={() => changeDirection("UP")}
              aria-label="Up"
            >
              <span className="i-ph-caret-up-bold text-3xl" />
            </button>
            <div />
            <button
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 shadow-sm active:bg-gray-200 active:scale-95 active:bg-green-100 active:text-green-600"
              onClick={() => changeDirection("LEFT")}
              aria-label="Left"
            >
              <span className="i-ph-caret-left-bold text-3xl" />
            </button>
            <button
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 shadow-sm active:bg-gray-200 active:scale-95 active:bg-green-100 active:text-green-600"
              onClick={() => changeDirection("DOWN")}
              aria-label="Down"
            >
              <span className="i-ph-caret-down-bold text-3xl" />
            </button>
            <button
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 shadow-sm active:bg-gray-200 active:scale-95 active:bg-green-100 active:text-green-600"
              onClick={() => changeDirection("RIGHT")}
              aria-label="Right"
            >
              <span className="i-ph-caret-right-bold text-3xl" />
            </button>
          </div>
          
          <div className="mt-6 hidden text-center text-sm text-gray-400 sm:block">
            Tip: Use Arrow keys or WASD to control. Space to pause.
          </div>
        </div>
      </Container>
    </div>
  );
}