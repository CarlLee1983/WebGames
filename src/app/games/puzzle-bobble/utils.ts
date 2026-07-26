export const BUBBLE_RADIUS = 16;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
export const COLS = 11; // Even rows have 11 cols (0..10), Odd rows have 10 cols (0..9)
export const BOARD_WIDTH = COLS * BUBBLE_DIAMETER;
export const BOARD_HEIGHT = 450;
export const MAX_ROWS = 15; // Max rows before game over
export const COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a855f7', '#f97316']; // Tailwind colors

export type Bubble = {
  row: number;
  col: number;
  color: string;
};

export type FlyingBubble = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
};

export type BubblePressure = 'safe' | 'pressured' | 'critical';

export type BubbleResolution = {
  board: Bubble[];
  matches: Bubble[];
  floating: Bubble[];
  points: number;
  combo: number;
  won: boolean;
};

export type CeilingAdvance = {
  board: Bubble[];
  lost: boolean;
};

export function getBubbleX(row: number, col: number): number {
  return col * BUBBLE_DIAMETER + BUBBLE_RADIUS + (row % 2 === 1 ? BUBBLE_RADIUS : 0);
}

export function getBubbleY(row: number): number {
  return row * ROW_HEIGHT + BUBBLE_RADIUS;
}

export function getGridPos(x: number, y: number): { row: number, col: number } {
  let row = Math.round((y - BUBBLE_RADIUS) / ROW_HEIGHT);
  // Prevent snapping above ceiling
  if (row < 0) row = 0;
  
  const colOffset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
  let col = Math.round((x - BUBBLE_RADIUS - colOffset) / BUBBLE_DIAMETER);
  
  const maxCols = row % 2 === 1 ? COLS - 1 : COLS;
  if (col < 0) col = 0;
  if (col >= maxCols) col = maxCols - 1;
  
  return { row, col };
}

export function getLandingPosition(
  board: Bubble[],
  x: number,
  y: number,
): { row: number; col: number } {
  const start = getGridPos(x, y);
  const occupied = new Set(board.map((bubble) => `${bubble.row},${bubble.col}`));
  if (!occupied.has(`${start.row},${start.col}`)) return start;

  const visited = new Set([`${start.row},${start.col}`]);
  let frontier = [start];

  while (frontier.length > 0) {
    const nextFrontier: Array<{ row: number; col: number }> = [];
    const openPositions: Array<{ row: number; col: number }> = [];

    for (const position of frontier) {
      for (const neighbor of getNeighbors(position.row, position.col)) {
        if (neighbor.row >= MAX_ROWS) continue;
        const key = `${neighbor.row},${neighbor.col}`;
        if (visited.has(key)) continue;
        visited.add(key);
        nextFrontier.push(neighbor);
        if (!occupied.has(key)) openPositions.push(neighbor);
      }
    }

    if (openPositions.length > 0) {
      return openPositions.sort((first, second) => (
        distance(x, y, getBubbleX(first.row, first.col), getBubbleY(first.row))
        - distance(x, y, getBubbleX(second.row, second.col), getBubbleY(second.row))
      ))[0];
    }

    frontier = nextFrontier;
  }

  return start;
}

export function distance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getNeighbors(row: number, col: number): { row: number, col: number }[] {
  const isOdd = row % 2 === 1;

  const neighbors = [
    { row: row, col: col - 1 }, // Left
    { row: row, col: col + 1 }, // Right
  ];

  if (isOdd) {
    neighbors.push(
      { row: row - 1, col: col },     // Top-left
      { row: row - 1, col: col + 1 }, // Top-right
      { row: row + 1, col: col },     // Bottom-left
      { row: row + 1, col: col + 1 }  // Bottom-right
    );
  } else {
    neighbors.push(
      { row: row - 1, col: col - 1 }, // Top-left
      { row: row - 1, col: col },     // Top-right
      { row: row + 1, col: col - 1 }, // Bottom-left
      { row: row + 1, col: col }      // Bottom-right
    );
  }

  return neighbors.filter(n => 
    n.row >= 0 && 
    (n.row % 2 === 1 ? n.col >= 0 && n.col < COLS - 1 : n.col >= 0 && n.col < COLS)
  );
}

export function findMatches(board: Bubble[], startBubble: Bubble): Bubble[] {
  const matched = new Set<string>();
  const queue: Bubble[] = [startBubble];
  const color = startBubble.color;
  
  const boardMap = new Map<string, Bubble>();
  board.forEach(b => boardMap.set(`${b.row},${b.col}`, b));

  matched.add(`${startBubble.row},${startBubble.col}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = getNeighbors(current.row, current.col);

    for (const n of neighbors) {
      const key = `${n.row},${n.col}`;
      if (!matched.has(key)) {
        const neighborBubble = boardMap.get(key);
        if (neighborBubble && neighborBubble.color === color) {
          matched.add(key);
          queue.push(neighborBubble);
        }
      }
    }
  }

  return Array.from(matched).map(key => {
    const [row, col] = key.split(',').map(Number);
    return { row, col, color };
  });
}

export function findFloating(board: Bubble[]): Bubble[] {
  const attached = new Set<string>();
  const queue: Bubble[] = [];
  const boardMap = new Map<string, Bubble>();
  
  board.forEach(b => {
    boardMap.set(`${b.row},${b.col}`, b);
    if (b.row === 0) {
      attached.add(`${b.row},${b.col}`);
      queue.push(b);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = getNeighbors(current.row, current.col);

    for (const n of neighbors) {
      const key = `${n.row},${n.col}`;
      if (!attached.has(key)) {
        const neighborBubble = boardMap.get(key);
        if (neighborBubble) {
          attached.add(key);
          queue.push(neighborBubble);
        }
      }
    }
  }

  return board.filter(b => !attached.has(`${b.row},${b.col}`));
}

export function resolveBubblePlacement(
  board: Bubble[],
  placedBubble: Bubble,
  currentCombo: number,
): BubbleResolution {
  const boardWithBubble = [...board.map((bubble) => ({ ...bubble })), { ...placedBubble }];
  const matches = findMatches(boardWithBubble, placedBubble);

  if (matches.length < 3) {
    return {
      board: boardWithBubble,
      matches: [],
      floating: [],
      points: 0,
      combo: 0,
      won: false,
    };
  }

  const matchKeys = new Set(matches.map((bubble) => `${bubble.row},${bubble.col}`));
  const boardAfterMatches = boardWithBubble.filter(
    (bubble) => !matchKeys.has(`${bubble.row},${bubble.col}`),
  );
  const floating = findFloating(boardAfterMatches);
  const floatingKeys = new Set(floating.map((bubble) => `${bubble.row},${bubble.col}`));
  const resolvedBoard = boardAfterMatches.filter(
    (bubble) => !floatingKeys.has(`${bubble.row},${bubble.col}`),
  );
  const combo = currentCombo + 1;

  return {
    board: resolvedBoard,
    matches,
    floating,
    points: matches.length * 10 + floating.length * 20 + Math.max(0, combo - 1) * 15,
    combo,
    won: resolvedBoard.length === 0,
  };
}

export function advanceCeiling(board: Bubble[], colors: string[]): CeilingAdvance {
  if (colors.length !== COLS) {
    throw new Error(`A ceiling row requires exactly ${COLS} colors.`);
  }

  const shiftedBoard = board.map((bubble) => ({ ...bubble, row: bubble.row + 1 }));
  const nextBoard = [
    ...shiftedBoard,
    ...colors.map((color, col) => ({ row: 0, col, color })),
  ];

  return {
    board: nextBoard,
    lost: hasCrossedDangerLine(nextBoard),
  };
}

export function hasCrossedDangerLine(board: Bubble[]): boolean {
  return board.some((bubble) => (
    bubble.row >= MAX_ROWS - 1
    || getBubbleY(bubble.row) > BOARD_HEIGHT - BUBBLE_DIAMETER * 2
  ));
}

export function getBubblePressure(board: Bubble[]): BubblePressure {
  const lowestRow = board.reduce((maximum, bubble) => Math.max(maximum, bubble.row), 0);
  if (lowestRow >= 11) return 'critical';
  if (lowestRow >= 8) return 'pressured';
  return 'safe';
}

export function getShotsUntilDrop(shotsFired: number, interval: number): number {
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new Error('Drop interval must be a positive integer.');
  }

  const normalizedShots = Math.max(0, Math.floor(shotsFired));
  return interval - (normalizedShots % interval);
}

export function parseBestScore(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export function bubbleBoardToRows(board: Bubble[]): string[] {
  const boardMap = new Map(board.map((bubble) => [
    `${bubble.row},${bubble.col}`,
    COLORS.includes(bubble.color) ? String(COLORS.indexOf(bubble.color) + 1) : '?',
  ]));

  return Array.from({ length: MAX_ROWS }, (_, row) => {
    const columns = row % 2 === 1 ? COLS - 1 : COLS;
    return Array.from({ length: columns }, (_, col) => boardMap.get(`${row},${col}`) ?? '.').join('');
  });
}
