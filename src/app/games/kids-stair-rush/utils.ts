// 遊戲常數
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;
export const STAIR_HEIGHT = 65;
export const STAIR_WIDTH = 140;
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
  if (side === "left") return 80;
  if (side === "center") return CANVAS_WIDTH / 2;
  return CANVAS_WIDTH - 80;
}

// 側邊 x 座標 → side
export function getClosestSide(x: number): Side {
  const sides: Side[] = ["left", "center", "right"];
  const distances = sides.map(s => Math.abs(getSideX(s) - x));
  const minIndex = distances.indexOf(Math.min(...distances));
  return sides[minIndex];
}

// 難度參數（根據分數）
export function getDifficultyParams(score: number): { speed: number; obstacleProbability: number } {
  let speed = 80;
  let obstacleProbability = 0.15;

  if (score >= 100) {
    speed = 190;
    obstacleProbability = 0.45;
  } else if (score >= 60) {
    speed = 160;
    obstacleProbability = 0.4;
  } else if (score >= 30) {
    speed = 130;
    obstacleProbability = 0.32;
  } else if (score >= 10) {
    speed = 100;
    obstacleProbability = 0.22;
  }

  return { speed, obstacleProbability };
}

// 隨機數生成器（seed 版，可重現）
function seededRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// 樓梯生成邏輯
export function generateStair(row: number, prevSide: Side | null, score: number): Stair {
  const { obstacleProbability } = getDifficultyParams(score);
  const seed = row * 1234 + score * 42;

  // 連續同側上限
  const consecutiveLimit = Math.max(3 - Math.floor(score / 20), 1);

  // 生成側邊
  let side: Side;
  do {
    const rnd = seededRandom(seed + Math.random() * 1000);
    const sideIndex = Math.floor(rnd * 3);
    side = ["left", "center", "right"][sideIndex] as Side;
  } while (prevSide && prevSide === side && consecutiveLimit <= 1);

  // 生成障礙物
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

  // 檢查逃脫路徑
  if (!hasEscapePath([stair])) {
    stair.hasObstacle = false;
  }

  return stair;
}

// 檢查是否有逃脫路徑（前瞻 3 行）
export function hasEscapePath(stairs: Stair[]): boolean {
  // 簡化版：只要不是每行都被障礙物擋住就行
  if (stairs.length === 0) return true;

  const nextRows = stairs.slice(0, 3);
  for (const row of nextRows) {
    if (!row.hasObstacle) return true;
  }

  // 如果有空白平台（沒障礙物），可逃脫
  return nextRows.some(s => !s.hasObstacle);
}

// 初始化遊戲狀態
export function createInitialState(): GameState {
  const stairs: Stair[] = [];
  let prevSide: Side | null = null;

  // 預生成 15 行樓梯
  for (let i = 0; i < 15; i++) {
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
    scrollSpeed: 80,
    score: 0,
    combo: 0,
    highScore: typeof localStorage !== "undefined" ? parseInt(localStorage.getItem("ksrHighScore") || "0", 10) : 0,
    comboMsg: null,
  };
}

// 開始遊戲
export function startGame(state: GameState): GameState {
  return {
    ...state,
    mode: "playing",
  };
}

// 暫停遊戲
export function togglePause(state: GameState): GameState {
  if (state.mode === "playing") {
    return { ...state, mode: "paused" };
  }
  if (state.mode === "paused") {
    return { ...state, mode: "playing" };
  }
  return state;
}

// 重新開始遊戲
export function restartGame(): GameState {
  return createInitialState();
}

// 移動玩家（左右）
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

  // 檢查玩家是否落空或踩到新台階
  const stairIndex = Math.floor(newState.scrollY / STAIR_HEIGHT);

  if (stairIndex < newState.stairs.length) {
    const currentStair = newState.stairs[stairIndex];

    // 檢查玩家是否踩對平台
    if (currentStair.side !== newState.player.side) {
      // Game Over：踩空或踩到障礙物的平台
      newState.mode = "gameOver";
      if (newState.score > newState.highScore) {
        newState.highScore = newState.score;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ksrHighScore", String(newState.score));
        }
      }
      return newState;
    }

    // 踩到正確平台
    if (currentStair.hasObstacle) {
      // Game Over：踩到障礙物
      newState.mode = "gameOver";
      if (newState.score > newState.highScore) {
        newState.highScore = newState.score;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ksrHighScore", String(newState.score));
        }
      }
      return newState;
    }

    // 更新分數（新台階）
    const newPlayerRow = stairIndex;
    if (newPlayerRow > newState.player.row) {
      newState.player.row = newPlayerRow;
      newState.score = newPlayerRow;
      newState.combo += 1;

      // Highlight 閃光效果
      if (stairIndex < newState.stairs.length) {
        newState.stairs[stairIndex].highlight = 1;
      }

      // combo 訊息
      if (newState.combo > 1) {
        newState.comboMsg = {
          text: `+${newState.combo}!`,
          t: 0.5,
        };
      }
    }
  }

  // 更新玩家位置（插值）
  newState.player.animT = Math.min(1, newState.player.animT + deltaMs / 200);
  newState.player.x =
    newState.player.x +
    (newState.player.targetX - newState.player.x) * (1 - Math.pow(1 - newState.player.animT, 2));

  // 更新跳動動畫
  if (newState.player.jumpT > 0) {
    newState.player.jumpT = Math.max(0, newState.player.jumpT - deltaMs / 300);
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

  // 生成新樓梯（當需要時）
  while (newState.scrollY + CANVAS_HEIGHT > newState.nextRow * STAIR_HEIGHT) {
    const prevStair = newState.stairs[newState.stairs.length - 1];
    const newStair = generateStair(newState.nextRow, prevStair.side, newState.score);
    newState.stairs.push(newStair);
    newState.nextRow += 1;
  }

  // 清理舊樓梯（超出視範圍）
  newState.stairs = newState.stairs.filter(s => s.row * STAIR_HEIGHT > newState.scrollY - STAIR_HEIGHT);

  return newState;
}

// Canvas 渲染函數
export function drawScene(ctx: CanvasRenderingContext2D, state: GameState): void {
  // 清空畫布
  ctx.fillStyle = "#e0f2fe";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 漸層背景（根據速度調整）
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  const alpha = Math.min(0.3, state.scrollSpeed / 300);
  gradient.addColorStop(0, `rgba(100, 200, 255, ${alpha})`);
  gradient.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 繪製樓梯
  for (const stair of state.stairs) {
    const stairY = stair.row * STAIR_HEIGHT - state.scrollY;

    if (stairY > CANVAS_HEIGHT || stairY + STAIR_HEIGHT < -STAIR_HEIGHT) continue;

    const stairX = getSideX(stair.side) - STAIR_WIDTH / 2;

    // 3D 立面
    ctx.fillStyle = "#8b7355";
    ctx.fillRect(stairX, stairY + STAIR_HEIGHT - 8, STAIR_WIDTH, 8);

    // 平台
    ctx.fillStyle = stair.hasObstacle ? "#d4a574" : "#c9a961";
    ctx.beginPath();
    ctx.roundRect(stairX, stairY, STAIR_WIDTH, STAIR_HEIGHT - 8, 8);
    ctx.fill();

    // 邊框
    ctx.strokeStyle = "#8b7355";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Highlight 閃光
    if (stair.highlight > 0) {
      ctx.fillStyle = `rgba(255, 255, 200, ${stair.highlight * 0.4})`;
      ctx.beginPath();
      ctx.roundRect(stairX, stairY, STAIR_WIDTH, STAIR_HEIGHT - 8, 8);
      ctx.fill();
    }

    // 繪製障礙物
    if (stair.hasObstacle) {
      const obstacleX = getSideX(stair.side);
      const obstacleY = stairY + STAIR_HEIGHT / 2;

      if (stair.obstacleType === "ball") {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(obstacleX, obstacleY, 16, 0, Math.PI * 2);
        ctx.fill();
      } else if (stair.obstacleType === "bear") {
        // 簡化熊的輪廓
        ctx.fillStyle = "#a16207";
        // 身體
        ctx.fillRect(obstacleX - 12, obstacleY - 8, 24, 18);
        // 頭
        ctx.beginPath();
        ctx.arc(obstacleX, obstacleY - 10, 10, 0, Math.PI * 2);
        ctx.fill();
        // 耳朵
        ctx.beginPath();
        ctx.arc(obstacleX - 8, obstacleY - 20, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(obstacleX + 8, obstacleY - 20, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 積木
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(obstacleX - 10, obstacleY - 12, 20, 12);
        ctx.fillStyle = "#1e40af";
        ctx.fillRect(obstacleX - 10, obstacleY - 12, 20, 4);
      }
    }
  }

  // 繪製玩家（卡通小孩）
  const playerX = state.player.x;
  const playerBodyY = PLAYER_Y + state.player.jumpT * -15;

  // 身體（橢圓）
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.ellipse(playerX, playerBodyY + 10, 18, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // 頭（圓形）
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(playerX, playerBodyY - 8, 12, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(playerX - 4, playerBodyY - 10, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(playerX + 4, playerBodyY - 10, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 嘴巴
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(playerX, playerBodyY - 4, 4, 0, Math.PI);
  ctx.stroke();

  // 手
  ctx.strokeStyle = "#fcd34d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(playerX - 16, playerBodyY + 5);
  ctx.lineTo(playerX - 24, playerBodyY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(playerX + 16, playerBodyY + 5);
  ctx.lineTo(playerX + 24, playerBodyY);
  ctx.stroke();

  // 腳
  ctx.beginPath();
  ctx.moveTo(playerX - 8, playerBodyY + 28);
  ctx.lineTo(playerX - 8, playerBodyY + 36);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(playerX + 8, playerBodyY + 28);
  ctx.lineTo(playerX + 8, playerBodyY + 36);
  ctx.stroke();

  // UI 層

  // 分數
  ctx.fillStyle = "#000";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${state.score}`, 16, 32);

  // 最高分
  ctx.font = "18px sans-serif";
  ctx.fillText(`Best: ${state.highScore}`, 16, 56);

  // Combo 訊息
  if (state.comboMsg && state.comboMsg.t > 0) {
    ctx.fillStyle = `rgba(239, 68, 68, ${state.comboMsg.t})`;
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.comboMsg.text, CANVAS_WIDTH / 2, 100);
  }

  // 模式相關 UI
  if (state.mode === "ready") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Kids Stair Rush", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

    ctx.font = "18px sans-serif";
    ctx.fillText("Press SPACE to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
  } else if (state.mode === "paused") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  } else if (state.mode === "gameOver") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    ctx.font = "24px sans-serif";
    ctx.fillText(`Score: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillText(`Best: ${state.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);

    ctx.font = "18px sans-serif";
    ctx.fillText("Press SPACE to restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
  }
}

// 匯出遊戲狀態為 JSON
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
