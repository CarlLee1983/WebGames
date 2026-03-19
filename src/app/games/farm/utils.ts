// ============================================================================
// 類型定義
// ============================================================================

export type PlotStatus = 'empty' | 'tilled' | 'seeded' | 'growing' | 'ready' | 'wilted';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy';
export type SpecialMechanism = 'night_only' | 'rain_boost' | 'fast_wilt' | 'double_yield' | 'none';

export interface CropDef {
  id: string;
  name: string;
  emoji: string;
  waterNeeded: number; // 收成所需澆水次數
  growthHours: number; // 冷卻時間（小時）
  sellPrice: number;
  buyPrice: number;
  xpReward: number;
  levelRequired: number;
  seasons: Season[];
  special: SpecialMechanism;
}

export interface PlotState {
  id: number;
  status: PlotStatus;
  cropId: string | null;
  waterCount: number; // 累積澆水次數
  lastWateredAt: number; // 時間戳 ms
  plantedAt: number; // 時間戳 ms
  isUnlocked: boolean;
}

export interface TradeRequest {
  id: string;
  cropId: string;
  quantity: number;
  reward: number; // 金幣
  expiresAt: number;
}

export interface FarmState {
  version: number;
  plots: PlotState[];
  player: {
    coins: number;
    xp: number;
    level: number;
    totalHarvests: number;
  };
  weather: {
    current: WeatherType;
    nextChangeAt: number;
  };
  activeTradeRequest: TradeRequest | null;
  achievements: Record<string, number | null>;
  selectedSeedId: string | null;
  inventory: Record<string, number>;
  lastSavedAt: number;
  createdAt: number;
}

// ============================================================================
// 作物定義 (Phase 1: 3 種; 最終: 8 種)
// ============================================================================

export const CROP_DEFS: Record<string, CropDef> = {
  carrot: {
    id: 'carrot',
    name: '紅蘿蔔',
    emoji: '🥕',
    waterNeeded: 3,
    growthHours: 2,
    sellPrice: 15,
    buyPrice: 5,
    xpReward: 20,
    levelRequired: 1,
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    special: 'none',
  },
  strawberry: {
    id: 'strawberry',
    name: '草莓',
    emoji: '🍓',
    waterNeeded: 4,
    growthHours: 2.5,
    sellPrice: 25,
    buyPrice: 8,
    xpReward: 30,
    levelRequired: 1,
    seasons: ['spring'],
    special: 'none',
  },
  corn: {
    id: 'corn',
    name: '玉米',
    emoji: '🌽',
    waterNeeded: 4,
    growthHours: 3,
    sellPrice: 30,
    buyPrice: 10,
    xpReward: 40,
    levelRequired: 2,
    seasons: ['summer'],
    special: 'rain_boost',
  },
};

// ============================================================================
// 常數
// ============================================================================

export const FARM_WIDTH = 6;
export const FARM_HEIGHT = 6;
export const INITIAL_UNLOCKED_WIDTH = 3;
export const INITIAL_UNLOCKED_HEIGHT = 3;
export const SAVE_KEY = 'farm_save_v1';
export const AUTO_SAVE_INTERVAL = 30000; // 30 秒

// ============================================================================
// 時間工具
// ============================================================================

export function getCurrentSeason(date: Date): Season {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export function isNightTime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 20 || hour < 8;
}

export function msUntilNextWater(plot: PlotState, crop: CropDef, now: number): number {
  const cooldownMs = crop.growthHours * 3600 * 1000;
  const nextWaterTime = plot.lastWateredAt + cooldownMs;
  return Math.max(0, nextWaterTime - now);
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function canWater(plot: PlotState, crop: CropDef, now: number): boolean {
  if (plot.status !== 'seeded' && plot.status !== 'growing') return false;
  if (plot.waterCount >= crop.waterNeeded) return false;

  // 夜間模式檢查
  if (crop.special === 'night_only') {
    const date = new Date(now);
    if (!isNightTime(date)) return false;
  }

  // 檢查澆水冷卻
  const cooldownMs = crop.growthHours * 3600 * 1000;
  const nextWaterTime = plot.lastWateredAt + cooldownMs;
  return now >= nextWaterTime;
}

export function isWilted(plot: PlotState, crop: CropDef, now: number): boolean {
  if (plot.status !== 'growing' && plot.status !== 'seeded') return false;

  // 快速枯萎機制：12 小時未澆
  if (crop.special === 'fast_wilt') {
    const wiltMs = 12 * 3600 * 1000;
    return now - plot.lastWateredAt > wiltMs;
  }

  // 標準枯萎：48 小時未澆
  const wiltMs = 48 * 3600 * 1000;
  return now - plot.lastWateredAt > wiltMs;
}

// ============================================================================
// localStorage 工具
// ============================================================================

export function loadFarmState(): FarmState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return migrateSave(data);
  } catch {
    return null;
  }
}

export function saveFarmState(state: FarmState): void {
  try {
    const updatedState = {
      ...state,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(updatedState));
  } catch (e) {
    console.error('Failed to save farm state:', e);
  }
}

export function migrateSave(raw: unknown): FarmState {
  if (typeof raw !== 'object' || raw === null) {
    return createInitialState();
  }

  const data = raw as unknown;
  return data as FarmState;
}

export function createInitialState(): FarmState {
  const now = Date.now();
  const plots: PlotState[] = [];

  // 初始 6×6 = 36 格，但只解鎖 3×3 = 9 格
  for (let i = 0; i < FARM_WIDTH * FARM_HEIGHT; i++) {
    const row = Math.floor(i / FARM_WIDTH);
    const col = i % FARM_WIDTH;
    const isUnlocked = row < INITIAL_UNLOCKED_HEIGHT && col < INITIAL_UNLOCKED_WIDTH;

    plots.push({
      id: i,
      status: 'empty',
      cropId: null,
      waterCount: 0,
      lastWateredAt: now,
      plantedAt: 0,
      isUnlocked,
    });
  }

  return {
    version: 1,
    plots,
    player: {
      coins: 100,
      xp: 0,
      level: 1,
      totalHarvests: 0,
    },
    weather: {
      current: 'sunny',
      nextChangeAt: now + 4 * 3600 * 1000,
    },
    activeTradeRequest: null,
    achievements: {},
    selectedSeedId: null,
    inventory: {},
    lastSavedAt: now,
    createdAt: now,
  };
}

// ============================================================================
// 農場操作（純函式，不可變）
// ============================================================================

export function tillPlot(state: FarmState, plotId: number): FarmState {
  const plot = state.plots[plotId];
  if (!plot || !plot.isUnlocked || plot.status !== 'empty') return state;

  return {
    ...state,
    plots: state.plots.map((p) =>
      p.id === plotId ? { ...p, status: 'tilled' } : p
    ),
  };
}

export function seedPlot(state: FarmState, plotId: number, cropId: string): FarmState {
  const crop = CROP_DEFS[cropId];
  if (!crop) return state;

  const plot = state.plots[plotId];
  if (!plot || plot.status !== 'tilled') return state;

  // 檢查玩家等級
  if (state.player.level < crop.levelRequired) return state;

  // 檢查庫存或金幣（先用金幣購買）
  const hasSeed = (state.inventory[cropId] ?? 0) > 0;
  const hasCoins = state.player.coins >= crop.buyPrice;

  if (!hasSeed && !hasCoins) return state;

  const now = Date.now();
  const newState = {
    ...state,
    plots: state.plots.map((p) =>
      p.id === plotId
        ? {
            ...p,
            status: 'seeded',
            cropId,
            waterCount: 0,
            lastWateredAt: now,
            plantedAt: now,
          }
        : p
    ),
    player: {
      ...state.player,
      coins: hasSeed ? state.player.coins : state.player.coins - crop.buyPrice,
    },
  };

  return newState;
}

export function waterPlot(state: FarmState, plotId: number, now: number): FarmState {
  const plot = state.plots[plotId];
  if (!plot || (plot.status !== 'seeded' && plot.status !== 'growing')) return state;

  const crop = CROP_DEFS[plot.cropId!];
  if (!crop) return state;

  if (!canWater(plot, crop, now)) return state;

  // rain_boost 檢查
  let waterIncrement = 1;
  if (crop.special === 'rain_boost' && state.weather.current === 'rainy') {
    waterIncrement = 2;
  }

  const newWaterCount = plot.waterCount + waterIncrement;
  const isReady = newWaterCount >= crop.waterNeeded;

  return {
    ...state,
    plots: state.plots.map((p) =>
      p.id === plotId
        ? {
            ...p,
            status: isReady ? 'ready' : 'growing',
            waterCount: newWaterCount,
            lastWateredAt: now,
          }
        : p
    ),
  };
}

export function harvestPlot(state: FarmState, plotId: number, now: number): FarmState {
  const plot = state.plots[plotId];
  if (!plot || plot.status !== 'ready') return state;

  const crop = CROP_DEFS[plot.cropId!];
  if (!crop) return state;

  // double_yield 檢查
  const yield_ = crop.special === 'double_yield' ? 2 : 1;
  const sellReward = crop.sellPrice * yield_;

  const newPlots: PlotState[] = state.plots.map((p) =>
    p.id === plotId
      ? {
          ...p,
          status: 'empty' as const,
          cropId: null,
          waterCount: 0,
          lastWateredAt: now,
          plantedAt: 0,
        }
      : p
  );

  const newInventory: Record<string, number> = {
    ...state.inventory,
    [crop.id]: (state.inventory[crop.id] ?? 0) + yield_,
  };

  return {
    ...state,
    plots: newPlots,
    player: {
      ...state.player,
      coins: state.player.coins + sellReward,
      xp: state.player.xp + crop.xpReward,
      level: calcLevel(state.player.xp + crop.xpReward),
      totalHarvests: state.player.totalHarvests + 1,
    },
    inventory: newInventory,
  };
}

export function clearPlot(state: FarmState, plotId: number): FarmState {
  const plot = state.plots[plotId];
  if (!plot || plot.status !== 'wilted') return state;

  return {
    ...state,
    plots: state.plots.map((p) =>
      p.id === plotId
        ? {
            ...p,
            status: 'empty',
            cropId: null,
            waterCount: 0,
            lastWateredAt: Date.now(),
            plantedAt: 0,
          }
        : p
    ),
  };
}

export function handlePlotClick(state: FarmState, plotId: number, now: number): FarmState {
  const plot = state.plots[plotId];
  if (!plot || !plot.isUnlocked) return state;

  // 優先級：枯萎 > 就緒收成 > 澆水 > 翻土 > 播種
  if (plot.status === 'wilted') {
    return clearPlot(state, plotId);
  }

  if (plot.status === 'ready') {
    return harvestPlot(state, plotId, now);
  }

  if (plot.status === 'seeded' || plot.status === 'growing') {
    const crop = CROP_DEFS[plot.cropId!];
    if (crop && canWater(plot, crop, now, state.weather.current)) {
      return waterPlot(state, plotId, now);
    }
    return state;
  }

  if (plot.status === 'tilled') {
    if (state.selectedSeedId) {
      return seedPlot(state, plotId, state.selectedSeedId);
    }
    return state;
  }

  if (plot.status === 'empty') {
    return tillPlot(state, plotId);
  }

  return state;
}

export function applyOfflineTick(state: FarmState, now: number): FarmState {
  // 離線計算：檢查每個格子是否枯萎
  return {
    ...state,
    plots: state.plots.map((plot) => {
      if (!plot.cropId) return plot;
      const crop = CROP_DEFS[plot.cropId];
      if (!crop) return plot;

      if (isWilted(plot, crop, now) && plot.status !== 'wilted') {
        return { ...plot, status: 'wilted' };
      }

      return plot;
    }),
  };
}

// ============================================================================
// 進度系統
// ============================================================================

export function calcLevel(xp: number): number {
  // 簡單等級計算：每 100 XP 升 1 級
  return Math.floor(xp / 100) + 1;
}

export function xpToNextLevel(xp: number): number {
  const currentLevel = calcLevel(xp);
  const nextLevelXp = currentLevel * 100;
  return nextLevelXp - xp;
}

// ============================================================================
// 天氣系統
// ============================================================================

export function generateWeather(seed: number): WeatherType {
  const rand = (seed * 1103515245 + 12345) >>> 0;
  const chance = (rand >>> 16) % 100;

  if (chance < 40) return 'sunny';
  if (chance < 70) return 'cloudy';
  if (chance < 90) return 'rainy';
  return 'stormy';
}

export function tickWeather(state: FarmState, now: number): FarmState {
  if (now < state.weather.nextChangeAt) return state;

  const newWeather = generateWeather(now);
  return {
    ...state,
    weather: {
      current: newWeather,
      nextChangeAt: now + 4 * 3600 * 1000, // 4 小時後再變
    },
  };
}

// ============================================================================
// 商店相關
// ============================================================================

export function sellCrop(state: FarmState, cropId: string, amount: number): FarmState {
  const crop = CROP_DEFS[cropId];
  if (!crop) return state;

  const inventory = state.inventory[cropId] ?? 0;
  if (inventory < amount) return state;

  return {
    ...state,
    player: {
      ...state.player,
      coins: state.player.coins + crop.sellPrice * amount,
    },
    inventory: {
      ...state.inventory,
      [cropId]: inventory - amount,
    },
  };
}
