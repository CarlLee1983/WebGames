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

// Helper functions for drawing
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

const drawBoard = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const centerX = 400;
  const centerY = 300;
  const radius = 150;
  const tileCount = state.board.length;

  // Draw outer circle
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw inner circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 40, 0, Math.PI * 2);
  ctx.stroke();

  // Draw tiles
  for (let i = 0; i < tileCount; i++) {
    const angle = (i / tileCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    ctx.fillStyle = getTileColor(state.board[i].type);
    ctx.fillRect(x - 20, y - 20, 40, 40);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 20, y - 20, 40, 40);

    if (i % 6 === 0) {
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.board[i].name, x, y);
    }
  }
};

const drawPlayers = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const centerX = 400;
  const centerY = 300;
  const radius = 150;
  const tileCount = state.board.length;

  state.players.forEach((player, index) => {
    const angle = (player.position / tileCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * (radius - 20) + (index - 1) * 10;
    const y = centerY + Math.sin(angle) * (radius - 20);

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
};

const drawInfoPanel = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const panel = {
    x: 50,
    y: 500,
    width: 700,
    height: 120,
  };

  ctx.fillStyle = '#fff';
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);

  const player = state.players[state.currentPlayerIndex];
  ctx.fillStyle = '#333';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';

  const lines = [
    `Current: ${player.name} | Pos: ${player.position} | Money: $${player.money}`,
    `Properties: ${player.properties.length} | Dice: ${state.diceValue}`,
    `D: Dice | B: Buy | P: Pass`,
  ];

  lines.forEach((line, index) => {
    ctx.fillText(line, panel.x + 10, panel.y + 20 + index * 30);
  });
};

export default function MonopolyGame() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'buy' | 'rent' | 'event' | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);

  // Render game
  const renderGame = useCallback(() => {
    if (!gameState || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawBoard(ctx, gameState);
    drawPlayers(ctx, gameState);
    drawInfoPanel(ctx, gameState);
  }, [gameState]);

  // Handle dice roll
  const handleRollDice = useCallback(() => {
    if (!gameState) return;

    const diceValue = rollDice();
    let newState = movePlayer(gameState, gameState.players[gameState.currentPlayerIndex].id, diceValue);
    newState = handleTileInteraction(newState, gameState.players[gameState.currentPlayerIndex].id);

    const currentTile = newState.board[newState.players[gameState.currentPlayerIndex].position];
    if (newState.selectedAction === 'buy' && currentTile.price) {
      setModalType('buy');
      setModalMessage(`Buy ${currentTile.name}? Price: $${currentTile.price}`);
      setShowModal(true);
    }

    setGameState(newState);
  }, [gameState]);

  // Handle property purchase
  const handleBuy = useCallback(() => {
    if (!gameState) return;

    const player = gameState.players[gameState.currentPlayerIndex];
    const tile = gameState.board[player.position];

    if (tile.id) {
      const newState = purchaseProperty(gameState, player.id, tile.id);
      setGameState(newState);
      setShowModal(false);
    }
  }, [gameState]);

  // Handle pass action
  const handlePass = useCallback(() => {
    if (!gameState) return;

    const newState = passAction(gameState);
    setGameState(newState);
    setShowModal(false);
  }, [gameState]);

  // Keyboard controls
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
  }, [handleRollDice, handleBuy, handlePass]);

  // Expose global functions for testing
  useEffect(() => {
    if (gameState) {
      window.render_game_to_text = () => renderGameToText(gameState);
      window.advanceTime = () => {
        // Time advancement for testing
      };
    }
  }, [gameState]);

  // Game loop
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
          <div className="text-2xl font-bold">Loading...</div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 py-8">
        <h1 className="text-4xl font-bold mb-6">Monopoly Game</h1>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={640}
          className="border-4 border-gray-800 rounded-lg shadow-lg bg-white mb-6"
        />

        {/* Control Panel */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleRollDice}
            className="px-6 py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition"
          >
            Roll Dice (D)
          </button>
          <button
            onClick={handleBuy}
            className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
          >
            Buy (B)
          </button>
          <button
            onClick={handlePass}
            className="px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition"
          >
            Pass (P)
          </button>
        </div>

        {/* Player Info */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="p-4 bg-white rounded-lg shadow-md border-2"
              style={{ borderColor: player.color }}
            >
              <div className="font-bold text-lg">{player.name}</div>
              <div className="text-sm text-gray-600">Pos: {player.position}</div>
              <div className="text-sm text-gray-600">Money: ${player.money}</div>
              <div className="text-sm text-gray-600">Properties: {player.properties.length}</div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm">
              <h2 className="text-2xl font-bold mb-4">Action</h2>
              <p className="text-gray-700 mb-6">{modalMessage}</p>
              <div className="flex gap-4">
                {modalType === 'buy' ? (
                  <>
                    <button
                      onClick={handleBuy}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      Buy
                    </button>
                    <button
                      onClick={handlePass}
                      className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    OK
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
