'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Container from '@/components/common/Container';
import {
  createInitialState,
  GameState,
  handleTileInteraction,
  movePlayer,
  passAction,
  purchaseProperty,
  renderGameToText,
  rollDice,
} from './utils';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
  }
}

export default function MonopolyGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'buy' | 'rent' | 'event' | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);

  // 初始化遊戲
  useEffect(() => {
    const initialState = createInitialState();
    setGameState(initialState);
  }, []);

  // 遊戲渲染函式
  const renderGame = useCallback(() => {
    if (!gameState || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除畫布
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 繪製棋盤邊框
    drawBoard(ctx, gameState);

    // 繪製玩家
    drawPlayers(ctx, gameState);

    // 繪製信息面板
    drawInfoPanel(ctx, gameState);
  }, [gameState]);

  // 繪製棋盤
  const drawBoard = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const centerX = 400;
    const centerY = 300;
    const radius = 150;
    const tileCount = state.board.length;

    // 繪製外圓
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 繪製內圓
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 40, 0, Math.PI * 2);
    ctx.stroke();

    // 繪製格子和標籤
    for (let i = 0; i < tileCount; i++) {
      const angle = (i / tileCount) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // 繪製格子
      ctx.fillStyle = getTileColor(state.board[i].type);
      ctx.fillRect(x - 20, y - 20, 40, 40);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 20, y - 20, 40, 40);

      // 繪製文字（僅顯示部分格子）
      if (i % 6 === 0) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(state.board[i].name, x, y);
      }
    }
  };

  // 繪製玩家
  const drawPlayers = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const centerX = 400;
    const centerY = 300;
    const radius = 150;
    const tileCount = state.board.length;

    state.players.forEach((player, index) => {
      const angle = (player.position / tileCount) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radius - 20) + (index - 1) * 10;
      const y = centerY + Math.sin(angle) * (radius - 20);

      // 繪製玩家圓形令牌
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // 繪製邊框
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  // 繪製信息面板
  const drawInfoPanel = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const panel = {
      x: 50,
      y: 500,
      width: 700,
      height: 120,
    };

    // 背景
    ctx.fillStyle = '#fff';
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);

    // 文字
    const player = state.players[state.currentPlayerIndex];
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';

    const lines = [
      `當前玩家: ${player.name} | 位置: ${player.position} | 金錢: $${player.money}`,
      `擁有地產: ${player.properties.length} | 骰子值: ${state.diceValue}`,
      `操作: 按 D 擲骰子 | 按 B 購買 | 按 P 通過`,
    ];

    lines.forEach((line, index) => {
      ctx.fillText(line, panel.x + 10, panel.y + 20 + index * 30);
    });
  };

  // 取得格子顏色
  const getTileColor = (type: string): string => {
    const colors: Record<string, string> = {
      start: '#FFD700',
      property: '#87CEEB',
      chance: '#FF69B4',
      fortune: '#98FB98',
      jail: '#FF6347',
      parking: '#DDA0DD',
      go_to_jail: '#DC143C',
    };
    return colors[type] || '#CCCCCC';
  };

  // 擲骰子
  const handleRollDice = () => {
    if (!gameState) return;

    const diceValue = rollDice();
    let newState = movePlayer(gameState, gameState.players[gameState.currentPlayerIndex].id, diceValue);
    newState = handleTileInteraction(newState, gameState.players[gameState.currentPlayerIndex].id);

    // 檢查是否需要模態框
    const currentTile = newState.board[newState.players[gameState.currentPlayerIndex].position];
    if (newState.selectedAction === 'buy' && currentTile.price) {
      setModalType('buy');
      setModalMessage(`購買 ${currentTile.name}? 價格: $${currentTile.price}`);
      setShowModal(true);
    }

    setGameState(newState);
  };

  // 購買地產
  const handleBuy = () => {
    if (!gameState) return;

    const player = gameState.players[gameState.currentPlayerIndex];
    const tile = gameState.board[player.position];

    if (tile.id) {
      const newState = purchaseProperty(gameState, player.id, tile.id);
      setGameState(newState);
      setShowModal(false);
    }
  };

  // 通過操作
  const handlePass = () => {
    if (!gameState) return;

    const newState = passAction(gameState);
    setGameState(newState);
    setShowModal(false);
  };

  // 鍵盤控制
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'd':
          handleRollDice();
          break;
        case 'b':
          handleBuy();
          break;
        case 'p':
          handlePass();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState]);

  // 暴露全局函式用於測試
  useEffect(() => {
    if (gameState) {
      window.render_game_to_text = () => renderGameToText(gameState);
      window.advanceTime = (ms: number) => {
        // 簡單的時間推進，用於測試
        // 實際遊戲邏輯已經在狀態更新中處理
      };
    }
  }, [gameState]);

  // 遊戲循環
  useEffect(() => {
    const gameLoop = () => {
      renderGame();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [renderGame]);

  if (!gameState) {
    return (
      <Container>
        <div className="flex items-center justify-center h-screen">
          <div className="text-2xl font-bold">載入遊戲中...</div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 py-8">
        <h1 className="text-4xl font-bold mb-6">大富翁遊戲</h1>

        {/* 遊戲畫布 */}
        <canvas
          ref={canvasRef}
          width={800}
          height={640}
          className="border-4 border-gray-800 rounded-lg shadow-lg bg-white mb-6"
        />

        {/* 控制面板 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleRollDice}
            className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition"
          >
            擲骰子 (D)
          </button>
          <button
            onClick={handleBuy}
            className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
          >
            購買 (B)
          </button>
          <button
            onClick={handlePass}
            className="px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition"
          >
            通過 (P)
          </button>
        </div>

        {/* 玩家資訊 */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="p-4 bg-white rounded-lg shadow-md border-2"
              style={{ borderColor: player.color }}
            >
              <div className="font-bold text-lg">{player.name}</div>
              <div className="text-sm text-gray-600">位置: {player.position}</div>
              <div className="text-sm text-gray-600">金錢: ${player.money}</div>
              <div className="text-sm text-gray-600">地產: {player.properties.length}</div>
            </div>
          ))}
        </div>

        {/* 模態框 */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm">
              <h2 className="text-2xl font-bold mb-4">操作</h2>
              <p className="text-gray-700 mb-6">{modalMessage}</p>
              <div className="flex gap-4">
                {modalType === 'buy' ? (
                  <>
                    <button
                      onClick={handleBuy}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      購買
                    </button>
                    <button
                      onClick={handlePass}
                      className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      不購買
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    確定
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
