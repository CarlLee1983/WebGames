"use client";

import { useState, useCallback } from "react";
import Container from "@/components/common/Container";

const BOARD_SIZE = 15;
type Player = 'black' | 'white';
type Cell = Player | null;

export default function GomokuGame() {
  const [board, setBoard] = useState<Cell[][]>(
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
  );
  const [isBlackNext, setIsBlackNext] = useState(true);
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [history, setHistory] = useState<Cell[][][]>([]);

  const checkWinner = (row: number, col: number, player: Player, currentBoard: Cell[][]) => {
    const directions = [
      [0, 1],  // Horizontal
      [1, 0],  // Vertical
      [1, 1],  // Diagonal \
      [1, -1], // Diagonal /
    ];

    for (const [dr, dc] of directions) {
      let count = 1;

      // Check forward
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && currentBoard[r][c] === player) {
          count++;
        } else {
          break;
        }
      }

      // Check backward
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && currentBoard[r][c] === player) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) return true;
    }
    return false;
  };

  const placeStone = (row: number, col: number) => {
    if (board[row][col] || winner) return;

    const currentPlayer = isBlackNext ? 'black' : 'white';
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;

    setHistory([...history, board.map(r => [...r])]);
    setBoard(newBoard);

    if (checkWinner(row, col, currentPlayer, newBoard)) {
      setWinner(currentPlayer);
    } else if (newBoard.every(r => r.every(c => c !== null))) {
      setWinner('draw');
    } else {
      setIsBlackNext(!isBlackNext);
    }
  };

  const resetGame = () => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)));
    setIsBlackNext(true);
    setWinner(null);
    setHistory([]);
  };

  const undoMove = () => {
    if (history.length === 0 || winner) return;
    const previousBoard = history[history.length - 1];
    setBoard(previousBoard);
    setHistory(history.slice(0, -1));
    setIsBlackNext(!isBlackNext);
  };

  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        <div className="mb-8 text-center">
          <h1 className="mb-2 flex items-center justify-center gap-3 text-4xl font-extrabold text-amber-800 sm:text-5xl">
            <span className="i-ph-circle-duotone" /> Gomoku
          </h1>
          <p className="text-gray-600">Get five in a row to win. Black starts first.</p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-center">
          {/* Game Info Panel (Mobile top, Desktop left/right) */}
          <div className="order-2 flex flex-col gap-4 lg:order-1 lg:w-48">
            <div className={`rounded-2xl p-4 shadow-sm border-2 ${isBlackNext && !winner ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-white'}`}>
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-black shadow-md" />
                <span className="font-bold text-gray-800">Black</span>
              </div>
              {isBlackNext && !winner && <p className="mt-1 text-xs font-bold text-amber-600 uppercase">Your Turn</p>}
            </div>
            <div className={`rounded-2xl p-4 shadow-sm border-2 ${!isBlackNext && !winner ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-white'}`}>
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white border border-gray-200 shadow-md" />
                <span className="font-bold text-gray-800">White</span>
              </div>
              {!isBlackNext && !winner && <p className="mt-1 text-xs font-bold text-amber-600 uppercase">Your Turn</p>}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={undoMove}
                disabled={history.length === 0 || !!winner}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm border border-gray-200 transition hover:bg-gray-50 disabled:opacity-50 active:scale-95"
              >
                <span className="i-ph-arrow-u-up-left-bold" /> Undo
              </button>
              <button
                onClick={resetGame}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700 shadow-sm border border-amber-200 transition hover:bg-amber-200 active:scale-95"
              >
                <span className="i-ph-arrows-clockwise-bold" /> Reset
              </button>
            </div>
          </div>

          {/* Board Container */}
          <div className="order-1 flex items-center justify-center lg:order-2">
            <div className="relative rounded-lg bg-[#e6b36e] p-4 shadow-2xl border-8 border-[#c99a5a]">
              <div 
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                  width: 'min(85vw, 600px)',
                  aspectRatio: '1 / 1'
                }}
              >
                {board.map((row, rIdx) => 
                  row.map((cell, cIdx) => (
                    <div 
                      key={`${rIdx}-${cIdx}`}
                      className="relative flex items-center justify-center cursor-pointer group"
                      onClick={() => placeStone(rIdx, cIdx)}
                    >
                      {/* Grid Lines */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Horizontal Line */}
                        <div className={`absolute top-1/2 left-0 right-0 h-0.5 bg-black/20 ${cIdx === 0 ? 'left-1/2' : ''} ${cIdx === BOARD_SIZE - 1 ? 'right-1/2' : ''}`} />
                        {/* Vertical Line */}
                        <div className={`absolute left-1/2 top-0 bottom-0 w-0.5 bg-black/20 ${rIdx === 0 ? 'top-1/2' : ''} ${rIdx === BOARD_SIZE - 1 ? 'bottom-1/2' : ''}`} />
                      </div>

                      {/* Small Dots (traditional Go board markings) */}
                      {((rIdx === 3 || rIdx === 7 || rIdx === 11) && (cIdx === 3 || cIdx === 7 || cIdx === 11)) && (
                        <div className="absolute h-1.5 w-1.5 rounded-full bg-black/40 z-0" />
                      )}

                      {/* Hover Indicator */}
                      {!cell && !winner && (
                        <div className={`absolute h-4/5 w-4/5 rounded-full opacity-0 transition-opacity group-hover:opacity-30 ${isBlackNext ? 'bg-black' : 'bg-white'}`} />
                      )}

                      {/* Stone */}
                      {cell && (
                        <div 
                          className={`relative z-10 h-4/5 w-4/5 rounded-full shadow-lg transition-transform duration-300 scale-100 animate-in zoom-in-50 ${
                            cell === 'black' 
                              ? 'bg-gradient-to-br from-gray-700 to-black' 
                              : 'bg-gradient-to-br from-gray-100 to-white border border-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Winner Overlay */}
              {winner && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 rounded-sm text-white backdrop-blur-sm animate-in fade-in duration-500">
                  <div className={`mb-4 h-20 w-20 rounded-full shadow-2xl ${
                    winner === 'black' ? 'bg-black' : winner === 'white' ? 'bg-white' : 'bg-gray-400'
                  }`} />
                  <h2 className="mb-2 text-4xl font-black italic tracking-tighter">
                    {winner === 'draw' ? "IT'S A DRAW!" : `${winner.toUpperCase()} WINS!`}
                  </h2>
                  <p className="mb-8 text-lg text-gray-200 font-medium">Excellent game of strategy.</p>
                  <button
                    onClick={resetGame}
                    className="rounded-xl bg-amber-500 px-8 py-3 font-bold text-white shadow-xl shadow-amber-500/30 transition hover:-translate-y-1 hover:bg-amber-600 active:scale-95"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}