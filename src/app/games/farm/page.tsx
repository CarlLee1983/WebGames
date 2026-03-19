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
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-4px) scale(1.05); }
  }

  @keyframes pixelGlow {
    0%, 100% {
      box-shadow: inset 0 0 0 3px rgba(0,0,0,0.3),
                  0 0 12px rgba(255,215,0,0.6),
                  0 0 24px rgba(255,215,0,0.3);
    }
    50% {
      box-shadow: inset 0 0 0 3px rgba(0,0,0,0.1),
                  0 0 20px rgba(255,215,0,0.9),
                  0 0 32px rgba(255,215,0,0.5);
    }
  }

  @keyframes pixelPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .pixel-btn {
    transition: all 0.08s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
  }

  .pixel-btn::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: inherit;
    border-radius: inherit;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .pixel-btn:active {
    transform: translate(2px, 2px) scale(0.98);
  }

  .pixel-btn-primary:hover:not(:active) {
    filter: brightness(1.2) saturate(1.1);
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 6px 12px rgba(0,0,0,0.3) !important;
  }

  .plot-ready {
    animation: pixelGlow 1.2s ease-in-out infinite;
  }

  .stat-card {
    animation: slideDown 0.4s ease-out;
  }

  .action-button {
    position: relative;
    overflow: hidden;
  }

  .action-button::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }

  .action-button:active::after {
    width: 300px;
    height: 300px;
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
    <div className="bg-gradient-to-br from-amber-100 via-yellow-100 to-orange-100 border-6 border-amber-950 rounded-lg p-6 space-y-5 shadow-2xl" style={{
      boxShadow: `
        inset 0 2px 0 rgba(255,255,255,0.6),
        inset 0 -2px 4px rgba(0,0,0,0.1),
        0 8px 16px rgba(0,0,0,0.2),
        0 0 20px rgba(255,165,0,0.3)
      `,
      background: 'linear-gradient(135deg, #fef3c7 0%, #fef3c7 50%, #fed7aa 100%)',
    }}>
      {/* 第一行：金幣 + 等級 + 天氣 + 季節 */}
      <div className="flex items-center justify-between gap-4 font-mono text-amber-950">
        {/* 金幣 */}
        <div className="stat-card flex items-center gap-3 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 px-5 py-3 rounded-lg border-4 border-amber-900 font-bold" style={{
          boxShadow: `
            inset 0 2px 0 rgba(255,255,255,0.6),
            0 4px 12px rgba(0,0,0,0.2),
            0 0 8px rgba(255,215,0,0.5)
          `,
        }}>
          <span className="text-3xl animate-bounce">💰</span>
          <span className="text-2xl drop-shadow-lg">{state.player.coins}</span>
        </div>

        {/* 等級 */}
        <div className="stat-card flex items-center gap-3 bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-400 px-5 py-3 rounded-lg border-4 border-indigo-900 font-bold text-white" style={{
          boxShadow: `
            inset 0 2px 0 rgba(255,255,255,0.4),
            0 4px 12px rgba(0,0,0,0.2),
            0 0 12px rgba(100,200,255,0.5)
          `,
        }}>
          <span className="text-3xl">⭐</span>
          <span className="text-2xl drop-shadow-lg">Lv.{level}</span>
        </div>

        {/* 季節 */}
        <div className="stat-card flex items-center gap-2 bg-gradient-to-br from-green-400 to-emerald-500 px-4 py-3 rounded-lg border-4 border-green-900 text-sm font-bold text-white" style={{
          boxShadow: `
            inset 0 2px 0 rgba(255,255,255,0.3),
            0 4px 12px rgba(0,0,0,0.2),
            0 0 8px rgba(100,200,100,0.4)
          `,
        }}>
          <span className="text-2xl">{seasonEmoji[currentSeason]}</span>
          <span className="drop-shadow-lg">{seasonName[currentSeason]}</span>
        </div>

        {/* 天氣 */}
        <div className="stat-card flex items-center gap-2 bg-gradient-to-br from-purple-400 to-pink-400 px-4 py-3 rounded-lg border-4 border-purple-900 text-sm font-bold text-white" style={{
          boxShadow: `
            inset 0 2px 0 rgba(255,255,255,0.3),
            0 4px 12px rgba(0,0,0,0.2),
            0 0 12px rgba(200,100,200,0.4)
          `,
        }}>
          <span className="text-2xl">{weatherEmoji[state.weather.current]}</span>
          <span className="drop-shadow-lg">{weatherName[state.weather.current]}</span>
        </div>
      </div>

      {/* 分隔線 */}
      <div className="h-2 bg-gradient-to-r from-transparent via-amber-900 to-transparent border-t-2 border-b-2 border-amber-900 opacity-50"></div>

      {/* 第二行：XP 進度條 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-mono font-bold text-amber-950 drop-shadow-sm">
          <span className="text-lg">📊 經驗值進度</span>
          <span className="bg-yellow-300 px-3 py-1 rounded border-2 border-amber-900">{xpToNext} XP 到下一級</span>
        </div>
        <div className="w-full h-8 bg-gradient-to-b from-amber-300 to-amber-400 border-4 border-amber-900 rounded-lg overflow-hidden" style={{
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.15)',
        }}>
          <div
            className="h-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 transition-all duration-500 relative"
            style={{
              width: `${((state.player.xp % 100) / 100) * 100}%`,
              boxShadow: `
                inset 0 2px 0 rgba(255,255,255,0.5),
                0 0 16px rgba(100,200,100,0.6)
              `,
            }}
          >
            {/* 進度條動畫線 */}
            <div className="absolute inset-0 opacity-50" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)',
              animation: 'slideDown 1s linear infinite',
            }}></div>
          </div>
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
      <div className="relative">
        {/* 農田邊框裝飾 */}
        <div className="absolute -inset-4 bg-gradient-to-br from-amber-900 via-amber-950 to-amber-950 rounded-2xl blur-lg opacity-50 -z-10"></div>

        <div
          className="gap-3 bg-gradient-to-br from-amber-900 via-amber-950 to-amber-950 p-6 rounded-2xl border-8 border-amber-950"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${FARM_WIDTH}, 1fr)`,
            gridTemplateRows: `repeat(${FARM_HEIGHT}, 1fr)`,
            width: 'fit-content',
            boxShadow: `
              inset 0 2px 4px rgba(0,0,0,0.5),
              inset 0 -4px 8px rgba(0,0,0,0.3),
              0 12px 24px rgba(0,0,0,0.4),
              0 0 30px rgba(139,69,19,0.4)
            `,
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 88px, rgba(0,0,0,0.2) 88px, rgba(0,0,0,0.2) 91px)',
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
        className="w-20 h-20 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-700 border-4 border-gray-800 flex items-center justify-center cursor-not-allowed opacity-50 font-bold text-3xl rounded-lg shadow-lg hover:opacity-50 transition-opacity"
        style={{
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.4)',
        }}
        title="已鎖定 - 需要農田擴充"
      >
        🔒
      </button>
    );
  }

  const crop = plot.cropId ? CROP_DEFS[plot.cropId] : null;
  let bgGradient = 'from-amber-700 to-amber-900';
  let borderColor = 'border-amber-950';
  let displayContent = '';
  let hoverText = '';
  let isReady = false;
  let glowColor = '';

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
    bgGradient = 'from-gray-600 via-gray-700 to-gray-800';
    borderColor = 'border-gray-900';
  } else if (crop) {
    if (plot.status === 'seeded' || plot.status === 'growing') {
      displayContent = crop.emoji;
      const canWaterNow = canWater(plot, crop, now);
      const countdown = msUntilNextWater(plot, crop, now);

      if (canWaterNow) {
        hoverText = `${crop.name} - ${plot.waterCount}/${crop.waterNeeded} 澆水 (可澆！)`;
        bgGradient = 'from-green-500 via-green-600 to-green-700';
        glowColor = '0 0 16px rgba(100,200,100,0.6)';
      } else {
        hoverText = `${crop.name} - ${plot.waterCount}/${crop.waterNeeded} 澆水 (${formatCountdown(countdown)})`;
        bgGradient = 'from-green-500 to-green-700';
      }

      borderColor = 'border-green-900';
    } else if (plot.status === 'ready') {
      bgGradient = 'from-yellow-400 via-yellow-500 to-orange-400';
      borderColor = 'border-yellow-800';
      displayContent = crop.emoji;
      hoverText = `${crop.name} - 就緒！點擊收成`;
      isReady = true;
      glowColor = '0 0 24px rgba(255,215,0,0.8)';
    }
  }

  return (
    <button
      onClick={() => onPlotClick(plot.id)}
      title={hoverText}
      className={`
        pixel-btn pixel-btn-primary w-20 h-20 text-3xl font-black
        flex items-center justify-center cursor-pointer
        rounded-lg border-4 transition-all duration-75
        bg-gradient-to-br ${bgGradient} ${borderColor}
        ${isReady ? 'plot-ready' : ''}
        hover:brightness-110 hover:scale-105 active:scale-95
      `}
      style={{
        boxShadow: `
          inset 0 2px 4px rgba(255,255,255,0.2),
          0 4px 8px rgba(0,0,0,0.3),
          ${glowColor}
        `,
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
    <div className="bg-gradient-to-b from-amber-100 via-yellow-100 to-orange-50 border-6 border-amber-950 rounded-lg p-6 space-y-6 shadow-2xl" style={{
      boxShadow: `
        inset 0 2px 0 rgba(255,255,255,0.6),
        inset 0 -2px 4px rgba(0,0,0,0.1),
        0 8px 16px rgba(0,0,0,0.2)
      `,
    }}>
      {/* 種子選擇 */}
      <div className="space-y-4">
        <h3 className="font-black text-amber-950 font-mono text-2xl drop-shadow-lg flex items-center gap-2" style={{
          textShadow: '2px 2px 0 rgba(255,255,255,0.7)',
        }}>
          📦 選擇種子
          <span className="text-sm bg-orange-500 text-white px-2 py-1 rounded-full font-bold">Lv.{Math.max(...availableCrops.map(c => c.levelRequired))}</span>
        </h3>
        <div className="flex flex-wrap gap-3">
          {availableCrops.map((crop) => (
            <button
              key={crop.id}
              onClick={() => onSelectSeed(crop.id)}
              className={`
                action-button pixel-btn pixel-btn-primary px-5 py-3 rounded-lg border-4 font-mono font-bold text-base
                transition-all duration-100 cursor-pointer relative
                ${
                  selectedSeedId === crop.id
                    ? 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 border-green-900 text-white'
                    : 'bg-gradient-to-br from-orange-300 via-yellow-400 to-amber-400 border-amber-900 text-amber-950 hover:from-orange-200 hover:via-yellow-300 hover:to-amber-300'
                }
              `}
              style={{
                boxShadow: selectedSeedId === crop.id
                  ? `
                    inset 0 2px 0 rgba(255,255,255,0.3),
                    0 6px 12px rgba(0,0,0,0.3),
                    0 0 16px rgba(100,200,100,0.5)
                  `
                  : `
                    inset 0 2px 0 rgba(255,255,255,0.6),
                    0 4px 8px rgba(0,0,0,0.15)
                  `,
              }}
              title={`需求等級: ${crop.levelRequired} | 購買: ${crop.buyPrice}💰 | 售價: ${crop.sellPrice}💰 | XP: +${crop.xpReward}`}
            >
              <span className="text-2xl">{crop.emoji}</span>
              <span className="drop-shadow-lg">{crop.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 分隔線 */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-900 to-transparent opacity-50"></div>

      {/* 庫存與販賣 */}
      <div className="space-y-4">
        <h3 className="font-black text-amber-950 font-mono text-2xl drop-shadow-lg" style={{
          textShadow: '2px 2px 0 rgba(255,255,255,0.7)',
        }}>
          🎒 庫存收穫
        </h3>
        {Object.keys(state.inventory).length === 0 ? (
          <div className="text-center py-6 bg-white bg-opacity-50 rounded-lg border-4 border-dashed border-amber-400">
            <p className="text-lg text-amber-800 italic font-mono font-bold">
              🌱 尚無物品<br/>
              <span className="text-sm">收成後會出現在這裡</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(state.inventory).map(([cropId, count]) => {
              const crop = CROP_DEFS[cropId];
              if (!crop || count === 0) return null;
              return (
                <button
                  key={cropId}
                  onClick={() => onSellCrop(cropId)}
                  className="action-button pixel-btn pixel-btn-primary px-5 py-3 rounded-lg border-4 border-orange-900 bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-400 text-amber-950 font-mono font-bold text-base hover:from-yellow-200 hover:via-yellow-300 hover:to-orange-300 transition-all duration-100 relative"
                  style={{
                    boxShadow: `
                      inset 0 2px 0 rgba(255,255,255,0.6),
                      0 4px 12px rgba(0,0,0,0.15),
                      0 0 12px rgba(255,200,100,0.4)
                    `,
                  }}
                  title={`販賣 1 個 ${crop.name} 得 ${crop.sellPrice} 金幣`}
                >
                  <span className="text-2xl">{crop.emoji}</span>
                  <span className="drop-shadow-lg">×{count}</span>
                  <span className="text-yellow-600 font-black drop-shadow-lg">+{crop.sellPrice}💰</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 遊戲教學 */}
      <div className="text-sm font-mono bg-gradient-to-br from-blue-200 to-blue-100 border-4 border-blue-900 p-4 rounded-lg space-y-2 text-blue-950 font-bold" style={{
        boxShadow: `
          inset 0 2px 0 rgba(255,255,255,0.6),
          0 4px 8px rgba(0,0,0,0.1),
          0 0 12px rgba(100,150,255,0.3)
        `,
      }}>
        <p className="text-lg drop-shadow-sm">📖 遊戲流程</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white bg-opacity-50 p-2 rounded border-2 border-blue-900">① 點擊空地<br/>→ 翻土</div>
          <div className="bg-white bg-opacity-50 p-2 rounded border-2 border-blue-900">② 選擇種子<br/>→ 播種</div>
          <div className="bg-white bg-opacity-50 p-2 rounded border-2 border-blue-900">③ 等待冷卻<br/>→ 澆水</div>
          <div className="bg-white bg-opacity-50 p-2 rounded border-2 border-blue-900">④ 達成目標<br/>→ 收成</div>
        </div>
        <div className="bg-yellow-200 border-2 border-yellow-700 p-2 rounded text-yellow-900 font-black text-xs text-center">
          💡 雨天澆水有加倍效果！ ⚡
        </div>
      </div>
    </div>
  );
}
