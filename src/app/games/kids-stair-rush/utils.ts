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
}

// 根據樓層決定難度
function getScrollSpeed(floor: number): number {
  if (floor < 10) return 60;
  if (floor < 30) return 80;
  if (floor < 50) return 100;
  if (floor < 100) return 120;
  return 150 + Math.min(100, (floor - 100));
}

// 產生新的平台
function generatePlatform(id: number, y: number, floor: number): Platform {
  const width = Math.max(60, 120 - Math.floor(floor / 10) * 5); // 隨樓層增加變窄
  const x = Math.random() * (CANVAS_WIDTH - width);

  let type: PlatformType = "normal";
  const r = Math.random();

  if (floor > 5) {
    if (r < 0.15) type = "spike";
    else if (r < 0.25) type = "trampoline";
    else if (r < 0.35) type = "conveyor-left";
    else if (r < 0.45) type = "conveyor-right";
    else if (floor > 10 && r < 0.55) type = "fake";
  }

  return { id, x, y, width, type, touched: false, state: 0 };
}

export function createInitialState(): GameState {
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
      0
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
    highScore: typeof localStorage !== "undefined" ? parseInt(localStorage.getItem("nsShaftHighScore") || "0", 10) : 0,
    nextPlatformId
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

  s.scrollSpeed = getScrollSpeed(s.floor);
  const scrollOffset = s.scrollSpeed * dt;
  s.distance += scrollOffset;
  s.floor = Math.floor(s.distance / 120);

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
    s.player.hurtTimer -= dt;
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
  let oldY = s.player.y;

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
            if (p.type === "normal" || p.type.startsWith("conveyor")) {
              s.player.hp = Math.min(MAX_HP, s.player.hp + 1);
            } else if (p.type === "spike") {
              s.player.hp -= 5;
              s.player.hurtTimer = 0.5;
            } else if (p.type === "trampoline") {
              s.player.vy = -600; // bounce
              s.player.groundedPlatformId = null;
            }
          } else {
             if (p.type === "spike" && s.player.hurtTimer <= 0) {
                 s.player.hp -= 5;
                 s.player.hurtTimer = 0.5;
             }
             else if (p.type === "trampoline") {
                  s.player.vy = -600; // bounce
                  s.player.groundedPlatformId = null; 
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
    }
    // 掉下平台
    s.player.groundedPlatformId = null;
    s.player.vy = GRAVITY * 0.2; // slight downward push
  }

  // 檢查死亡條件
  if (s.player.hp <= 0 || s.player.y > CANVAS_HEIGHT) {
    s.mode = "gameOver";
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
  // 背景
  ctx.fillStyle = "#1e1e24";
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
    drawPlatform(ctx, plat);
  }

  // 繪製天花板釘子
  drawCeilingSpikes(ctx);

  // 繪製玩家
  drawPlayer(ctx, state.player);

  // 繪製 HUD
  drawHUD(ctx, state);

  // 疊層
  if (state.mode === "ready") drawReadyOverlay(ctx);
  if (state.mode === "paused") drawPausedOverlay(ctx);
  if (state.mode === "gameOver") drawGameOverOverlay(ctx, state);
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform) {
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
      break;

    case "conveyor-left":
    case "conveyor-right":
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(0, 0, p.width, 8);
      // 動態紋理
      ctx.fillStyle = "#2563eb";
      const offset = (Date.now() / 10) % 20;
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
  let leftArmRot = isFalling ? -Math.PI * 0.8 : (isWalking ? (animFrame === 0 ? 0.3 : -0.3) : 0);
  let rightArmRot = isFalling ? -Math.PI * 0.8 : (isWalking ? (animFrame === 0 ? -0.3 : 0.3) : 0);
  let leftLegRot = isFalling ? -0.2 : (isWalking ? (animFrame === 0 ? -0.4 : 0.4) : 0);
  let rightLegRot = isFalling ? 0.4 : (isWalking ? (animFrame === 0 ? 0.4 : -0.4) : 0);

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
  // 生命條 Background
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(10, 30, 160, 24);
  
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.fillText("HP", 16, 47);

  // 生命格子
  const barWidth = 10;
  for (let i = 0; i < Math.floor(s.player.hp); i++) {
    // 如果快死了變紅，正常是紅到綠
    ctx.fillStyle = s.player.hp <= 3 ? "#ef4444" : "#fcd34d";
    ctx.fillRect(40 + i * 11, 34, barWidth, 16);
  }

  // 樓層 Floor
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(CANVAS_WIDTH - 120, 30, 110, 36);
  
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`B ${s.floor.toString().padStart(4, '0')}`, CANVAS_WIDTH - 20, 56);
}

function drawReadyOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 36px monospace";
  ctx.fillText("NS-SHAFT", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
  ctx.font = "18px monospace";
  ctx.fillText("Press SPACE to Start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
}

function drawPausedOverlay(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 36px monospace";
  ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
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
  ctx.fillText("Press SPACE to Restart", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120);
}

// 用於 playwright 驗證的狀態輸出
export function renderGameToText(state: GameState): string {
  return JSON.stringify({
    mode: state.mode,
    floor: state.floor,
    hp: state.player.hp,
    playerX: Math.round(state.player.x),
    playerY: Math.round(state.player.y),
    groundedPlatformId: state.player.groundedPlatformId,
    numActivePlatforms: state.platforms.length
  });
}

