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
    advanceTime?: (ms: number) => void | Promise<void>;
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
    // Utility for glowing rects
    const fillGlowRect = (x: number, y: number, w: number, h: number, color: string, blur: number = 10) => {
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;
    };

    // Draw player
    const playerColor = (state.player.invulnerable > 0 && Math.floor((state.player.invulnerable * 10) % 2) === 0) 
      ? "#ff00ff" 
      : "#00ffff";
    ctx.globalAlpha = state.player.invulnerable > 0 ? 0.7 : 1;
    
    ctx.save();
    ctx.translate(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2);
    ctx.fillStyle = playerColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = playerColor;
    ctx.beginPath();
    ctx.moveTo(0, -state.player.height / 2); // Nose
    ctx.lineTo(state.player.width / 2, state.player.height / 2); // Right wing
    ctx.lineTo(0, state.player.height / 6); // Inner tail
    ctx.lineTo(-state.player.width / 2, state.player.height / 2); // Left wing
    ctx.closePath();
    ctx.fill();
    
    // Engine flame
    if (state.mode === 'playing' && Math.random() > 0.5) {
      ctx.fillStyle = "#ffaa00";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffaa00";
      ctx.beginPath();
      ctx.moveTo(-2, state.player.height / 6);
      ctx.lineTo(2, state.player.height / 6);
      ctx.lineTo(0, state.player.height / 2 + 5 + Math.random() * 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Draw player health bar
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(5, 5, 50, 4);
    fillGlowRect(5, 5, (state.player.health / state.player.maxHealth) * 50, 4, "#00ff00", 5);

    // Draw player bullets
    state.playerBullets.forEach((bullet) => {
      fillGlowRect(bullet.x + bullet.width / 2 - 1, bullet.y - 4, 3, bullet.height + 6, "#00ffff", 12);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(bullet.x + bullet.width / 2, bullet.y - 2, 1, bullet.height + 4);
    });

    // Draw enemies
    state.enemies.forEach((enemy) => {
      let color = "#ff0000";
      if (enemy.type === "fast") color = "#ff00ff";
      if (enemy.type === "heavy") color = "#ffff00";
      
      ctx.save();
      ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
      ctx.fillStyle = color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.beginPath();
      
      if (enemy.type === "fast") {
        // Sharp wedge pointing down
        ctx.moveTo(0, enemy.height / 2);
        ctx.lineTo(enemy.width / 2, -enemy.height / 2);
        ctx.lineTo(0, -enemy.height / 4);
        ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
      } else if (enemy.type === "heavy") {
        // Hexagon / blocky shape
        ctx.moveTo(-enemy.width / 2 + 2, -enemy.height / 2);
        ctx.lineTo(enemy.width / 2 - 2, -enemy.height / 2);
        ctx.lineTo(enemy.width / 2, 0);
        ctx.lineTo(enemy.width / 2 - 2, enemy.height / 2);
        ctx.lineTo(-enemy.width / 2 + 2, enemy.height / 2);
        ctx.lineTo(-enemy.width / 2, 0);
      } else {
        // Basic diamond
        ctx.moveTo(0, enemy.height / 2);
        ctx.lineTo(enemy.width / 2, 0);
        ctx.lineTo(0, -enemy.height / 2);
        ctx.lineTo(-enemy.width / 2, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Enemy health indicator
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
      ctx.fillRect(enemy.x, enemy.y - 6, enemy.width, 2);
      ctx.fillStyle = "#00ff00";
      const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
      ctx.fillRect(enemy.x, enemy.y - 6, enemy.width * healthPercent, 2);
    });

    // Draw enemy bullets
    state.enemyBullets.forEach((bullet) => {
      fillGlowRect(bullet.x + bullet.width / 2 - 1, bullet.y, 2, bullet.height, "#ff0055", 8);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(bullet.x + bullet.width / 2 - 0.5, bullet.y, 1, bullet.height);
    });

    // Draw power-ups
    state.powerUps.forEach((powerUp) => {
      let color = "#00ff00";
      if (powerUp.type === "weapon") color = "#ffff00";
      if (powerUp.type === "shield") color = "#ff00ff";
      
      const pulse = 10 + Math.sin(Date.now() / 150) * 5;
      
      ctx.save();
      ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
      ctx.rotate(Date.now() / 400); // Rotating pick-up
      ctx.shadowBlur = pulse;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      if (powerUp.type === 'shield') {
         ctx.arc(0, 0, powerUp.width / 2 + 2, 0, Math.PI * 2);
      } else {
         ctx.rect(-powerUp.width / 2 - 1, -powerUp.height / 2 - 1, powerUp.width + 2, powerUp.height + 2);
      }
      ctx.stroke();
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 0;
      // Undo rotation for the text
      ctx.rotate(-Date.now() / 400);
      ctx.fillText(powerUp.type.charAt(0).toUpperCase(), 0, 1);
      ctx.restore();
    });

    // Draw UI
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#00ffff";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${state.score}`, 5, 25);
    ctx.fillText(`WAVE: ${state.wave}`, 5, 40);
    ctx.fillText(`LIVES: ${state.lives}`, 5, 55);
    ctx.fillText(`WPN: LV${state.player.weaponLevel}`, 5, 70);
    ctx.shadowBlur = 0;

    if (state.combo > 0) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff00ff";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`COMBO x${state.combo}`, CANVAS_WIDTH / 2, 25);
      ctx.shadowBlur = 0;
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

    const handleTouchEnd = () => {
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
      <div className="flex flex-col items-center min-h-[calc(100vh-80px)] py-8 font-mono bg-grid-cyan-900/[0.04]">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500" style={{ filter: "drop-shadow(0px 0px 8px rgba(34,211,238,0.5))" }}>
            BATTLESHIP BLITZ
          </h1>
          <p className="text-cyan-300/80 text-sm tracking-[0.2em] mt-2 uppercase">Retro Arcade Shooter</p>
        </div>

        <div className="relative group w-full max-w-[640px] px-4">
          <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-[#111118] rounded-xl border border-cyan-500/30 overflow-hidden shadow-2xl p-1 md:p-2 flex justify-center">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full aspect-[4/3] bg-[#0a0a14] rounded shadow-inner"
              style={{
                imageRendering: "pixelated",
                maxHeight: "60vh"
              }}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[640px] px-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-lg transform transition hover:-translate-y-1 hover:border-cyan-500/50">
            <h2 className="text-cyan-400 text-sm font-bold tracking-wider mb-4 flex items-center gap-2">
              <span className="i-ph-game-controller text-lg" />
              CONTROLS
            </h2>
            <ul className="space-y-3 text-cyan-100/70 text-sm">
              <li className="flex items-center gap-3">
                <span className="bg-cyan-950 border border-cyan-800 rounded px-2 py-1 text-xs">←</span>
                <span className="bg-cyan-950 border border-cyan-800 rounded px-2 py-1 text-xs">→</span>
                <span>Move Ship</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="bg-cyan-950 border border-cyan-800 rounded px-2 py-1 text-xs w-16 text-center">SPACE</span>
                <span>Shoot Laser</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="bg-cyan-950 border border-cyan-800 rounded px-2 py-1 text-xs">P</span>
                <span>Pause Game</span>
              </li>
              <li className="flex items-center gap-3 pt-2 border-t border-cyan-900/50 mt-2 text-xs">
                <span className="i-ph-device-mobile-camera text-cyan-400 text-lg" />
                <span>Touch & drag to move and shoot</span>
              </li>
            </ul>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-lg transform transition hover:-translate-y-1 hover:border-fuchsia-500/50">
            <h2 className="text-fuchsia-400 text-sm font-bold tracking-wider mb-4 flex items-center gap-2">
              <span className="i-ph-radar text-lg" />
              RADAR LEGEND
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-300">
              <div className="space-y-3">
                <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-500" style={{ boxShadow: "0 0 8px rgba(239,68,68,0.8)" }} /> Basic Enemy</p>
                <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-fuchsia-500" style={{ boxShadow: "0 0 8px rgba(217,70,239,0.8)" }} /> Fast Enemy</p>
                <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-yellow-500" style={{ boxShadow: "0 0 8px rgba(234,179,8,0.8)" }} /> Heavy Enemy</p>
              </div>
              <div className="space-y-3">
                <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: "0 0 10px rgba(74,222,128,0.8)" }} /> +Health</p>
                <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" style={{ boxShadow: "0 0 10px rgba(250,204,21,0.8)" }} /> +Weapon</p>
                <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-fuchsia-400 animate-pulse" style={{ boxShadow: "0 0 10px rgba(232,121,249,0.8)" }} /> +Shield</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
