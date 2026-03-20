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
    up: false,
    down: false,
    shoot: false,
    pause: false,
    touchX: undefined as number | undefined,
    touchY: undefined as number | undefined,
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
    ctx.fillStyle = "#0f0f18";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw starfield background (parallax effect)
    for (let i = 0; i < 40; i++) {
      const speedMultiplier = i % 3 === 0 ? 30 : (i % 2 === 0 ? 15 : 5);
      const x = (i * 45 + (state.time * speedMultiplier)) % CANVAS_WIDTH;
      const y = (i * 25 + (state.time * speedMultiplier * 2)) % CANVAS_HEIGHT;
      const size = i % 3 === 0 ? 2 : 1;
      ctx.fillStyle = i % 3 === 0 ? "rgba(255, 255, 255, 0.6)" : "rgba(100, 200, 255, 0.3)";
      ctx.fillRect(x, y, size, size);
    }

    if (state.mode === "menu") {
      // Menu screen
      ctx.fillStyle = "#00ffff";
      ctx.font = "bold 32px monospace";
      ctx.textAlign = "center";
      ctx.fillText("BATTLESHIP BLITZ", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

      ctx.fillStyle = "#ffff00";
      ctx.font = "16px monospace";
      ctx.fillText("RETRO ARCADE SHOOTER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3 + 40);

      ctx.fillStyle = "#00ff00";
      ctx.font = "14px monospace";
      ctx.fillText("Controls:", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.fillText("Arrow Keys / WASD to move", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
      ctx.fillText("SPACE or Touch to shoot", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      ctx.fillText("P to pause", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 75);

      ctx.fillStyle = "#ff00ff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(Math.floor(Date.now() / 500) % 2 === 0 ? "PRESS SPACE TO START" : "", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.75);
    } else if (state.mode === "paused") {
      // Draw game state dimmed
      drawGameplay(ctx, state);

      // Draw pause overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#ffff00";
      ctx.font = "bold 30px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

      ctx.fillStyle = "#00ff00";
      ctx.font = "16px monospace";
      ctx.fillText("Press P to resume", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    } else if (state.mode === "gameOver") {
      // Draw game state dimmed
      drawGameplay(ctx, state);

      // Draw game over overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#ff0000";
      ctx.font = "bold 36px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

      ctx.fillStyle = "#ffff00";
      ctx.font = "18px monospace";
      ctx.fillText(`FINAL SCORE: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
      ctx.fillText(`WAVE REACHED: ${state.wave}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

      ctx.fillStyle = "#00ff00";
      ctx.font = "16px monospace";
      ctx.fillText("Press SPACE to restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90);
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
    
    // Player ship base
    ctx.fillStyle = playerColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = playerColor;
    ctx.beginPath();
    // Modern fighter jet shape
    ctx.moveTo(0, -state.player.height * 0.7); // Nose
    ctx.lineTo(state.player.width * 0.2, -state.player.height * 0.2); // Right nose
    ctx.lineTo(state.player.width * 0.6, state.player.height * 0.3); // Right wing tip
    ctx.lineTo(state.player.width * 0.3, state.player.height * 0.5); // Right inner wing
    ctx.lineTo(state.player.width * 0.1, state.player.height * 0.3); // Right tail base
    ctx.lineTo(0, state.player.height * 0.1); // Inner tail
    ctx.lineTo(-state.player.width * 0.1, state.player.height * 0.3); // Left tail base
    ctx.lineTo(-state.player.width * 0.3, state.player.height * 0.5); // Left inner wing
    ctx.lineTo(-state.player.width * 0.6, state.player.height * 0.3); // Left wing tip
    ctx.lineTo(-state.player.width * 0.2, -state.player.height * 0.2); // Left nose
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.ellipse(0, -state.player.height * 0.2, state.player.width * 0.1, state.player.height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine flames (3 flames)
    if (state.mode === 'playing' && Math.random() > 0.3) {
      const drawFlame = (xOff: number, size: number) => {
        ctx.fillStyle = "#ff5500";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ff0000";
        ctx.beginPath();
        ctx.moveTo(xOff - size, state.player.height * 0.3);
        ctx.lineTo(xOff + size, state.player.height * 0.3);
        ctx.lineTo(xOff, state.player.height * 0.5 + Math.random() * 15 * size);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#ffffaa";
        ctx.beginPath();
        ctx.moveTo(xOff - size*0.5, state.player.height * 0.3);
        ctx.lineTo(xOff + size*0.5, state.player.height * 0.3);
        ctx.lineTo(xOff, state.player.height * 0.4 + Math.random() * 8 * size);
        ctx.closePath();
        ctx.fill();
      };
      
      drawFlame(0, 3); // Main
      drawFlame(-state.player.width * 0.3, 1.5); // Left
      drawFlame(state.player.width * 0.3, 1.5); // Right
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Draw player health bar above player slightly
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(state.player.x, state.player.y + state.player.height + 15, state.player.width, 4);
    fillGlowRect(
      state.player.x, 
      state.player.y + state.player.height + 15, 
      (state.player.health / state.player.maxHealth) * state.player.width, 
      4, 
      "#00ff00", 
      5
    );

    // Draw player bullets
    state.playerBullets.forEach((bullet) => {
      if (bullet.width > 6) { // Missiles
        ctx.save();
        ctx.translate(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
        ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
        fillGlowRect(-bullet.width/2, -bullet.height/2, bullet.width, bullet.height, "#ffaa00", 15);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-bullet.width/4, -bullet.height/2, bullet.width/2, bullet.height);
        ctx.restore();
      } else {
        fillGlowRect(bullet.x, bullet.y, bullet.width, bullet.height, "#00ffff", 12);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bullet.x + bullet.width/2 - 0.5, bullet.y + 1, 1, bullet.height - 2);
      }
    });

    // Draw enemies
    state.enemies.forEach((enemy) => {
      ctx.save();
      ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
      
      if (enemy.type === "boss") {
        ctx.fillStyle = "#ff3300";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ff0000";
        // Large complex boss shape
        ctx.beginPath();
        // Core
        ctx.arc(0, 0, enemy.width * 0.3, 0, Math.PI * 2);
        // Wings
        ctx.moveTo(-enemy.width * 0.3, 0);
        ctx.lineTo(-enemy.width * 0.5, -enemy.height * 0.4);
        ctx.lineTo(-enemy.width * 0.4, enemy.height * 0.4);
        ctx.lineTo(-enemy.width * 0.2, enemy.height * 0.2);
        
        ctx.moveTo(enemy.width * 0.3, 0);
        ctx.lineTo(enemy.width * 0.5, -enemy.height * 0.4);
        ctx.lineTo(enemy.width * 0.4, enemy.height * 0.4);
        ctx.lineTo(enemy.width * 0.2, enemy.height * 0.2);
        ctx.fill();

        // Details
        ctx.fillStyle = "#222222";
        ctx.beginPath();
        ctx.arc(0, 0, enemy.width * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing eye
        const pulse = Math.abs(Math.sin((enemy.stateTime || 0) * 4));
        ctx.fillStyle = `rgba(255, 255, 0, ${0.5 + pulse * 0.5})`;
        ctx.shadowBlur = 10 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.width * 0.08, 0, Math.PI * 2);
        ctx.fill();

      } else {
        let color = "#ff0000";
        if (enemy.type === "fast") color = "#ff00ff";
        if (enemy.type === "heavy") color = "#ffaa00";

        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        
        if (enemy.type === "fast") {
          // Sharp wedge pointing down
          ctx.moveTo(0, enemy.height * 0.5);
          ctx.lineTo(enemy.width * 0.4, -enemy.height * 0.5);
          ctx.lineTo(0, -enemy.height * 0.2);
          ctx.lineTo(-enemy.width * 0.4, -enemy.height * 0.5);
        } else if (enemy.type === "heavy") {
          // Tanky hexagon
          ctx.moveTo(-enemy.width * 0.4, -enemy.height * 0.4);
          ctx.lineTo(enemy.width * 0.4, -enemy.height * 0.4);
          ctx.lineTo(enemy.width * 0.5, 0);
          ctx.lineTo(enemy.width * 0.4, enemy.height * 0.4);
          ctx.lineTo(-enemy.width * 0.4, enemy.height * 0.4);
          ctx.lineTo(-enemy.width * 0.5, 0);
        } else {
          // Basic diamond/shield
          ctx.moveTo(0, enemy.height * 0.5);
          ctx.lineTo(enemy.width * 0.5, 0);
          ctx.lineTo(0, -enemy.height * 0.5);
          ctx.lineTo(-enemy.width * 0.5, 0);
        }
        ctx.closePath();
        ctx.fill();
        
        // Minor detail
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.arc(0, 0, enemy.width * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Enemy health indicator (except boss)
      if (enemy.type !== "boss") {
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fillRect(enemy.x, enemy.y - 8, enemy.width, 3);
        ctx.fillStyle = "#00ff00";
        const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
        ctx.fillRect(enemy.x, enemy.y - 8, enemy.width * healthPercent, 3);
      }
    });

    // Draw Boss Health Bar at top
    const boss = state.enemies.find(e => e.type === 'boss');
    if (boss) {
      const hbWidth = CANVAS_WIDTH * 0.8;
      const hbHeight = 15;
      const hbX = CANVAS_WIDTH * 0.1;
      const hbY = 40;
      
      ctx.shadowBlur = 0;
      // Background
      ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
      ctx.fillRect(hbX, hbY, hbWidth, hbHeight);
      
      // HP bar
      const hpRatio = Math.max(0, boss.health / boss.maxHealth);
      ctx.fillStyle = `rgb(${255}, ${Math.floor(255 * hpRatio)}, 0)`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(hbX, hbY, hbWidth * hpRatio, hbHeight);
      
      // Border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(hbX, hbY, hbWidth, hbHeight);
      
      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.shadowBlur = 2;
      ctx.fillText("WARNING: ALIEN MOTHERSHIP", CANVAS_WIDTH / 2, hbY - 10);
    }

    // Draw enemy bullets
    state.enemyBullets.forEach((bullet) => {
      ctx.save();
      ctx.translate(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) - Math.PI / 2);
      fillGlowRect(-bullet.width/2, -bullet.height/2, bullet.width, bullet.height, "#ff0055", 10);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-bullet.width/4, -bullet.height/2, bullet.width/2, bullet.height);
      ctx.restore();
    });

    // Draw power-ups
    state.powerUps.forEach((powerUp) => {
      let color = "#00ff00";
      if (powerUp.type === "weapon") color = "#ffff00";
      if (powerUp.type === "shield") color = "#ff00ff";
      
      const pulse = 10 + Math.sin(Date.now() / 150) * 8;
      
      ctx.save();
      ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
      ctx.rotate(Date.now() / 300); // Rotating pick-up
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
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 0;
      // Undo rotation for the text
      ctx.rotate(-Date.now() / 300);
      ctx.fillText(powerUp.type.charAt(0).toUpperCase(), 0, 1);
      ctx.restore();
    });

    // Draw UI HUD
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#00ffff";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${state.score}`, 15, 25);
    ctx.fillText(`WAVE: ${state.wave}`, 15, 45);
    
    // Draw Lives
    const renderLives = () => {
      ctx.fillText(`LIVES:`, 15, 65);
      for(let i=0; i<Math.min(5, state.lives); i++) {
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.moveTo(80 + i * 15, 65);
        ctx.lineTo(85 + i * 15, 55);
        ctx.lineTo(90 + i * 15, 65);
        ctx.fill();
      }
    };
    renderLives();

    ctx.fillStyle = state.player.weaponLevel >= 5 ? "#ffaa00" : "#ffffff";
    ctx.fillText(`WPN: LV${state.player.weaponLevel < 5 ? state.player.weaponLevel : "MAX"}`, 15, 85);
    ctx.shadowBlur = 0;

    if (state.combo > 1) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#ff00ff";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`COMBO x${state.combo}`, CANVAS_WIDTH - 15, 30);
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
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        inputStateRef.current.left = true;
      } else if (key === "arrowright" || key === "d") {
        inputStateRef.current.right = true;
      } else if (key === "arrowup" || key === "w") {
        inputStateRef.current.up = true;
      } else if (key === "arrowdown" || key === "s") {
        inputStateRef.current.down = true;
      } else if (key === " ") {
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
      } else if (key === "p") {
        gameStateRef.current = togglePause(gameStateRef.current);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        inputStateRef.current.left = false;
      } else if (key === "arrowright" || key === "d") {
        inputStateRef.current.right = false;
      } else if (key === "arrowup" || key === "w") {
        inputStateRef.current.up = false;
      } else if (key === "arrowdown" || key === "s") {
        inputStateRef.current.down = false;
      } else if (key === " ") {
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
      const scaleY = CANVAS_HEIGHT / rect.height;
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * scaleX;
      const touchY = (touch.clientY - rect.top) * scaleY;
      
      // Calculate offset logic to make dragging relative to plane center feel natural
      inputStateRef.current.touchX = touchX;
      inputStateRef.current.touchY = Math.max(0, touchY - 40); // Offset to see ship above finger
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      inputStateRef.current.shoot = true;
      handleTouchMove(e);
      if (
        gameStateRef.current.mode === "menu"
      ) {
        gameStateRef.current = startGame(gameStateRef.current);
      } else if (gameStateRef.current.mode === "gameOver") {
        gameStateRef.current = restartGame(gameStateRef.current);
      }
    };

    const handleTouchEnd = () => {
      inputStateRef.current.shoot = false;
      inputStateRef.current.touchX = undefined;
      inputStateRef.current.touchY = undefined;
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
          <h1 className="text-4xl md:text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500" style={{ filter: "drop-shadow(0px 0px 10px rgba(34,211,238,0.5))" }}>
            BATTLESHIP BLITZ
          </h1>
          <p className="text-cyan-300/80 text-sm tracking-[0.3em] mt-3 uppercase font-semibold">Retro Arcade Shooter</p>
        </div>

        <div className="relative group w-full max-w-[600px] px-2 md:px-0">
          <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500 to-purple-600 rounded-2xl blur-md opacity-40 group-hover:opacity-60 transition duration-1000"></div>
          <div className="relative bg-[#0f0f18] rounded-xl border border-cyan-500/40 overflow-hidden shadow-2xl p-1 md:p-2 flex justify-center">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full aspect-[3/4] bg-[#0a0a14] rounded shadow-inner"
              style={{
                imageRendering: "pixelated",
                maxHeight: "70vh"
              }}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[800px] px-4">
          <div className="bg-[#111118]/80 backdrop-blur-md border border-cyan-900/50 rounded-xl p-6 shadow-xl transform transition hover:-translate-y-1 hover:border-cyan-500/50">
            <h2 className="text-cyan-400 text-sm font-bold tracking-widest mb-5 flex items-center gap-3">
              <span className="i-ph-game-controller text-xl" />
              CONTROLS
            </h2>
            <ul className="space-y-4 text-cyan-100/80 text-sm">
              <li className="flex items-center gap-3">
                <div className="grid grid-cols-3 gap-1">
                  <div/>
                  <span className="bg-cyan-950/80 border border-cyan-800 rounded px-2 py-1 text-xs text-center">W/↑</span>
                  <div/>
                  <span className="bg-cyan-950/80 border border-cyan-800 rounded px-2 py-1 text-xs text-center">A/←</span>
                  <span className="bg-cyan-950/80 border border-cyan-800 rounded px-2 py-1 text-xs text-center">S/↓</span>
                  <span className="bg-cyan-950/80 border border-cyan-800 rounded px-2 py-1 text-xs text-center">D/→</span>
                </div>
                <span className="ml-2 font-medium">Move Ship</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="bg-cyan-950/80 border border-cyan-800 rounded px-3 py-1.5 text-xs text-center font-bold tracking-widest">SPACE</span>
                <span className="font-medium">Shoot Weapons</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="bg-cyan-950/80 border border-cyan-800 rounded px-3 py-1.5 text-xs font-bold">P</span>
                <span className="font-medium">Pause Game</span>
              </li>
              <li className="flex items-center gap-3 pt-4 border-t border-cyan-900/50 mt-4 text-xs font-semibold text-cyan-300">
                <span className="i-ph-device-mobile-camera text-2xl" />
                <span>Touch & drag anywhere to move and shoot</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#111118]/80 backdrop-blur-md border border-fuchsia-900/50 rounded-xl p-6 shadow-xl transform transition hover:-translate-y-1 hover:border-fuchsia-500/50">
            <h2 className="text-fuchsia-400 text-sm font-bold tracking-widest mb-5 flex items-center gap-3">
              <span className="i-ph-radar text-xl" />
              RADAR LEGEND
            </h2>
            <div className="grid grid-cols-2 gap-x-2 gap-y-4 text-sm text-gray-300">
              <div className="space-y-4">
                <p className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-sm bg-red-500" style={{ boxShadow: "0 0 10px rgba(239,68,68,0.8)" }} /> Interceptor</p>
                <p className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-sm bg-fuchsia-500" style={{ boxShadow: "0 0 10px rgba(217,70,239,0.8)" }} /> Stalker</p>
                <p className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-sm bg-[#ffaa00]" style={{ boxShadow: "0 0 10px rgba(255,170,0,0.8)" }} /> Dreadnought</p>
                <p className="flex items-center gap-3 font-bold text-red-400 mt-2"><span className="w-4 h-4 rounded-full bg-[#ff3300] animate-pulse" style={{ boxShadow: "0 0 15px rgba(255,51,0,1)" }} /> ALIEN BOSS</p>
              </div>
              <div className="space-y-4 border-l border-white/10 pl-4">
                <p className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-full bg-green-400 animate-pulse border border-green-200" style={{ boxShadow: "0 0 12px rgba(74,222,128,0.8)" }} /> Repair (H)</p>
                <p className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse border border-yellow-200" style={{ boxShadow: "0 0 12px rgba(250,204,21,0.8)" }} /> Upgrade (W)</p>
                <p className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-full bg-fuchsia-400 animate-pulse border border-fuchsia-200" style={{ boxShadow: "0 0 12px rgba(232,121,249,0.8)" }} /> Shield (S)</p>
                <p className="text-xs text-gray-400 mt-4 leading-relaxed">Collect power-ups to upgrade weapons to MAX LEVEL (5) and survive!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
