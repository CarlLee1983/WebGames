"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Container from "@/components/common/Container";
import { generateBoard, toggleLightsInPlace, checkIsSolved, solveLightsOut } from "./utils";

type Difficulty = 3 | 5 | 7;

export default function LightsOutGame() {
  const [size, setSize] = useState<Difficulty>(5);
  const [board, setBoard] = useState<boolean[][]>([]);
  const [moves, setMoves] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{r: number, c: number} | null>(null);
  const [hintCell, setHintCell] = useState<{r: number, c: number} | null>(null);

  const initGame = useCallback((gridSize: number) => {
    let newBoard;
    do {
      const shuffles = gridSize === 3 ? 10 : gridSize === 5 ? 25 : 50;
      newBoard = generateBoard(gridSize, shuffles);
    } while (checkIsSolved(newBoard));

    setBoard(newBoard);
    setMoves(0);
    setIsSolved(false);
    setHintCell(null);
  }, []);

  useEffect(() => {
    initGame(size);
  }, [initGame, size]);

  const handleCellClick = (r: number, c: number) => {
    if (isSolved || board.length === 0) return;

    const newBoard = board.map(row => [...row]);
    toggleLightsInPlace(newBoard, r, c, size);
    
    setBoard(newBoard);
    setMoves(m => m + 1);
    setHintCell(null); // 點擊後清除提示

    if (checkIsSolved(newBoard)) {
      setIsSolved(true);
    }
  };

  const showHint = () => {
    if (isSolved) return;
    const solution = solveLightsOut(board, size);
    if (solution) {
      // 尋找第一個需要點擊的格子
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (solution[r][c]) {
            setHintCell({r, c});
            return;
          }
        }
      }
    }
  };

  // 判斷某格是否在目前懸停格的十字連動範圍內
  const isInHoverRange = (r: number, c: number) => {
    if (!hoveredCell) return false;
    const { r: hr, c: hc } = hoveredCell;
    return (
      (r === hr && c === hc) ||
      (r === hr - 1 && c === hc) ||
      (r === hr + 1 && c === hc) ||
      (r === hr && c === hc - 1) ||
      (r === hr && c === hc + 1)
    );
  };

  if (board.length === 0) return null;

  return (
    <div className="py-12 sm:py-16 bg-slate-900 min-h-[calc(100vh-64px)] text-white">
      <Container size="md">
        <div className="mb-10 flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
          <div className="text-center sm:text-left">
            <h1 className="mb-2 flex items-center justify-center sm:justify-start gap-3 text-4xl font-extrabold text-yellow-400 sm:text-5xl">
              <span className="i-ph-lightbulb-filament-duotone" /> Lights Out
            </h1>
            <p className="text-slate-400 italic">Toggle the cross to clear all lights.</p>
          </div>
          
          <div className="flex gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
            {([3, 5, 7] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setSize(d)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  size === d 
                    ? 'bg-yellow-500 text-slate-900 shadow-md scale-105' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {d}x{d}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-lg flex-col items-center">
          
          <div className="w-full flex justify-between items-center mb-6 px-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Moves</span>
              <span className="text-3xl font-black text-slate-200 leading-none">{moves}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={showHint}
                disabled={isSolved}
                className="flex items-center gap-2 rounded-xl bg-blue-900/40 px-5 py-2.5 font-bold text-blue-300 shadow-sm border border-blue-700/50 transition hover:bg-blue-800/60 active:scale-95 disabled:opacity-30"
              >
                <span className="i-ph-magic-wand-bold h-5 w-5" />
                Hint
              </button>
              <button
                onClick={() => initGame(size)}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 font-bold text-slate-300 shadow-sm border border-slate-700 transition hover:bg-slate-700 active:scale-95"
              >
                <span className="i-ph-arrows-clockwise-bold h-5 w-5" />
                Reset
              </button>
            </div>
          </div>

          <div className="relative w-full rounded-2xl bg-slate-800 p-3 sm:p-5 shadow-2xl border border-slate-700/50">
            <div 
              className="grid gap-2 sm:gap-3"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                aspectRatio: '1/1'
              }}
              onMouseLeave={() => setHoveredCell(null)}
            >
              {board.map((row, r) => 
                row.map((isOn, c) => {
                  const isHoveredRange = isInHoverRange(r, c);
                  const isTargetHint = hintCell?.r === r && hintCell?.c === c;

                  return (
                    <button
                      key={`${r}-${c}`}
                      onMouseEnter={() => setHoveredCell({r, c})}
                      onClick={() => handleCellClick(r, c)}
                      disabled={isSolved}
                      className={`
                        relative w-full h-full rounded-xl sm:rounded-2xl transition-all duration-300
                        ${isOn 
                          ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6),inset_0_2px_4px_rgba(255,255,255,0.8)]' 
                          : 'bg-slate-900 shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] border border-slate-700/50'
                        }
                        ${!isSolved && isHoveredRange && 'ring-4 ring-white/30 brightness-110'}
                        ${isTargetHint && 'ring-4 ring-blue-500 animate-pulse scale-105 z-20'}
                        ${!isSolved && 'active:scale-90'}
                      `}
                    >
                      {isOn && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-40">
                           <div className="w-1/3 h-1/3 bg-white rounded-full blur-[2px]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {isSolved && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-2xl animate-in fade-in zoom-in duration-500">
                <div className="i-ph-moon-stars-duotone mb-4 h-24 w-24 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                <h2 className="mb-2 text-4xl font-black text-white">ALL LIGHTS OUT!</h2>
                <p className="mb-8 text-lg font-medium text-slate-300">
                  Great job! Solved in <span className="text-yellow-400 font-bold">{moves}</span> moves.
                </p>
                <button
                  onClick={() => initGame(size)}
                  className="rounded-xl bg-yellow-500 px-8 py-3 font-bold text-slate-900 shadow-lg shadow-yellow-500/20 transition hover:-translate-y-1 hover:bg-yellow-400 active:scale-95"
                >
                  New Game
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-slate-500 text-sm">
            <p>Hint: Hover over a cell to see the affected cross area.</p>
          </div>
        </div>
      </Container>
    </div>
  );
}