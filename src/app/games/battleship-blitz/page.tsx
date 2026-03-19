"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GameState,
  createInitialState,
  restartGame,
  startGame,
  togglePause,
  updateGameState,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const FRAME_MS = 1000 / 60;

export default function BattleshipBlitzPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(createInitialState());
  const inputStateRef = useRef({
    left: false,
    right: false,
    shoot: false,
    pause: false,
    touchX: undefined as number | undefined,
  });
  const [gameState, setGameState] = useState<GameState>(gameStateRef.current);
  const frameCountRef = useRef(0);

  // Render game to canvas
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = gameStateRef.current;

    // Clear canvas with dark background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw starfield background (parallax effect)
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < 20; i++) {
      const x = (i * 60 + (state.time * 20) % 60) % CANVAS_WIDTH;
      const y = (i * 30 + (state.time * 10) % 240) % CANVAS_HEIGHT;
      ctx.fillRect(x, y, 1, 1);
    }

    if (state.mode === "menu") {
      // Menu screen
      ctx.fillStyle = "#00ffff";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("BATTLESHIP BLITZ", CANVAS_WIDTH / 2, 60);

      ctx.fillStyle = "#ffff00";
      ctx.font = "14px monospace";
      ctx.fillText("RETRO ARCADE SHOOTER", CANVAS_WIDTH / 2, 90);

      ctx.fillStyle = "#00ff00";
      ctx.font = "12px monospace";
      ctx.fillText("Controls:", CANVAS_WIDTH / 2, 130);
      ctx.fillText("← → to move", CANVAS_WIDTH / 2, 145);
      ctx.fillText("SPACE to shoot", CANVAS_WIDTH / 2, 160);
      ctx.fillText("P to pause", CANVAS_WIDTH / 2, 175);

      ctx.fillStyle = "#ff00ff";
      ctx.font = "16px monospace";
      ctx.fillText("PRESS SPACE TO START", CANVAS_WIDTH / 2, 220);
    } else if (state.mode === "paused") {
      // Draw game state dimmed
      drawGameplay(ctx, state);

      // Draw pause overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#ffff00";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

      ctx.fillStyle = "#00ff00";
      ctx.font = "12px monospace";
      ctx.fillText("Press P to resume", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
    } else if (state.mode === "gameOver") {
      // Draw game state dimmed
      drawGameplay(ctx, state);

      // Draw game over overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#ff0000";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

      ctx.fillStyle = "#ffff00";
      ctx.font = "14px monospace";
      ctx.fillText(`FINAL SCORE: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.fillText(`WAVE: ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

      ctx.fillStyle = "#00ff00";
      ctx.font = "12px monospace";
      ctx.fillText("Press SPACE to restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
    } else {
      // Gameplay
      drawGameplay(ctx, state);
    }

    // Update UI state
    setGameState({ ...state });
  }, []);

  const drawGameplay = (ctx: CanvasRenderingContext2D, state: GameState) => {
    // Draw player
    if (state.player.invulnerable > 0 && Math.floor((state.player.invulnerable * 10) % 2) === 0) {
      ctx.fillStyle = "#ff00ff";
      ctx.globalAlpha = 0.5;
    } else {
      ctx.fillStyle = "#00ff00";
      ctx.globalAlpha = 1;
    }
    ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
    ctx.globalAlpha = 1;

    // Draw player health bar
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(5, 5, 50, 4);
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(5, 5, (state.player.health / state.player.maxHealth) * 50, 4);

    // Draw player bullets
    ctx.fillStyle = "#ffff00";
    state.playerBullets.forEach((bullet) => {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    // Draw enemies
    state.enemies.forEach((enemy) => {
      if (enemy.type === "basic") {
        ctx.fillStyle = "#ff0000";
      } else if (enemy.type === "fast") {
        ctx.fillStyle = "#ff00ff";
      } else {
        ctx.fillStyle = "#ffff00";
      }
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

      // Enemy health indicator
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(enemy.x, enemy.y - 4, enemy.width, 2);
      ctx.fillStyle = "#00ff00";
      const healthPercent = enemy.health / enemy.maxHealth;
      ctx.fillRect(enemy.x, enemy.y - 4, enemy.width * healthPercent, 2);
    });

    // Draw enemy bullets
    ctx.fillStyle = "#ff00ff";
    state.enemyBullets.forEach((bullet) => {
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    // Draw power-ups
    state.powerUps.forEach((powerUp) => {
      if (powerUp.type === "health") {
        ctx.fillStyle = "#00ff00";
      } else if (powerUp.type === "weapon") {
        ctx.fillStyle = "#ffff00";
      } else {
        ctx.fillStyle = "#ff00ff";
      }
      ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
    });

    // Draw UI
    ctx.fillStyle = "#00ffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${state.score}`, 5, 20);
    ctx.fillText(`WAVE: ${state.wave}`, 5, 35);
    ctx.fillText(`LIVES: ${state.lives}`, 5, 50);
    ctx.fillText(`WPN: ${state.player.weaponLevel}`, 5, 65);

    if (state.combo > 0) {
      ctx.fillStyle = "#ff00ff";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`COMBO x${state.combo}`, CANVAS_WIDTH / 2, 20);
    }
  };

  // Game loop
  useEffect(() => {
    const gameLoop = setInterval(() => {
      const inputState = inputStateRef.current;
      gameStateRef.current = updateGameState(
        gameStateRef.current,
        inputState,
        FRAME_MS / 1000
      );
      renderGame();
    }, FRAME_MS);

    return () => clearInterval(gameLoop);
  }, [renderGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        inputStateRef.current.left = true;
      } else if (e.key === "ArrowRight") {
        inputStateRef.current.right = true;
      } else if (e.key === " ") {
        e.preventDefault();
        if (
          gameStateRef.current.mode === "menu" &&
          gameStateRef.current.player.shootCooldown <= 0
        ) {
          gameStateRef.current = startGame(gameStateRef.current);
        } else if (gameStateRef.current.mode === "gameOver") {
          gameStateRef.current = restartGame(gameStateRef.current);
        } else if (gameStateRef.current.mode === "playing") {
          inputStateRef.current.shoot = true;
        }
      } else if (e.key.toLowerCase() === "p") {
        gameStateRef.current = togglePause(gameStateRef.current);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        inputStateRef.current.left = false;
      } else if (e.key === "ArrowRight") {
        inputStateRef.current.right = false;
      } else if (e.key === " ") {
        inputStateRef.current.shoot = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Touch controls for mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * scaleX;
      inputStateRef.current.touchX = touchX;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      inputStateRef.current.shoot = true;
      handleTouchMove(e);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      inputStateRef.current.shoot = false;
      inputStateRef.current.touchX = undefined;
    };

    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Expose game state for testing
  useEffect(() => {
    window.render_game_to_text = () => {
      const state = gameStateRef.current;
      return JSON.stringify({
        mode: state.mode,
        score: state.score,
        wave: state.wave,
        lives: state.lives,
        player: {
          x: Math.round(state.player.x),
          y: Math.round(state.player.y),
          health: state.player.health,
          weaponLevel: state.player.weaponLevel,
        },
        enemies: state.enemies.length,
        bullets: state.playerBullets.length,
        enemyBullets: state.enemyBullets.length,
        combo: state.combo,
      });
    };

    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / FRAME_MS));
      for (let i = 0; i < steps; i++) {
        const inputState = inputStateRef.current;
        gameStateRef.current = updateGameState(
          gameStateRef.current,
          inputState,
          FRAME_MS / 1000
        );
      }
      renderGame();
    };
  }, [renderGame]);

  return (
    <Container>
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-3xl font-bold text-cyan-400">Battleship Blitz</h1>
        <p className="text-cyan-300 text-sm">SNES Retro Arcade Shooter</p>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-4 border-cyan-400 bg-gray-900 pixel-art max-w-full"
          style={{
            imageRendering: "pixelated",
            width: "320px",
            height: "240px",
          }}
        />

        <div className="text-sm text-cyan-300 text-center">
          <p>⌨️ Arrow Keys to Move | SPACE to Shoot | P to Pause</p>
          <p>📱 Touch to move and shoot on mobile</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-cyan-300">
          <div className="text-left">
            <p>
              <span className="text-red-400">█</span> Basic Enemy
            </p>
            <p>
              <span className="text-magenta-400">█</span> Fast Enemy
            </p>
            <p>
              <span className="text-yellow-400">█</span> Heavy Enemy
            </p>
          </div>
          <div className="text-left">
            <p>
              <span className="text-green-400">█</span> Health
            </p>
            <p>
              <span className="text-yellow-400">█</span> Weapon
            </p>
            <p>
              <span className="text-magenta-400">█</span> Shield
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
