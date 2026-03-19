"use client";

import { useState, useEffect, useCallback } from "react";
import Container from "@/components/common/Container";
import { generateSudoku, findErrors, isGridFull } from "./utils";

type Difficulty = 'easy' | 'medium' | 'hard';
type Grid = (number | null)[][];

export default function SudokuGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [puzzle, setPuzzle] = useState<Grid>(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [grid, setGrid] = useState<Grid>(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [selectedCell, setSelectedCell] = useState<{ r: number, c: number } | null>(null);
  const [errors, setErrors] = useState<{ r: number, c: number }[]>([]);
  const [isSolved, setIsSolved] = useState(false);

  const initGame = useCallback((diff: Difficulty) => {
    const { puzzle } = generateSudoku(diff);
    setPuzzle(puzzle);
    // 深拷貝 puzzle 給 grid
    setGrid(puzzle.map(row => [...row]));
    setErrors([]);
    setIsSolved(false);
    setSelectedCell(null);
  }, []);

  // 初始載入遊戲
  useEffect(() => {
    initGame(difficulty);
  }, [difficulty, initGame]);

  const handleCellClick = (r: number, c: number) => {
    if (isSolved) return;
    setSelectedCell({ r, c });
  };

  const handleInput = useCallback((num: number | null) => {
    if (isSolved || !selectedCell) return;
    const { r, c } = selectedCell;

    // 如果該格是原始題目，不允許修改
    if (puzzle[r][c] !== null) return;

    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = num;
    setGrid(newGrid);

    const newErrors = findErrors(newGrid);
    setErrors(newErrors);

    if (newErrors.length === 0 && isGridFull(newGrid)) {
      setIsSolved(true);
    }
  }, [grid, isSolved, puzzle, selectedCell]);

  // 鍵盤輸入監聽
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSolved) return;

      if (e.key >= '1' && e.key <= '9') {
        handleInput(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleInput(null);
      } else if (selectedCell) {
        // 方向鍵導航
        let { r, c } = selectedCell;
        if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
        if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
        if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
        if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
        
        if (r !== selectedCell.r || c !== selectedCell.c) {
          setSelectedCell({ r, c });
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInput, isSolved, selectedCell]);


  const isCellSelected = (r: number, c: number) => selectedCell?.r === r && selectedCell?.c === c;
  const isCellError = (r: number, c: number) => errors.some(e => e.r === r && e.c === c);
  const getSameNumberHighlight = (r: number, c: number) => {
    if (!selectedCell) return false;
    const selectedVal = grid[selectedCell.r][selectedCell.c];
    return selectedVal !== null && grid[r][c] === selectedVal;
  };

  return (
    <div className="py-12 sm:py-16">
      <Container size="md">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="mb-2 flex items-center gap-3 text-4xl font-extrabold text-blue-800 sm:text-5xl">
              <span className="i-ph-grid-nine-duotone" /> Sudoku
            </h1>
            <p className="text-gray-600">Fill the grid so every row, column, and 3x3 box contains 1-9.</p>
          </div>
          
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
                  difficulty === d 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl bg-white p-6 shadow-xl sm:p-8">
          
          {/* Game Board */}
          <div className="relative mb-8 w-full select-none" style={{ aspectRatio: '1/1' }}>
            <div className="grid h-full w-full grid-cols-9 grid-rows-9 border-4 border-gray-800 bg-gray-800 gap-[1px]">
              {grid.map((row, r) => 
                row.map((cell, c) => {
                  const isOriginal = puzzle[r][c] !== null;
                  const isSelected = isCellSelected(r, c);
                  const isError = isCellError(r, c);
                  const isSameNumber = getSameNumberHighlight(r, c);
                  
                  // 計算 3x3 區塊的粗邊框
                  const borderRight = c === 2 || c === 5 ? 'border-r-4 border-gray-800' : '';
                  const borderBottom = r === 2 || r === 5 ? 'border-b-4 border-gray-800' : '';
                  
                  // 背景色邏輯
                  let bgClass = 'bg-white';
                  if (isSelected) bgClass = 'bg-blue-200';
                  else if (isError) bgClass = 'bg-red-100';
                  else if (isSameNumber) bgClass = 'bg-blue-50';
                  
                  // 文字顏色邏輯
                  let textClass = 'text-gray-900';
                  if (isError) textClass = 'text-red-600';
                  else if (!isOriginal) textClass = 'text-blue-600 font-light';

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      className={`flex items-center justify-center text-xl sm:text-2xl font-bold cursor-pointer transition-colors
                        ${bgClass} ${textClass} ${borderRight} ${borderBottom}
                        ${!isOriginal && !isSolved ? 'hover:bg-blue-100' : ''}
                      `}
                    >
                      {cell || ''}
                    </div>
                  );
                })
              )}
            </div>

            {/* Success Overlay */}
            {isSolved && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-500">
                <div className="i-ph-confetti-duotone mb-4 h-20 w-20 text-yellow-500" />
                <h2 className="mb-2 text-4xl font-black text-blue-600">Excellent!</h2>
                <p className="mb-6 font-medium text-gray-600">You solved the {difficulty} puzzle.</p>
                <button
                  onClick={() => initGame(difficulty)}
                  className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:-translate-y-1 hover:bg-blue-700 active:scale-95"
                >
                  Play Again
                </button>
              </div>
            )}
          </div>

          {/* Virtual Numpad */}
          <div className="w-full">
            <div className="grid grid-cols-5 gap-2 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handleInput(num)}
                  disabled={isSolved}
                  className="flex h-12 items-center justify-center rounded-xl bg-gray-100 text-xl font-bold text-gray-800 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 active:scale-95 disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleInput(null)}
                disabled={isSolved}
                className="flex h-12 items-center justify-center rounded-xl bg-red-50 text-red-600 shadow-sm transition hover:bg-red-100 active:scale-95 disabled:opacity-50"
                title="Erase"
              >
                <span className="i-ph-eraser-duotone h-6 w-6" />
              </button>
            </div>
            
            <div className="mt-6 flex justify-center">
               <button
                onClick={() => initGame(difficulty)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-2.5 font-bold text-gray-600 shadow-sm transition hover:bg-gray-50 active:scale-95"
              >
                <span className="i-ph-arrows-clockwise-duotone h-5 w-5" />
                New {difficulty} Game
              </button>
            </div>
          </div>
          
        </div>
      </Container>
    </div>
  );
}