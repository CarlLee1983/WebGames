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
// 全局樣式（8bit 復古風格）
// ============================================================================

const styles = `
  /* 調色板：NES 綠 + 棕 + 灰 + 黑 */
  :root {
    --pixel-dark: #1a1a1a;
    --pixel-brown: #8b4513;
    --pixel-green: #2d5016;
    --pixel-light-green: #6ec34d;
    --pixel-yellow: #ffd700;
    --pixel-gray: #808080;
  }

  @keyframes blink {
    0%, 49%, 100% { opacity: 1; }
    50%, 99% { opacity: 0.7; }
  }

  @keyframes pixelFlash {
    0%, 100% { background-color: var(--pixel-light-green); }
    50% { background-color: var(--pixel-yellow); }
  }

  .pixel-btn {
    image-rendering: pixelated;
    transition: none;
    cursor: pointer;
    user-select: none;
  }

  .pixel-btn:active {
    transform: translate(1px, 1px);
  }

  .pixel-btn:hover {
    filter: brightness(1.1);
  }

  .plot-ready {
    animation: pixelFlash 0.8s step-start infinite;
    box-shadow: inset 0 0 0 2px var(--pixel-yellow), 0 0 4px var(--pixel-yellow);
  }

  .stat-badge {
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 1px;
  }

  body {
    image-rendering: pixelated;
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
      <div className="py-6 px-4 space-y-6 min-h-screen" style={{
        backgroundColor: '#2d5016',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(45,80,22,0.3) 8px, rgba(45,80,22,0.3) 16px), repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(45,80,22,0.3) 8px, rgba(45,80,22,0.3) 16px)',
      }}>
        {/* 標題 */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black font-mono text-yellow-300" style={{
            textShadow: '2px 2px 0 #000, 4px 4px 0 rgba(0,0,0,0.5)',
            letterSpacing: '3px'
          }}>
            🌾 PIXEL FARM 🌾
          </h1>
          <p className="text-lg font-bold text-yellow-200 mt-2 font-mono" style={{
            textShadow: '1px 1px 0 #000'
          }}>— PLANT • WATER • HARVEST —</p>
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
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '3px solid #000',
      borderImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%228%22 height=%228%22%3E%3Crect width=%228%22 height=%228%22 fill=%22%23ffd700%22/%3E%3Crect x=%221%22 y=%221%22 width=%226%22 height=%226%22 fill=%22%231a1a1a%22/%3E%3C/svg%3E") 1',
      padding: '12px',
      margin: '4px',
    }} className="space-y-3">
      {/* 第一行：金幣 + 等級 */}
      <div className="flex items-center justify-between gap-3 font-mono stat-badge text-yellow-300" style={{
        textShadow: '1px 1px 0 #000'
      }}>
        {/* 金幣 */}
        <div className="pixel-btn flex items-center gap-2" style={{
          backgroundColor: '#ffd700',
          color: '#000',
          border: '2px solid #000',
          padding: '6px 10px',
          fontWeight: 'bold',
        }}>
          <span className="text-lg">💰</span>
          <span>{state.player.coins}</span>
        </div>

        {/* 等級 */}
        <div className="pixel-btn flex items-center gap-2" style={{
          backgroundColor: '#6ec34d',
          color: '#000',
          border: '2px solid #000',
          padding: '6px 10px',
          fontWeight: 'bold',
        }}>
          <span>LV</span>
          <span className="text-lg">{level}</span>
        </div>

        {/* 季節 */}
        <div className="pixel-btn flex items-center gap-2" style={{
          backgroundColor: '#ffd700',
          color: '#000',
          border: '2px solid #000',
          padding: '6px 10px',
          fontWeight: 'bold',
          fontSize: '12px',
        }}>
          <span>{seasonEmoji[currentSeason]}</span>
          <span>{seasonName[currentSeason]}</span>
        </div>

        {/* 天氣 */}
        <div className="pixel-btn flex items-center gap-2" style={{
          backgroundColor: '#808080',
          color: '#fff',
          border: '2px solid #000',
          padding: '6px 10px',
          fontWeight: 'bold',
          fontSize: '12px',
        }}>
          <span>{weatherEmoji[state.weather.current]}</span>
          <span>{weatherName[state.weather.current]}</span>
        </div>
      </div>

      {/* 第二行：XP 進度條 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono stat-badge text-yellow-300" style={{
          textShadow: '1px 1px 0 #000'
        }}>
          <span>EXP</span>
          <span>{xpToNext} TO LEVEL UP</span>
        </div>
        <div style={{
          width: '100%',
          height: '16px',
          backgroundColor: '#808080',
          border: '2px solid #000',
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 0 rgba(0,0,0,0.5)'
        }}>
          <div
            className="h-full"
            style={{
              width: `${((state.player.xp % 100) / 100) * 100}%`,
              backgroundColor: '#6ec34d',
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 6px)',
              transition: 'width 0.3s step-end',
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
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${FARM_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${FARM_HEIGHT}, 1fr)`,
          gap: '2px',
          padding: '8px',
          backgroundColor: '#1a1a1a',
          border: '4px solid #000',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.8)',
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
      <button
        disabled
        className="pixel-btn w-16 h-16 text-2xl font-black flex items-center justify-center cursor-default opacity-60"
        style={{
          backgroundColor: '#404040',
          border: '2px solid #000',
          color: '#fff',
        }}
        title="已鎖定"
      >
        🔒
      </button>
    );
  }

  const crop = plot.cropId ? CROP_DEFS[plot.cropId] : null;
  let bgColor = '#8b4513'; // 棕色（空地）
  let displayContent = '';
  let hoverText = '';
  let isReady = false;
  let waterProgress = 0;
  let canWaterNow = false;
  let countdown = 0;

  if (plot.status === 'empty') {
    displayContent = '🌍';
    hoverText = 'TILL SOIL';
    bgColor = '#8b4513';
  } else if (plot.status === 'tilled') {
    displayContent = '🌱';
    hoverText = 'PLANT SEED';
    bgColor = '#a0522d';
  } else if (plot.status === 'wilted') {
    displayContent = '💀';
    hoverText = 'CLEAR DEAD';
    bgColor = '#404040';
  } else if (crop) {
    if (plot.status === 'seeded' || plot.status === 'growing') {
      displayContent = crop.emoji;
      canWaterNow = canWater(plot, crop, now);
      countdown = msUntilNextWater(plot, crop, now);
      waterProgress = (plot.waterCount / crop.waterNeeded) * 100;

      if (canWaterNow) {
        hoverText = `${crop.name}\n${plot.waterCount}/${crop.waterNeeded} WATERS\n[CLICK TO WATER]`;
        bgColor = '#6ec34d';
      } else {
        hoverText = `${crop.name}\n${plot.waterCount}/${crop.waterNeeded} WATERS\nWAIT: ${formatCountdown(countdown)}`;
        bgColor = '#5ca03d';
      }
    } else if (plot.status === 'ready') {
      displayContent = crop.emoji;
      hoverText = `${crop.name}\nREADY TO HARVEST!`;
      isReady = true;
      bgColor = '#ffd700';
      waterProgress = 100;
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => onPlotClick(plot.id)}
        title={hoverText}
        className={`pixel-btn w-16 h-16 text-2xl font-black flex items-center justify-center cursor-pointer relative`}
        style={{
          backgroundColor: bgColor,
          border: '2px solid #000',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)',
          animation: isReady ? 'pixelFlash 0.8s step-start infinite' : 'none',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'translate(1px, 1px)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'translate(0, 0)')}
      >
        {displayContent}
      </button>

      {/* 收成進度條 */}
      {crop && (plot.status === 'seeded' || plot.status === 'growing' || plot.status === 'ready') && (
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            left: '2px',
            right: '2px',
            height: '4px',
            backgroundColor: '#404040',
            border: '1px solid #000',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(waterProgress, 100)}%`,
              backgroundColor: waterProgress >= 100 ? '#ffd700' : '#6ec34d',
              transition: 'width 0.2s step-end',
            }}
          />
        </div>
      )}

      {/* 澆水冷卻指示器（圓形倒計時） */}
      {crop && (plot.status === 'seeded' || plot.status === 'growing') && !canWaterNow && countdown > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '12px',
            height: '12px',
            backgroundColor: '#808080',
            border: '1px solid #000',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            fontWeight: 'bold',
            color: '#000',
          }}
          title={`冷卻中：${formatCountdown(countdown)}`}
        >
          ⏳
        </div>
      )}
    </div>
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
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '3px solid #000',
      padding: '12px',
    }} className="space-y-4">
      {/* 種子選擇 */}
      <div className="space-y-2">
        <h3 className="font-mono stat-badge text-yellow-300" style={{
          textShadow: '1px 1px 0 #000',
          fontSize: '14px',
        }}>
          [SEEDS]
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableCrops.map((crop) => (
            <button
              key={crop.id}
              onClick={() => onSelectSeed(crop.id)}
              className="pixel-btn text-lg font-black"
              style={{
                backgroundColor: selectedSeedId === crop.id ? '#6ec34d' : '#ffd700',
                color: '#000',
                border: '2px solid #000',
                padding: '6px 8px',
                cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)',
              }}
              title={`Lv.${crop.levelRequired} | Buy:${crop.buyPrice}💰 | Sell:${crop.sellPrice}💰`}
            >
              {crop.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 庫存與販賣 */}
      <div className="space-y-2">
        <h3 className="font-mono stat-badge text-yellow-300" style={{
          textShadow: '1px 1px 0 #000',
          fontSize: '14px',
        }}>
          [INVENTORY]
        </h3>
        {Object.keys(state.inventory).length === 0 ? (
          <div style={{
            backgroundColor: '#404040',
            border: '2px dashed #ffd700',
            padding: '8px',
            color: '#ffd700',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fontSize: '12px',
            textAlign: 'center',
          }}>
            EMPTY
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(state.inventory).map(([cropId, count]) => {
              const crop = CROP_DEFS[cropId];
              if (!crop || count === 0) return null;
              return (
                <button
                  key={cropId}
                  onClick={() => onSellCrop(cropId)}
                  className="pixel-btn text-lg font-black"
                  style={{
                    backgroundColor: '#ffd700',
                    color: '#000',
                    border: '2px solid #000',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)',
                    fontSize: '12px',
                  }}
                  title={`SELL for ${crop.sellPrice}💰`}
                >
                  {crop.emoji} x{count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 遊戲教學 */}
      <div style={{
        backgroundColor: '#404040',
        border: '2px solid #ffd700',
        padding: '8px',
        color: '#ffd700',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: '11px',
        lineHeight: '1.5',
        textShadow: '1px 1px 0 #000',
      }}>
        <div className="mb-1">— HOW TO PLAY —</div>
        <div>① CLICK DIRT</div>
        <div>② SELECT SEED</div>
        <div>③ WATER & WAIT</div>
        <div>④ HARVEST!</div>
        <div className="mt-1 pt-1 border-t border-yellow-600">
          💡 RAIN 2x WATER!
        </div>
      </div>
    </div>
  );
}
