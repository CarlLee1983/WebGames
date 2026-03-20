'use client';

import Container from '@/components/common/Container';
import { useEffect, useRef, useState } from 'react';
import {
  BUILDING_DEFS,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  createInitialState,
  placeBuilding,
  bulldoze,
  simulateTick,
  saveCityState,
  loadCityState,
  type CityState,
  type BuildingType,
  type ToolMode,
  type GameSpeed,
} from './utils';

export default function CityBuilderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CityState>(createInitialState());
  const [uiSnapshot, setUiSnapshot] = useState<CityState | null>(null);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const animationFrameRef = useRef<number>(0);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(0);

  // 初始化遊戲
  useEffect(() => {
    // 嘗試讀檔
    const saved = loadCityState();
    if (saved) {
      stateRef.current = saved;
    }
    setUiSnapshot(stateRef.current);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 模擬迴圈
    const simulationSpeed = stateRef.current.gameSpeed === 'fast' ? 500 : 3000; // 毫秒
    simulationIntervalRef.current = setInterval(() => {
      stateRef.current = simulateTick(stateRef.current);

      // 定期保存
      if (stateRef.current.tick - lastSaveRef.current > 100) {
        saveCityState(stateRef.current);
        lastSaveRef.current = stateRef.current.tick;
      }

      // 更新 UI（每次都更新以保持同步）
      setUiSnapshot({ ...stateRef.current });
    }, simulationSpeed);

    // 渲染迴圈
    const render = () => {
      if (stateRef.current) {
        renderCity(canvas, stateRef.current, hoveredCell);
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      if (animationFrameRef.current !== 0) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [hoveredCell]);

  // 更新模擬速度
  useEffect(() => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    const simulationSpeed =
      stateRef.current.gameSpeed === 'fast'
        ? 500
        : stateRef.current.gameSpeed === 'paused'
          ? Infinity
          : 3000;

    if (simulationSpeed !== Infinity) {
      simulationIntervalRef.current = setInterval(() => {
        stateRef.current = simulateTick(stateRef.current);
        if (stateRef.current.tick - lastSaveRef.current > 100) {
          saveCityState(stateRef.current);
          lastSaveRef.current = stateRef.current.tick;
        }
        setUiSnapshot({ ...stateRef.current });
      }, simulationSpeed);
    }

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  }, [uiSnapshot?.gameSpeed]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (stateRef.current.selectedTool === 'bulldoze') {
      stateRef.current = bulldoze(stateRef.current, col, row);
    } else {
      stateRef.current = placeBuilding(
        stateRef.current,
        col,
        row,
        stateRef.current.selectedTool as BuildingType
      );
    }

    setUiSnapshot({ ...stateRef.current });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      setHoveredCell([col, row]);
    } else {
      setHoveredCell(null);
    }
  };

  const handleSelectTool = (tool: ToolMode) => {
    if (!stateRef.current) return;
    stateRef.current = { ...stateRef.current, selectedTool: tool };
    setUiSnapshot(stateRef.current);
  };

  const handleSetSpeed = (speed: GameSpeed) => {
    if (!stateRef.current) return;
    stateRef.current = { ...stateRef.current, gameSpeed: speed };
    setUiSnapshot(stateRef.current);
  };

  const handleNewGame = () => {
    stateRef.current = createInitialState();
    lastSaveRef.current = 0;
    setUiSnapshot(stateRef.current);
    saveCityState(stateRef.current);
  };

  if (!uiSnapshot) {
    return (
      <Container className="py-8">
        <div>Loading...</div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="space-y-4">
        {/* 標題和控制 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🏙️ City Builder</h1>
            <p className="text-sm text-gray-400">
              Day {uiSnapshot.day} | Tick {uiSnapshot.tick}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSetSpeed('paused')}
              className={`px-3 py-1 rounded text-sm ${
                uiSnapshot.gameSpeed === 'paused'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ⏸ Paused
            </button>
            <button
              onClick={() => handleSetSpeed('normal')}
              className={`px-3 py-1 rounded text-sm ${
                uiSnapshot.gameSpeed === 'normal'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ▶ Normal
            </button>
            <button
              onClick={() => handleSetSpeed('fast')}
              className={`px-3 py-1 rounded text-sm ${
                uiSnapshot.gameSpeed === 'fast'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              ⏩ Fast
            </button>
            <button
              onClick={handleNewGame}
              className="px-3 py-1 rounded text-sm bg-red-600 hover:bg-red-700 text-white"
            >
              ↻ New Game
            </button>
          </div>
        </div>

        {/* 資源儀表板 */}
        <div className="grid grid-cols-5 gap-2 bg-gray-900 p-4 rounded">
          <div className="text-center">
            <div className="text-xs text-gray-400">Money</div>
            <div className="text-lg font-bold text-green-400">
              ${uiSnapshot.money}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Population</div>
            <div className="text-lg font-bold text-blue-400">
              {uiSnapshot.population}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Power</div>
            <div className="text-lg font-bold text-purple-400">
              {uiSnapshot.power}/{uiSnapshot.powerUsage}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Water</div>
            <div className="text-lg font-bold text-cyan-400">
              {uiSnapshot.water}/{uiSnapshot.waterUsage}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Happiness</div>
            <div className="text-lg font-bold text-yellow-400">
              {uiSnapshot.happiness}%
            </div>
          </div>
        </div>

        {/* 主遊戲區 */}
        <div className="flex gap-4 bg-gray-900 p-4 rounded">
          {/* 工具列 */}
          <div className="w-32 space-y-2">
            <div className="text-sm font-bold text-gray-300">Tools</div>
            {Object.entries(BUILDING_DEFS).map(([key, def]) => (
              <button
                key={key}
                onClick={() => handleSelectTool(key as BuildingType)}
                className={`w-full px-2 py-2 text-xs rounded text-left ${
                  uiSnapshot.selectedTool === key
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span>{def.emoji}</span> {def.name}
                <div className="text-xs text-gray-400">${def.cost}</div>
              </button>
            ))}
            <button
              onClick={() => handleSelectTool('bulldoze')}
              className={`w-full px-2 py-2 text-xs rounded text-left ${
                uiSnapshot.selectedTool === 'bulldoze'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              🗑️ Bulldoze
              <div className="text-xs text-gray-400">Refund 50%</div>
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1">
            <canvas
              ref={canvasRef}
              width={GRID_COLS * CELL_SIZE}
              height={GRID_ROWS * CELL_SIZE}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoveredCell(null)}
              className="border-2 border-gray-700 bg-gray-950 cursor-pointer w-full"
            />
          </div>
        </div>

        {/* 通知 */}
        <div className="space-y-1">
          {uiSnapshot.notifications.slice(-5).map((notif) => (
            <div
              key={notif.id}
              className={`text-sm px-3 py-1 rounded ${
                notif.type === 'success'
                  ? 'bg-green-900 text-green-300'
                  : notif.type === 'warning'
                    ? 'bg-yellow-900 text-yellow-300'
                    : 'bg-blue-900 text-blue-300'
              }`}
            >
              {notif.message}
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

/**
 * 渲染城市地圖
 */
function renderCity(
  canvas: HTMLCanvasElement,
  state: CityState,
  hoveredCell: [number, number] | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 清除背景
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 繪製格子
  drawGrid(ctx, GRID_COLS, GRID_ROWS);

  // 繪製所有格子
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const isHovered = !!(hoveredCell && hoveredCell[0] === c && hoveredCell[1] === r);
      drawCell(ctx, state.grid[r][c], c, r, isHovered);
    }
  }

  // 如果懸停，顯示可放置狀態
  if (hoveredCell) {
    const [c, r] = hoveredCell;
    const toolDef = state.selectedTool === 'bulldoze' ? null : BUILDING_DEFS[state.selectedTool as BuildingType];
    const cost = toolDef?.cost ?? 0;
    const canPlace = state.grid[r][c].type === 'empty' && state.money >= cost;
    ctx.strokeStyle = canPlace ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }
}

/**
 * 繪製單格
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: ReturnType<typeof createInitialState>['grid'][0][0],
  col: number,
  row: number,
  isHovered: boolean
) {
  const x = col * CELL_SIZE;
  const y = row * CELL_SIZE;

  const def = BUILDING_DEFS[cell.type];

  // 背景
  ctx.fillStyle = def.color;
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

  // Hover 效果
  if (isHovered) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  }

  // 繪製 Emoji
  if (cell.type !== 'empty') {
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, x + CELL_SIZE / 2, y + CELL_SIZE / 2);

    // 人口標示（住宅區）
    if (cell.type === 'residential' && cell.population > 0) {
      ctx.font = '10px Arial';
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(Math.floor(cell.population / 10).toString(), x + CELL_SIZE - 5, y + 5);
    }

    // 電力指示
    if (cell.powered) {
      ctx.fillStyle = 'rgba(168,85,247,0.3)';
      ctx.fillRect(x, y, 4, CELL_SIZE);
    }

    // 水資源指示
    if (cell.hasWater) {
      ctx.fillStyle = 'rgba(6,182,212,0.3)';
      ctx.fillRect(x + CELL_SIZE - 4, y, 4, CELL_SIZE);
    }
  }
}

/**
 * 繪製格線
 */
function drawGrid(ctx: CanvasRenderingContext2D, cols: number, rows: number) {
  ctx.strokeStyle = 'rgba(107,114,128,0.2)';
  ctx.lineWidth = 1;

  // 垂直線
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, rows * CELL_SIZE);
    ctx.stroke();
  }

  // 水平線
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(cols * CELL_SIZE, r * CELL_SIZE);
    ctx.stroke();
  }
}
