"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";

import Container from "@/components/common/Container";

import {
  type AiDifficulty,
  BOARD_SIZE,
  cloneBoard,
  createEmptyBoard,
  getComputerMove,
  getCurrentPlayer,
  playMove,
  type Board,
  type Player,
  type Winner,
} from "./utils";

type GameMode = "local" | "computer";

const DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

type HistoryEntry = {
  board: Board;
  isBlackNext: boolean;
};

type GameState = {
  board: Board;
  isBlackNext: boolean;
  winner: Winner;
  history: HistoryEntry[];
};

function createInitialGameState(): GameState {
  return {
    board: createEmptyBoard(),
    isBlackNext: true,
    winner: null,
    history: [],
  };
}

function clearScheduledAiMove(timeoutRef: MutableRefObject<number | null>) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

function buildNextGameState(previous: GameState, row: number, col: number, player: Player): GameState {
  if (previous.winner || getCurrentPlayer(previous.isBlackNext) !== player) {
    return previous;
  }

  const result = playMove(previous.board, row, col, player);

  if (!result) {
    return previous;
  }

  return {
    board: result.board,
    isBlackNext: result.winner ? previous.isBlackNext : !previous.isBlackNext,
    winner: result.winner,
    history: [
      ...previous.history,
      {
        board: cloneBoard(previous.board),
        isBlackNext: previous.isBlackNext,
      },
    ],
  };
}

function getUndoState(previous: GameState, gameMode: GameMode): GameState {
  if (previous.history.length === 0 || previous.winner) {
    return previous;
  }

  const movesToUndo =
    gameMode === "computer" ? (previous.isBlackNext ? Math.min(2, previous.history.length) : 1) : 1;
  const nextHistoryLength = previous.history.length - movesToUndo;
  const snapshot = previous.history[nextHistoryLength];

  if (!snapshot) {
    return createInitialGameState();
  }

  return {
    board: cloneBoard(snapshot.board),
    isBlackNext: snapshot.isBlackNext,
    winner: null,
    history: previous.history.slice(0, nextHistoryLength),
  };
}

function getWinnerTitle(winner: Winner, gameMode: GameMode): string {
  if (winner === "draw") {
    return "IT'S A DRAW!";
  }

  if (gameMode === "computer") {
    return winner === "black" ? "YOU WIN!" : "COMPUTER WINS!";
  }

  return `${winner?.toUpperCase()} WINS!`;
}

function getWinnerSubtitle(winner: Winner, gameMode: GameMode): string {
  if (winner === "draw") {
    return "The board is full and nobody found the finishing line.";
  }

  if (gameMode === "computer") {
    return winner === "black" ? "You found the winning line first." : "The computer found the better sequence.";
  }

  return "Excellent game of strategy.";
}

export default function GomokuGame() {
  const [gameMode, setGameMode] = useState<GameMode>("local");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("normal");
  const [game, setGame] = useState<GameState>(() => createInitialGameState());
  const aiTimeoutRef = useRef<number | null>(null);

  const currentPlayer = getCurrentPlayer(game.isBlackNext);
  const isComputerMode = gameMode === "computer";
  const isComputerTurn = isComputerMode && currentPlayer === "white" && !game.winner;
  const canPlaceStone = !game.winner && (!isComputerMode || currentPlayer === "black");

  useEffect(() => {
    if (!isComputerTurn) {
      clearScheduledAiMove(aiTimeoutRef);
      return;
    }

    clearScheduledAiMove(aiTimeoutRef);
    aiTimeoutRef.current = window.setTimeout(() => {
      const move = getComputerMove(game.board, difficulty);

      if (move) {
        setGame((previous) => buildNextGameState(previous, move.row, move.col, "white"));
      }

      aiTimeoutRef.current = null;
    }, 420);

    return () => clearScheduledAiMove(aiTimeoutRef);
  }, [difficulty, game.board, isComputerTurn]);

  function placeStone(row: number, col: number) {
    if (!canPlaceStone) {
      return;
    }

    setGame((previous) => buildNextGameState(previous, row, col, getCurrentPlayer(previous.isBlackNext)));
  }

  function resetGame() {
    clearScheduledAiMove(aiTimeoutRef);
    setGame(createInitialGameState());
  }

  function changeMode(nextMode: GameMode) {
    if (nextMode === gameMode) {
      return;
    }

    clearScheduledAiMove(aiTimeoutRef);
    if (nextMode === "computer") {
      setDifficulty("normal");
    }
    setGameMode(nextMode);
    setGame(createInitialGameState());
  }

  function changeDifficulty(nextDifficulty: AiDifficulty) {
    if (nextDifficulty === difficulty) {
      return;
    }

    clearScheduledAiMove(aiTimeoutRef);
    setDifficulty(nextDifficulty);
    setGame(createInitialGameState());
  }

  function undoMove() {
    clearScheduledAiMove(aiTimeoutRef);
    setGame((previous) => getUndoState(previous, gameMode));
  }

  return (
    <div className="py-12 sm:py-16">
      <Container size="lg">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end">
          <div className="text-center sm:text-left">
            <h1 className="mb-2 flex items-center justify-center gap-3 text-4xl font-extrabold text-amber-800 sm:justify-start sm:text-5xl">
              <span className="i-ph-circle-duotone" /> Gomoku
            </h1>
            <p className="max-w-2xl text-gray-600">
              {isComputerMode
                ? "Challenge the computer as Black. Build five in a row before it does."
                : "Local head-to-head mode. Get five in a row to win. Black starts first."}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            <div className="flex rounded-2xl bg-amber-100 p-1 shadow-inner shadow-amber-900/10">
              <button
                onClick={() => changeMode("local")}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  gameMode === "local" ? "bg-white text-amber-700 shadow-sm" : "text-amber-700/70 hover:text-amber-800"
                }`}
              >
                Local 2P
              </button>
              <button
                onClick={() => changeMode("computer")}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  gameMode === "computer"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-amber-700/70 hover:text-amber-800"
                }`}
              >
                Vs Computer
              </button>
            </div>

            {isComputerMode && (
              <div className="flex rounded-2xl bg-amber-100 p-1 shadow-inner shadow-amber-900/10">
                {(["easy", "normal", "hard"] as AiDifficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => changeDifficulty(level)}
                    className={`rounded-xl px-3 py-2 text-sm font-bold transition sm:px-4 ${
                      difficulty === level
                        ? "bg-white text-amber-700 shadow-sm"
                        : "text-amber-700/70 hover:text-amber-800"
                    }`}
                  >
                    {DIFFICULTY_LABELS[level]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-center">
          <div className="order-2 flex flex-col gap-4 lg:order-1 lg:w-56">
            <div
              className={`rounded-2xl border-2 p-4 shadow-sm ${
                game.isBlackNext && !game.winner ? "border-amber-500 bg-amber-50" : "border-transparent bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-black shadow-md" />
                <div>
                  <p className="font-bold text-gray-800">Black</p>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                    {isComputerMode ? "You" : "Player 1"}
                  </p>
                </div>
              </div>
              {game.isBlackNext && !game.winner && (
                <p className="mt-1 text-xs font-bold uppercase text-amber-600">
                  {isComputerMode ? "Your Turn" : "Current Turn"}
                </p>
              )}
            </div>

            <div
              className={`rounded-2xl border-2 p-4 shadow-sm ${
                !game.isBlackNext && !game.winner ? "border-amber-500 bg-amber-50" : "border-transparent bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full border border-gray-200 bg-white shadow-md" />
                <div>
                  <p className="font-bold text-gray-800">White</p>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                    {isComputerMode ? "Computer" : "Player 2"}
                  </p>
                </div>
              </div>
              {!game.isBlackNext && !game.winner && (
                <p className="mt-1 text-xs font-bold uppercase text-amber-600">
                  {isComputerMode ? "Thinking..." : "Current Turn"}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Mode Status</p>
              <p className="mt-2 text-lg font-black text-gray-900">
                {isComputerMode ? "Solo Challenge" : "Local Duel"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {game.winner
                  ? "Round finished."
                  : isComputerTurn
                    ? `Computer is evaluating the board on ${DIFFICULTY_LABELS[difficulty]}.`
                    : isComputerMode
                      ? `Difficulty: ${DIFFICULTY_LABELS[difficulty]}.`
                      : `${currentPlayer === "black" ? "Black" : "White"} to move.`}
              </p>
              {isComputerMode && (
                <p className="mt-3 text-xs text-gray-400">
                  Undo rewinds the full turn after the computer has answered.
                </p>
              )}
            </div>

            <div className="mt-1 flex flex-col gap-2">
              <button
                onClick={undoMove}
                disabled={game.history.length === 0 || !!game.winner}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 active:scale-95"
              >
                <span className="i-ph-arrow-u-up-left-bold" />
                {isComputerMode ? "Undo Turn" : "Undo"}
              </button>
              <button
                onClick={resetGame}
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700 shadow-sm transition hover:bg-amber-200 active:scale-95"
              >
                <span className="i-ph-arrows-clockwise-bold" /> Reset
              </button>
            </div>
          </div>

          <div className="order-1 flex w-full items-center justify-center px-2 lg:order-2">
            <div className="relative w-full max-w-[600px] rounded-lg border-4 border-[#c99a5a] bg-[#e6b36e] p-2 shadow-2xl sm:border-8 sm:p-4">
              {isComputerTurn && (
                <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-700 shadow-lg backdrop-blur-sm">
                  <span className="i-ph-brain-duotone text-base" />
                  Thinking
                </div>
              )}

              <div
                className="grid aspect-square w-full"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                }}
              >
                {game.board.map((row, rIdx) =>
                  row.map((cell, cIdx) => (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      className={`relative flex items-center justify-center ${
                        canPlaceStone && !cell ? "cursor-pointer group" : "cursor-default"
                      }`}
                      onClick={() => placeStone(rIdx, cIdx)}
                    >
                      <div className="pointer-events-none absolute inset-0">
                        <div
                          className={`absolute left-0 right-0 top-1/2 h-0.5 bg-black/20 ${
                            cIdx === 0 ? "left-1/2" : ""
                          } ${cIdx === BOARD_SIZE - 1 ? "right-1/2" : ""}`}
                        />
                        <div
                          className={`absolute bottom-0 top-0 left-1/2 w-0.5 bg-black/20 ${
                            rIdx === 0 ? "top-1/2" : ""
                          } ${rIdx === BOARD_SIZE - 1 ? "bottom-1/2" : ""}`}
                        />
                      </div>

                      {(rIdx === 3 || rIdx === 7 || rIdx === 11) && (cIdx === 3 || cIdx === 7 || cIdx === 11) && (
                        <div className="absolute z-0 h-1.5 w-1.5 rounded-full bg-black/40" />
                      )}

                      {!cell && canPlaceStone && (
                        <div
                          className={`absolute h-4/5 w-4/5 rounded-full opacity-0 transition-opacity group-hover:opacity-30 ${
                            game.isBlackNext ? "bg-black" : "bg-white"
                          }`}
                        />
                      )}

                      {cell && (
                        <div
                          className={`relative z-10 h-4/5 w-4/5 animate-in zoom-in-50 rounded-full shadow-lg transition-transform duration-300 ${
                            cell === "black"
                              ? "bg-gradient-to-br from-gray-700 to-black"
                              : "border border-gray-200 bg-gradient-to-br from-gray-100 to-white"
                          }`}
                        />
                      )}
                    </div>
                  )),
                )}
              </div>

              {game.winner && (
                <div className="animate-in fade-in absolute inset-0 z-20 flex flex-col items-center justify-center rounded-sm bg-black/60 text-white backdrop-blur-sm duration-500">
                  <div
                    className={`mb-4 h-20 w-20 rounded-full shadow-2xl ${
                      game.winner === "black" ? "bg-black" : game.winner === "white" ? "bg-white" : "bg-gray-400"
                    }`}
                  />
                  <h2 className="mb-2 text-center text-4xl font-black italic tracking-tighter">
                    {getWinnerTitle(game.winner, gameMode)}
                  </h2>
                  <p className="mb-8 text-center text-lg font-medium text-gray-200">
                    {getWinnerSubtitle(game.winner, gameMode)}
                  </p>
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
