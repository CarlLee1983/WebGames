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
