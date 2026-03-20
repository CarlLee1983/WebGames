"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Container from "@/components/common/Container";
import {
  BUBBLE_RADIUS,
  BUBBLE_DIAMETER,
  COLS,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  MAX_ROWS,
  COLORS,
  Bubble,
  FlyingBubble,
  getBubbleX,
  getBubbleY,
  getGridPos,
  distance,
  findMatches,
  findFloating
} from "./utils";

export default function PuzzleBobbleGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [, setBoardState] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [shotsFired, setShotsFired] = useState(0);

  // Refs for physics and animation
  const flyingBubbleRef = useRef<FlyingBubble | null>(null);
  const nextColorRef = useRef<string>(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const currentColorRef = useRef<string>(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const angleRef = useRef<number>(Math.PI / 2); // pointing straight up
  const boardRef = useRef<Bubble[]>([]);

  // Initialize board
  const initBoard = useCallback(() => {
    const initialRows = 5;
    const newBoard: Bubble[] = [];
    for (let r = 0; r < initialRows; r++) {
      const cols = r % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < cols; c++) {
        newBoard.push({
          row: r,
          col: c,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }
    setBoardState(newBoard);
    boardRef.current = newBoard;
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    setShotsFired(0);
    currentColorRef.current = COLORS[Math.floor(Math.random() * COLORS.length)];
    nextColorRef.current = COLORS[Math.floor(Math.random() * COLORS.length)];
    flyingBubbleRef.current = null;
  }, []);

  useEffect(() => {
    initBoard();
  }, [initBoard]);

  const dropCeiling = useCallback(() => {
    const newBoard = boardRef.current.map(b => ({ ...b, row: b.row + 1 }));
    // Add a new row at the top
    for (let c = 0; c < COLS; c++) {
      newBoard.push({
        row: 0,
        col: c,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
    
    boardRef.current = newBoard;
    setBoardState(newBoard);
    
    // Check if any bubble crossed the bottom line
    if (newBoard.some(b => getBubbleY(b.row) > BOARD_HEIGHT - BUBBLE_DIAMETER * 2)) {
      setGameOver(true);
    }
  }, []);

  // Main game loop
  useEffect(() => {
    let animationId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // Draw background/grid (optional)
      ctx.fillStyle = "#1e293b"; // slate-800
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // Draw bubbles on board
      boardRef.current.forEach(b => {
        const cx = getBubbleX(b.row, b.col);
        const cy = getBubbleY(b.row);
        drawBubble(ctx, cx, cy, b.color);
      });

      // Draw cannon / aiming line
      const cannonX = BOARD_WIDTH / 2;
      const cannonY = BOARD_HEIGHT - BUBBLE_RADIUS;
      
      if (!gameOver && !gameWon) {
        // Draw aiming dotted line
        ctx.beginPath();
        ctx.setLineDash([5, 10]);
        ctx.moveTo(cannonX, cannonY);
        ctx.lineTo(
          cannonX + Math.cos(angleRef.current) * 150,
          cannonY - Math.sin(angleRef.current) * 150
        );
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw current bubble
        if (!flyingBubbleRef.current) {
          drawBubble(ctx, cannonX, cannonY, currentColorRef.current);
        }

        // Draw next bubble preview
        drawBubble(ctx, cannonX - 60, cannonY, nextColorRef.current);
        ctx.fillStyle = "white";
        ctx.font = "12px sans-serif";
        ctx.fillText("NEXT", cannonX - 75, cannonY + 30);
      }

      // Handle flying bubble physics
      const flying = flyingBubbleRef.current;
      if (flying) {
        flying.x += flying.vx;
        flying.y -= flying.vy; // subtract because y is inverted in screen coords

        // Wall collisions
        if (flying.x - BUBBLE_RADIUS <= 0) {
          flying.x = BUBBLE_RADIUS;
          flying.vx *= -1;
        } else if (flying.x + BUBBLE_RADIUS >= BOARD_WIDTH) {
          flying.x = BOARD_WIDTH - BUBBLE_RADIUS;
          flying.vx *= -1;
        }

        let snapped = false;

        // Ceiling collision
        if (flying.y - BUBBLE_RADIUS <= 0) {
          flying.y = BUBBLE_RADIUS;
          snapped = true;
        } else {
          // Bubble collisions
          for (const b of boardRef.current) {
            const bx = getBubbleX(b.row, b.col);
            const by = getBubbleY(b.row);
            if (distance(flying.x, flying.y, bx, by) <= BUBBLE_DIAMETER - 2) {
              snapped = true;
              break;
            }
          }
        }

        if (snapped) {
          const { row, col } = getGridPos(flying.x, flying.y);
          
          // Check if spot is occupied, if so, move down
          let finalRow = row;
          const finalCol = col;
          while (boardRef.current.some(b => b.row === finalRow && b.col === finalCol)) {
            finalRow++;
          }

          const newBubble = { row: finalRow, col: finalCol, color: flying.color };
          const newBoard = [...boardRef.current, newBubble];
          
          // Check matches
          const matches = findMatches(newBoard, newBubble);
          if (matches.length >= 3) {
            const matchKeys = new Set(matches.map(m => `${m.row},${m.col}`));
            let filteredBoard = newBoard.filter(b => !matchKeys.has(`${b.row},${b.col}`));
            
            // Check floating
            const floating = findFloating(filteredBoard);
            const floatingKeys = new Set(floating.map(f => `${f.row},${f.col}`));
            filteredBoard = filteredBoard.filter(b => !floatingKeys.has(`${b.row},${b.col}`));
            
            boardRef.current = filteredBoard;
            setBoardState(filteredBoard);
            setScore(s => s + matches.length * 10 + floating.length * 20);

            if (filteredBoard.length === 0) {
              setGameWon(true);
            }
          } else {
            boardRef.current = newBoard;
            setBoardState(newBoard);
          }

          flyingBubbleRef.current = null;
          
          // Next bubbles
          currentColorRef.current = nextColorRef.current;
          nextColorRef.current = COLORS[Math.floor(Math.random() * COLORS.length)];
          
          const newShots = shotsFired + 1;
          setShotsFired(newShots);
          if (newShots % 6 === 0) {
            dropCeiling();
          }

          // Game over check
          if (finalRow >= MAX_ROWS - 1) {
            setGameOver(true);
          }
        } else {
          drawBubble(ctx, flying.x, flying.y, flying.color);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gameOver, gameWon, shotsFired, dropCeiling]);

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    ctx.beginPath();
    ctx.arc(x, y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(x - 5, y - 5, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameOver || gameWon || flyingBubbleRef.current) return;
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const cannonX = BOARD_WIDTH / 2;
    const cannonY = BOARD_HEIGHT - BUBBLE_RADIUS;

    const dx = x - cannonX;
    const dy = cannonY - y; // y is inverted

    let angle = Math.atan2(dy, dx);
    // Clamp angle between 10 degrees and 170 degrees
    if (angle < 0.2) angle = 0.2;
    if (angle > Math.PI - 0.2) angle = Math.PI - 0.2;
    
    angleRef.current = angle;
  };

  const shoot = () => {
    if (gameOver || gameWon || flyingBubbleRef.current) return;

    const speed = 12;
    flyingBubbleRef.current = {
      x: BOARD_WIDTH / 2,
      y: BOARD_HEIGHT - BUBBLE_RADIUS,
      vx: Math.cos(angleRef.current) * speed,
      vy: Math.sin(angleRef.current) * speed,
      color: currentColorRef.current,
    };
  };

  return (
    <Container>
      <div className="max-w-2xl mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-600">
            Puzzle Bobble
          </h1>
          <div className="text-xl font-bold bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 shadow-inner">
            {score} <span className="text-fuchsia-400 text-sm">PTS</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 justify-center items-start">
          {/* Game Board */}
          <div 
            ref={containerRef}
            className="relative bg-slate-900 p-2 rounded-2xl shadow-2xl border-4 border-slate-800"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              className="rounded-lg cursor-crosshair block bg-slate-800"
              onMouseMove={handlePointerMove}
              onTouchMove={handlePointerMove}
              onClick={shoot}
              onTouchEnd={(e) => {
                e.preventDefault();
                shoot();
              }}
            />

            {/* Overlays */}
            {(gameOver || gameWon) && (
              <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex flex-col items-center justify-center z-10 p-6 backdrop-blur-sm animate-in fade-in duration-300">
                <div className={`text-5xl mb-2 i-ph-${gameWon ? 'trophy' : 'skull'}-duotone ${gameWon ? 'text-yellow-400' : 'text-red-500'}`} />
                <h2 className="text-4xl font-black text-white mb-2 tracking-wide">
                  {gameWon ? "STAGE CLEARED!" : "GAME OVER"}
                </h2>
                <p className="text-xl text-slate-300 mb-8 font-medium">Final Score: <span className="text-fuchsia-400 font-bold">{score}</span></p>
                
                <button
                  onClick={initBoard}
                  className="px-8 py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-full shadow-lg hover:shadow-fuchsia-500/50 transition-all active:scale-95 flex items-center gap-2 text-lg"
                >
                  <div className="i-ph-arrow-counter-clockwise-bold" />
                  Play Again
                </button>
              </div>
            )}
          </div>

          {/* Instructions Panel */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 w-full md:w-64">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <div className="i-ph-info-duotone text-fuchsia-400" />
              How to Play
            </h3>
            <ul className="space-y-3 text-slate-300 text-sm">
              <li className="flex items-start gap-2">
                <div className="i-ph-mouse-left-duotone text-lg shrink-0 mt-0.5" />
                <span>Move mouse or swipe to aim the cannon.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="i-ph-target-duotone text-lg shrink-0 mt-0.5" />
                <span>Click or tap to shoot the bubble.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="i-ph-circles-three-duotone text-lg shrink-0 mt-0.5" />
                <span>Match 3 or more of the same color to pop them.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="i-ph-arrow-down-duotone text-lg shrink-0 mt-0.5 text-red-400" />
                <span>Ceiling lowers every 6 shots! Don&apos;t let bubbles reach the bottom.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Container>
  );
}
