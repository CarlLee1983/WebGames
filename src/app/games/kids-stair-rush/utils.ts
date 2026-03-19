// 遊戲常數
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 800;
export const STAIR_HEIGHT = 85;
export const STAIR_WIDTH = 180;
export const PLAYER_Y = CANVAS_HEIGHT * 0.65;
export const FRAME_MS = 1000 / 60;

// 遊戲型別
export type Side = "left" | "center" | "right";
export type GameMode = "ready" | "playing" | "paused" | "gameOver";

export interface Stair {
  row: number;
  side: Side;
  hasObstacle: boolean;
  obstacleType: "ball" | "bear" | "block";
  highlight: number;
}

export interface Player {
  row: number;
  side: Side;
  x: number;
  targetX: number;
  animT: number;
  jumpT: number;
}

export interface GameState {
  mode: GameMode;
  player: Player;
  stairs: Stair[];
  nextRow: number;
  scrollY: number;
  scrollSpeed: number;
  score: number;
  combo: number;
  highScore: number;
  comboMsg: { text: string; t: number } | null;
}

// 側邊 x 座標對應
export function getSideX(side: Side): number {
  if (side === "left") return 110;
  if (side === "center") return CANVAS_WIDTH / 2;
  return CANVAS_WIDTH - 110;
}

// 難度參數（根據分數）
export function getDifficultyParams(score: number): { speed: number; obstacleProbability: number } {
  let speed = 100;
  let obstacleProbability = 0.12;

  if (score >= 100) {
    speed = 220;
    obstacleProbability = 0.5;
  } else if (score >= 60) {
    speed = 180;
    obstacleProbability = 0.42;
  } else if (score >= 30) {
    speed = 150;
    obstacleProbability = 0.35;
  } else if (score >= 10) {
    speed = 120;
    obstacleProbability = 0.25;
  }

  return { speed, obstacleProbability };
}

// 隨機數生成器（seed 版）
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 樓梯生成邏輯
export function generateStair(row: number, prevSide: Side | null, score: number): Stair {
  const { obstacleProbability } = getDifficultyParams(score);
  const seed = row * 1234 + score * 42;

  let side: Side;
  do {
    const rnd = seededRandom(seed + Math.random() * 1000);
    const sideIndex = Math.floor(rnd * 3);
    side = ["left", "center", "right"][sideIndex] as Side;
  } while (prevSide && prevSide === side && Math.random() > 0.3);

  const hasObstacle = seededRandom(seed + row * 0.5) < obstacleProbability;
  const obstacleTypes: ("ball" | "bear" | "block")[] = ["ball", "bear", "block"];
  const obstacleType = obstacleTypes[Math.floor(seededRandom(seed + row * 0.3) * 3)];

  const stair: Stair = {
    row,
    side,
    hasObstacle,
    obstacleType,
    highlight: 0,
  };

  if (!hasEscapePath([stair])) {
    stair.hasObstacle = false;
  }

  return stair;
}

// 檢查是否有逃脫路徑（前瞻 3 行）
export function hasEscapePath(stairs: Stair[]): boolean {
  if (stairs.length === 0) return true;
  const nextRows = stairs.slice(0, 3);
  return nextRows.some(s => !s.hasObstacle);
}

// 初始化遊戲狀態
export function createInitialState(): GameState {
  const stairs: Stair[] = [];

  // 第一階必須在 center（玩家初始位置）
  const firstStair: Stair = {
    row: 0,
    side: "center",
    hasObstacle: false,
    obstacleType: "ball",
    highlight: 0,
  };
  stairs.push(firstStair);

  let prevSide: Side = "center";

  for (let i = 1; i < 15; i++) {
    const stair = generateStair(i, prevSide, 0);
    stairs.push(stair);
    prevSide = stair.side;
  }

  return {
    mode: "ready",
    player: {
      row: 0,
      side: "center",
      x: getSideX("center"),
      targetX: getSideX("center"),
      animT: 0,
      jumpT: 0,
    },
    stairs,
    nextRow: 15,
    scrollY: 0,
    scrollSpeed: 100,
    score: 0,
    combo: 0,
    highScore: typeof localStorage !== "undefined" ? parseInt(localStorage.getItem("ksrHighScore") || "0", 10) : 0,
    comboMsg: null,
  };
}

export function startGame(state: GameState): GameState {
  return { ...state, mode: "playing" };
}

export function togglePause(state: GameState): GameState {
  if (state.mode === "playing") return { ...state, mode: "paused" };
  if (state.mode === "paused") return { ...state, mode: "playing" };
  return state;
}

export function restartGame(): GameState {
  return createInitialState();
}

export function movePlayer(state: GameState, direction: "left" | "right"): GameState {
  if (state.mode !== "playing") return state;

  const currentSideIndex = ["left", "center", "right"].indexOf(state.player.side);
  let newSideIndex = currentSideIndex;

  if (direction === "left") {
    newSideIndex = Math.max(0, currentSideIndex - 1);
  } else {
    newSideIndex = Math.min(2, currentSideIndex + 1);
  }

  const newSide = ["left", "center", "right"][newSideIndex] as Side;
  const newTargetX = getSideX(newSide);

  return {
    ...state,
    player: {
      ...state.player,
      side: newSide,
      targetX: newTargetX,
      animT: 0,
      jumpT: 1,
    },
  };
}

// 主 tick 函數
export function tick(state: GameState, deltaMs: number): GameState {
  if (state.mode !== "playing") {
    return state;
  }

  const newState = { ...state };

  // 更新捲動
  const { speed } = getDifficultyParams(newState.score);
  newState.scrollSpeed = speed;
  newState.scrollY += (speed * deltaMs) / 1000;

  // 檢查玩家是否踩到新平台
  const stairIndex = Math.floor(newState.scrollY / STAIR_HEIGHT);

  // 只檢查玩家進入新樓梯時的碰撞
  if (stairIndex > newState.player.row && stairIndex < newState.stairs.length) {
    const currentStair = newState.stairs[stairIndex];

    // 檢查是否踩對平台
    if (currentStair.side !== newState.player.side) {
      newState.mode = "gameOver";
      if (newState.score > newState.highScore) {
        newState.highScore = newState.score;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ksrHighScore", String(newState.score));
        }
      }
      return newState;
    }

    // 踩到障礙物
    if (currentStair.hasObstacle) {
      newState.mode = "gameOver";
      if (newState.score > newState.highScore) {
        newState.highScore = newState.score;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ksrHighScore", String(newState.score));
        }
      }
      return newState;
    }

    // 更新分數
    newState.player.row = stairIndex;
    newState.score = stairIndex;
    newState.combo = stairIndex; // combo = score

    if (stairIndex < newState.stairs.length) {
      newState.stairs[stairIndex].highlight = 1;
    }

    if (stairIndex > 5) {
      newState.comboMsg = {
        text: `×${newState.combo}!`,
        t: 0.5,
      };
    }
  }

  // 更新玩家位置（插值）
  newState.player.animT = Math.min(1, newState.player.animT + deltaMs / 150);
  const easeOut = 1 - Math.pow(1 - newState.player.animT, 3);
  newState.player.x = newState.player.x + (newState.player.targetX - newState.player.x) * easeOut;

  // 更新跳動動畫
  if (newState.player.jumpT > 0) {
    newState.player.jumpT = Math.max(0, newState.player.jumpT - deltaMs / 250);
  }

  // 更新 highlight
  newState.stairs = newState.stairs.map(s => ({
    ...s,
    highlight: Math.max(0, s.highlight - deltaMs / 300),
  }));

  // 更新 combo 訊息
  if (newState.comboMsg) {
    newState.comboMsg = {
      ...newState.comboMsg,
      t: Math.max(0, newState.comboMsg.t - deltaMs / 1000),
    };
    if (newState.comboMsg.t <= 0) {
      newState.comboMsg = null;
    }
  }

  // 生成新樓梯
  while (newState.scrollY + CANVAS_HEIGHT > newState.nextRow * STAIR_HEIGHT) {
    const prevStair = newState.stairs[newState.stairs.length - 1];
    const newStair = generateStair(newState.nextRow, prevStair.side, newState.score);
    newState.stairs.push(newStair);
    newState.nextRow += 1;
  }

  // 清理舊樓梯
  newState.stairs = newState.stairs.filter(s => s.row * STAIR_HEIGHT > newState.scrollY - STAIR_HEIGHT);

  return newState;
}

// Canvas 渲染函數
export function drawScene(ctx: CanvasRenderingContext2D, state: GameState): void {
  // 背景漸層
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#87CEEB");
  gradient.addColorStop(0.5, "#e0f6ff");
  gradient.addColorStop(1, "#fff9e6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 雲朵裝飾
  drawClouds(ctx, state.scrollY);

  // 繪製樓梯
  for (const stair of state.stairs) {
    const stairY = stair.row * STAIR_HEIGHT - state.scrollY;
    if (stairY > CANVAS_HEIGHT || stairY + STAIR_HEIGHT < -STAIR_HEIGHT) continue;

    const stairX = getSideX(stair.side) - STAIR_WIDTH / 2;
    drawStair(ctx, stairX, stairY, stair);
  }

  // 繪製玩家
  drawPlayer(ctx, state.player);

  // 繪製 UI
  drawUI(ctx, state);

  // 繪製遊戲狀態疊層
  if (state.mode === "ready") {
    drawReadyOverlay(ctx);
  } else if (state.mode === "paused") {
    drawPausedOverlay(ctx);
  } else if (state.mode === "gameOver") {
    drawGameOverOverlay(ctx, state);
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, scrollY: number) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const offset = (scrollY * 0.3) % 600;

  drawCloud(ctx, 100 - offset, 80, 60);
  drawCloud(ctx, 100 - offset + 600, 80, 60);
  drawCloud(ctx, 450 - offset * 0.5, 150, 50);
  drawCloud(ctx, 450 - offset * 0.5 + 600, 150, 50);
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y - size * 0.5, size * 0.9, 0, Math.PI * 2);
  ctx.arc(x + size * 1.6, y, size * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawStair(ctx: CanvasRenderingContext2D, x: number, y: number, stair: Stair) {
  // 陰影/立面
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(x, y + STAIR_HEIGHT - 10, STAIR_WIDTH, 10);

  // 平台主體
  const platColor = stair.hasObstacle ? "#D4A574" : "#E8D5B7";
  ctx.fillStyle = platColor;
  ctx.beginPath();
  ctx.roundRect(x, y, STAIR_WIDTH, STAIR_HEIGHT - 10, 12);
  ctx.fill();

  // 邊框
  ctx.strokeStyle = "#8B6914";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 高亮效果
  if (stair.highlight > 0) {
    ctx.fillStyle = `rgba(255, 255, 150, ${stair.highlight * 0.5})`;
    ctx.beginPath();
    ctx.roundRect(x, y, STAIR_WIDTH, STAIR_HEIGHT - 10, 12);
    ctx.fill();
  }

  // 障礙物
  if (stair.hasObstacle) {
    const obstacleX = getSideX(stair.side);
    const obstacleY = y + (STAIR_HEIGHT - 10) / 2;
    drawObstacle(ctx, obstacleX, obstacleY, stair.obstacleType);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, x: number, y: number, type: string) {
  if (type === "ball") {
    const gradient = ctx.createRadialGradient(x - 8, y - 8, 0, x, y, 20);
    gradient.addColorStop(0, "#FF6B6B");
    gradient.addColorStop(1, "#C92A2A");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(x - 6, y - 6, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "bear") {
    // 熊身體
    ctx.fillStyle = "#8B6914";
    ctx.beginPath();
    ctx.roundRect(x - 16, y - 8, 32, 28, 6);
    ctx.fill();

    // 熊頭
    ctx.fillStyle = "#A0826D";
    ctx.beginPath();
    ctx.arc(x, y - 20, 15, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = "#8B6914";
    ctx.beginPath();
    ctx.arc(x - 12, y - 32, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 12, y - 32, 8, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x - 6, y - 22, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y - 22, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 積木
    ctx.fillStyle = "#4A90E2";
    ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.fillStyle = "#2E5C8A";
    ctx.fillRect(x - 14, y - 14, 28, 8);

    // 邊框
    ctx.strokeStyle = "#1E3A5F";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 14, y - 14, 28, 28);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
  const bodyY = PLAYER_Y + player.jumpT * -30;

  // 身體（蛋形）
  ctx.fillStyle = "#FFD93D";
  ctx.beginPath();
  ctx.ellipse(player.x, bodyY + 15, 22, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 頭部
  const gradient = ctx.createRadialGradient(player.x - 5, bodyY - 15, 0, player.x, bodyY - 15, 18);
  gradient.addColorStop(0, "#FFE66D");
  gradient.addColorStop(1, "#FFD93D");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(player.x, bodyY - 15, 18, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(player.x - 8, bodyY - 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x + 8, bodyY - 18, 4, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛高光
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(player.x - 6, bodyY - 20, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x + 10, bodyY - 20, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 嘴巴
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, bodyY - 8, 6, 0, Math.PI);
  ctx.stroke();

  // 手臂
  ctx.strokeStyle = "#FFE66D";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x - 22, bodyY + 8);
  ctx.lineTo(player.x - 35, bodyY - 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(player.x + 22, bodyY + 8);
  ctx.lineTo(player.x + 35, bodyY - 5);
  ctx.stroke();

  // 手
  ctx.fillStyle = "#FFD93D";
  ctx.beginPath();
  ctx.arc(player.x - 35, bodyY - 5, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x + 35, bodyY - 5, 8, 0, Math.PI * 2);
  ctx.fill();

  // 腿
  ctx.strokeStyle = "#FFE66D";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(player.x - 10, bodyY + 42);
  ctx.lineTo(player.x - 10, bodyY + 58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(player.x + 10, bodyY + 42);
  ctx.lineTo(player.x + 10, bodyY + 58);
  ctx.stroke();

  // 腳
  ctx.fillStyle = "#FF6B6B";
  ctx.fillRect(player.x - 14, bodyY + 56, 8, 12);
  ctx.fillRect(player.x + 6, bodyY + 56, 8, 12);
}

function drawUI(ctx: CanvasRenderingContext2D, state: GameState) {
  // 分數面板
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(0, 0, 200, 80);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${state.score}`, 20, 35);

  ctx.font = "18px Arial";
  ctx.fillText(`Best: ${state.highScore}`, 20, 60);

  // Combo 訊息
  if (state.comboMsg && state.comboMsg.t > 0) {
    ctx.fillStyle = `rgba(255, 107, 107, ${state.comboMsg.t})`;
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(state.comboMsg.text, CANVAS_WIDTH / 2, 120);
  }

  // 難度指示器
  const speed = getDifficultyParams(state.score).speed;
  const speedLevel = Math.min(5, Math.floor(speed / 50));
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(CANVAS_WIDTH - 150, 10, 130, 20);
  ctx.fillStyle = "#FF6B6B";
  for (let i = 0; i < speedLevel; i++) {
    ctx.fillRect(CANVAS_WIDTH - 140 + i * 20, 12, 16, 16);
  }
}

function drawReadyOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Kids Stair Rush", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

  ctx.font = "24px Arial";
  ctx.fillStyle = "#FFD93D";
  ctx.fillText("Press SPACE to Start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

  ctx.font = "16px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Tap to move left / right", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
}

function drawPausedOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  ctx.font = "20px Arial";
  ctx.fillText("Press SPACE to resume", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
}

function drawGameOverOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#FF6B6B";
  ctx.font = "bold 56px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);

  ctx.fillStyle = "#fff";
  ctx.font = "32px Arial";
  ctx.fillText(`Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  ctx.font = "24px Arial";
  ctx.fillText(`Best: ${state.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);

  ctx.fillStyle = "#FFD93D";
  ctx.font = "22px Arial";
  ctx.fillText("Press SPACE to Restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 140);
}

export function renderGameToText(state: GameState): string {
  return JSON.stringify({
    mode: state.mode,
    score: state.score,
    highScore: state.highScore,
    combo: state.combo,
    playerRow: state.player.row,
    playerSide: state.player.side,
    scrollY: state.scrollY,
    scrollSpeed: state.scrollSpeed,
  }, null, 2);
}
