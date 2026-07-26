// Battle City - Core game logic and state management
import { TileType, getMap } from "./maps";
import { createEnemyAI, updateEnemyAI, type AIState } from "./ai";

// Constants
export const TILE_SIZE = 16;
export const TANK_SIZE = 2; // 2×2 tiles = 32×32px
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 416;
export const GAME_AREA_WIDTH = 416;
export const GAME_AREA_HEIGHT = 416;
export const SIDE_BAR_WIDTH = 64;

// Game config
export const TANK_SPEED = 2;
export const BULLET_SPEED = 3;
export const SHOOT_COOLDOWN = 300;
export const TANK_MAX_HEALTH = 100;
export const PLAYER_INVINCIBLE_TIME = 2000;

// Types
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type GameMode = "menu" | "stageStart" | "playing" | "paused" | "stageComplete" | "gameOver";
export type TankType = "player" | "basic" | "fast" | "armored" | "artillery";
export type PowerUpType = "tank" | "star" | "bomb" | "shield" | "clock" | "shovel";

export interface Tank {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  health: number;
  maxHealth: number;
  shootCooldown: number;
  bulletPower: number;
  invincible: number;
  type?: TankType;
  level?: number;
  shield?: boolean;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  isPlayer: boolean;
  power: number;
}

export interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  blinkTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface EnemyAIState {
  id: string;
  state: AIState;
  stateTimer: number;
  targetDir: Direction;
  lastShotTime: number;
}

export interface GameState {
  mode: GameMode;
  stage: number;
  lives: number;
  score: number;
  hiScore: number;
  time: number;

  mapGrid: TileType[][];
  brickHealth: number[][];
  baseDestroyed: boolean;

  player: Tank;
  enemies: Tank[];
  bullets: Bullet[];
  powerUp: PowerUp | null;
  particles: Particle[];

  enemyQueue: TankType[];
  enemySpawnTimer: number;
  enemyAIMap: Record<string, EnemyAIState>;
  frozenTimer: number;
  shovelTimer: number;

  stageTimer: number;
  shakeIntensity: number;
  playerInput: Direction | "none";
  enemiesDefeated: number;
}

// Helper functions
const gridToPixels = (gridX: number, gridY: number): [number, number] => {
  return [gridX * TILE_SIZE, gridY * TILE_SIZE];
};

const pixelsToGrid = (pixelX: number, pixelY: number): [number, number] => {
  return [Math.floor(pixelX / TILE_SIZE), Math.floor(pixelY / TILE_SIZE)];
};

const getDirectionVector = (dir: Direction): [number, number] => {
  switch (dir) {
    case "UP":
      return [0, -1];
    case "DOWN":
      return [0, 1];
    case "LEFT":
      return [-1, 0];
    case "RIGHT":
      return [1, 0];
  }
};

const getBulletVelocity = (dir: Direction, speed: number): [number, number] => {
  const [dx, dy] = getDirectionVector(dir);
  return [dx * speed, dy * speed];
};

const canMoveToPixels = (pixelX: number, pixelY: number, mapGrid: TileType[][]): boolean => {
  const startGridX = Math.floor(pixelX / TILE_SIZE);
  const endGridX = Math.floor((pixelX + TANK_SIZE * TILE_SIZE - 0.1) / TILE_SIZE);
  const startGridY = Math.floor(pixelY / TILE_SIZE);
  const endGridY = Math.floor((pixelY + TANK_SIZE * TILE_SIZE - 0.1) / TILE_SIZE);

  if (startGridX < 0 || startGridY < 0 || endGridX >= mapGrid[0].length || endGridY >= mapGrid.length) {
    return false;
  }

  for (let gy = startGridY; gy <= endGridY; gy++) {
    for (let gx = startGridX; gx <= endGridX; gx++) {
      const tile = mapGrid[gy]?.[gx];
      if (tile === 2 || tile === 1 || tile === 4) return false;
    }
  }

  return true;
};

const getBulletHitTiles = (
  bullet: Bullet,
  nextX: number,
  nextY: number
): { gridX: number; gridY: number }[] => {
  const [gx1, gy1] = pixelsToGrid(bullet.x, bullet.y);
  const [gx2, gy2] = pixelsToGrid(nextX, nextY);

  const tiles = new Set<string>();
  // Add all tiles the bullet path crosses
  const minX = Math.min(gx1, gx2);
  const maxX = Math.max(gx1, gx2);
  const minY = Math.min(gy1, gy2);
  const maxY = Math.max(gy1, gy2);

  for (let gx = minX; gx <= maxX; gx++) {
    for (let gy = minY; gy <= maxY; gy++) {
      tiles.add(`${gx},${gy}`);
    }
  }

  return Array.from(tiles).map((key) => {
    const [gx, gy] = key.split(",").map(Number);
    return { gridX: gx, gridY: gy };
  });
};

export const createInitialState = (): GameState => {
  const map = getMap(1);

  // Initialize brick health (1-2 blocks health per brick)
  const brickHealth: number[][] = map.grid.map((row) =>
    row.map((tile) => (tile === 1 ? 1 : 0))
  );

  const [playerX, playerY] = gridToPixels(map.playerSpawn.x, map.playerSpawn.y);

  let hiScore = 0;
  if (typeof window !== "undefined") {
    try {
      hiScore = Number.parseInt(localStorage.getItem("battle-city-hi-score") ?? "0", 10) || 0;
    } catch {
      // Storage can be unavailable in private browsing; the game remains playable.
    }
  }

  return {
    mode: "menu",
    stage: 1,
    lives: 3,
    score: 0,
    hiScore,
    time: 0,

    mapGrid: map.grid,
    brickHealth,
    baseDestroyed: false,

    player: {
      id: "player",
      x: playerX,
      y: playerY,
      direction: "UP",
      speed: TANK_SPEED,
      health: TANK_MAX_HEALTH,
      maxHealth: TANK_MAX_HEALTH,
      shootCooldown: 0,
      bulletPower: 1,
      invincible: PLAYER_INVINCIBLE_TIME,
      type: "player",
    },

    enemies: [],
    bullets: [],
    powerUp: null,
    particles: [],

    enemyQueue: ["basic", "basic", "fast", "basic", "armored", "basic", "basic", "fast"],
    enemySpawnTimer: 0,
    enemyAIMap: {},
    frozenTimer: 0,
    shovelTimer: 0,

    stageTimer: 0,
    shakeIntensity: 0,
    playerInput: "none",
    enemiesDefeated: 0,
  };
};

export const setPlayerInput = (state: GameState, input: Direction | "none"): GameState => {
  return {
    ...state,
    playerInput: input,
  };
};

export const togglePause = (state: GameState): GameState => {
  if (state.mode === "playing") {
    return { ...state, mode: "paused" };
  } else if (state.mode === "paused") {
    return { ...state, mode: "playing" };
  }
  return state;
};

export const startGame = (state: GameState): GameState => {
  return {
    ...state,
    mode: "stageStart",
    stageTimer: 2000,
    enemies: [],
    bullets: [],
    particles: [],
    player: {
      ...state.player,
      x: gridToPixels(state.mapGrid[0].length / 2 - TANK_SIZE / 2 - 4, state.mapGrid.length - TANK_SIZE - 1)[0],
      y: gridToPixels(
        state.mapGrid[0].length / 2 - TANK_SIZE / 2 - 4,
        state.mapGrid.length - TANK_SIZE - 1
      )[1],
      health: state.player.maxHealth,
      invincible: PLAYER_INVINCIBLE_TIME,
    },
  };
};

export const advanceStage = (state: GameState): GameState => {
  if (state.mode !== "stageComplete") return state;

  const stage = state.stage + 1;
  const map = getMap(stage);
  const nextState: GameState = {
    ...state,
    stage,
    mapGrid: map.grid.map((row) => [...row]),
    brickHealth: map.grid.map((row) => row.map((tile) => (tile === 1 ? 1 : 0))),
    baseDestroyed: false,
    enemyQueue: ["basic", "basic", "fast", "basic", "armored", "basic", "basic", "fast"],
    enemySpawnTimer: 0,
    enemyAIMap: {},
    enemiesDefeated: 0,
    powerUp: null,
    frozenTimer: 0,
    shovelTimer: 0,
    playerInput: "none",
  };

  return startGame(nextState);
};

export const tick = (state: GameState, deltaMs: number): GameState => {
  let newState: GameState = {
    ...state,
    time: state.time + deltaMs,
    mapGrid: state.mapGrid.map((row) => [...row]),
    brickHealth: state.brickHealth.map((row) => [...row]),
    player: { ...state.player },
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
    bullets: state.bullets.map((bullet) => ({ ...bullet })),
    particles: state.particles.map((particle) => ({ ...particle })),
    enemyQueue: [...state.enemyQueue],
    enemyAIMap: { ...state.enemyAIMap },
    powerUp: state.powerUp ? { ...state.powerUp } : null,
  };

  // Update screen shake
  newState.shakeIntensity = Math.max(0, newState.shakeIntensity - deltaMs * 0.02);

  if (newState.mode === "menu") {
    return newState;
  }

  if (newState.mode === "stageStart") {
    newState.stageTimer -= deltaMs;
    if (newState.stageTimer <= 0) {
      newState = { ...newState, mode: "playing", stageTimer: 0 };
    }
    return newState;
  }

  if (newState.mode === "paused") {
    return newState;
  }

  if (newState.mode === "playing") {
    // Update player
    const newPlayer = { ...newState.player };

    // Handle movement
    if (newState.playerInput !== "none") {
      newPlayer.direction = newState.playerInput;
      const [dx, dy] = getDirectionVector(newState.playerInput);
      
      let nextX = newPlayer.x + dx * newPlayer.speed;
      let nextY = newPlayer.y + dy * newPlayer.speed;

      // Auto-align for smooth turning
      if (dx !== 0) { // Moving horizontally
        const alignY = Math.round(newPlayer.y / TILE_SIZE) * TILE_SIZE;
        if (Math.abs(newPlayer.y - alignY) <= 8) {
          nextY = alignY; // Snap
        } else {
          // Prevent moving if completely misaligned
          nextX = newPlayer.x;
        }
      } else if (dy !== 0) { // Moving vertically
        const alignX = Math.round(newPlayer.x / TILE_SIZE) * TILE_SIZE;
        if (Math.abs(newPlayer.x - alignX) <= 8) {
          nextX = alignX; // Snap
        } else {
          nextY = newPlayer.y;
        }
      }

      if (canMoveToPixels(nextX, nextY, newState.mapGrid)) {
        newPlayer.x = nextX;
        newPlayer.y = nextY;
      }
    }

    // Clamp position to valid range
    newPlayer.x = Math.max(0, Math.min(newPlayer.x, GAME_AREA_WIDTH - TANK_SIZE * TILE_SIZE));
    newPlayer.y = Math.max(0, Math.min(newPlayer.y, GAME_AREA_HEIGHT - TANK_SIZE * TILE_SIZE));

    // Update invincibility and shoot cooldown
    newPlayer.invincible = Math.max(0, newPlayer.invincible - deltaMs);
    newPlayer.shootCooldown = Math.max(0, newPlayer.shootCooldown - deltaMs);

    newState.player = newPlayer;

    // Update bullets
    const newBullets: Bullet[] = [];
    const bulletsToRemove = new Set<string>();

    for (const bullet of newState.bullets) {
      const nextX = bullet.x + bullet.vx;
      const nextY = bullet.y + bullet.vy;

      // Check collision with walls
      const hitTiles = getBulletHitTiles(bullet, nextX, nextY);
      let hitWall = false;

      for (const { gridX, gridY } of hitTiles) {
        if (
          gridX < 0 ||
          gridX >= newState.mapGrid[0].length ||
          gridY < 0 ||
          gridY >= newState.mapGrid.length
        ) {
          hitWall = true;
          break;
        }

        const tile = newState.mapGrid[gridY]?.[gridX];
        if (tile === 2) {
          // Steel - always block
          hitWall = true;
          break;
        }
        if (tile === 1) {
          // Brick - damage it
          newState.brickHealth[gridY][gridX]--;
          if (newState.brickHealth[gridY][gridX] <= 0) {
            newState.mapGrid[gridY][gridX] = 0;
            // Spawn particles
            newState.particles.push({
              x: gridX * TILE_SIZE,
              y: gridY * TILE_SIZE,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              life: 300,
              maxLife: 300,
              color: "#d4552d",
              size: 4,
            });
          }
          hitWall = true;
          break;
        }
      }

      if (!hitWall) {
        bullet.x = nextX;
        bullet.y = nextY;
        newBullets.push(bullet);
      } else {
        bulletsToRemove.add(bullet.id);
      }
    }

    newState.bullets = newBullets;

    // Update particles
    newState.particles = newState.particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - deltaMs,
      }))
      .filter((p) => p.life > 0);

    newState.frozenTimer = Math.max(0, newState.frozenTimer - deltaMs);
    newState.shovelTimer = Math.max(0, newState.shovelTimer - deltaMs);
    const enemiesFrozen = newState.frozenTimer > 0;

    // Spawn enemies
    newState.enemySpawnTimer -= deltaMs;
    const maxEnemies = 4;
    if (newState.enemySpawnTimer <= 0 && newState.enemies.length < maxEnemies && newState.enemyQueue.length > 0) {
      const spawnPoints = getMap(newState.stage).enemySpawns;
      const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      const [spawnX, spawnY] = gridToPixels(spawnPoint.x, spawnPoint.y);

      const enemyType = newState.enemyQueue.shift()!;
      const enemySpeed = enemyType === "fast" ? 3 : 2;
      const newEnemy: Tank = {
        id: `enemy-${Date.now()}-${Math.random()}`,
        x: spawnX,
        y: spawnY,
        direction: "DOWN",
        speed: enemySpeed,
        health: enemyType === "armored" ? 200 : 100,
        maxHealth: enemyType === "armored" ? 200 : 100,
        shootCooldown: 0,
        bulletPower: 1,
        invincible: 500,
        type: enemyType as TankType,
      };

      newState.enemies.push(newEnemy);
      newState.enemyAIMap[newEnemy.id] = createEnemyAI(newEnemy.id);
      newState.enemySpawnTimer = 2000;
    }

    // Update enemies
    const newEnemies: Tank[] = [];
    for (let i = 0; i < newState.enemies.length; i++) {
      const enemy = newState.enemies[i];
      const newEnemy = { ...enemy };

      const aiState = newState.enemyAIMap[enemy.id] ?? createEnemyAI(enemy.id);
      const [updatedAI, moveDir, shouldShoot] = enemiesFrozen
        ? [aiState, enemy.direction, false] as const
        : updateEnemyAI(aiState, enemy, newState, deltaMs);
      newState.enemyAIMap[enemy.id] = updatedAI;

      // Move enemy
      newEnemy.direction = moveDir;
      const [dx, dy] = getDirectionVector(moveDir);
      
      let nextX = newEnemy.x + dx * newEnemy.speed;
      let nextY = newEnemy.y + dy * newEnemy.speed;

      if (dx !== 0) {
        const alignY = Math.round(newEnemy.y / TILE_SIZE) * TILE_SIZE;
        if (Math.abs(newEnemy.y - alignY) <= 8) nextY = alignY;
        else nextX = newEnemy.x;
      } else if (dy !== 0) {
        const alignX = Math.round(newEnemy.x / TILE_SIZE) * TILE_SIZE;
        if (Math.abs(newEnemy.x - alignX) <= 8) nextX = alignX;
        else nextY = newEnemy.y;
      }

      if (!enemiesFrozen && canMoveToPixels(nextX, nextY, newState.mapGrid)) {
        newEnemy.x = nextX;
        newEnemy.y = nextY;
      }

      // Clamp position
      newEnemy.x = Math.max(0, Math.min(newEnemy.x, GAME_AREA_WIDTH - TANK_SIZE * TILE_SIZE));
      newEnemy.y = Math.max(0, Math.min(newEnemy.y, GAME_AREA_HEIGHT - TANK_SIZE * TILE_SIZE));

      // Update invincibility and shoot cooldown
      newEnemy.invincible = Math.max(0, newEnemy.invincible - deltaMs);
      newEnemy.shootCooldown = Math.max(0, newEnemy.shootCooldown - deltaMs);

      // Enemy shooting
      if (shouldShoot && newEnemy.shootCooldown <= 0) {
        const [vx, vy] = getBulletVelocity(moveDir, BULLET_SPEED);
        const bulletX = newEnemy.x + (TANK_SIZE * TILE_SIZE) / 2;
        const bulletY = newEnemy.y + (TANK_SIZE * TILE_SIZE) / 2;

        newState.bullets.push({
          id: `enemy-bullet-${Date.now()}-${Math.random()}`,
          x: bulletX,
          y: bulletY,
          vx,
          vy,
          ownerId: newEnemy.id,
          isPlayer: false,
          power: newEnemy.bulletPower,
        });

        newEnemy.shootCooldown = SHOOT_COOLDOWN;
      }

      newEnemies.push(newEnemy);
    }
    newState.enemies = newEnemies;

    // Check bullet-tank collisions
    const bulletsAfterCollision: Bullet[] = [];
    for (const bullet of newState.bullets) {
      let hitTank = false;

      if (bullet.isPlayer) {
        // Player bullet - check enemy collision
        for (let i = 0; i < newState.enemies.length; i++) {
          const enemy = newState.enemies[i];
          const dx = Math.abs(bullet.x - (enemy.x + TANK_SIZE * TILE_SIZE / 2));
          const dy = Math.abs(bullet.y - (enemy.y + TANK_SIZE * TILE_SIZE / 2));

          if (dx < TANK_SIZE * TILE_SIZE && dy < TANK_SIZE * TILE_SIZE) {
            enemy.health -= bullet.power * 50;
            if (enemy.health <= 0) {
              const enemyX = enemy.x + TANK_SIZE * TILE_SIZE / 2;
              const enemyY = enemy.y + TANK_SIZE * TILE_SIZE / 2;

              // Spawn explosion particles
              for (let p = 0; p < 8; p++) {
                const angle = (p / 8) * Math.PI * 2;
                const speed = 2 + Math.random() * 2;
                newState.particles.push({
                  x: enemyX,
                  y: enemyY,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  life: 400,
                  maxLife: 400,
                  color: "#ff6600",
                  size: 3 + Math.random() * 2,
                });
              }

              newState.shakeIntensity = 8;
              newState.enemies.splice(i, 1);
              delete newState.enemyAIMap[enemy.id];
              newState.enemiesDefeated++;
              newState.score += 100;

              // 30% chance to spawn power-up
              if (Math.random() < 0.3 && !newState.powerUp) {
                const powerUpTypes: PowerUpType[] = ["tank", "star", "bomb", "shield", "clock", "shovel"];
                const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                newState.powerUp = {
                  x: enemyX,
                  y: enemyY,
                  type: randomType,
                  blinkTimer: 0,
                };
              }
            }
            hitTank = true;
            break;
          }
        }
      } else {
        // Enemy bullet - check player collision
        const dx = Math.abs(bullet.x - (newState.player.x + TANK_SIZE * TILE_SIZE / 2));
        const dy = Math.abs(bullet.y - (newState.player.y + TANK_SIZE * TILE_SIZE / 2));

        if (dx < TANK_SIZE * TILE_SIZE && dy < TANK_SIZE * TILE_SIZE && newState.player.invincible <= 0) {
          const playerX = newState.player.x + TANK_SIZE * TILE_SIZE / 2;
          const playerY = newState.player.y + TANK_SIZE * TILE_SIZE / 2;

          const absorbedByShield = Boolean(newState.player.shield);

          // Spawn hit particles
          for (let p = 0; p < 6; p++) {
            const angle = (p / 6) * Math.PI * 2;
            const speed = 1.5 + Math.random() * 1.5;
            newState.particles.push({
              x: playerX,
              y: playerY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 300,
              maxLife: 300,
              color: absorbedByShield ? "#22d3ee" : "#ffff00",
              size: 2 + Math.random() * 1.5,
            });
          }

          if (absorbedByShield) {
            newState.shakeIntensity = 2;
            newState.player.shield = false;
            newState.player.invincible = 350;
          } else {
            newState.shakeIntensity = 5;
            newState.player.health -= bullet.power * 50;
            if (newState.player.health <= 0) {
              newState.lives--;
              if (newState.lives <= 0) {
                newState.mode = "gameOver";
              } else {
                newState.player.health = newState.player.maxHealth;
                newState.player.invincible = PLAYER_INVINCIBLE_TIME;
              }
            }
          }
          hitTank = true;
        }
      }

      if (!hitTank) {
        bulletsAfterCollision.push(bullet);
      }
    }
    newState.bullets = bulletsAfterCollision;

    // Update power-up blinking and collect
    if (newState.powerUp) {
      newState.powerUp.blinkTimer += deltaMs;
      // Collect power-up if player touches it
      const dx = Math.abs(newState.powerUp.x - (newState.player.x + TANK_SIZE * TILE_SIZE / 2));
      const dy = Math.abs(newState.powerUp.y - (newState.player.y + TANK_SIZE * TILE_SIZE / 2));
      if (dx < TANK_SIZE * TILE_SIZE && dy < TANK_SIZE * TILE_SIZE) {
        newState = applyPowerUp(newState);
      }
    }

    if (newState.shovelTimer > 0) {
      // Base is protected
      newState.baseDestroyed = false;
    }

    // Check base destruction (if enemy bullets hit base and no shovel protection)
    for (const bullet of newState.bullets) {
      if (!bullet.isPlayer && newState.shovelTimer <= 0) {
        const bx = Math.abs(bullet.x - (newState.mapGrid[0].length / 2 * TILE_SIZE));
        const by = Math.abs(bullet.y - ((newState.mapGrid.length - 2) * TILE_SIZE));
        if (bx < TILE_SIZE * 2 && by < TILE_SIZE * 2) {
          newState.baseDestroyed = true;
          newState.mode = "gameOver";
        }
      }
    }

    // Check level complete
    if (newState.enemyQueue.length === 0 && newState.enemies.length === 0) {
      newState.mode = "stageComplete";
      newState.stageTimer = 2000;
    }
  }

  // Save hi-score to localStorage when entering gameOver
  if (newState.mode === "gameOver" && state.mode !== "gameOver") {
    if (newState.score > newState.hiScore) {
      newState.hiScore = newState.score;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("battle-city-hi-score", String(newState.score));
        } catch {
          // A blocked storage write should not interrupt the result screen.
        }
      }
    }
  }

  return newState;
};

export const shootBullet = (state: GameState): GameState => {
  if (
    state.mode !== "playing" ||
    state.player.shootCooldown > 0 ||
    state.player.health <= 0
  ) {
    return state;
  }

  const [vx, vy] = getBulletVelocity(state.player.direction, BULLET_SPEED);
  const bulletX = state.player.x + (TANK_SIZE * TILE_SIZE) / 2;
  const bulletY = state.player.y + (TANK_SIZE * TILE_SIZE) / 2;

  const newBullet: Bullet = {
    id: `bullet-${Date.now()}-${Math.random()}`,
    x: bulletX,
    y: bulletY,
    vx,
    vy,
    ownerId: state.player.id,
    isPlayer: true,
    power: state.player.bulletPower,
  };

  return {
    ...state,
    bullets: [...state.bullets, newBullet],
    player: { ...state.player, shootCooldown: SHOOT_COOLDOWN },
  };
};

export const applyPowerUp = (state: GameState): GameState => {
  if (!state.powerUp) return state;

  const dx = Math.abs(state.powerUp.x - (state.player.x + TANK_SIZE * TILE_SIZE / 2));
  const dy = Math.abs(state.powerUp.y - (state.player.y + TANK_SIZE * TILE_SIZE / 2));

  if (dx > 32 || dy > 32) return state;

  // Apply power-up effect
  switch (state.powerUp.type) {
    case "tank":
      // Extra life
      return {
        ...state,
        lives: state.lives + 1,
        powerUp: null,
        score: state.score + 500,
      };

    case "bomb":
      // Kill all enemies
      return {
        ...state,
        enemies: [],
        enemyAIMap: {},
        powerUp: null,
        score: state.score + 500,
      };

    case "clock":
      // Freeze enemies
      return {
        ...state,
        frozenTimer: 5000,
        powerUp: null,
        score: state.score + 500,
      };

    case "shovel":
      // Protect base
      return {
        ...state,
        shovelTimer: 5000,
        powerUp: null,
        score: state.score + 500,
      };

    case "star": {
      // Upgrade tank level
      const newLevel = Math.min(3, (state.player.level || 1) + 1);
      const upgradedPlayer = { ...state.player, level: newLevel };
      if (newLevel === 2) {
        upgradedPlayer.speed = 3;
        upgradedPlayer.bulletPower = 2;
      } else if (newLevel === 3) {
        upgradedPlayer.speed = 4;
        upgradedPlayer.bulletPower = 3;
      }
      return {
        ...state,
        player: upgradedPlayer,
        powerUp: null,
        score: state.score + 500,
      };
    }

    case "shield": {
      // Shield effect
      const shieldedPlayer = { ...state.player, shield: true };
      return {
        ...state,
        player: shieldedPlayer,
        powerUp: null,
        score: state.score + 500,
      };
    }
  }

  return state;
};

export const restartGame = (): GameState => {
  return createInitialState();
};
