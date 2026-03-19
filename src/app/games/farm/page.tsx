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
// 全局樣式（16-bit 超任風格 / SNES Style）
// ============================================================================

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  :root {
    --snes-bg: #4a90e2; /* Sky blue */
    --snes-panel-bg: #2b3044;
    --snes-panel-border: #f8f8f8;
    --snes-button-outline: #222222;
    --snes-button-top: #eaeaea;
    --snes-button-bottom: #a2a2a2;
    --snes-wood-bg: #8c5a35;
    --snes-wood-border: #4d2d14;
    
    --snes-grass-dark: #3b8a3e;
    --snes-grass-light: #5db944;
    --snes-dirt-tilled: #5a3118;
    --snes-dirt-dry: #A66C41;
  }

  .snes-font {
    font-family: 'Press Start 2P', 'Courier New', monospace;
    text-transform: uppercase;
    line-height: 1.4;
  }

  .snes-text-shadow {
    text-shadow: 2px 2px 0px #000;
  }

  .snes-panel {
    background: linear-gradient(135deg, #1b2762 0%, #000c42 100%);
    border: 4px solid #fff;
    border-radius: 8px;
    box-shadow: inset 0 0 0 2px #5f6eb3, 4px 4px 0px rgba(0,0,0,0.5);
    color: white;
    padding: 16px;
  }

  .snes-wood-panel {
    background-color: var(--snes-wood-bg);
    background-image:
      linear-gradient(90deg, rgba(0,0,0,0.1) 2px, transparent 2px),
      linear-gradient(0deg, rgba(0,0,0,0.1) 2px, transparent 2px);
    background-size: 16px 16px;
    border: 4px solid var(--snes-wood-border);
    box-shadow: inset 0 0 8px rgba(0,0,0,0.5), 4px 4px 0px rgba(0,0,0,0.4);
    color: #fff;
  }

  .snes-button {
    background: linear-gradient(to bottom, var(--snes-button-top) 0%, var(--snes-button-bottom) 100%);
    border: 3px solid var(--snes-button-outline);
    border-radius: 6px;
    color: #222;
    cursor: pointer;
    box-shadow: inset 0 2px 0 rgba(255,255,255,0.5), 2px 2px 0 rgba(0,0,0,0.3);
    image-rendering: pixelated;
    transition: all 0.1s;
    user-select: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .snes-button:active {
    transform: translate(2px, 2px);
    box-shadow: inset 0 2px 0 rgba(0,0,0,0.1), 0px 0px 0 rgba(0,0,0,0.3);
    background: linear-gradient(to bottom, var(--snes-button-bottom) 0%, var(--snes-button-top) 100%);
  }

  .snes-button:disabled {
    filter: grayscale(100%);
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: inset 0 2px 0 rgba(255,255,255,0.2);
  }

  .snes-button-action {
    background: linear-gradient(to bottom, #7ece5d 0%, #469a21 100%);
    color: #fff;
    text-shadow: 1px 1px 0px #000;
  }
  .snes-button-action:active {
    background: linear-gradient(to bottom, #469a21 0%, #7ece5d 100%);
  }

  .snes-button-selected {
    background: linear-gradient(to bottom, #ffd15c 0%, #e29d00 100%);
    border-color: #8c5a00;
    box-shadow: inset 0 2px 0 rgba(255,255,255,0.8), 2px 2px 0 rgba(0,0,0,0.3);
  }

  .grass-bg {
    background-color: var(--snes-grass-light);
    background-image:
      radial-gradient(var(--snes-grass-dark) 10%, transparent 11%),
      radial-gradient(var(--snes-grass-dark) 10%, transparent 11%);
    background-size: 24px 24px;
    background-position: 0 0, 12px 12px;
  }

  .snes-plot {
    width: 14vw;
    height: 14vw;
    max-width: 5rem;
    max-height: 5rem;
    border: 3px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    user-select: none;
    image-rendering: pixelated;
    transition: filter 0.1s;
  }
  .snes-plot:hover {
    filter: brightness(1.1);
  }
  .snes-plot:active {
    filter: brightness(0.9);
  }

  .plot-dry {
    background-color: var(--snes-dirt-dry);
    border-color: #633615;
    box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
  }

  .plot-tilled {
    background-color: var(--snes-dirt-tilled);
    border-color: #2b1609;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.6);
  }

  .plot-watered {
    background-color: #3b2010; /* Very dark wet soil */
    border-color: #1a0f07;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
  }

  .plot-locked {
    background-color: #444;
    border-color: #222;
    background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, #333 10px, #333 20px);
    cursor: not-allowed;
    opacity: 0.8;
  }

  @keyframes cropBounce {
    0%, 100% { transform: translateY(0); filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); }
    50% { transform: translateY(-4px); filter: drop-shadow(0 6px 4px rgba(0,0,0,0.3)); }
  }

  .crop-bounce {
    animation: cropBounce 1s infinite alternate;
  }

  .water-bar-container {
    position: absolute;
    bottom: 2px;
    left: 4px;
    right: 4px;
    height: 6px;
    background: #222;
    border: 1px solid #111;
    border-radius: 2px;
    overflow: hidden;
  }
  .water-bar-fill {
    height: 100%;
    background: linear-gradient(to bottom, #4ea3e5, #1e6fae);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
    transition: width 0.3s ease;
  }
  .water-bar-ready {
    background: linear-gradient(to bottom, #fceb5d, #dfa900);
  }
`;

export default function FarmPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [now, setNow] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const saved = loadFarmState();
    const initialState = saved ?? createInitialState();
    const currentTime = Date.now();
    const tickedState = applyOfflineTick(initialState, currentTime);
    setState(tickedState);
    setNow(currentTime);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => {
      saveFarmState(state);
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [state]);

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

  useEffect(() => {
    const handleUnload = () => {
      if (state) {
        saveFarmState(state);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        <div className="flex items-center justify-center min-h-screen bg-gray-900 snes-font text-white">
          <div className="text-xl animate-pulse snes-text-shadow text-yellow-400">LOADING GAME...</div>
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
      <div className="py-8 px-4 space-y-8 min-h-screen grass-bg snes-font">
        {/* 標題區 */}
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-black text-yellow-300 snes-text-shadow mb-3" style={{ textShadow: '4px 4px 0 #000, 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}>
            SUPER PIXEL FARM
          </h1>
          <p className="text-sm md:text-base text-white snes-text-shadow">
            - A 16-BIT LIFE -
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 左側/上方：狀態與操作面板 */}
          <div className="space-y-6 lg:col-span-1">
            <StatusBar state={state} level={level} xpToNext={xpToNext} currentSeason={currentSeason} />
            <ActionPanel
              state={state}
              selectedSeedId={state.selectedSeedId}
              onSelectSeed={onSelectSeed}
              onSellCrop={onSellCrop}
            />
          </div>

          {/* 右側：農田網格 */}
          <div className="lg:col-span-2 flex justify-center items-start">
            <FarmGrid state={state} now={now} onPlotClick={onPlotClick} />
          </div>

        </div>
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

  return (
    <div className="snes-panel space-y-4">
      {/* 標題 */}
      <div className="text-yellow-300 border-b-2 border-white/20 pb-2 text-center text-sm snes-text-shadow">
        ★ FARM STATUS ★
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
        <div className="bg-black/50 p-2 rounded border border-white/20 flex items-center justify-between">
          <span className="text-gray-300">GOLD</span>
          <span className="text-yellow-400 snes-text-shadow">{state.player.coins}</span>
        </div>
        <div className="bg-black/50 p-2 rounded border border-white/20 flex items-center justify-between">
          <span className="text-gray-300">LVL</span>
          <span className="text-green-400 snes-text-shadow">{level}</span>
        </div>
        <div className="bg-black/50 p-2 rounded border border-white/20 flex items-center justify-between">
          <span className="text-gray-300">SEA</span>
          <span className="text-white snes-text-shadow">{seasonEmoji[currentSeason]} {currentSeason.toUpperCase()}</span>
        </div>
        <div className="bg-black/50 p-2 rounded border border-white/20 flex items-center justify-between">
          <span className="text-gray-300">WTH</span>
          <span className="text-white snes-text-shadow">{weatherEmoji[state.weather.current]} {state.weather.current.toUpperCase()}</span>
        </div>
      </div>

      {/* XP Progress */}
      <div className="space-y-1 pt-2">
        <div className="flex justify-between text-[10px] text-gray-300">
          <span>EXP</span>
          <span>{xpToNext} TO NEXT</span>
        </div>
        <div className="h-4 bg-black border-2 border-gray-600 rounded-sm overflow-hidden relative">
          <div
            className="h-full bg-green-500 absolute top-0 left-0"
            style={{
              width: `${((state.player.xp % 100) / 100) * 100}%`,
              boxShadow: 'inset 0 4px 6px -4px rgba(255,255,255,0.6), inset 0 -4px 6px -4px rgba(0,0,0,0.6)',
              transition: 'width 0.3s ease-out',
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
    <div className="snes-wood-panel p-3 inline-block">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${FARM_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${FARM_HEIGHT}, 1fr)`,
          gap: '2px',
          backgroundColor: '#4d2d14',
          border: '4px solid #331d0b',
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
      <div className="snes-plot plot-locked" title="LOCKED">
        <span className="text-2xl opacity-50 drop-shadow-md">🔒</span>
      </div>
    );
  }

  const crop = plot.cropId ? CROP_DEFS[plot.cropId] : null;
  let plotClass = 'plot-dry';
  let displayContent = '';
  let hoverText = 'TILL SOIL';
  let isReady = false;
  let waterProgress = 0;
  let canWaterNow = false;
  let countdown = 0;

  if (plot.status === 'empty') {
    plotClass = 'plot-dry';
  } else if (plot.status === 'tilled') {
    plotClass = 'plot-tilled';
    hoverText = 'PLANT SEED';
  } else if (plot.status === 'wilted') {
    plotClass = 'plot-tilled';
    displayContent = '🍂';
    hoverText = 'CLEAR DEAD CROP';
  } else if (crop) {
    plotClass = 'plot-watered'; // 預設給一種濕潤的泥土感
    if (plot.status === 'seeded' || plot.status === 'growing') {
      displayContent = plot.status === 'seeded' ? '🌰' : crop.emoji;
      canWaterNow = canWater(plot, crop, now);
      countdown = msUntilNextWater(plot, crop, now);
      waterProgress = (plot.waterCount / crop.waterNeeded) * 100;

      if (!canWaterNow && countdown > 0) {
        plotClass = 'plot-watered'; // 剛澆過水
        hoverText = `${crop.name.toUpperCase()}\nWAIT: ${formatCountdown(countdown)}`;
      } else {
        plotClass = 'plot-tilled'; // 乾了，需要澆水
        hoverText = `${crop.name.toUpperCase()}\nWATER: ${plot.waterCount}/${crop.waterNeeded}`;
      }
    } else if (plot.status === 'ready') {
      plotClass = 'plot-tilled';
      displayContent = crop.emoji;
      hoverText = `${crop.name.toUpperCase()}\nREADY TO HARVEST!`;
      isReady = true;
      waterProgress = 100;
    }
  }

  return (
    <div
      onClick={() => onPlotClick(plot.id)}
      title={hoverText}
      className={`snes-plot ${plotClass}`}
    >
      <div className={`text-3xl filter drop-shadow-md ${isReady ? 'crop-bounce' : ''}`} style={{ transform: plot.status === 'growing' ? 'scale(0.8)' : 'scale(1)' }}>
        {displayContent}
      </div>

      {crop && (plot.status === 'seeded' || plot.status === 'growing' || plot.status === 'ready') && (
        <div className="water-bar-container">
          <div
            className={`water-bar-fill ${waterProgress >= 100 ? 'water-bar-ready' : ''}`}
            style={{ width: `${Math.min(waterProgress, 100)}%` }}
          />
        </div>
      )}

      {crop && (plot.status === 'seeded' || plot.status === 'growing') && !canWaterNow && countdown > 0 && (
        <div className="absolute top-1 right-1 w-4 h-4 bg-gray-800 border border-black flex items-center justify-center rounded-sm">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
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
    <div className="snes-wood-panel p-4 space-y-5">
      
      {/* SEEDS */}
      <div>
        <h3 className="text-yellow-300 text-xs border-b-2 border-yellow-800/50 pb-1 mb-3 snes-text-shadow">
          ► SEEDS
        </h3>
        <div className="flex flex-wrap gap-3">
          {availableCrops.map((crop) => {
            const isSelected = selectedSeedId === crop.id;
            return (
              <button
                key={crop.id}
                onClick={() => onSelectSeed(crop.id)}
                className={`snes-button ${isSelected ? 'snes-button-selected' : ''} px-3 py-2 text-2xl`}
                title={`${crop.name.toUpperCase()} (Lv.${crop.levelRequired})\nBUY: ${crop.buyPrice} GLD\nSELL: ${crop.sellPrice} GLD`}
              >
                {crop.emoji}
              </button>
            );
          })}
        </div>
      </div>

      {/* INVENTORY */}
      <div>
        <h3 className="text-yellow-300 text-xs border-b-2 border-yellow-800/50 pb-1 mb-3 snes-text-shadow">
          ► INVENTORY
        </h3>
        {Object.keys(state.inventory).length === 0 ? (
          <div className="bg-black/40 text-gray-400 text-[10px] text-center p-3 rounded border border-black/50">
            EMPTY BAG
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
                  className="snes-button snes-button-action px-2 py-1 flex items-center gap-1"
                  title={`SELL FOR ${crop.sellPrice} GLD`}
                >
                  <span className="text-xl">{crop.emoji}</span>
                  <span className="text-[10px]">x{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* HOW TO PLAY */}
      <div className="bg-black/60 p-3 rounded border border-gray-700 mt-4 text-[9px] leading-relaxed text-gray-300">
        <div className="text-yellow-400 mb-1 text-[10px]">INSTRUCTIONS:</div>
        <div>1. TAP DIRT TO TILL</div>
        <div>2. SELECT A SEED & PLANT</div>
        <div>3. WATER IT AND WAIT</div>
        <div>4. HARVEST WHEN GLOWING!</div>
        <div className="mt-2 text-blue-300 border-t border-gray-600 pt-1">
          * RAIN GIVES 2X WATER
        </div>
      </div>

    </div>
  );
}
