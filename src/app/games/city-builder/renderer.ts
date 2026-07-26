import {
  BUILDING_DEFS,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  getCoverageCells,
  getPlacementError,
  type CityCell,
  type CityState,
} from './utils';

const MAP_WIDTH = GRID_COLS * CELL_SIZE;
const MAP_HEIGHT = GRID_ROWS * CELL_SIZE;

export function renderCity(
  canvas: HTMLCanvasElement,
  state: CityState,
  hoveredCell: [number, number] | null,
  cursorCell: [number, number],
  pixelRatio: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.fillStyle = '#101d21';
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      drawCell(ctx, state.grid[row][col], state.grid, col, row);
    }
  }

  drawCoverageLayer(ctx, state, hoveredCell ?? cursorCell);
  drawSelection(ctx, state, hoveredCell, cursorCell);
}

function drawCoverageLayer(
  ctx: CanvasRenderingContext2D,
  state: CityState,
  selected: [number, number]
) {
  const tool = state.selectedTool;
  if (tool !== 'power_plant' && tool !== 'water_pump' && tool !== 'park') return;

  const color = tool === 'power_plant' ? '168, 85, 247' : tool === 'water_pump' ? '6, 182, 212' : '16, 185, 129';
  const paintCells = (cells: ReturnType<typeof getCoverageCells>, alpha: number) => {
    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    cells.forEach(({ col, row }) => {
      ctx.fillRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
  };

  state.grid.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
    if (cell.type === tool) paintCells(getCoverageCells(tool, colIndex, rowIndex), 0.08);
  }));

  const [col, row] = selected;
  const invalid = getPlacementError(state, col, row, tool) !== null;
  if (invalid) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.13)';
    getCoverageCells(tool, col, row).forEach((point) => {
      ctx.fillRect(point.col * CELL_SIZE + 1, point.row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
  } else {
    paintCells(getCoverageCells(tool, col, row), 0.2);
  }
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: CityCell,
  grid: CityCell[][],
  col: number,
  row: number
) {
  const x = col * CELL_SIZE;
  const y = row * CELL_SIZE;

  ctx.fillStyle = (col + row) % 2 === 0 ? '#18352f' : '#16312c';
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);

  if (cell.type === 'empty') {
    drawGrass(ctx, x, y, col, row);
    return;
  }

  if (cell.type === 'road') {
    drawRoad(ctx, grid, col, row);
    return;
  }

  const def = BUILDING_DEFS[cell.type];
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = def.color;
  roundedRect(ctx, x + 3, y + 4, CELL_SIZE - 6, CELL_SIZE - 7, 5);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundedRect(ctx, x + 6, y + 7, CELL_SIZE - 12, 5, 2);
  ctx.fill();

  ctx.font = '17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(def.emoji, x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 2);

  if (cell.type === 'residential' && cell.population > 0) {
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#eff6ff';
    ctx.fillText(`${cell.population}`, x + CELL_SIZE - 3, y + 2);
  }

  const requiresServices = cell.type === 'residential' || cell.type === 'commercial' || cell.type === 'industrial';
  if (requiresServices) {
    if (!cell.connectedToRoad) drawBadge(ctx, x + 3, y + CELL_SIZE - 8, 'R', '#ef4444');
    if (!cell.powered) drawBadge(ctx, x + 12, y + CELL_SIZE - 8, '⚡', '#f59e0b');
    if (!cell.hasWater) drawBadge(ctx, x + 22, y + CELL_SIZE - 8, '●', '#06b6d4');
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number, col: number, row: number) {
  const seed = (col * 17 + row * 23) % 19;
  if (seed > 5) return;
  ctx.fillStyle = seed % 2 === 0 ? '#2c5b45' : '#27533f';
  ctx.fillRect(x + 7 + (seed % 8), y + 8 + ((seed * 3) % 12), 2, 4);
}

function drawRoad(ctx: CanvasRenderingContext2D, grid: CityCell[][], col: number, row: number) {
  const x = col * CELL_SIZE;
  const y = row * CELL_SIZE;
  const connects = (c: number, r: number) =>
    c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS && grid[r][c].type === 'road';

  ctx.fillStyle = '#414957';
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  ctx.fillStyle = '#232a35';
  ctx.fillRect(x, y, CELL_SIZE, 3);
  ctx.fillRect(x, y + CELL_SIZE - 3, CELL_SIZE, 3);

  ctx.strokeStyle = '#f8d36a';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  if (connects(col - 1, row) || connects(col + 1, row)) {
    ctx.moveTo(x, y + CELL_SIZE / 2);
    ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE / 2);
  }
  if (connects(col, row - 1) || connects(col, row + 1)) {
    ctx.moveTo(x + CELL_SIZE / 2, y);
    ctx.lineTo(x + CELL_SIZE / 2, y + CELL_SIZE);
  }
  if (!connects(col - 1, row) && !connects(col + 1, row) && !connects(col, row - 1) && !connects(col, row + 1)) {
    ctx.moveTo(x + 6, y + CELL_SIZE / 2);
    ctx.lineTo(x + CELL_SIZE - 6, y + CELL_SIZE / 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 4, y + 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0b1220';
  ctx.fillText(label, x + 4, y + 4.5);
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  state: CityState,
  hoveredCell: [number, number] | null,
  cursorCell: [number, number]
) {
  const selected = hoveredCell ?? cursorCell;
  const [col, row] = selected;
  const cell = state.grid[row][col];
  const invalid = state.selectedTool === 'bulldoze'
    ? cell.type === 'empty'
    : getPlacementError(state, col, row, state.selectedTool) !== null;

  ctx.fillStyle = invalid ? 'rgba(239, 68, 68, 0.2)' : 'rgba(52, 211, 153, 0.2)';
  ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  ctx.strokeStyle = invalid ? '#fb7185' : '#34d399';
  ctx.lineWidth = 3;
  ctx.strokeRect(col * CELL_SIZE + 1.5, row * CELL_SIZE + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);

  if (!hoveredCell) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(col * CELL_SIZE + 4, row * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
    ctx.setLineDash([]);
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
