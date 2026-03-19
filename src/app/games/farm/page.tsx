'use client';

import { useEffect, useState, useCallback } from 'react';
import Container from '@/components/common/Container';
import {
  FarmState,
  PlotState,
  CROP_DEFS,
  FARM_WIDTH,
  FARM_HEIGHT,
  AUTO_SAVE_INTERVAL,
  loadFarmState,
  saveFarmState,
  createInitialState,
  applyOfflineTick,
  handlePlotClick,
  calcLevel,
  xpToNextLevel,
  tickWeather,
  canWater,
  msUntilNextWater,
  formatCountdown,
  WeatherType,
  Season,
  getCurrentSeason,
} from './utils';

export default function FarmPage() {
  const [state, setState] = useState<FarmState>(() => {
    const saved = loadFarmState();
    const initialState = saved ?? createInitialState();
    const currentTime = Date.now();
    const tickedState = applyOfflineTick(initialState, currentTime);
    return tickedState;
  });
  const [now, setNow] = useState<number>(() => Date.now());

  // =========================================================================
  // 自動保存
  // =========================================================================

  useEffect(() => {
    if (!state) return;

    const timer = setInterval(() => {
      saveFarmState(state);
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [state]);

  // =========================================================================
  // 定時 Tick（天氣、成就等）
  // =========================================================================

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setState((current) => {
        if (!current) return current;
        return tickWeather(current, Date.now());
      });
    }, 60000); // 60 秒 tick 一次

    return () => clearInterval(timer);
  }, []);

  // =========================================================================
  // beforeunload 強制保存
  // =========================================================================

  useEffect(() => {
    const handleUnload = () => {
      if (state) {
        saveFarmState(state);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [state]);

  // =========================================================================
  // 更新時間每秒
  // =========================================================================

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // =========================================================================
  // 事件處理
  // =========================================================================

  const onPlotClick = useCallback((plotId: number) => {
    setState((current) => {
      if (!current) return current;
      const newState = handlePlotClick(current, plotId, Date.now());
      saveFarmState(newState);
      return newState;
    });
  }, []);

  const onSelectSeed = useCallback((cropId: string) => {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        selectedSeedId: current.selectedSeedId === cropId ? null : cropId,
      };
    });
  }, []);

  const onSellCrop = useCallback((cropId: string) => {
    setState((current) => {
      if (!current) return current;
      const inventory = current.inventory[cropId] ?? 0;
      if (inventory === 0) return current;

      const crop = CROP_DEFS[cropId];
      if (!crop) return current;

      const newState = {
        ...current,
        player: {
          ...current.player,
          coins: current.player.coins + crop.sellPrice,
        },
        inventory: {
          ...current.inventory,
          [cropId]: inventory - 1,
        },
      };

      saveFarmState(newState);
      return newState;
    });
  }, []);

  if (!state) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-2xl font-bold">加載遊戲中...</div>
        </div>
      </Container>
    );
  }

  const currentSeason = getCurrentSeason(new Date());
  const level = calcLevel(state.player.xp);
  const xpToNext = xpToNextLevel(state.player.xp);

  return (
    <Container>
      <div className="py-4 space-y-4">
        {/* 標題 */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold font-mono text-amber-900">🌾 像素農場</h1>
          <p className="text-sm text-gray-600 mt-2">種植、澆水、收成！</p>
        </div>

        {/* 狀態條 */}
        <StatusBar state={state} level={level} xpToNext={xpToNext} currentSeason={currentSeason} />

        {/* 農田網格 */}
        <FarmGrid state={state} now={now} onPlotClick={onPlotClick} />

        {/* 動作面板 */}
        <ActionPanel
          state={state}
          selectedSeedId={state.selectedSeedId}
          onSelectSeed={onSelectSeed}
          onSellCrop={onSellCrop}
        />
      </div>
    </Container>
  );
}

// ============================================================================
// StatusBar 組件
// ============================================================================

interface StatusBarProps {
  state: FarmState;
  level: number;
  xpToNext: number;
  currentSeason: Season;
}

function StatusBar({ state, level, xpToNext, currentSeason }: StatusBarProps) {
  const weatherEmoji: Record<WeatherType, string> = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    stormy: '⛈️',
  };

  const seasonEmoji: Record<Season, string> = {
    spring: '🌸',
    summer: '🌞',
    autumn: '🍂',
    winter: '❄️',
  };

  const seasonName: Record<Season, string> = {
    spring: '春天',
    summer: '夏天',
    autumn: '秋天',
    winter: '冬天',
  };

  return (
    <div className="bg-amber-100 border-2 border-amber-900 rounded p-4 space-y-3">
      {/* 第一行：金幣 + 等級 */}
      <div className="flex items-center justify-between gap-4 font-mono text-amber-900">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <span className="font-bold text-lg">{state.player.coins}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <span className="font-bold text-lg">Lv. {level}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{seasonEmoji[currentSeason]}</span>
          <span className="text-sm font-bold">{seasonName[currentSeason]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{weatherEmoji[state.weather.current]}</span>
          <span className="text-xs font-bold uppercase">{state.weather.current}</span>
        </div>
      </div>

      {/* 第二行：XP 進度條 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono font-bold text-amber-900">
          <span>經驗值</span>
          <span>{xpToNext} XP 到下一級</span>
        </div>
        <div className="w-full h-4 bg-amber-200 border-2 border-amber-900 rounded overflow-hidden">
          <div
            className="h-full bg-amber-600 transition-all duration-300"
            style={{
              width: `${((state.player.xp % 100) / 100) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FarmGrid 組件
// ============================================================================

interface FarmGridProps {
  state: FarmState;
  now: number;
  onPlotClick: (plotId: number) => void;
}

function FarmGrid({ state, now, onPlotClick }: FarmGridProps) {
  return (
    <div className="flex justify-center">
      <div
        className="gap-1 bg-amber-900 p-2 rounded"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${FARM_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${FARM_HEIGHT}, 1fr)`,
          width: 'fit-content',
        }}
      >
        {state.plots.map((plot) => (
          <PlotCell
            key={plot.id}
            plot={plot}
            now={now}
            onPlotClick={onPlotClick}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PlotCell 組件
// ============================================================================

interface PlotCellProps {
  plot: PlotState;
  now: number;
  onPlotClick: (plotId: number) => void;
}

function PlotCell({ plot, now, onPlotClick }: PlotCellProps) {
  if (!plot.isUnlocked) {
    return (
      <div
        className="w-16 h-16 bg-gray-400 border-2 border-gray-600 flex items-center justify-center cursor-not-allowed opacity-50 font-bold text-2xl"
        title="已鎖定"
      >
        🔒
      </div>
    );
  }

  const crop = plot.cropId ? CROP_DEFS[plot.cropId] : null;
  let bgColor = 'bg-amber-800'; // 空地或翻土
  let displayContent = '';
  let hoverText = '';

  if (plot.status === 'empty') {
    displayContent = '🌍';
    hoverText = '點擊翻土';
  } else if (plot.status === 'tilled') {
    displayContent = '🌱';
    hoverText = '點擊播種';
  } else if (plot.status === 'wilted') {
    bgColor = 'bg-gray-500';
    displayContent = '💀';
    hoverText = '點擊清除';
  } else if (crop) {
    if (plot.status === 'seeded' || plot.status === 'growing') {
      displayContent = crop.emoji;
      const canWaterNow = canWater(plot, crop, now);
      const countdown = msUntilNextWater(plot, crop, now);

      if (canWaterNow) {
        hoverText = `${crop.name} - ${plot.waterCount}/${crop.waterNeeded} 澆水 (可澆)`;
      } else {
        hoverText = `${crop.name} - ${plot.waterCount}/${crop.waterNeeded} 澆水 (${formatCountdown(countdown)})`;
      }

      bgColor = 'bg-green-600';
    } else if (plot.status === 'ready') {
      bgColor = 'bg-green-600 ring-2 ring-yellow-400';
      displayContent = crop.emoji;
      hoverText = `${crop.name} - 就緒！點擊收成`;
    }
  }

  return (
    <button
      onClick={() => onPlotClick(plot.id)}
      title={hoverText}
      className={`
        w-16 h-16 border-2 border-amber-900 text-3xl font-bold
        flex items-center justify-center cursor-pointer
        hover:opacity-80 transition-opacity duration-100
        ${bgColor}
      `}
    >
      {displayContent}
    </button>
  );
}

// ============================================================================
// ActionPanel 組件
// ============================================================================

interface ActionPanelProps {
  state: FarmState;
  selectedSeedId: string | null;
  onSelectSeed: (cropId: string) => void;
  onSellCrop: (cropId: string) => void;
}

function ActionPanel({ state, selectedSeedId, onSelectSeed, onSellCrop }: ActionPanelProps) {
  const availableCrops = Object.values(CROP_DEFS).filter(
    (crop) => state.player.level >= crop.levelRequired
  );

  return (
    <div className="bg-amber-100 border-2 border-amber-900 rounded p-4 space-y-4">
      {/* 種子選擇 */}
      <div>
        <h3 className="font-bold text-amber-900 mb-2 font-mono">📦 選擇種子</h3>
        <div className="flex flex-wrap gap-2">
          {availableCrops.map((crop) => (
            <button
              key={crop.id}
              onClick={() => onSelectSeed(crop.id)}
              className={`
                px-3 py-2 rounded border-2 font-mono text-sm font-bold
                transition-all duration-100
                ${
                  selectedSeedId === crop.id
                    ? 'bg-green-500 border-green-900 text-white ring-2 ring-yellow-400'
                    : 'bg-amber-200 border-amber-900 text-amber-900 hover:bg-amber-300'
                }
              `}
              title={`種子費用：${crop.buyPrice} 金幣 | 售價：${crop.sellPrice} | XP：${crop.xpReward}`}
            >
              {crop.emoji} {crop.name}
            </button>
          ))}
        </div>
      </div>

      {/* 庫存與販賣 */}
      <div>
        <h3 className="font-bold text-amber-900 mb-2 font-mono">🎒 庫存</h3>
        {Object.keys(state.inventory).length === 0 ? (
          <p className="text-sm text-gray-600 italic">尚無物品</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(state.inventory).map(([cropId, count]) => {
              const crop = CROP_DEFS[cropId];
              if (!crop || count === 0) return null;
              return (
                <button
                  key={cropId}
                  onClick={() => onSellCrop(cropId)}
                  className="px-3 py-2 rounded border-2 border-amber-900 bg-yellow-200 text-amber-900 font-mono text-sm font-bold hover:bg-yellow-300 transition-all duration-100"
                  title={`販賣 1 個 ${crop.name} 得 ${crop.sellPrice} 金幣`}
                >
                  {crop.emoji} ×{count} (+{crop.sellPrice}💰)
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 提示 */}
      <div className="text-xs text-gray-600 font-mono bg-white border border-gray-300 p-2 rounded">
        <p>• 點擊空地 → 翻土 → 播種 → 澆水 → 收成</p>
        <p>• 選擇種子後點擊翻好的地進行播種</p>
        <p>• 澆水需要冷卻時間，達到需求次數後可收成</p>
      </div>
    </div>
  );
}
