// 遊戲常數
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const GRAVITY = 1200; // px/s^2
export const MAX_FALL_SPEED = 800;
export const PLAYER_SPEED = 300;
export const PLATFORM_HEIGHT = 16;
export const CEILING_HEIGHT = 24;
export const PLAYER_WIDTH = 28;
export const PLAYER_HEIGHT = 32;
export const MAX_HP = 10;
export const FRAME_MS = 1000 / 60;
export const FEEDBACK_SECONDS = 1.6;

// 型別定義
export type GameMode = "ready" | "playing" | "paused" | "gameOver";
export type PlatformType = "normal" | "spike" | "trampoline" | "conveyor-left" | "conveyor-right" | "fake";

export interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  type: PlatformType;
  touched: boolean;
  state: number; // 用於計時或動畫狀態
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  groundedPlatformId: number | null;
  inputDir: "left" | "right" | "none";
  hurtTimer: number;
  facing: "left" | "right";
}

export interface GameState {
  mode: GameMode;
  player: Player;
  platforms: Platform[];
  distance: number;
  floor: number;
  scrollSpeed: number;
  highScore: number;
  nextPlatformId: number;
  landings: number;
  streak: number;
  bestStreak: number;
  feedback: string;
  feedbackTimer: number;
  lastMilestone: number;
}

export interface PaceProgress {
  level: number;
  label: string;
  startFloor: number;
  nextFloor: number | null;
  floorsRemaining: number;
  percent: number;
  speed: number;
}

export interface LandingForecast {
  platformId: number;
  type: PlatformType;
  direction: "left" | "right" | "hold";
  verticalDistance: number;
  horizontalGap: number;
}

// 根據樓層決定難度
export function getScrollSpeed(floor: number): number {
  if (floor < 10) return 60;
  if (floor < 30) return 80;
  if (floor < 50) return 100;
  if (floor < 100) return 120;
  return 150 + Math.min(100, (floor - 100));
}

export function getPaceProgress(floor: number): PaceProgress {
  const safeFloor = Math.max(0, Math.floor(floor));
  const bands = [
    { start: 0, next: 10, label: "Warm-up" },
    { start: 10, next: 30, label: "Quick steps" },
    { start: 30, next: 50, label: "Fast shaft" },
    { start: 50, next: 100, label: "Danger climb" },
    { start: 100, next: 200, label: "Abyss rush" },
    { start: 200, next: null, label: "Maximum velocity" },
  ] as const;
  let bandIndex = 0;
  for (let index = 1; index < bands.length; index += 1) {
    if (safeFloor >= bands[index].start) bandIndex = index;
  }
  const band = bands[bandIndex];
  const floorsRemaining = band.next === null ? 0 : Math.max(0, band.next - safeFloor);
  const percent = band.next === null
    ? 100
    : Math.min(100, ((safeFloor - band.start) / (band.next - band.start)) * 100);

  return {
    level: bandIndex + 1,
    label: band.label,
    startFloor: band.start,
    nextFloor: band.next,
    floorsRemaining,
    percent,
    speed: getScrollSpeed(safeFloor),
  };
}

export function getLandingForecast(state: GameState): LandingForecast | null {
  const playerBottom = state.player.y + PLAYER_HEIGHT;
  const platform = state.platforms
    .filter((candidate) => (
      candidate.id !== state.player.groundedPlatformId
      && candidate.y >= playerBottom - 2
      && !(candidate.type === "fake" && candidate.state > 0.5)
    ))
    .sort((first, second) => first.y - second.y)[0];

  if (!platform) return null;

  const playerCenter = state.player.x + PLAYER_WIDTH / 2;
  const safeLeft = platform.x + PLAYER_WIDTH * 0.3;
  const safeRight = platform.x + platform.width - PLAYER_WIDTH * 0.3;
  const direction = playerCenter < safeLeft
    ? "right"
    : playerCenter > safeRight
      ? "left"
      : "hold";
  const horizontalGap = direction === "right"
    ? safeLeft - playerCenter
    : direction === "left"
      ? playerCenter - safeRight
      : 0;

  return {
    platformId: platform.id,
    type: platform.type,
    direction,
    verticalDistance: Math.max(0, Math.round(platform.y - playerBottom)),
    horizontalGap: Math.max(0, Math.round(horizontalGap)),
  };
}

export function parseHighScore(value: string | null): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// 產生新的平台
export function generatePlatform(
  id: number,
  y: number,
  floor: number,
  random: () => number = Math.random,
): Platform {
  const width = Math.max(60, 120 - Math.floor(floor / 10) * 5); // 隨樓層增加變窄
  const x = random() * (CANVAS_WIDTH - width);

  let type: PlatformType = "normal";
  const r = random();

  if (floor > 5) {
    if (r < 0.15) type = "spike";
    else if (r < 0.25) type = "trampoline";
    else if (r < 0.35) type = "conveyor-left";
    else if (r < 0.45) type = "conveyor-right";
    else if (floor > 10 && r < 0.55) type = "fake";
  }

  return { id, x, y, width, type, touched: false, state: 0 };
}

export function createInitialState(
  random: () => number = Math.random,
  storedHighScore?: number,
): GameState {
  const platforms: Platform[] = [];
  let nextPlatformId = 1;

  // 初始安全平台在底下
  platforms.push({
    id: 0,
    x: CANVAS_WIDTH / 2 - 60,
    y: CANVAS_HEIGHT * 0.8,
    width: 120,
    type: "normal",
    touched: true,
    state: 0
  });

  // 預先產生畫面上的其他平台
  for (let i = 1; i <= 6; i++) {
    platforms.push(generatePlatform(
      nextPlatformId++,
      CANVAS_HEIGHT * 0.8 - i * 100,
      0,
      random,
    ));
  }

  return {
    mode: "ready",
    player: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT * 0.8 - PLAYER_HEIGHT, // 站在初始平台上
      vx: 0,
      vy: 0,
      hp: MAX_HP,
      groundedPlatformId: 0,
      inputDir: "none",
      hurtTimer: 0,
      facing: "right",
    },
    platforms,
    distance: 0,
    floor: 0,
    scrollSpeed: 60,
    highScore: storedHighScore ?? (
      typeof localStorage !== "undefined"
        ? parseHighScore(localStorage.getItem("nsShaftHighScore"))
        : 0
    ),
    nextPlatformId,
    landings: 0,
    streak: 0,
    bestStreak: 0,
    feedback: "Find the next safe step",
    feedbackTimer: 0,
    lastMilestone: 0,
  };
}

export function startGame(state: GameState): GameState {
  return { ...state, mode: "playing" };
}

export function restartGame(): GameState {
  return createInitialState();
}

export function togglePause(state: GameState): GameState {
  if (state.mode === "playing") return { ...state, mode: "paused" };
  if (state.mode === "paused") return { ...state, mode: "playing" };
  return state;
}

export function setPlayerInput(state: GameState, dir: "left" | "right" | "none"): GameState {
  if (state.mode !== "playing") return state;
  let facing = state.player.facing;
  if (dir === "left") facing = "left";
  if (dir === "right") facing = "right";

  return {
    ...state,
    player: {
      ...state.player,
      inputDir: dir,
      facing,
    }
  };
}

// AABB 碰撞檢查 (檢查玩家底部是否剛好落入平台頂部)
function checkLanding(oldY: number, newY: number, playerX: number, plat: Platform): boolean {
  const playerBottomOld = oldY + PLAYER_HEIGHT;
  const playerBottomNew = newY + PLAYER_HEIGHT;
  const platTop = plat.y;
  
  // X 軸覆蓋 (玩家需有一半身體在平台上才算踩到)
  const isXAligned = (playerX + PLAYER_WIDTH * 0.7 > plat.x) && (playerX - PLAYER_WIDTH * 0.7 + PLAYER_WIDTH < plat.x + plat.width);
  // Y 軸從上方穿過
  const isYCrossing = playerBottomOld <= platTop + 2 && playerBottomNew >= platTop;

  return isXAligned && isYCrossing;
}

export function tick(state: GameState, deltaMs: number): GameState {
  if (state.mode !== "playing") return state;

  const dt = deltaMs / 1000;
  const s = { ...state, player: { ...state.player } };

  const previousFloor = s.floor;
  const previousPace = getPaceProgress(previousFloor);
  s.scrollSpeed = previousPace.speed;
  const scrollOffset = s.scrollSpeed * dt;
  s.distance += scrollOffset;
  s.floor = Math.floor(s.distance / 120);
  const currentPace = getPaceProgress(s.floor);
  s.scrollSpeed = currentPace.speed;

  if (currentPace.level > previousPace.level && s.floor > previousFloor) {
    s.lastMilestone = currentPace.startFloor;
    s.feedback = `${currentPace.label} — ${currentPace.speed} px/s!`;
    s.feedbackTimer = FEEDBACK_SECONDS;
  }

  // 移動所有平台往上
  const activePlatforms: Platform[] = [];
  for (const p of s.platforms) {
    const updated = { ...p, y: p.y - scrollOffset };
    if (updated.type === "fake" && updated.state > 0) {
      updated.state += dt;
    }
    // 移除超過畫面上方的平台，但保留還沒完全離開的
    if (updated.y + PLATFORM_HEIGHT > CEILING_HEIGHT) {
      activePlatforms.push(updated);
    }
  }
  s.platforms = activePlatforms;

  // 補充下方平台
  const lowestPlat = s.platforms[s.platforms.length - 1];
  if (lowestPlat && lowestPlat.y < CANVAS_HEIGHT - 100) {
    s.platforms.push(generatePlatform(s.nextPlatformId++, CANVAS_HEIGHT + 20, s.floor));
  }

  // 受傷計時
  if (s.player.hurtTimer > 0) {
    s.player.hurtTimer = Math.max(0, s.player.hurtTimer - dt);
  }
  if (s.feedbackTimer > 0) {
    s.feedbackTimer = Math.max(0, s.feedbackTimer - dt);
  }

  // X軸移動
  let targetVx = 0;
  if (s.player.inputDir === "left") targetVx = -PLAYER_SPEED;
  if (s.player.inputDir === "right") targetVx = PLAYER_SPEED;
  
  s.player.vx = targetVx;

  // 如果在輸送帶上，加上輸送帶速度
  if (s.player.groundedPlatformId !== null) {
    const ground = s.platforms.find(p => p.id === s.player.groundedPlatformId);
    if (ground) {
      if (ground.type === "conveyor-left") s.player.vx -= 100;
      if (ground.type === "conveyor-right") s.player.vx += 100;
      
      // fake platform collapse mechanism
      if (ground.type === "fake") {
        if (ground.state === 0) ground.state = 0.01; // start timer
        if (ground.state > 0.5) {
          // Collapse!
          s.player.groundedPlatformId = null;
        }
      }
    } else {
      s.player.groundedPlatformId = null;
    }
  }

  s.player.x += s.player.vx * dt;
  // 邊界限制
  if (s.player.x < 0) s.player.x = 0;
  if (s.player.x + PLAYER_WIDTH > CANVAS_WIDTH) s.player.x = CANVAS_WIDTH - PLAYER_WIDTH;

  // Y軸移動
  let newY = s.player.y;
  const oldY = s.player.y;

  if (s.player.groundedPlatformId !== null) {
    // 跟隨著平台往上移動
    const ground = s.platforms.find(p => p.id === s.player.groundedPlatformId);
    if (ground) {
      s.player.y = ground.y - PLAYER_HEIGHT;
      s.player.vy = 0;

      // 如果從平台邊緣掉下去
      const isXAligned = (s.player.x + PLAYER_WIDTH * 0.7 > ground.x) && (s.player.x - PLAYER_WIDTH * 0.7 + PLAYER_WIDTH < ground.x + ground.width);
      if (!isXAligned) {
        s.player.groundedPlatformId = null; 
      }
    }
  } else {
    // 自由落體
    s.player.vy += GRAVITY * dt;
    if (s.player.vy > MAX_FALL_SPEED) s.player.vy = MAX_FALL_SPEED;
    newY += s.player.vy * dt;

    // 檢查碰撞
    if (s.player.vy > 0) {
      for (const p of s.platforms) {
        if (checkLanding(oldY, newY, s.player.x, p) && (p.type !== "fake" || p.state < 0.5)) {
          s.player.groundedPlatformId = p.id;
          s.player.y = p.y - PLAYER_HEIGHT;
          s.player.vy = 0;

          // 降落效果
          if (!p.touched) {
            p.touched = true;
            if (p.type !== "spike") {
              s.landings += 1;
              s.streak += 1;
              s.bestStreak = Math.max(s.bestStreak, s.streak);
            }

            if (p.type === "normal") {
              s.player.hp = Math.min(MAX_HP, s.player.hp + 1);
              s.feedback = s.player.hp === MAX_HP ? "Safe landing" : "Safe landing +1 HP";
              s.feedbackTimer = FEEDBACK_SECONDS;
            } else if (p.type.startsWith("conveyor")) {
              s.player.hp = Math.min(MAX_HP, s.player.hp + 1);
              s.feedback = "Conveyor — hold your course";
              s.feedbackTimer = FEEDBACK_SECONDS;
            } else if (p.type === "spike") {
              s.player.hp -= 5;
              s.player.hurtTimer = 0.5;
              s.streak = 0;
              s.feedback = "Spikes! -5 HP";
              s.feedbackTimer = FEEDBACK_SECONDS;
            } else if (p.type === "trampoline") {
              s.player.vy = -600; // bounce
              s.player.groundedPlatformId = null;
              s.feedback = "Super bounce!";
              s.feedbackTimer = FEEDBACK_SECONDS;
            } else if (p.type === "fake") {
              p.state = 0.01;
              s.feedback = "Cracking step — move!";
              s.feedbackTimer = FEEDBACK_SECONDS;
            }
          } else {
             if (p.type === "spike" && s.player.hurtTimer <= 0) {
                 s.player.hp -= 5;
                 s.player.hurtTimer = 0.5;
                 s.streak = 0;
                 s.feedback = "Spikes! -5 HP";
                 s.feedbackTimer = FEEDBACK_SECONDS;
             }
             else if (p.type === "trampoline") {
                  s.player.vy = -600; // bounce
                  s.player.groundedPlatformId = null;
                  s.feedback = "Super bounce!";
                  s.feedbackTimer = FEEDBACK_SECONDS;
             }
          }
          break;
        }
      }
    }
    if (s.player.groundedPlatformId === null) {
        s.player.y = newY;
    }
  }

  // 檢查天花板(釘板)碰撞
  if (s.player.y < CEILING_HEIGHT) {
    s.player.y = CEILING_HEIGHT;
    s.player.vy = 0;
    // 撞到天花板，強制掉下去而且受傷
    if (s.player.hurtTimer <= 0) {
      s.player.hp -= 3;
      s.player.hurtTimer = 1.0;
      s.streak = 0;
      s.feedback = "Ceiling spikes! -3 HP";
      s.feedbackTimer = FEEDBACK_SECONDS;
    }
    // 掉下平台
    s.player.groundedPlatformId = null;
    s.player.vy = GRAVITY * 0.2; // slight downward push
  }

  // 檢查死亡條件
  if (s.player.hp <= 0 || s.player.y > CANVAS_HEIGHT) {
    s.player.hp = Math.max(0, s.player.hp);
    s.mode = "gameOver";
    s.feedback = s.player.hp <= 0 ? "Out of energy" : "Missed the next step";
    s.feedbackTimer = FEEDBACK_SECONDS;
    if (s.floor > s.highScore) {
      s.highScore = s.floor;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("nsShaftHighScore", String(s.highScore));
      }
    }
  }

  return s;
}

// ---------------- 繪圖函式 ---------------- //

export function drawScene(ctx: CanvasRenderingContext2D, state: GameState): void {
  // 深井背景
  const background = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  background.addColorStop(0, "#070b16");
  background.addColorStop(0.55, "#111827");
  background.addColorStop(1, "#071522");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const sideGlow = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  sideGlow.addColorStop(0, "rgba(14,165,233,0.18)");
  sideGlow.addColorStop(0.18, "rgba(14,165,233,0)");
  sideGlow.addColorStop(0.82, "rgba(168,85,247,0)");
  sideGlow.addColorStop(1, "rgba(168,85,247,0.16)");
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 網格線 (復古感)
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < CANVAS_WIDTH; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
    const yOffsets = (i - state.distance % 40);
    ctx.beginPath(); ctx.moveTo(0, yOffsets); ctx.lineTo(CANVAS_WIDTH, yOffsets); ctx.stroke();
  }

  // 繪製平台
  for (const plat of state.platforms) {
    drawPlatform(ctx, plat, state.distance);
  }

  // 繪製天花板釘子
  drawCeilingSpikes(ctx);

  // 繪製玩家
  drawPlayer(ctx, state.player);

  // 繪製 HUD
  drawHUD(ctx, state);

  if (state.player.hurtTimer > 0) {
    const pulse = Math.min(0.22, state.player.hurtTimer * 0.2);
    ctx.fillStyle = `rgba(239,68,68,${pulse})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 疊層
  if (state.mode === "ready") drawReadyOverlay(ctx);
  if (state.mode === "paused") drawPausedOverlay(ctx);
  if (state.mode === "gameOver") drawGameOverOverlay(ctx, state);
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, distance: number) {
  if (p.type === "fake" && p.state > 0.5) return; // collapsed

  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.type === "fake") {
    // Blink if about to break
    if (p.state > 0.3 && p.state * 20 % 2 < 1) {
      ctx.globalAlpha = 0.3;
    }
  }

  // 底座厚度
  ctx.fillStyle = "#2c2c36";
  ctx.fillRect(0, 0, p.width, PLATFORM_HEIGHT);

  switch (p.type) {
    case "normal":
      ctx.fillStyle = "#4ade80"; // 綠色正常
      ctx.fillRect(0, 0, p.width, 6);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(0, 6, p.width, 4);
      ctx.fillStyle = "rgba(220,252,231,0.55)";
      for (let i = 8; i < p.width - 4; i += 20) ctx.fillRect(i, 2, 8, 2);
      break;
    
    case "spike":
      // 銀色釘子
      ctx.fillStyle = "#cbd5e1";
      for (let i = 0; i < p.width; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 8);
        ctx.lineTo(i + 5, -6);
        ctx.lineTo(i + 10, 8);
        ctx.fill();
      }
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(0, 6, p.width, 4);
      break;

    case "trampoline":
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(0, 0, p.width, 4); // Jump pad
      ctx.fillStyle = "#d97706";
      ctx.fillRect(10, 4, p.width - 20, 6);
      ctx.strokeStyle = "#fef3c7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, 4);
      for (let i = 12; i < p.width - 12; i += 8) {
        ctx.lineTo(i, i % 16 === 4 ? 4 : 9);
      }
      ctx.stroke();
      break;

    case "conveyor-left":
    case "conveyor-right":
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(0, 0, p.width, 8);
      // 動態紋理
      ctx.fillStyle = "#2563eb";
      const offset = (distance * 0.7) % 20;
      for (let i = -20; i < p.width; i += 20) {
        const dx = p.type === "conveyor-left" ? -offset : offset;
        const xPos = i + dx;
        if (xPos > -10 && xPos < p.width) {
          ctx.beginPath();
          if (p.type === "conveyor-left") {
            ctx.moveTo(xPos + 10, 2); ctx.lineTo(xPos, 4); ctx.lineTo(xPos + 10, 6);
          } else {
            ctx.moveTo(xPos, 2); ctx.lineTo(xPos + 10, 4); ctx.lineTo(xPos, 6);
          }
          ctx.fill();
        }
      }
      break;

    case "fake":
      ctx.fillStyle = "#fb7185";
      ctx.fillRect(0, 0, p.width, 6);
      ctx.fillStyle = "#e11d48";
      ctx.fillRect(0, 6, p.width, 4);
      ctx.strokeStyle = "#ffe4e6";
      ctx.lineWidth = 1.5;
      for (let i = 18; i < p.width; i += 28) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 3, 4);
        ctx.lineTo(i + 2, 8);
        ctx.stroke();
      }
      break;
  }

  // 邊緣高光
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(0, 0, p.width, 2);

  ctx.restore();
}

function drawCeilingSpikes(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#475569";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CEILING_HEIGHT - 6);
  
  ctx.fillStyle = "#94a3b8"; // Spike color
  for (let i = 0; i < CANVAS_WIDTH; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, CEILING_HEIGHT - 6);
    ctx.lineTo(i + 8, CEILING_HEIGHT + 6);
    ctx.lineTo(i + 16, CEILING_HEIGHT - 6);
    ctx.fill();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
  // 受傷閃爍
  if (p.hurtTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(p.x + PLAYER_WIDTH / 2, p.y + PLAYER_HEIGHT / 2);

  if (p.facing === "left") {
    ctx.scale(-1, 1);
  }

  const isFalling = p.groundedPlatformId === null;
  const isWalking = !isFalling && p.vx !== 0;
  
  // Animation cycle (0 or 1)
  const animFrame = isWalking ? Math.floor(Date.now() / 120) % 2 : 0;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 手臂與腿的參數
  const leftArmRot = isFalling ? -Math.PI * 0.8 : (isWalking ? (animFrame === 0 ? 0.3 : -0.3) : 0);
  const rightArmRot = isFalling ? -Math.PI * 0.8 : (isWalking ? (animFrame === 0 ? -0.3 : 0.3) : 0);
  const leftLegRot = isFalling ? -0.2 : (isWalking ? (animFrame === 0 ? -0.4 : 0.4) : 0);
  const rightLegRot = isFalling ? 0.4 : (isWalking ? (animFrame === 0 ? 0.4 : -0.4) : 0);

  // 繪製背景側的手腳 (Left = 後方)
  ctx.lineWidth = 4;
  
  // 左腿 (後)
  ctx.strokeStyle = "#1e3a8a"; // dark blue pants
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(Math.sin(leftLegRot) * 8, 8 + Math.cos(leftLegRot) * 8);
  ctx.stroke();
  // 左腳底
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.arc(Math.sin(leftLegRot) * 8 + 2, 8 + Math.cos(leftLegRot) * 8, 2, 0, Math.PI*2);
  ctx.fill();

  // 左手 (後)
  ctx.strokeStyle = "#60a5fa"; // lighter blue sleeve
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(Math.sin(leftArmRot) * 8, -2 + Math.cos(leftArmRot) * 8);
  ctx.stroke();

  // 身體 (Shirt)
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.roundRect(-6, -4, 12, 14, 4);
  ctx.fill();
  
  // 繪製前景側的手腳 (Right = 前方)
  // 右腿 (前)
  ctx.strokeStyle = "#1e40af"; 
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(Math.sin(rightLegRot) * 8, 8 + Math.cos(rightLegRot) * 8);
  ctx.stroke();
  // 右腳底
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.arc(Math.sin(rightLegRot) * 8 + 2, 8 + Math.cos(rightLegRot) * 8, 2, 0, Math.PI*2);
  ctx.fill();

  // 右手 (前)
  ctx.strokeStyle = "#2563eb"; 
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(Math.sin(rightArmRot) * 8, -2 + Math.cos(rightArmRot) * 8);
  ctx.stroke();
  // 膚色手掌
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(Math.sin(rightArmRot) * 8, -2 + Math.cos(rightArmRot) * 8, 2.5, 0, Math.PI*2);
  ctx.fill();

  // 頭部
  ctx.fillStyle = "#fcd34d"; // skin
  ctx.beginPath();
  ctx.arc(0, -10, 7, 0, Math.PI * 2);
  ctx.fill();
  
  // 頭髮
  ctx.fillStyle = "#451a03"; // dark brown
  ctx.beginPath();
  ctx.arc(0, -11, 7.5, Math.PI, Math.PI * 2); // top half
  // 亂髮
  ctx.lineTo(6, -8);
  ctx.lineTo(4, -10);
  ctx.lineTo(0, -8);
  ctx.lineTo(-4, -10);
  ctx.lineTo(-6, -8);
  ctx.closePath();
  ctx.fill();

  // 臉部表情:
  // 眼睛: 看向正前方 (right) 所以在 X 大於 0
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  if (p.hurtTimer > 0) {
    // 痛痛眼 (X)
    ctx.beginPath(); ctx.moveTo(2, -13); ctx.lineTo(4, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -13); ctx.lineTo(2, -9); ctx.stroke();
    
    ctx.beginPath(); ctx.moveTo(6, -13); ctx.lineTo(8, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(6, -9); ctx.stroke();
  } else if (isFalling) {
    // 驚恐掉落眼 (大)
    ctx.beginPath(); ctx.arc(3, -11, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -11, 1.5, 0, Math.PI * 2); ctx.fill();
  } else {
    // 正常眼睛
    ctx.beginPath(); ctx.arc(4, -11, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -11, 1, 0, Math.PI * 2); ctx.fill();
  }

  // 嘴巴
  ctx.beginPath();
  if (p.hurtTimer > 0) {
    // 痛嘴
    ctx.moveTo(3, -7); ctx.lineTo(7, -6); ctx.lineTo(3, -5); ctx.stroke();
  } else if (isFalling) {
    // 驚恐嘴 'O'
    ctx.arc(5, -6, 1.5, 0, Math.PI * 2); ctx.fill();
  } else {
    // 微笑
    ctx.arc(5, -7, 2, 0.2, Math.PI * 0.8);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = "rgba(2,6,23,0.82)";
  ctx.fillRect(10, 34, 176, 42);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`HP ${Math.max(0, s.player.hp)}/${MAX_HP}`, 17, 50);

  const barWidth = 12;
  for (let i = 0; i < Math.floor(s.player.hp); i++) {
    ctx.fillStyle = s.player.hp <= 3 ? "#fb7185" : "#34d399";
    ctx.fillRect(17 + i * 15, 57, barWidth, 10);
  }

  ctx.fillStyle = "rgba(2,6,23,0.82)";
  ctx.fillRect(CANVAS_WIDTH - 144, 34, 134, 62);
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`B ${s.floor.toString().padStart(4, "0")}`, CANVAS_WIDTH - 18, 58);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 11px monospace";
  ctx.fillText(`BEST B${s.highScore}  ·  STREAK ${s.streak}`, CANVAS_WIDTH - 18, 78);
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(`${Math.round(s.scrollSpeed)} PX/S`, CANVAS_WIDTH - 18, 91);

  if (s.feedbackTimer > 0) {
    ctx.font = "bold 14px monospace";
    const textWidth = Math.min(CANVAS_WIDTH - 40, ctx.measureText(s.feedback).width + 34);
    const left = (CANVAS_WIDTH - textWidth) / 2;
    ctx.fillStyle = "rgba(2,6,23,0.88)";
    ctx.fillRect(left, CANVAS_HEIGHT - 50, textWidth, 32);
    ctx.strokeStyle = "rgba(56,189,248,0.6)";
    ctx.strokeRect(left, CANVAS_HEIGHT - 50, textWidth, 32);
    ctx.fillStyle = "#e0f2fe";
    ctx.textAlign = "center";
    ctx.fillText(s.feedback, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 29);
  }
}

function drawReadyOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 36px monospace";
  ctx.fillText("NS-SHAFT", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
  ctx.font = "18px monospace";
  ctx.fillText("Press SPACE or tap START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
  ctx.font = "15px monospace";
  ctx.fillText("Hold left/right to move", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 13px monospace";
  ctx.fillText("GREEN safe · BLUE conveyor · PINK breaks", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 92);
}

function drawPausedOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 36px monospace";
  ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.font = "16px monospace";
  ctx.fillText("Press SPACE / P or tap RESUME", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 32);
}

function drawGameOverOverlay(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "center";
  ctx.font = "bold 42px monospace";
  ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
  
  ctx.fillStyle = "#fff";
  ctx.font = "24px monospace";
  ctx.fillText(`Floor: B ${s.floor}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
  ctx.font = "18px monospace";
  ctx.fillText(`High Score: ${s.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);

  ctx.fillStyle = "#facc15";
  ctx.font = "18px monospace";
  ctx.fillText("Press SPACE or tap START", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120);
}

// 用於 playwright 驗證的狀態輸出
export function renderGameToText(state: GameState): string {
  const pace = getPaceProgress(state.floor);
  return JSON.stringify({
    mode: state.mode,
    floor: state.floor,
    hp: state.player.hp,
    playerX: Math.round(state.player.x),
    playerY: Math.round(state.player.y),
    groundedPlatformId: state.player.groundedPlatformId,
    numActivePlatforms: state.platforms.length,
    landings: state.landings,
    streak: state.streak,
    bestStreak: state.bestStreak,
    feedback: state.feedback,
    feedbackActive: state.feedbackTimer > 0,
    scrollSpeed: state.scrollSpeed,
    pace: {
      level: pace.level,
      label: pace.label,
      nextFloor: pace.nextFloor,
      floorsRemaining: pace.floorsRemaining,
      progressPercent: Math.round(pace.percent),
    },
    nextLanding: getLandingForecast(state),
  });
}
