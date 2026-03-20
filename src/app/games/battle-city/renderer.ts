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
  BACKGROUND: "#1a1a1a",
  BORDER: "#333",
  BRICK: "#d4552d",
  STEEL: "#888",
  WATER: "#0066cc",
  FOREST: "#228822",
  ICE: "#aaf",
  PLAYER_TANK: "#ffff00",
  ENEMY_TANK: "#ff0000",
  BASE: "#00ff00",
  BASE_DAMAGED: "#ff8800",
  BULLET: "#ffff00",
  SIDEBAR_BG: "#222",
  TEXT: "#ffffff",
  TEXT_DIM: "#888",
};

export const drawScene = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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
};

const drawMap = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (let y = 0; y < state.mapGrid.length; y++) {
    for (let x = 0; x < state.mapGrid[y].length; x++) {
      const tile = state.mapGrid[y][x];
      const pixelX = x * TILE_SIZE;
      const pixelY = y * TILE_SIZE;

      switch (tile) {
        case 1: // Brick
          ctx.fillStyle = COLORS.BRICK;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          // Draw damage indicator
          const health = state.brickHealth[y]?.[x] ?? 0;
          if (health < 1) {
            ctx.fillStyle = "rgba(212, 85, 45, 0.5)";
            ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          }
          break;
        case 2: // Steel
          ctx.fillStyle = COLORS.STEEL;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "#666";
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX + 2, pixelY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          break;
        case 3: // Forest
          ctx.fillStyle = COLORS.FOREST;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          break;
        case 4: // Water
          ctx.fillStyle = COLORS.WATER;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = "rgba(0, 102, 204, 0.5)";
          ctx.fillRect(pixelX + 2, pixelY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          break;
        case 5: // Ice
          ctx.fillStyle = COLORS.ICE;
          ctx.fillRect(pixelX, pixelY, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = "#ddf";
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX + 2, pixelY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
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

  drawTank(ctx, player.x, player.y, player.direction, COLORS.PLAYER_TANK, Math.min(3, Math.ceil(player.health / 33)));

  ctx.globalAlpha = 1;
};

const drawEnemies = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const enemy of state.enemies) {
    drawTank(ctx, enemy.x, enemy.y, enemy.direction, COLORS.ENEMY_TANK, 1);
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

  // Cannon
  const cannonX = x + size / 2;
  const cannonY = y + size / 2;
  const cannonLength = 10;

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

  // Draw level stars
  ctx.fillStyle = "#ffff00";
  for (let i = 0; i < level - 1; i++) {
    const starX = x + 4 + i * 6;
    const starY = y + 4;
    drawStar(ctx, starX, starY, 3);
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
    ctx.fillStyle = bullet.isPlayer ? COLORS.BULLET : "#ff6666";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
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
    const y = 24 * TILE_SIZE;
    ctx.fillRect(x, y, TILE_SIZE * 2, TILE_SIZE * 2);
  } else {
    // Draw eagle icon
    ctx.fillStyle = COLORS.BASE;
    const x = 12 * TILE_SIZE;
    const y = 24 * TILE_SIZE;
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
