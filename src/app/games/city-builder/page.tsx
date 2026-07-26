'use client';

import Container from '@/components/common/Container';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { renderCity } from './renderer';
import {
  BUILDING_DEFS,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  bulldoze,
  createInitialState,
  getCoverageCells,
  getCityRank,
  getPlacementError,
  loadCityState,
  placeBuilding,
  saveCityState,
  simulateTick,
  type BuildingType,
  type CityState,
  type GameSpeed,
  type ToolMode,
} from './utils';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void | Promise<void>;
  }
}

const MAP_WIDTH = GRID_COLS * CELL_SIZE;
const MAP_HEIGHT = GRID_ROWS * CELL_SIZE;
const ZOOM_LEVELS = [0.75, 1, 1.5] as const;

const TOOL_ENTRIES = (Object.entries(BUILDING_DEFS) as [BuildingType, (typeof BUILDING_DEFS)[BuildingType]][])
  .filter(([type]) => type !== 'empty');

export default function CityBuilderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [uiSnapshot, setUiSnapshot] = useState<CityState>(() => createInitialState());
  const stateRef = useRef<CityState>(uiSnapshot);
  const lastSaveRef = useRef(0);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const [cursorCell, setCursorCell] = useState<[number, number]>([4, 4]);
  const [zoom, setZoom] = useState<(typeof ZOOM_LEVELS)[number]>(0.75);
  const [pixelRatio, setPixelRatio] = useState(1);
  const [feedback, setFeedback] = useState('選擇設施，然後在地圖上點一下開始建造。');
  const [confirmReset, setConfirmReset] = useState(false);

  const commitState = useCallback((next: CityState, persist = false) => {
    stateRef.current = next;
    setUiSnapshot(next);
    if (persist) saveCityState(next);
  }, []);

  useEffect(() => {
    const updateDisplay = () => {
      setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    };
    const frame = window.requestAnimationFrame(() => {
      const saved = loadCityState();
      if (saved) {
        stateRef.current = saved;
        setUiSnapshot(saved);
        lastSaveRef.current = saved.tick;
        setFeedback('已載入上次保存的城市。');
      }
      updateDisplay();
      setZoom(window.matchMedia('(max-width: 639px)').matches ? 1.5 : 0.75);
    });
    window.addEventListener('resize', updateDisplay);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateDisplay);
    };
  }, []);

  useEffect(() => {
    if (uiSnapshot.gameSpeed === 'paused') return;
    const delay = uiSnapshot.gameSpeed === 'fast' ? 500 : 3000;
    const interval = window.setInterval(() => {
      const next = simulateTick(stateRef.current);
      stateRef.current = next;
      setUiSnapshot(next);
      if (next.tick - lastSaveRef.current >= 20) {
        saveCityState(next);
        lastSaveRef.current = next.tick;
      }
    }, delay);
    return () => window.clearInterval(interval);
  }, [uiSnapshot.gameSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.round(MAP_WIDTH * pixelRatio);
    const height = Math.round(MAP_HEIGHT * pixelRatio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    renderCity(canvas, uiSnapshot, hoveredCell, cursorCell, pixelRatio);
  }, [cursorCell, hoveredCell, pixelRatio, uiSnapshot]);

  useEffect(() => {
    window.render_game_to_text = () => {
      const state = stateRef.current;
      return JSON.stringify({
        coordinateSystem: 'grid col 0-29, row 0-19; origin top-left',
        day: state.day,
        tick: state.tick,
        speed: state.gameSpeed,
        money: state.money,
        population: state.population,
        finance: { income: state.income, expenses: state.expenses },
        utilities: {
          power: `${state.powerUsage}/${state.power}`,
          water: `${state.waterUsage}/${state.water}`,
        },
        selectedTool: state.selectedTool,
        cursor: { col: cursorCell[0], row: cursorCell[1] },
        selectedCell: state.grid[cursorCell[1]][cursorCell[0]],
        placementPreview: {
          error: state.selectedTool === 'bulldoze'
            ? (state.grid[cursorCell[1]][cursorCell[0]].type === 'empty' ? '這塊地是空的，不需要拆除。' : null)
            : getPlacementError(state, cursorCell[0], cursorCell[1], state.selectedTool),
          coverageCells: getCoverageCells(state.selectedTool, cursorCell[0], cursorCell[1]),
        },
        buildings: state.grid.flatMap((row, rowIndex) => row.flatMap((cell, colIndex) =>
          cell.type === 'empty' ? [] : [{ col: colIndex, row: rowIndex, ...cell }]
        )),
      });
    };
    window.advanceTime = (ms: number) => {
      if (stateRef.current.gameSpeed === 'paused') return;
      const delay = stateRef.current.gameSpeed === 'fast' ? 500 : 3000;
      const ticks = Math.max(1, Math.floor(ms / delay));
      let next = stateRef.current;
      for (let index = 0; index < ticks; index++) next = simulateTick(next);
      commitState(next);
    };
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [commitState, cursorCell]);

  const selectedPosition = hoveredCell ?? cursorCell;
  const selectedCell = uiSnapshot.grid[selectedPosition[1]][selectedPosition[0]];
  const coverageCells = useMemo(
    () => getCoverageCells(uiSnapshot.selectedTool, selectedPosition[0], selectedPosition[1]),
    [selectedPosition, uiSnapshot.selectedTool]
  );
  const coveredDistricts = useMemo(
    () => coverageCells.filter(({ col, row }) => {
      const type = uiSnapshot.grid[row][col].type;
      return type === 'residential' || type === 'commercial' || type === 'industrial';
    }).length,
    [coverageCells, uiSnapshot.grid]
  );
  const coveragePlacementError = coverageCells.length > 0 && uiSnapshot.selectedTool !== 'bulldoze'
    ? getPlacementError(uiSnapshot, selectedPosition[0], selectedPosition[1], uiSnapshot.selectedTool)
    : null;
  const coverageLabel = uiSnapshot.selectedTool === 'power_plant'
    ? '電力'
    : uiSnapshot.selectedTool === 'water_pump'
      ? '供水'
      : '公園影響';
  const selectedDef = uiSnapshot.selectedTool === 'bulldoze'
    ? null
    : BUILDING_DEFS[uiSnapshot.selectedTool];
  const cityRank = getCityRank(uiSnapshot);
  const netIncome = uiSnapshot.income - uiSnapshot.expenses;
  const formattedNetIncome = netIncome >= 0 ? `+$${netIncome}` : `-$${Math.abs(netIncome)}`;
  const rankProgress = cityRank.nextPopulation === null
    ? 100
    : Math.min(100, Math.round((uiSnapshot.population / cityRank.nextPopulation) * 100));

  const serviceStatus = useMemo(() => {
    if (selectedCell.type === 'empty' || selectedCell.type === 'road') return null;
    return [
      { label: '道路', ready: selectedCell.connectedToRoad },
      { label: '電力', ready: selectedCell.powered },
      { label: '供水', ready: selectedCell.hasWater },
    ];
  }, [selectedCell]);

  const getGridPosition = (event: MouseEvent<HTMLCanvasElement>): [number, number] | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const logicalX = (event.clientX - rect.left) * (MAP_WIDTH / rect.width);
    const logicalY = (event.clientY - rect.top) * (MAP_HEIGHT / rect.height);
    const col = Math.floor(logicalX / CELL_SIZE);
    const row = Math.floor(logicalY / CELL_SIZE);
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS ? [col, row] : null;
  };

  const activateCell = useCallback((col: number, row: number) => {
    const current = stateRef.current;
    if (current.selectedTool === 'bulldoze') {
      if (current.grid[row][col].type === 'empty') {
        setFeedback('這塊地是空的，不需要拆除。');
        return;
      }
      const removedName = BUILDING_DEFS[current.grid[row][col].type].name;
      commitState(bulldoze(current, col, row), true);
      setFeedback(`${removedName}已拆除，返還一半建造費。`);
      return;
    }

    const error = getPlacementError(current, col, row, current.selectedTool);
    if (error) {
      setFeedback(error);
      return;
    }
    const definition = BUILDING_DEFS[current.selectedTool];
    commitState(placeBuilding(current, col, row, current.selectedTool), true);
    setFeedback(`${definition.name}已建於 (${col + 1}, ${row + 1})。`);
  }, [commitState]);

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const position = getGridPosition(event);
    if (!position) return;
    setCursorCell(position);
    activateCell(...position);
  };

  const handleCanvasMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    setHoveredCell(getGridPosition(event));
  };

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const movement: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (event.key in movement) {
      event.preventDefault();
      const [dc, dr] = movement[event.key];
      setCursorCell(([col, row]) => [
        Math.max(0, Math.min(GRID_COLS - 1, col + dc)),
        Math.max(0, Math.min(GRID_ROWS - 1, row + dr)),
      ]);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateCell(...cursorCell);
      return;
    }
    if (event.key.toLowerCase() === 'b') {
      event.preventDefault();
      const next = { ...stateRef.current, selectedTool: 'bulldoze' as const };
      commitState(next);
      setFeedback('已選擇拆除工具。');
    }
  };

  const handleSelectTool = (tool: ToolMode) => {
    commitState({ ...stateRef.current, selectedTool: tool });
    setFeedback(tool === 'bulldoze'
      ? '拆除工具：點選建築可回收 50% 建造費。'
      : `${BUILDING_DEFS[tool].name}：${BUILDING_DEFS[tool].description}`);
  };

  const handleSetSpeed = (speed: GameSpeed) => {
    commitState({ ...stateRef.current, gameSpeed: speed }, true);
    setFeedback(speed === 'paused' ? '城市模擬已暫停。' : speed === 'fast' ? '快速模擬中。' : '城市恢復正常速度。');
  };

  const handleNewGame = () => {
    const next = createInitialState();
    lastSaveRef.current = 0;
    commitState(next, true);
    setCursorCell([4, 4]);
    setConfirmReset(false);
    setFeedback('新城市已建立。先鋪路，再配置電廠與水泵。');
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="space-y-4 text-slate-100">
        <header className="rounded-2xl border border-teal-400/20 bg-slate-900 p-4 shadow-xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-300">
                <span className="i-ph-buildings-duotone text-lg" aria-hidden="true" />
                Urban planning sandbox
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">City Builder</h1>
              <p className="mt-1 text-sm text-slate-400">鋪設道路、接通民生服務，讓每個街區真正運轉。</p>
            </div>

            <div className="flex flex-wrap gap-2" style={{ alignSelf: 'center' }} aria-label="Simulation controls">
              {([
                ['paused', 'i-ph-pause-fill', '暫停'],
                ['normal', 'i-ph-play-fill', '正常'],
                ['fast', 'i-ph-fast-forward-fill', '快速'],
              ] as [GameSpeed, string, string][]).map(([speed, icon, label]) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleSetSpeed(speed)}
                  aria-pressed={uiSnapshot.gameSpeed === speed}
                  className={`min-h-12 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${
                    uiSnapshot.gameSpeed === speed
                      ? 'border-teal-300 bg-teal-500 text-slate-950'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <span className={`${icon} mr-1.5 align-[-2px]`} aria-hidden="true" />{label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-12 rounded-xl border border-rose-400/50 bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
              >
                <span className="i-ph-arrow-counter-clockwise-bold mr-1.5 align-[-2px]" aria-hidden="true" />新城市
              </button>
            </div>
          </div>

          {confirmReset && (
            <div role="alertdialog" aria-labelledby="reset-title" className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-400/40 bg-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p id="reset-title" className="font-bold text-rose-100">確定要清除目前城市？</p>
                <p className="text-sm text-rose-200/70">這會覆蓋瀏覽器中的自動存檔。</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmReset(false)} className="min-h-12 flex-1 rounded-lg bg-slate-700 px-4 font-bold sm:flex-none">取消</button>
                <button type="button" onClick={handleNewGame} className="min-h-12 flex-1 rounded-lg bg-rose-500 px-4 font-bold text-white sm:flex-none">清除並重建</button>
              </div>
            </div>
          )}
        </header>

        <section aria-label="City resources" className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatCard icon="i-ph-coins-duotone" label="市庫" value={`$${uiSnapshot.money.toLocaleString()}`} tone="text-emerald-300" />
          <StatCard icon="i-ph-users-three-duotone" label="人口" value={uiSnapshot.population.toLocaleString()} tone="text-sky-300" />
          <StatCard icon="i-ph-chart-line-up-duotone" label="每回合淨額" value={formattedNetIncome} tone={netIncome >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
          <StatCard icon="i-ph-lightning-duotone" label="電力" value={`${uiSnapshot.powerUsage}/${uiSnapshot.power}`} tone={uiSnapshot.powerUsage <= uiSnapshot.power ? 'text-violet-300' : 'text-rose-300'} />
          <StatCard icon="i-ph-drop-duotone" label="供水" value={`${uiSnapshot.waterUsage}/${uiSnapshot.water}`} tone={uiSnapshot.waterUsage <= uiSnapshot.water ? 'text-cyan-300' : 'text-rose-300'} />
          <StatCard icon="i-ph-smiley-duotone" label="幸福度" value={`${uiSnapshot.happiness}%`} tone="text-amber-300" />
        </section>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="order-2 w-full space-y-4 lg:order-1 lg:w-56">
            <section className="rounded-2xl border border-slate-700/80 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-black">建造選單</h2>
                <span className="rounded-full bg-teal-400/10 px-2 py-1 text-xs font-bold text-teal-300">${uiSnapshot.money.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                {TOOL_ENTRIES.map(([type, def]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectTool(type)}
                    aria-pressed={uiSnapshot.selectedTool === type}
                    disabled={uiSnapshot.money < def.cost}
                    className={`min-h-14 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-45 ${
                      uiSnapshot.selectedTool === type
                        ? 'border-teal-300 bg-slate-700 shadow-[inset_3px_0_0_#5eead4]'
                        : 'border-slate-700 bg-slate-800/80 hover:border-slate-500'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold"><span className="mr-1.5" aria-hidden="true">{def.emoji}</span>{def.name}</span>
                      <span className="text-xs font-bold text-emerald-300">${def.cost}</span>
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">{def.description}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSelectTool('bulldoze')}
                  aria-pressed={uiSnapshot.selectedTool === 'bulldoze'}
                  className={`min-h-14 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 ${
                    uiSnapshot.selectedTool === 'bulldoze'
                      ? 'border-rose-300 bg-slate-700 shadow-[inset_3px_0_0_#fda4af]'
                      : 'border-slate-700 bg-slate-800/80 hover:border-slate-500'
                  }`}
                >
                  <span className="font-bold">🗑️ 拆除</span>
                  <span className="mt-1 block text-xs text-slate-400">返還 50% 建造費</span>
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">城市等級</p>
                  <p className="text-xl font-black text-teal-300">{cityRank.name}</p>
                </div>
                <span className="text-sm font-bold text-slate-300">第 {uiSnapshot.day} 天</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-300" style={{ width: `${rankProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {cityRank.nextPopulation === null ? '已達最高城市等級' : `距離下一級：${Math.max(0, cityRank.nextPopulation - uiSnapshot.population)} 人`}
              </p>
            </section>
          </aside>

          <main className="order-1 min-w-0 flex-1 space-y-3 lg:order-2">
            <section className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-3 border-b border-slate-700/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-black">城市地圖</h2>
                  <p className="text-xs text-slate-400">箭頭移動游標，Enter／空白鍵建造，B 切換拆除。</p>
                </div>
                <div className="flex items-center gap-2" aria-label="Map zoom">
                  <span className="text-xs font-bold text-slate-400">縮放</span>
                  {ZOOM_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setZoom(level)}
                      aria-pressed={zoom === level}
                      className={`min-h-12 min-w-12 rounded-lg text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${zoom === level ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {Math.round(level * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-b border-slate-700/80 bg-slate-950/35 p-3 lg:hidden" role="toolbar" aria-label="地圖旁行動工具">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">行動工具</p>
                  <p className="text-xs text-slate-400">左右滑動選擇</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-color:#475569_transparent]">
                  {TOOL_ENTRIES.map(([type, def]) => (
                    <button
                      key={`quick-${type}`}
                      type="button"
                      onClick={() => handleSelectTool(type)}
                      aria-label={`在地圖旁選擇${def.name}，花費 $${def.cost}`}
                      aria-pressed={uiSnapshot.selectedTool === type}
                      disabled={uiSnapshot.money < def.cost}
                      className="min-h-14 min-w-[84px] shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-2 py-2 text-center text-xs font-bold text-slate-200 transition disabled:opacity-40 aria-pressed:border-teal-300 aria-pressed:bg-teal-500 aria-pressed:text-slate-950"
                    >
                      <span className="block text-lg" aria-hidden="true">{def.emoji}</span>
                      <span className="block truncate">{def.name}</span>
                      <span className="block text-[10px] opacity-75">${def.cost}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSelectTool('bulldoze')}
                    aria-label="在地圖旁選擇拆除工具"
                    aria-pressed={uiSnapshot.selectedTool === 'bulldoze'}
                    className="min-h-14 min-w-[84px] shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-2 py-2 text-center text-xs font-bold text-slate-200 transition aria-pressed:border-rose-300 aria-pressed:bg-rose-500 aria-pressed:text-slate-950"
                  >
                    <span className="block text-lg" aria-hidden="true">🗑️</span>
                    <span className="block">拆除</span>
                    <span className="block text-[10px] opacity-75">回收 50%</span>
                  </button>
                </div>
              </div>

              {coverageCells.length > 0 && (
                <div role="status" className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm ${coveragePlacementError ? 'border-rose-400/25 bg-rose-950/35 text-rose-100' : 'border-teal-400/25 bg-teal-950/35 text-teal-100'}`}>
                  <span className="font-bold">
                    <span className="i-ph-scan-duotone mr-2 align-[-2px] text-lg" aria-hidden="true" />
                    {coverageLabel}預覽 · {coverageCells.length} 格 · 涵蓋 {coveredDistricts} 個街區
                  </span>
                  <span className="text-xs opacity-75">{coveragePlacementError ?? '可在目前位置建造'}</span>
                </div>
              )}

              <div
                ref={scrollerRef}
                className="max-h-[70vh] overflow-auto bg-[#0c171a] overscroll-contain p-2 sm:p-3"
                style={{ maxHeight: 'min(70vh, 640px)' }}
                aria-label="Scrollable city map"
              >
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setHoveredCell(null)}
                  onKeyDown={handleCanvasKeyDown}
                  tabIndex={0}
                  role="application"
                  aria-label={`城市地圖，游標位於第 ${cursorCell[0] + 1} 欄、第 ${cursorCell[1] + 1} 列，目前工具${uiSnapshot.selectedTool === 'bulldoze' ? '拆除' : BUILDING_DEFS[uiSnapshot.selectedTool].name}${coverageCells.length > 0 ? `，預覽涵蓋 ${coverageCells.length} 格` : ''}`}
                  className="block max-w-none cursor-crosshair rounded-lg border border-slate-600 shadow-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                  style={{ width: MAP_WIDTH * zoom, height: MAP_HEIGHT * zoom }}
                />
              </div>
            </section>

            <div aria-live="polite" className="rounded-xl border border-teal-400/25 bg-teal-950/40 px-4 py-3 text-sm text-teal-100">
              <span className="i-ph-info-duotone mr-2 align-[-2px] text-lg text-teal-300" aria-hidden="true" />
              {feedback}
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">目前工具</p>
                <p className="mt-1 text-lg font-black">
                  {uiSnapshot.selectedTool === 'bulldoze' ? '🗑️ 拆除' : `${selectedDef?.emoji} ${selectedDef?.name}`}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {uiSnapshot.selectedTool === 'bulldoze' ? '拆除既有設施並回收一半費用。' : selectedDef?.description}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">地塊 ({selectedPosition[0] + 1}, {selectedPosition[1] + 1})</p>
                  <span className="text-sm font-bold">{BUILDING_DEFS[selectedCell.type].emoji} {BUILDING_DEFS[selectedCell.type].name}</span>
                </div>
                {serviceStatus ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {serviceStatus.map((service) => (
                      <span key={service.label} className={`rounded-lg px-2 py-1 text-center text-xs font-bold ${service.ready ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                        {service.ready ? '✓' : '×'} {service.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">住宅、商業與工業需要鄰接道路，並位於電力與供水範圍內。</p>
                )}
              </div>
            </section>
          </main>
        </div>

        {uiSnapshot.notifications.length > 0 && (
          <section aria-label="City notifications" className="space-y-2">
            {uiSnapshot.notifications.slice(-4).reverse().map((notification) => (
              <div key={notification.id} className={`rounded-xl border px-4 py-3 text-sm ${
                notification.type === 'success'
                  ? 'border-emerald-400/25 bg-emerald-950/40 text-emerald-200'
                  : notification.type === 'warning'
                    ? 'border-amber-400/25 bg-amber-950/40 text-amber-200'
                    : 'border-sky-400/25 bg-sky-950/40 text-sky-200'
              }`}>
                {notification.message}
              </div>
            ))}
          </section>
        )}
      </div>
    </Container>
  );
}

function StatCard({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        <span className={`${icon} text-lg`} aria-hidden="true" />{label}
      </div>
      <p className={`mt-1 text-lg font-black sm:text-xl ${tone}`}>{value}</p>
    </div>
  );
}
