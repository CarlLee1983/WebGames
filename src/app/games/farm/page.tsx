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

// ============================================================================
// 全局樣式
// ============================================================================

const styles = `
  @keyframes pixelBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @keyframes pixelGlow {
    0%, 100% { box-shadow: inset 0 0 0 3px rgba(0,0,0,0.3); }
    50% { box-shadow: inset 0 0 0 3px rgba(0,0,0,0.1); }
  }

  .pixel-btn {
    transition: all 0.05s linear;
  }

  .pixel-btn:active {
    transform: translate(1px, 1px);
  }

  .pixel-btn-primary:hover:not(:active) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .plot-ready {
    animation: pixelGlow 1.5s ease-in-out infinite;
  }
`;

export default function FarmPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [now, setNow] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // =========================================================================
  // 初始化（客戶端專用）
  // =========================================================================

  useEffect(() => {
    const saved = loadFarmState();
    const initialState = saved ?? createInitialState();
    const currentTime = Date.now();
    const tickedState = applyOfflineTick(initialState, currentTime);
    setState(tickedState);
    setNow(currentTime);
    setIsHydrated(true);
  }, []);

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

  if (!state || !isHydrated) {
    return (
      <Container>
        <style>{styles}</style>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-amber-50 to-green-50">
          <div className="text-2xl font-bold font-mono text-amber-900">⏳ 加載遊戲中...</div>
        </div>
      </Container>
    );
  }

  const currentSeason = getCurrentSeason(new Date());
  const level = calcLevel(state.player.xp);
  const xpToNext = xpToNextLevel(state.player.xp);

  return (
    <Container>
      <style>{styles}</style>
      <div className="py-6 px-4 space-y-6 bg-gradient-to-b from-amber-50 to-green-50 min-h-screen">
        {/* 標題 */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black font-mono text-amber-950 drop-shadow-lg" style={{
            textShadow: '3px 3px 0 rgba(0,0,0,0.2)',
            letterSpacing: '2px'
          }}>
            🌾 像素農場
          </h1>
          <p className="text-sm font-bold text-amber-800 mt-2 font-mono">⬇ 種植 • 澆水 • 收成 ⬇</p>
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

  const weatherName: Record<WeatherType, string> = {
    sunny: '晴天',
    cloudy: '陰天',
    rainy: '下雨',
    stormy: '暴風',
  };

  return (
    <div className="bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-50 border-4 border-amber-900 rounded-lg p-5 space-y-4 shadow-lg" style={{
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.15)',
    }}>
      {/* 第一行：金幣 + 等級 + 天氣 + 季節 */}
      <div className="flex items-center justify-between gap-3 font-mono text-amber-950">
        {/* 金幣 */}
        <div className="flex items-center gap-2 bg-yellow-200 px-4 py-2 rounded border-3 border-amber-900" style={{
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <span className="text-2xl">💰</span>
          <span className="font-bold text-lg">{state.player.coins}</span>
        </div>

        {/* 等級 */}
        <div className="flex items-center gap-2 bg-gradient-to-b from-cyan-300 to-blue-300 px-4 py-2 rounded border-3 border-cyan-900" style={{
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <span className="text-2xl">⭐</span>
          <span className="font-bold text-lg">Lv.{level}</span>
        </div>

        {/* 季節 */}
        <div className="flex items-center gap-2 bg-green-200 px-3 py-2 rounded border-3 border-green-900 text-sm font-bold">
          <span className="text-xl">{seasonEmoji[currentSeason]}</span>
          <span>{seasonName[currentSeason]}</span>
        </div>

        {/* 天氣 */}
        <div className="flex items-center gap-2 bg-purple-200 px-3 py-2 rounded border-3 border-purple-900 text-sm font-bold">
          <span className="text-xl">{weatherEmoji[state.weather.current]}</span>
          <span>{weatherName[state.weather.current]}</span>
        </div>
      </div>

      {/* 第二行：XP 進度條 */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono font-bold text-amber-950">
          <span>📊 經驗值</span>
          <span>{xpToNext} XP 到下一級</span>
        </div>
        <div className="w-full h-6 bg-amber-300 border-4 border-amber-900 rounded overflow-hidden" style={{
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
        }}>
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
            style={{
              width: `${((state.player.xp % 100) / 100) * 100}%`,
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4)',
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
        className="gap-2 bg-gradient-to-br from-amber-900 to-amber-950 p-5 rounded-lg border-6 border-amber-950"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${FARM_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${FARM_HEIGHT}, 1fr)`,
          width: 'fit-content',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2)',
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
      <button
        disabled
        className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-600 border-4 border-gray-700 flex items-center justify-center cursor-not-allowed opacity-60 font-bold text-3xl rounded-sm shadow-md hover:opacity-60 transition-opacity"
        style={{
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.3)',
        }}
        title="已鎖定"
      >
        🔒
      </button>
    );
  }

  const crop = plot.cropId ? CROP_DEFS[plot.cropId] : null;
  let bgGradient = 'from-amber-700 to-amber-900'; // 空地
  let borderColor = 'border-amber-950';
  let shadowColor = 'inset 0 2px 4px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.4)';
  let displayContent = '';
  let hoverText = '';
  let isReady = false;

  if (plot.status === 'empty') {
    displayContent = '🌍';
    hoverText = '點擊翻土';
    bgGradient = 'from-amber-700 to-amber-900';
  } else if (plot.status === 'tilled') {
    displayContent = '🌱';
    hoverText = '點擊播種';
    bgGradient = 'from-amber-600 to-amber-800';
  } else if (plot.status === 'wilted') {
    displayContent = '💀';
    hoverText = '點擊清除';
    bgGradient = 'from-gray-600 to-gray-800';
    borderColor = 'border-gray-900';
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

      bgGradient = 'from-green-500 to-green-700';
      borderColor = 'border-green-900';
    } else if (plot.status === 'ready') {
      bgGradient = 'from-yellow-400 to-yellow-500';
      borderColor = 'border-yellow-800';
      displayContent = crop.emoji;
      hoverText = `${crop.name} - 就緒！點擊收成`;
      isReady = true;
    }
  }

  return (
    <button
      onClick={() => onPlotClick(plot.id)}
      title={hoverText}
      className={`
        pixel-btn pixel-btn-primary w-20 h-20 text-3xl font-bold
        flex items-center justify-center cursor-pointer
        rounded-sm border-4 transition-all duration-75
        bg-gradient-to-b ${bgGradient} ${borderColor}
        ${isReady ? 'plot-ready' : ''}
        hover:brightness-110 active:translate-x-1 active:translate-y-1
      `}
      style={{
        boxShadow: shadowColor,
      }}
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
    <div className="bg-gradient-to-b from-amber-100 to-yellow-50 border-4 border-amber-900 rounded-lg p-5 space-y-5" style={{
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.15)',
    }}>
      {/* 種子選擇 */}
      <div className="space-y-3">
        <h3 className="font-bold text-amber-950 font-mono text-lg" style={{
          textShadow: '1px 1px 0 rgba(255,255,255,0.5)',
        }}>
          📦 選擇種子
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCrops.map((crop) => (
            <button
              key={crop.id}
              onClick={() => onSelectSeed(crop.id)}
              className={`
                pixel-btn pixel-btn-primary px-4 py-2 rounded-sm border-3 font-mono text-sm font-bold
                transition-all duration-75 cursor-pointer
                ${
                  selectedSeedId === crop.id
                    ? 'bg-gradient-to-b from-green-500 to-green-600 border-green-900 text-white shadow-md'
                    : 'bg-gradient-to-b from-amber-300 to-amber-400 border-amber-900 text-amber-950 hover:from-amber-200 hover:to-amber-300'
                }
              `}
              style={{
                boxShadow: selectedSeedId === crop.id
                  ? 'inset 0 2px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)'
                  : 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.1)',
              }}
              title={`需求等級: ${crop.levelRequired} | 購買: ${crop.buyPrice}💰 | 售價: ${crop.sellPrice}💰 | XP: +${crop.xpReward}`}
            >
              {crop.emoji} {crop.name}
            </button>
          ))}
        </div>
      </div>

      {/* 庫存與販賣 */}
      <div className="space-y-3">
        <h3 className="font-bold text-amber-950 font-mono text-lg" style={{
          textShadow: '1px 1px 0 rgba(255,255,255,0.5)',
        }}>
          🎒 庫存
        </h3>
        {Object.keys(state.inventory).length === 0 ? (
          <p className="text-sm text-amber-800 italic font-mono">（尚無物品，收成後會出現）</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(state.inventory).map(([cropId, count]) => {
              const crop = CROP_DEFS[cropId];
              if (!crop || count === 0) return null;
              return (
                <button
                  key={cropId}
                  onClick={() => onSellCrop(cropId)}
                  className="pixel-btn pixel-btn-primary px-4 py-2 rounded-sm border-3 border-yellow-900 bg-gradient-to-b from-yellow-300 to-yellow-400 text-amber-950 font-mono text-sm font-bold hover:from-yellow-200 hover:to-yellow-300 transition-all duration-75"
                  style={{
                    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  title={`販賣 1 個 ${crop.name} 得 ${crop.sellPrice} 金幣`}
                >
                  {crop.emoji} ×{count} → +{crop.sellPrice}💰
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 遊戲教學 */}
      <div className="text-xs text-amber-900 font-mono bg-white bg-opacity-70 border-3 border-amber-900 p-3 rounded-sm space-y-1" style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
      }}>
        <p className="font-bold text-amber-950">📖 遊戲流程：</p>
        <p>① 點擊空地 → 翻土</p>
        <p>② 選擇種子 → 點擊翻好的地 → 播種</p>
        <p>③ 等待冷卻 → 點擊 → 澆水</p>
        <p>④ 澆水次數足夠 → 點擊 → 收成</p>
        <p className="text-amber-800 mt-2">💡 雨天澆水有加倍效果！</p>
      </div>
    </div>
  );
}
