"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GameState,
  createInitialState,
  getMissionTelemetry,
  renderGameStateText,
  restartGame,
  sanitizeBestScore,
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
const BEST_SCORE_KEY = "battleship_blitz_best_score_v1";

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
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [bestScore, setBestScore] = useState(0);
  const bestScoreRef = useRef(0);
  const frameCountRef = useRef(0);
  const drawGameplayRef = useRef<(ctx: CanvasRenderingContext2D, state: GameState) => void>(() => undefined);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = sanitizeBestScore(Number(window.localStorage.getItem(BEST_SCORE_KEY)));
        bestScoreRef.current = stored;
        setBestScore(stored);
      } catch {
        // The game remains fully playable when storage is unavailable.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateBestScore = useCallback((score: number) => {
    if (score <= bestScoreRef.current) return;
    bestScoreRef.current = score;
    setBestScore(score);
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(score));
    } catch {
      // Ignore storage failures; the in-session record still updates.
    }
  }, []);

  // Render game to canvas
  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = gameStateRef.current;
    updateBestScore(state.score);

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
      drawGameplayRef.current(ctx, state);

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
      drawGameplayRef.current(ctx, state);

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
      drawGameplayRef.current(ctx, state);
    }

    // Keep the HTML HUD responsive without forcing React to render at 60 fps.
    frameCountRef.current += 1;
    if (frameCountRef.current % 6 === 0) {
      setGameState({ ...state, player: { ...state.player } });
    }
  }, [updateBestScore]);

  function drawGameplay(ctx: CanvasRenderingContext2D, state: GameState) {
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
    if (state.mode === 'playing') {
      const drawFlame = (xOff: number, size: number, phase: number) => {
        const flicker = 0.75 + (Math.sin(state.time * 35 + phase) + 1) * 0.25;
        ctx.fillStyle = "#ff5500";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ff0000";
        ctx.beginPath();
        ctx.moveTo(xOff - size, state.player.height * 0.3);
        ctx.lineTo(xOff + size, state.player.height * 0.3);
        ctx.lineTo(xOff, state.player.height * 0.5 + 8 * size * flicker);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#ffffaa";
        ctx.beginPath();
        ctx.moveTo(xOff - size*0.5, state.player.height * 0.3);
        ctx.lineTo(xOff + size*0.5, state.player.height * 0.3);
        ctx.lineTo(xOff, state.player.height * 0.4 + 4 * size * flicker);
        ctx.closePath();
        ctx.fill();
      };
      
      drawFlame(0, 3, 0); // Main
      drawFlame(-state.player.width * 0.3, 1.5, 1); // Left
      drawFlame(state.player.width * 0.3, 1.5, 2); // Right
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
      if (bullet.type === 'missile') {
        ctx.save();
        ctx.translate(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
        ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
        fillGlowRect(-bullet.width/2, -bullet.height/2, bullet.width, bullet.height, "#ffaa00", 15);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-bullet.width/4, -bullet.height/2, bullet.width/2, bullet.height);
        ctx.restore();
      } else if (bullet.type === 'laser') {
        fillGlowRect(bullet.x, bullet.y, bullet.width, bullet.height, "#44aaff", 15);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bullet.x + bullet.width/2 - 2, bullet.y, 4, bullet.height);
      } else if (bullet.type === 'spread') {
        ctx.save();
        ctx.translate(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
        ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
        fillGlowRect(-bullet.width/2, -bullet.height/2, bullet.width, bullet.height, "#00ff44", 10);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-bullet.width/4, -bullet.height/4, bullet.width/2, bullet.height/2);
        ctx.restore();
      } else { // blaster
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
      let text = "W";
      if (powerUp.type === "health") { color = "#00ff00"; text = "H"; }
      else if (powerUp.type === "shield") { color = "#ff00ff"; text = "S"; }
      else if (powerUp.type === "weapon_blaster") { color = "#ffff00"; text = "B"; }
      else if (powerUp.type === "weapon_missile") { color = "#ff5500"; text = "M"; }
      else if (powerUp.type === "weapon_laser") { color = "#44aaff"; text = "L"; }
      else if (powerUp.type === "weapon_spread") { color = "#00ff44"; text = "S"; }
      
      const pulse = 10 + Math.sin(state.time * 7) * 8;
      
      ctx.save();
      ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
      ctx.rotate(state.time * 2); // Rotating pick-up
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
      ctx.rotate(-state.time * 2);
      ctx.fillText(text, 0, 1);
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
    ctx.fillText(`WPN: ${state.player.weaponType.toUpperCase()} LV${state.player.weaponLevel < 5 ? state.player.weaponLevel : "MAX"}`, 15, 85);
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
  }

  useEffect(() => {
    drawGameplayRef.current = drawGameplay;
  });

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
      const target = e.target as HTMLElement | null;

      if (target?.closest("button, a, input, textarea, select")) {
        return;
      }
      
      // Prevent default browser scrolling for game controls
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        e.preventDefault();
      }

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
          gameStateRef.current = startGame();
        } else if (gameStateRef.current.mode === "gameOver") {
          gameStateRef.current = restartGame();
        } else if (gameStateRef.current.mode === "playing") {
          inputStateRef.current.shoot = true;
        }
      } else if (key === "p") {
        if (!e.repeat) {
          gameStateRef.current = togglePause(gameStateRef.current);
        }
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
        gameStateRef.current = startGame();
      } else if (gameStateRef.current.mode === "gameOver") {
        gameStateRef.current = restartGame();
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
      return renderGameStateText(gameStateRef.current, bestScoreRef.current);
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
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [renderGame]);

  const handlePrimaryAction = () => {
    const state = gameStateRef.current;
    if (state.mode === "menu") {
      gameStateRef.current = startGame();
    } else if (state.mode === "gameOver") {
      gameStateRef.current = restartGame();
    } else {
      gameStateRef.current = togglePause(state);
    }
    setGameState({ ...gameStateRef.current, player: { ...gameStateRef.current.player } });
    requestAnimationFrame(() => canvasRef.current?.focus());
  };

  const setInput = (
    key: "left" | "right" | "up" | "down" | "shoot",
    pressed: boolean,
  ) => {
    inputStateRef.current[key] = pressed;
  };

  const fireOnce = () => {
    if (gameStateRef.current.mode !== "playing") return;
    gameStateRef.current = updateGameState(
      gameStateRef.current,
      { ...inputStateRef.current, shoot: true },
      0,
    );
    renderGame();
  };

  const modeLabel = {
    menu: "Ready",
    playing: "In flight",
    paused: "Paused",
    gameOver: "Run ended",
  }[gameState.mode];
  const primaryActionLabel = gameState.mode === "menu"
    ? "Start sortie"
    : gameState.mode === "gameOver"
      ? "Try again"
      : gameState.mode === "paused"
        ? "Resume"
        : "Pause";
  const telemetry = getMissionTelemetry(gameState);
  const threatTone = {
    Clear: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    Engaged: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    Critical: "border-rose-400/50 bg-rose-400/15 text-rose-100",
    Boss: "border-fuchsia-400/60 bg-fuchsia-400/15 text-fuchsia-100",
  }[telemetry.threat];
  const weaponShort = `${gameState.player.weaponType.slice(0, 3).toUpperCase()} ${gameState.player.weaponLevel}`;

  return (
    <div
      className="min-h-[calc(100vh-64px)] overflow-x-hidden bg-[#050914] font-mono text-slate-100"
      style={{
        backgroundImage: "radial-gradient(circle at 16% 2%, rgba(34,211,238,.14), transparent 28%), radial-gradient(circle at 92% 12%, rgba(217,70,239,.12), transparent 26%)",
      }}
    >
      <Container size="lg">
        <div className="py-3 sm:py-5">
          <header className="mb-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="hidden text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300 sm:block">Fleet defense // sortie 05</p>
              <h1 className="whitespace-nowrap bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 bg-clip-text text-[clamp(1.55rem,6vw,3.25rem)] font-black leading-none tracking-[0.08em] text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,.25)]">
                BATTLESHIP BLITZ
              </h1>
              <p className="mt-2 hidden text-xs font-semibold tracking-[0.12em] text-slate-400 md:block">Break the formation. Protect the fleet. Survive every fifth-wave mothership.</p>
            </div>
            <div className="hidden shrink-0 rounded-xl border border-cyan-400/25 bg-cyan-400/8 px-4 py-2 text-right sm:block">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Pilot rank</p>
              <p className="mt-0.5 text-sm font-black text-cyan-200">{telemetry.rank}</p>
            </div>
          </header>

          <section className="mb-3 grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Current mission status">
            <MissionStat label="Status" value={modeLabel} />
            <MissionStat label="Score" value={gameState.score.toLocaleString("en-US")} />
            <MissionStat label="Wave" value={gameState.wave.toString()} />
            <MissionStat label="Hull" value={`${gameState.player.health}% · ${gameState.lives}L`} />
            <MissionStat label="Weapon" value={weaponShort} />
          </section>

          <div className="grid items-start gap-3 lg:grid-cols-[minmax(350px,420px)_minmax(0,1fr)]">
            <section aria-label="Flight console">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="min-h-12 rounded-xl bg-cyan-400 px-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
                >
                  {primaryActionLabel}
                </button>
                <button
                  type="button"
                  disabled={gameState.mode !== "playing"}
                  onClick={fireOnce}
                  onPointerDown={() => setInput("shoot", true)}
                  onPointerUp={() => setInput("shoot", false)}
                  onPointerCancel={() => setInput("shoot", false)}
                  onPointerLeave={() => setInput("shoot", false)}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") setInput("shoot", true);
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") setInput("shoot", false);
                  }}
                  onBlur={() => setInput("shoot", false)}
                  className="min-h-12 rounded-xl border border-fuchsia-400/60 bg-fuchsia-950/80 px-3 text-xs font-black uppercase tracking-[0.12em] text-fuchsia-100 transition hover:bg-fuchsia-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Hold to fire
                </button>
              </div>

              <div className="relative mx-auto w-full max-w-[326px] sm:max-w-[380px] lg:max-w-[390px]">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-cyan-500 to-fuchsia-600 opacity-45 blur-md" />
                <div className="relative flex justify-center overflow-hidden rounded-xl border border-cyan-400/40 bg-[#0f0f18] p-1.5 shadow-2xl">
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    tabIndex={0}
                    role="img"
                    aria-label={`Battleship Blitz game field. ${modeLabel}. Score ${gameState.score}, wave ${gameState.wave}, hull ${gameState.player.health} percent.`}
                    className="block w-full rounded bg-[#0a0a14] shadow-inner outline-none focus-visible:ring-4 focus-visible:ring-cyan-400"
                    style={{ imageRendering: "pixelated", height: "auto", touchAction: "none" }}
                  >
                    Battleship Blitz arcade game. Use the controls around the game field to play.
                  </canvas>
                </div>
              </div>

              <div className="mx-auto mt-2 grid w-full max-w-[326px] grid-cols-3 gap-1.5 sm:max-w-[380px] lg:hidden" aria-label="Touch movement controls">
                <span />
                <ControlButton label="Move up" glyph="↑" input="up" setInput={setInput} />
                <span />
                <ControlButton label="Move left" glyph="←" input="left" setInput={setInput} />
                <ControlButton label="Move down" glyph="↓" input="down" setInput={setInput} />
                <ControlButton label="Move right" glyph="→" input="right" setInput={setInput} />
              </div>
            </section>

            <aside className="grid gap-3" aria-label="Mission intelligence">
              <section className="rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-4 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Mission cadence</p>
                    <h2 className="mt-1 text-xl font-black text-white">Route to the mothership</h2>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${threatTone}`}>
                    {telemetry.threat}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-2" aria-label={`Wave ${telemetry.sectorStep} of 5 in the current sector`}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const step = index + 1;
                    const active = step <= telemetry.sectorStep;
                    return (
                      <div key={step} className="text-center">
                        <div className={`h-2 rounded-full ${active ? (step === 5 ? "bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,.8)]" : "bg-cyan-400") : "bg-slate-800"}`} />
                        <span className="mt-1.5 block text-[9px] font-black text-slate-500">{step === 5 ? "BOSS" : `W${step}`}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  {telemetry.bossIn === 0
                    ? "Mothership contact. Read the pattern and hold the center lane."
                    : `${telemetry.bossIn} wave${telemetry.bossIn === 1 ? "" : "s"} until the next mothership contact.`}
                </p>

                <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/8 pt-4">
                  <MissionMetric label="Rank" value={telemetry.rank} />
                  <MissionMetric label="Best" value={bestScore.toLocaleString("en-US")} />
                  <MissionMetric label="Combo" value={`×${gameState.combo}`} />
                  <MissionMetric label="Hostiles" value={gameState.enemies.length.toString()} />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-cyan-400/15 bg-slate-950/60 p-4">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Flight controls</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase text-slate-300">
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">WASD / Arrows · Move</span>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">Space · Fire</span>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">P · Pause</span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">On touch screens, drag inside the field to steer and auto-fire, or use the directional pad.</p>
                </div>

                <div className="rounded-2xl border border-fuchsia-400/15 bg-slate-950/60 p-4">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Radar legend</h2>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-bold text-slate-400">
                    <RadarItem color="bg-red-500" label="Interceptor" />
                    <RadarItem color="bg-fuchsia-500" label="Stalker" />
                    <RadarItem color="bg-amber-400" label="Dreadnought" />
                    <RadarItem color="bg-orange-500" label="Mothership" />
                    <RadarItem color="bg-emerald-400" label="Repair / Spread" />
                    <RadarItem color="bg-blue-400" label="Laser / Shield" />
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <p className="sr-only" aria-live="polite">
            {modeLabel}. Score {gameState.score}. Wave {gameState.wave}. Hull {gameState.player.health} percent. {gameState.lives} lives remaining.
          </p>
        </div>
      </Container>
    </div>
  );
}

function MissionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-cyan-300/15 bg-slate-950/65 px-2 py-2 shadow-lg sm:px-3">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-[9px]">{label}</p>
      <p className="mt-1 truncate text-[10px] font-black text-white sm:text-sm">{value}</p>
    </div>
  );
}

function MissionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[8px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-200">{value}</p>
    </div>
  );
}

function RadarItem({ color, label }: { color: string; label: string }) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </p>
  );
}

function ControlButton({
  label,
  glyph,
  input,
  setInput,
}: {
  label: string;
  glyph: string;
  input: "left" | "right" | "up" | "down";
  setInput: (input: "left" | "right" | "up" | "down" | "shoot", pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={() => setInput(input, true)}
      onPointerUp={() => setInput(input, false)}
      onPointerCancel={() => setInput(input, false)}
      onPointerLeave={() => setInput(input, false)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setInput(input, true);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          setInput(input, false);
        }
      }}
      onBlur={() => setInput(input, false)}
      className="min-h-12 rounded-lg border border-cyan-700 bg-cyan-950 text-xl font-black text-cyan-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
    >
      {glyph}
    </button>
  );
}
