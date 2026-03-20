// Battle City - Game Maps
// Tile types: 0=empty, 1=brick, 2=steel, 3=forest, 4=water, 5=ice

export type TileType = 0 | 1 | 2 | 3 | 4 | 5;

export interface GameMap {
  width: number;
  height: number;
  grid: TileType[][];
  playerSpawn: { x: number; y: number };
  basePosition: { x: number; y: number };
  enemySpawns: { x: number; y: number }[];
}

// Level 1 - Classic Battle City layout
// 26×26 grid (26*16px = 416px per side)
const LEVEL_1: GameMap = {
  width: 26,
  height: 26,
  grid: [
    // Row 0
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    // Row 1-3: Brick maze on sides
    [2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2],
    [2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2],
    [2, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 2],
    // Row 4-6: Mid section
    [2, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 2],
    [2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
    [2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
    // Row 7-9: Center area
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 2],
    [2, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 2],
    // Row 10-12
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
    [2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2],
    // Row 13-15: Base area
    [2, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 2],
    [2, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 2],
    [2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2],
    // Row 16-18
    [2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2],
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 2],
    // Row 19-21: Lower section
    [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [2, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 2],
    [2, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 2],
    // Row 22-24
    [2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2],
    [2, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2],
    // Row 25: Bottom border
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  ],
  playerSpawn: { x: 1, y: 24 }, // Bottom-left (grid coords)
  basePosition: { x: 12, y: 24 }, // Bottom-center (grid coords)
  enemySpawns: [
    { x: 12, y: 1 }, // Top-center
    { x: 1, y: 1 }, // Top-left
    { x: 24, y: 1 }, // Top-right
  ],
};

// Level 2 - More obstacles
const LEVEL_2: GameMap = {
  width: 26,
  height: 26,
  grid: LEVEL_1.grid.map((row, y) =>
    row.map((tile, x) => {
      // Add more steel walls and fewer bricks
      if ((x + y) % 3 === 0 && tile === 0) return Math.random() > 0.7 ? 2 : 0;
      if (tile === 1 && Math.random() > 0.6) return 2;
      return tile;
    })
  ),
  playerSpawn: LEVEL_1.playerSpawn,
  basePosition: LEVEL_1.basePosition,
  enemySpawns: LEVEL_1.enemySpawns,
};

// Level 3 - Open arena
const LEVEL_3: GameMap = {
  width: 26,
  height: 26,
  grid: LEVEL_1.grid.map(row =>
    row.map(tile => {
      // Reduce brick walls, keep some steel walls
      if (tile === 1 && Math.random() > 0.5) return 0;
      if (tile === 2 && Math.random() > 0.8) return 0;
      return tile;
    })
  ),
  playerSpawn: LEVEL_1.playerSpawn,
  basePosition: LEVEL_1.basePosition,
  enemySpawns: LEVEL_1.enemySpawns,
};

// Level 4 - Narrow passages
const LEVEL_4: GameMap = {
  width: 26,
  height: 26,
  grid: LEVEL_1.grid.map((row, y) =>
    row.map((tile, x) => {
      // Create more barriers
      if ((x + y) % 2 === 0 && tile === 0) return Math.random() > 0.6 ? 1 : 0;
      return tile;
    })
  ),
  playerSpawn: LEVEL_1.playerSpawn,
  basePosition: LEVEL_1.basePosition,
  enemySpawns: LEVEL_1.enemySpawns,
};

// Level 5 - Dense fortress
const LEVEL_5: GameMap = {
  width: 26,
  height: 26,
  grid: LEVEL_1.grid.map(row =>
    row.map(tile => {
      if (tile === 1 && Math.random() > 0.4) return 2; // More steel
      if (tile === 0 && Math.random() > 0.8) return Math.random() > 0.5 ? 1 : 2;
      return tile;
    })
  ),
  playerSpawn: LEVEL_1.playerSpawn,
  basePosition: LEVEL_1.basePosition,
  enemySpawns: LEVEL_1.enemySpawns,
};

export const MAPS: GameMap[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];

export const getMap = (stageNumber: number): GameMap => {
  return MAPS[(stageNumber - 1) % MAPS.length];
};
