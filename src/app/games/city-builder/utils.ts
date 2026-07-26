// City Builder - 模擬城市遊戲工具函式
// Pure function 架構，所有狀態更新都是 immutable

export type BuildingType =
  | 'empty'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'power_plant'
  | 'park'
  | 'water_pump';

export type ToolMode = BuildingType | 'bulldoze';
export type GameSpeed = 'paused' | 'normal' | 'fast';
export type CoverageBuildingType = 'power_plant' | 'water_pump' | 'park';

export interface GridPoint {
  col: number;
  row: number;
}

export interface CityCell {
  type: BuildingType;
  level: number;
  powered: boolean;
  hasWater: boolean;
  connectedToRoad: boolean;
  population: number;
  happiness: number;
  placedAt: number; // tick number
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  timestamp: number;
}

export interface CityState {
  grid: CityCell[][]; // [row][col], 20 rows × 30 cols
  money: number;
  population: number;
  power: number;
  powerUsage: number;
  water: number;
  waterUsage: number;
  happiness: number;
  tick: number;
  day: number;
  income: number;
  expenses: number;
  selectedTool: ToolMode;
  gameSpeed: GameSpeed;
  notifications: Notification[];
}

// 建築定義
const BUILDING_DEFS: Record<
  BuildingType,
  {
    name: string;
    cost: number;
    emoji: string;
    color: string;
    description: string;
    powerUsage?: number;
    waterUsage?: number;
  }
> = {
  empty: {
    name: '空地',
    cost: 0,
    emoji: '□',
    color: '#1a1f2e',
    description: '空白地塊',
  },
  road: {
    name: '道路',
    cost: 10,
    emoji: '━',
    color: '#4b5563',
    description: '連接各建築',
  },
  residential: {
    name: '住宅區',
    cost: 50,
    emoji: '🏠',
    color: '#3b82f6',
    description: '需道路、電力、水',
    powerUsage: 2,
    waterUsage: 2,
  },
  commercial: {
    name: '商業區',
    cost: 80,
    emoji: '🏬',
    color: '#ef4444',
    description: '產生收入',
    powerUsage: 4,
    waterUsage: 1,
  },
  industrial: {
    name: '工業區',
    cost: 100,
    emoji: '🏭',
    color: '#6b7280',
    description: '高收入，低幸福',
    powerUsage: 6,
    waterUsage: 3,
  },
  power_plant: {
    name: '電廠',
    cost: 300,
    emoji: '⚡',
    color: '#a855f7',
    description: '半徑5格提供電力',
  },
  water_pump: {
    name: '水泵',
    cost: 200,
    emoji: '💧',
    color: '#06b6d4',
    description: '半徑4格提供水資源',
  },
  park: {
    name: '公園',
    cost: 60,
    emoji: '🌳',
    color: '#10b981',
    description: '提高鄰近幸福度',
  },
};

export const GRID_COLS = 30;
export const GRID_ROWS = 20;
export const CELL_SIZE = 32;

const COVERAGE_RANGES: Record<CoverageBuildingType, number> = {
  power_plant: 5,
  water_pump: 4,
  park: 2,
};

export function getCoverageCells(type: ToolMode, col: number, row: number): GridPoint[] {
  if (type === 'bulldoze' || type === 'empty' || type === 'road' || type === 'residential' || type === 'commercial' || type === 'industrial') {
    return [];
  }

  const range = COVERAGE_RANGES[type];
  const cells: GridPoint[] = [];
  for (let nextRow = row - range; nextRow <= row + range; nextRow++) {
    for (let nextCol = col - range; nextCol <= col + range; nextCol++) {
      if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) continue;
      const deltaCol = nextCol - col;
      const deltaRow = nextRow - row;
      const isCovered = type === 'park'
        ? Math.max(Math.abs(deltaCol), Math.abs(deltaRow)) <= range
        : Math.hypot(deltaCol, deltaRow) <= range;
      if (isCovered) cells.push({ col: nextCol, row: nextRow });
    }
  }
  return cells;
}

/**
 * 初始化遊戲狀態
 */
export function createInitialState(): CityState {
  const grid: CityCell[][] = Array(GRID_ROWS)
    .fill(null)
    .map(() =>
      Array(GRID_COLS)
        .fill(null)
        .map(() => ({
          type: 'empty',
          level: 0,
          powered: false,
          hasWater: false,
          connectedToRoad: false,
          population: 0,
          happiness: 50,
          placedAt: 0,
        }))
    );

  return {
    grid,
    money: 5000,
    population: 0,
    power: 0,
    powerUsage: 0,
    water: 0,
    waterUsage: 0,
    happiness: 50,
    tick: 0,
    day: 1,
    income: 0,
    expenses: 0,
    selectedTool: 'road',
    gameSpeed: 'normal',
    notifications: [],
  };
}

/**
 * 檢查是否可以放置建築
 */
export function canPlace(
  state: CityState,
  col: number,
  row: number,
  type: BuildingType
): boolean {
  if (type === 'empty') {
    return false;
  }

  // 邊界檢查
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
    return false;
  }

  const cell = state.grid[row][col];

  // 不能在非空地放置（拆除除外）
  if (cell.type !== 'empty') {
    return false;
  }

  // 檢查金錢
  const cost = BUILDING_DEFS[type].cost;
  if (state.money < cost) {
    return false;
  }

  return true;
}

export function getPlacementError(
  state: CityState,
  col: number,
  row: number,
  type: BuildingType
): string | null {
  if (type === 'empty') return '請先選擇一種可建造設施';
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return '這塊地超出城市範圍';
  if (state.grid[row][col].type !== 'empty') return '這塊地已有設施，請先拆除';
  if (state.money < BUILDING_DEFS[type].cost) return `資金不足，還需要 $${BUILDING_DEFS[type].cost - state.money}`;
  return null;
}

/**
 * 放置建築
 */
export function placeBuilding(
  state: CityState,
  col: number,
  row: number,
  type: BuildingType
): CityState {
  if (!canPlace(state, col, row, type)) {
    return state;
  }

  const cost = BUILDING_DEFS[type].cost;
  const newGrid = state.grid.map((r) => [...r]);

  newGrid[row][col] = {
    type,
    level: 1,
    powered: false,
    hasWater: false,
    connectedToRoad: type === 'road',
    population: 0,
    happiness: 50,
    placedAt: state.tick,
  };

  const notification: Notification = {
    id: `place-${state.tick}-${col}-${row}`,
    message: `${BUILDING_DEFS[type].name}已放置`,
    type: 'success',
    timestamp: state.tick,
  };

  return refreshCityServices({
    ...state,
    grid: newGrid,
    money: state.money - cost,
    notifications: [...state.notifications, notification],
  });
}

/**
 * 拆除建築
 */
export function bulldoze(state: CityState, col: number, row: number): CityState {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
    return state;
  }

  const cell = state.grid[row][col];
  if (cell.type === 'empty') {
    return state;
  }

  const refund = Math.floor(BUILDING_DEFS[cell.type].cost * 0.5);
  const newGrid = state.grid.map((r) => [...r]);

  newGrid[row][col] = {
    type: 'empty',
    level: 0,
    powered: false,
    hasWater: false,
    connectedToRoad: false,
    population: 0,
    happiness: 50,
    placedAt: 0,
  };

  return refreshCityServices({
    ...state,
    grid: newGrid,
    money: state.money + refund,
    notifications: [
      ...state.notifications,
      {
        id: `bulldoze-${state.tick}-${col}-${row}`,
        message: `${BUILDING_DEFS[cell.type].name}已拆除，回收 $${refund}`,
        type: 'info',
        timestamp: state.tick,
      },
    ],
  });
}

/**
 * 計算道路可達性
 */
function computeRoadConnectivity(grid: CityCell[][]): boolean[][] {
  const connected = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(false));

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].type === 'road') {
        connected[r][c] = true;
      }
    }
  }

  // 這個沙盒沒有固定城市入口；任何直接鄰接道路的建築都視為可達。
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].type === 'empty' || grid[r][c].type === 'road') continue;
      const neighbors = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
      if (neighbors.some(([nc, nr]) => nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc].type === 'road')) {
        connected[r][c] = true;
      }
    }
  }

  return connected;
}

/**
 * 計算電力覆蓋（電廠5格範圍）
 */
function computePowerCoverage(grid: CityCell[][]): boolean[][] {
  const powered = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(false));

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].type === 'power_plant') {
        getCoverageCells('power_plant', c, r).forEach(({ col, row }) => {
          powered[row][col] = true;
        });
      }
    }
  }

  return powered;
}

/**
 * 計算水資源覆蓋（水泵4格範圍）
 */
function computeWaterCoverage(grid: CityCell[][]): boolean[][] {
  const hasWater = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(false));

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].type === 'water_pump') {
        getCoverageCells('water_pump', c, r).forEach(({ col, row }) => {
          hasWater[row][col] = true;
        });
      }
    }
  }

  return hasWater;
}

/**
 * 計算人口增長
 */
function computePopulation(grid: CityCell[][]): CityCell[][] {
  const roadConnected = computeRoadConnectivity(grid);
  const powered = computePowerCoverage(grid);
  const hasWater = computeWaterCoverage(grid);

  return grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell.type !== 'residential') {
        return cell;
      }

      // 需要道路、電、水才能有人口
      if (!roadConnected[r][c] || !powered[r][c] || !hasWater[r][c]) {
        return { ...cell, population: 0, powered: powered[r][c], hasWater: hasWater[r][c], connectedToRoad: roadConnected[r][c] };
      }

      // 每個 tick 增加少量人口（最多100）
      const newPop = Math.min(cell.population + 5, 100);
      return {
        ...cell,
        population: newPop,
        powered: true,
        hasWater: true,
        connectedToRoad: true,
      };
    })
  );
}

/**
 * 計算幸福度
 */
function computeHappiness(grid: CityCell[][]): CityCell[][] {
  return grid.map((row, r) =>
    row.map((cell, c) => {
      if (cell.type === 'empty' || cell.population === 0) {
        return cell;
      }

      let happiness = 50; // 基礎幸福度

      // 工業區半徑3格內住宅幸福度-15
      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            if (grid[nr][nc].type === 'industrial') {
              happiness -= 15;
            }
          }
        }
      }

      // 公園半徑2格內幸福度+15
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            if (grid[nr][nc].type === 'park') {
              happiness += 15;
            }
          }
        }
      }

      happiness = Math.max(10, Math.min(100, happiness));

      return { ...cell, happiness };
    })
  );
}

/**
 * 計算財務狀況
 */
function computeFinance(state: CityState): {
  income: number;
  expenses: number;
  powerUsage: number;
  waterUsage: number;
} {
  let income = 0;
  let expenses = 0;
  let powerUsage = 0;
  let waterUsage = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = state.grid[r][c];

      const active = cell.connectedToRoad && cell.powered && cell.hasWater;

      // 正常營運的商業與工業提供穩定稅收。
      if (cell.type === 'commercial') {
        if (active) income += 45;
        powerUsage += 4;
        waterUsage += 1;
      }

      // 工業區收入
      if (cell.type === 'industrial') {
        if (active) income += 80;
        powerUsage += 6;
        waterUsage += 3;
      }

      // 住宅區維護費
      if (cell.type === 'residential') {
        expenses += Math.floor(cell.population * 0.1);
        powerUsage += 2;
        waterUsage += 2;
      }

      // 建築維護費
      if (cell.type !== 'empty') {
        expenses += 5;
      }

      // 電廠維護費
      if (cell.type === 'power_plant') {
        expenses += 50;
      }

      // 水泵維護費
      if (cell.type === 'water_pump') {
        expenses += 30;
      }
    }
  }

  return { income, expenses, powerUsage, waterUsage };
}

export function refreshCityServices(state: CityState): CityState {
  const roadConnected = computeRoadConnectivity(state.grid);
  const powered = computePowerCoverage(state.grid);
  const hasWater = computeWaterCoverage(state.grid);
  const grid = state.grid.map((row, rowIndex) =>
    row.map((cell, colIndex) => ({
      ...cell,
      powered: powered[rowIndex][colIndex],
      hasWater: hasWater[rowIndex][colIndex],
      connectedToRoad: roadConnected[rowIndex][colIndex] || cell.type === 'road',
    }))
  );
  const finance = computeFinance({ ...state, grid });
  let power = 0;
  let water = 0;
  grid.forEach((row) => row.forEach((cell) => {
    if (cell.type === 'power_plant') power += 200;
    if (cell.type === 'water_pump') water += 150;
  }));

  return {
    ...state,
    grid,
    power,
    water,
    powerUsage: finance.powerUsage,
    waterUsage: finance.waterUsage,
    income: finance.income,
    expenses: finance.expenses,
  };
}

/**
 * 主模擬步驟（每個 tick 調用一次）
 */
export function simulateTick(state: CityState): CityState {
  if (state.gameSpeed === 'paused') {
    return state;
  }

  const serviced = refreshCityServices(state);
  let newGrid = serviced.grid;

  // 計算人口
  newGrid = computePopulation(newGrid);

  // 計算幸福度
  newGrid = computeHappiness(newGrid);

  // 計算財務
  const finance = computeFinance({ ...state, grid: newGrid });

  // 計算總人口和幸福度
  let totalPopulation = 0;
  let avgHappiness = 0;
  let populationCount = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      totalPopulation += newGrid[r][c].population;
      if (newGrid[r][c].population > 0) {
        avgHappiness += newGrid[r][c].happiness;
        populationCount++;
      }
    }
  }

  avgHappiness = populationCount > 0 ? avgHappiness / populationCount : 50;

  const newMoney = state.money + finance.income - finance.expenses;
  const newTick = state.tick + 1;
  const newDay = Math.floor(newTick / 20) + 1; // 20 ticks per day

  const notifications = state.notifications.filter((n) => newTick - n.timestamp < 100);
  if (state.population < 50 && totalPopulation >= 50) {
    notifications.push({ id: `milestone-50-${newTick}`, message: '里程碑：城市人口突破 50！', type: 'success', timestamp: newTick });
  }
  if (state.money >= 0 && newMoney < 0) {
    notifications.push({ id: `deficit-${newTick}`, message: '市庫已進入赤字，請增加收入或拆除高維護設施', type: 'warning', timestamp: newTick });
  }

  return {
    ...state,
    grid: newGrid,
    money: newMoney,
    population: totalPopulation,
    happiness: Math.round(avgHappiness),
    power: serviced.power,
    powerUsage: finance.powerUsage,
    water: serviced.water,
    waterUsage: finance.waterUsage,
    income: finance.income,
    expenses: finance.expenses,
    tick: newTick,
    day: newDay,
    notifications,
  };
}

export function getCityRank(state: CityState): { name: string; nextPopulation: number | null } {
  if (state.population >= 500) return { name: 'Metropolis', nextPopulation: null };
  if (state.population >= 250) return { name: 'City', nextPopulation: 500 };
  if (state.population >= 100) return { name: 'Town', nextPopulation: 250 };
  if (state.population >= 25) return { name: 'Village', nextPopulation: 100 };
  return { name: 'Settlement', nextPopulation: 25 };
}

export function parseCityState(value: unknown): CityState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Partial<CityState>;
  const buildingTypes = new Set(Object.keys(BUILDING_DEFS));
  const isValidCell = (cell: unknown): cell is CityCell => {
    if (!cell || typeof cell !== 'object') return false;
    const candidate = cell as Partial<CityCell>;
    return typeof candidate.type === 'string'
      && buildingTypes.has(candidate.type)
      && Number.isFinite(candidate.level)
      && Number.isFinite(candidate.population)
      && Number.isFinite(candidate.happiness)
      && Number.isFinite(candidate.placedAt)
      && typeof candidate.powered === 'boolean'
      && typeof candidate.hasWater === 'boolean'
      && typeof candidate.connectedToRoad === 'boolean';
  };
  const validGrid = Array.isArray(state.grid)
    && state.grid.length === GRID_ROWS
    && state.grid.every((row) => Array.isArray(row)
      && row.length === GRID_COLS
      && row.every(isValidCell));
  const validNumbers = ['money', 'population', 'power', 'powerUsage', 'water', 'waterUsage', 'happiness', 'tick', 'day', 'income', 'expenses']
    .every((key) => Number.isFinite(state[key as keyof CityState]));
  const validTool = typeof state.selectedTool === 'string'
    && (state.selectedTool === 'bulldoze'
      || (state.selectedTool !== 'empty' && buildingTypes.has(state.selectedTool)));
  const validSpeed = state.gameSpeed === 'paused' || state.gameSpeed === 'normal' || state.gameSpeed === 'fast';
  const validNotifications = Array.isArray(state.notifications)
    && state.notifications.every((notification) => notification
      && typeof notification.id === 'string'
      && typeof notification.message === 'string'
      && (notification.type === 'info' || notification.type === 'warning' || notification.type === 'success')
      && Number.isFinite(notification.timestamp));

  return validGrid && validNumbers && validTool && validSpeed && validNotifications
    ? state as CityState
    : null;
}

/**
 * localStorage 存檔
 */
export function saveCityState(state: CityState): void {
  try {
    localStorage.setItem('cityBuilder_state', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save city state:', e);
  }
}

/**
 * localStorage 讀檔
 */
export function loadCityState(): CityState | null {
  try {
    const saved = localStorage.getItem('cityBuilder_state');
    if (saved) {
      return parseCityState(JSON.parse(saved));
    }
  } catch (e) {
    console.error('Failed to load city state:', e);
  }
  return null;
}

export { BUILDING_DEFS };
