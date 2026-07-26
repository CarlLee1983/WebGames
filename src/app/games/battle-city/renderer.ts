// Battle City - Canvas rendering
import {
  GameState,
  TILE_SIZE,
  TANK_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GAME_AREA_WIDTH,
  GAME_AREA_HEIGHT,
  SIDE_BAR_WIDTH,
} from "./utils";

const COLORS = {
  BACKGROUND: "#080b10",
  BORDER: "#334155",
  BRICK: "#c2412d",
  STEEL: "#94a3b8",
  WATER: "#0369a1",
  FOREST: "#166534",
  ICE: "#bae6fd",
  PLAYER_TANK: "#facc15",
  ENEMY_TANK: "#ef4444",
  BASE: "#4ade80",
  BASE_DAMAGED: "#f97316",
  BULLET: "#fde047",
  SIDEBAR_BG: "#111827",
  TEXT: "#f8fafc",
  TEXT_DIM: "#94a3b8",
};

export const drawScene = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Apply screen shake effect
  ctx.save();
  if (state.shakeIntensity > 0) {
    const shakeX = (Math.random() - 0.5) * state.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * state.shakeIntensity;
    ctx.translate(shakeX, shakeY);
  }

  // Draw game area border
  ctx.strokeStyle = COLORS.BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);

  // Draw map grid
  drawMap(ctx, state);

  // Draw game objects
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  drawEnemies(ctx, state);
  drawPlayer(ctx, state);
  drawBase(ctx, state);
  drawPowerUp(ctx, state);

  // Draw sidebar
  drawSidebar(ctx, state);

  // Draw game mode overlays
  if (state.mode === "menu") {
    drawMenuOverlay(ctx);
  } else if (state.mode === "stageStart") {
    drawStageStartOverlay(ctx, state);
  } else if (state.mode === "stageComplete") {
    drawStageCompleteOverlay(ctx, state);
  } else if (state.mode === "paused") {
    drawPausedOverlay(ctx);
  } else if (state.mode === "gameOver") {
    drawGameOverOverlay(ctx);
  }

  ctx.restore();
};

const drawMap = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (let y = 0; y < state.mapGrid.length; y++) {
    for (let x = 0; x < state.mapGrid[y].length; x++) {
      const tile = state.mapGrid[y][x];
      const pixelX = x * TILE_SIZE;
      const pixelY = y * TILE_SIZE;

      ctx.fillStyle = (x + y) % 2 === 0 ? "#0b1017" : "#0d131b";
      ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);

      switch (tile) {
        case 1: // Brick
          ctx.fillStyle = COLORS.BRICK;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = "#fb923c";
          ctx.fillRect(pixelX + 1, pixelY + 1, 6, 2);
          ctx.fillRect(pixelX + 9, pixelY + 9, 6, 2);
          ctx.strokeStyle = "#7c2d12";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pixelX, pixelY + 8);
          ctx.lineTo(pixelX + TILE_SIZE, pixelY + 8);
          ctx.moveTo(pixelX + 8, pixelY);
          ctx.lineTo(pixelX + 8, pixelY + 8);
          ctx.moveTo(pixelX + 5, pixelY + 8);
          ctx.lineTo(pixelX + 5, pixelY + TILE_SIZE);
          ctx.stroke();
          // Draw damage indicator
          const health = state.brickHealth[y]?.[x] ?? 0;
          if (health < 1) {
            ctx.fillStyle = "rgba(212, 85, 45, 0.5)";
            ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          }
          break;
        case 2: // Steel
          const steel = ctx.createLinearGradient(pixelX, pixelY, pixelX + TILE_SIZE, pixelY + TILE_SIZE);
          steel.addColorStop(0, "#e2e8f0");
          steel.addColorStop(0.45, COLORS.STEEL);
          steel.addColorStop(1, "#475569");
          ctx.fillStyle = steel;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX + 2, pixelY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = "#334155";
          ctx.fillRect(pixelX + 3, pixelY + 3, 2, 2);
          ctx.fillRect(pixelX + 11, pixelY + 11, 2, 2);
          break;
        case 3: // Forest
          ctx.fillStyle = COLORS.FOREST;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.arc(pixelX + 5, pixelY + 6, 4, 0, Math.PI * 2);
          ctx.arc(pixelX + 11, pixelY + 9, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 4: // Water
          ctx.fillStyle = COLORS.WATER;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const wave = Math.sin(state.time / 220 + x + y) * 1.5;
          ctx.moveTo(pixelX + 2, pixelY + 5 + wave);
          ctx.lineTo(pixelX + 14, pixelY + 5 - wave);
          ctx.moveTo(pixelX + 2, pixelY + 11 - wave);
          ctx.lineTo(pixelX + 14, pixelY + 11 + wave);
          ctx.stroke();
          break;
        case 5: // Ice
          ctx.fillStyle = COLORS.ICE;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "#f0f9ff";
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX + 2, pixelY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.beginPath();
          ctx.moveTo(pixelX + 4, pixelY + 12);
          ctx.lineTo(pixelX + 12, pixelY + 4);
          ctx.stroke();
          break;
      }
    }
  }
};

const drawPlayer = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const player = state.player;

  // Draw invincibility effect
  if (state.mode === "playing" && player.invincible > 0 && Math.floor((player.invincible / 100) % 2) === 0) {
    ctx.globalAlpha = 0.5;
  }

  drawTank(ctx, player.x, player.y, player.direction, COLORS.PLAYER_TANK, player.level || 1);

  // Draw shield effect
  if (player.shield) {
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + TANK_SIZE * TILE_SIZE / 2, player.y + TANK_SIZE * TILE_SIZE / 2, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
};

const drawEnemies = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const enemy of state.enemies) {
    let enemyColor = COLORS.ENEMY_TANK;
    let enemyLevel = 1;

    // Different colors for different enemy types
    if (enemy.type === "fast") {
      enemyColor = "#ff6600";
    } else if (enemy.type === "armored") {
      enemyColor = "#8888ff";
      enemyLevel = 2;
    } else if (enemy.type === "artillery") {
      enemyColor = "#ff0088";
      enemyLevel = 2;
    }

    drawTank(ctx, enemy.x, enemy.y, enemy.direction, enemyColor, enemyLevel);
  }
};

const drawTank = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: string,
  color: string,
  level: number
) => {
  const size = TANK_SIZE * TILE_SIZE;

  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
  ctx.lineWidth = 2;

  // Cannon
  const cannonX = x + size / 2;
  const cannonY = y + size / 2;
  const cannonLength = 10 + (level - 1) * 2;

  let cannonEndX = cannonX;
  let cannonEndY = cannonY;

  switch (direction) {
    case "UP":
      cannonEndY -= cannonLength;
      break;
    case "DOWN":
      cannonEndY += cannonLength;
      break;
    case "LEFT":
      cannonEndX -= cannonLength;
      break;
    case "RIGHT":
      cannonEndX += cannonLength;
      break;
  }

  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(cannonX, cannonY);
  ctx.lineTo(cannonEndX, cannonEndY);
  ctx.stroke();

  // Tank body
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

  // Tank tracks
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  switch (direction) {
    case "UP":
    case "DOWN":
      ctx.fillRect(x + 2, y + 2, 8, size - 4);
      ctx.fillRect(x + size - 10, y + 2, 8, size - 4);
      break;
    case "LEFT":
    case "RIGHT":
      ctx.fillRect(x + 2, y + 2, size - 4, 8);
      ctx.fillRect(x + 2, y + size - 10, size - 4, 8);
      break;
  }

  // Draw level indicators
  ctx.fillStyle = "#ffff00";
  for (let i = 0; i < level - 1; i++) {
    const starX = x + 4 + i * 6;
    const starY = y + 4;
    drawStar(ctx, starX, starY, 3);
  }

  // Draw level number for level 3
  if (level === 3) {
    ctx.fillStyle = "#ffff00";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3", x + size / 2, y + size / 2);
  }
};

const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
};

const drawBullets = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const bullet of state.bullets) {
    ctx.save();
    ctx.fillStyle = bullet.isPlayer ? COLORS.BULLET : "#ff6666";
    ctx.shadowColor = bullet.isPlayer ? "#fde047" : "#ef4444";
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

const drawPowerUp = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!state.powerUp) return;

  const x = state.powerUp.x;
  const y = state.powerUp.y;
  const blinking = Math.floor((state.powerUp.blinkTimer / 200) % 2) === 0;

  if (!blinking) return;

  const colors: Record<string, string> = {
    tank: "#ffff00",
    star: "#ff8800",
    bomb: "#ff0000",
    shield: "#00ff00",
    clock: "#0088ff",
    shovel: "#8800ff",
  };

  ctx.fillStyle = colors[state.powerUp.type] || "#ffffff";
  ctx.fillRect(x - 8, y - 8, 16, 16);

  // Draw icon letter
  ctx.fillStyle = "#000000";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const letters: Record<string, string> = {
    tank: "T",
    star: "S",
    bomb: "B",
    shield: "H",
    clock: "C",
    shovel: "L",
  };
  ctx.fillText(letters[state.powerUp.type] || "?", x, y);
};

const drawParticles = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const particle of state.particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
};

const drawBase = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (state.baseDestroyed) {
    ctx.fillStyle = COLORS.BASE_DAMAGED;
    const x = 12 * TILE_SIZE;
    const y = 23 * TILE_SIZE;
    ctx.fillRect(x, y, TILE_SIZE * 2, TILE_SIZE * 2);
  } else {
    // Draw eagle icon
    ctx.fillStyle = COLORS.BASE;
    const x = 12 * TILE_SIZE;
    const y = 23 * TILE_SIZE;
    drawEagle(ctx, x + TILE_SIZE, y + TILE_SIZE);
  }
};

const drawEagle = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = "#00ff00";
  // Head
  ctx.beginPath();
  ctx.arc(x, y - 6, 4, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillRect(x - 6, y - 2, 12, 12);
  // Wings
  ctx.fillRect(x - 10, y + 2, 5, 4);
  ctx.fillRect(x + 5, y + 2, 5, 4);
};

const drawSidebar = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const sidebarX = GAME_AREA_WIDTH;

  // Background
  ctx.fillStyle = COLORS.SIDEBAR_BG;
  ctx.fillRect(sidebarX, 0, SIDE_BAR_WIDTH, CANVAS_HEIGHT);

  // Border
  ctx.strokeStyle = COLORS.BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(sidebarX, 0, SIDE_BAR_WIDTH, CANVAS_HEIGHT);

  // Draw text
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "12px monospace";
  ctx.textAlign = "left";

  let yOffset = 20;
  ctx.fillText("STAGE", sidebarX + 8, yOffset);
  yOffset += 15;
  ctx.font = "bold 16px monospace";
  ctx.fillText(String(state.stage), sidebarX + 18, yOffset);

  yOffset += 30;
  ctx.font = "12px monospace";
  ctx.fillText("LIVES", sidebarX + 10, yOffset);
  yOffset += 15;
  ctx.font = "bold 14px monospace";
  ctx.fillText(String(state.lives), sidebarX + 20, yOffset);

  yOffset += 30;
  ctx.font = "12px monospace";
  ctx.fillText("SCORE", sidebarX + 8, yOffset);
  yOffset += 15;
  ctx.font = "bold 12px monospace";
  ctx.fillText(String(state.score).padStart(6, "0"), sidebarX + 8, yOffset);

  yOffset += 30;
  ctx.font = "12px monospace";
  ctx.fillText("HI", sidebarX + 18, yOffset);
  yOffset += 15;
  ctx.font = "bold 12px monospace";
  ctx.fillText(String(state.hiScore).padStart(6, "0"), sidebarX + 8, yOffset);

  yOffset += 34;
  ctx.fillStyle = COLORS.TEXT_DIM;
  ctx.font = "10px monospace";
  ctx.fillText("ENEMY", sidebarX + 12, yOffset);
  yOffset += 12;
  const remaining = state.enemies.length + state.enemyQueue.length;
  for (let i = 0; i < Math.min(remaining, 12); i++) {
    const iconX = sidebarX + 12 + (i % 3) * 15;
    const iconY = yOffset + Math.floor(i / 3) * 14;
    ctx.fillStyle = i < state.enemies.length ? "#fb7185" : "#64748b";
    ctx.fillRect(iconX, iconY, 8, 10);
  }

  yOffset += 70;
  ctx.fillStyle = COLORS.TEXT_DIM;
  ctx.fillText("ARMOR", sidebarX + 12, yOffset);
  ctx.fillStyle = "#334155";
  ctx.fillRect(sidebarX + 8, yOffset + 7, 48, 5);
  ctx.fillStyle = state.player.health > 50 ? "#4ade80" : "#f97316";
  ctx.fillRect(sidebarX + 8, yOffset + 7, 48 * Math.max(0, state.player.health / state.player.maxHealth), 5);
};

const drawMenuOverlay = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.fillText("BATTLE CITY", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

  ctx.font = "16px monospace";
  ctx.fillText("Press SPACE to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
};

const drawStageStartOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const opacity = 1 - state.stageTimer / 2000;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * opacity})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.globalAlpha = opacity;
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`STAGE ${state.stage}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.globalAlpha = 1;
};

const drawPausedOverlay = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
};

const drawStageCompleteOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const opacity = 1 - state.stageTimer / 2000;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * opacity})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.globalAlpha = opacity;
  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("STAGE COMPLETE", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
  ctx.font = "16px monospace";
  ctx.fillText(`Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
  ctx.globalAlpha = 1;
};

const drawGameOverOverlay = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = COLORS.TEXT;
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

  ctx.font = "16px monospace";
  ctx.fillText("Press SPACE to return to menu", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
};
