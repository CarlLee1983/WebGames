export const BOARD_SIZE = 15;

export type Player = "black" | "white";
export type Cell = Player | null;
export type Board = Cell[][];
export type Winner = Player | "draw" | null;
export type AiDifficulty = "easy" | "normal" | "hard";
export type Move = {
  row: number;
  col: number;
};

type DifficultySettings = {
  attackWeight: number;
  defenseWeight: number;
  poolSize: number;
  randomnessExponent: number;
};

type RankedMove = Move & {
  score: number;
};

const DIFFICULTY_SETTINGS = {
  easy: {
    attackWeight: 1.05,
    defenseWeight: 0.58,
    poolSize: 8,
    randomnessExponent: 1.2,
  },
  normal: {
    attackWeight: 1.1,
    defenseWeight: 0.82,
    poolSize: 4,
    randomnessExponent: 1.7,
  },
  hard: {
    attackWeight: 1.15,
    defenseWeight: 1,
    poolSize: 1,
    randomnessExponent: 1,
  },
} satisfies Record<AiDifficulty, DifficultySettings>;

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function getCurrentPlayer(isBlackNext: boolean): Player {
  return isBlackNext ? "black" : "white";
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export function checkWinner(row: number, col: number, player: Player, board: Board): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;

    for (let step = 1; step < 5; step += 1) {
      const nextRow = row + dr * step;
      const nextCol = col + dc * step;

      if (!isWithinBounds(nextRow, nextCol) || board[nextRow][nextCol] !== player) {
        break;
      }

      count += 1;
    }

    for (let step = 1; step < 5; step += 1) {
      const nextRow = row - dr * step;
      const nextCol = col - dc * step;

      if (!isWithinBounds(nextRow, nextCol) || board[nextRow][nextCol] !== player) {
        break;
      }

      count += 1;
    }

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

export function playMove(
  board: Board,
  row: number,
  col: number,
  player: Player,
): { board: Board; winner: Winner } | null {
  if (!isWithinBounds(row, col) || board[row][col] !== null) {
    return null;
  }

  const nextBoard = cloneBoard(board);
  nextBoard[row][col] = player;

  if (checkWinner(row, col, player, nextBoard)) {
    return { board: nextBoard, winner: player };
  }

  if (isBoardFull(nextBoard)) {
    return { board: nextBoard, winner: "draw" };
  }

  return { board: nextBoard, winner: null };
}

export function getComputerMove(
  board: Board,
  difficulty: AiDifficulty,
  rng: () => number = Math.random,
): Move | null {
  const center = Math.floor(BOARD_SIZE / 2);
  const candidates = getCandidateMoves(board);
  const settings = DIFFICULTY_SETTINGS[difficulty];

  if (candidates.length === 0) {
    return { row: center, col: center };
  }

  for (const candidate of candidates) {
    const result = playMove(board, candidate.row, candidate.col, "white");

    if (result?.winner === "white") {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    const result = playMove(board, candidate.row, candidate.col, "black");

    if (result?.winner === "black") {
      return candidate;
    }
  }

  let bestMove: Move | null = null;
  const ranked = candidates
    .map((candidate) => {
      const attackScore = evaluateMove(board, candidate.row, candidate.col, "white");
      const defenseScore = evaluateMove(board, candidate.row, candidate.col, "black");
      const centerBias = getCenterBias(candidate.row, candidate.col);

      return {
        ...candidate,
        score: attackScore * settings.attackWeight + defenseScore * settings.defenseWeight + centerBias,
      } satisfies RankedMove;
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.row !== right.row) {
        return left.row - right.row;
      }

      return left.col - right.col;
    });

  bestMove = chooseRankedMove(ranked.slice(0, settings.poolSize), settings.randomnessExponent, rng);
  return bestMove;
}

function isWithinBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getCandidateMoves(board: Board): Move[] {
  const candidates = new Map<string, Move>();
  let hasStone = false;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === null) {
        continue;
      }

      hasStone = true;

      for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
        for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
          const nextRow = row + rowOffset;
          const nextCol = col + colOffset;

          if (!isWithinBounds(nextRow, nextCol) || board[nextRow][nextCol] !== null) {
            continue;
          }

          candidates.set(`${nextRow}:${nextCol}`, { row: nextRow, col: nextCol });
        }
      }
    }
  }

  if (!hasStone) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [{ row: center, col: center }];
  }

  return [...candidates.values()].sort((left, right) => {
    const leftDistance = Math.abs(left.row - Math.floor(BOARD_SIZE / 2)) + Math.abs(left.col - Math.floor(BOARD_SIZE / 2));
    const rightDistance = Math.abs(right.row - Math.floor(BOARD_SIZE / 2)) + Math.abs(right.col - Math.floor(BOARD_SIZE / 2));

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left.row !== right.row) {
      return left.row - right.row;
    }

    return left.col - right.col;
  });
}

function getCenterBias(row: number, col: number): number {
  const center = Math.floor(BOARD_SIZE / 2);
  return BOARD_SIZE - Math.abs(center - row) - Math.abs(center - col);
}

function chooseRankedMove(
  rankedMoves: RankedMove[],
  randomnessExponent: number,
  rng: () => number,
): Move | null {
  if (rankedMoves.length === 0) {
    return null;
  }

  if (rankedMoves.length === 1) {
    const [move] = rankedMoves;
    return { row: move.row, col: move.col };
  }

  const randomValue = Math.min(Math.max(rng(), 0), 0.999999);
  const selectedIndex = Math.min(
    rankedMoves.length - 1,
    Math.floor(randomValue ** randomnessExponent * rankedMoves.length),
  );
  const selectedMove = rankedMoves[selectedIndex];

  return {
    row: selectedMove.row,
    col: selectedMove.col,
  };
}

function evaluateMove(board: Board, row: number, col: number, player: Player): number {
  if (board[row][col] !== null) {
    return Number.NEGATIVE_INFINITY;
  }

  let totalScore = 0;

  for (const [dr, dc] of DIRECTIONS) {
    const forward = scanDirection(board, row, col, player, dr, dc);
    const backward = scanDirection(board, row, col, player, -dr, -dc);
    const stones = 1 + forward.count + backward.count;
    const openEnds = Number(forward.open) + Number(backward.open);

    totalScore += getPatternScore(stones, openEnds);
  }

  return totalScore;
}

function scanDirection(
  board: Board,
  row: number,
  col: number,
  player: Player,
  rowDelta: number,
  colDelta: number,
): { count: number; open: boolean } {
  let count = 0;
  let nextRow = row + rowDelta;
  let nextCol = col + colDelta;

  while (isWithinBounds(nextRow, nextCol) && board[nextRow][nextCol] === player) {
    count += 1;
    nextRow += rowDelta;
    nextCol += colDelta;
  }

  return {
    count,
    open: isWithinBounds(nextRow, nextCol) && board[nextRow][nextCol] === null,
  };
}

function getPatternScore(stones: number, openEnds: number): number {
  if (stones >= 5) {
    return 1_000_000;
  }

  if (stones === 4 && openEnds === 2) {
    return 120_000;
  }

  if (stones === 4 && openEnds === 1) {
    return 40_000;
  }

  if (stones === 3 && openEnds === 2) {
    return 14_000;
  }

  if (stones === 3 && openEnds === 1) {
    return 2_400;
  }

  if (stones === 2 && openEnds === 2) {
    return 700;
  }

  if (stones === 2 && openEnds === 1) {
    return 120;
  }

  if (stones === 1 && openEnds === 2) {
    return 24;
  }

  return 0;
}
