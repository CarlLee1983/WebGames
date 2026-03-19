// Battleship Blitz - SNES Retro Arcade Shooter
// Canvas dimensions
export const CANVAS_WIDTH = 320;
export const CANVAS_HEIGHT = 240;

// Game modes
export type GameMode = 'menu' | 'playing' | 'gameOver' | 'paused';

// Entity types
export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  shootCooldown: number;
  weaponLevel: number;
  invulnerable: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  isPlayerBullet: boolean;
}

export interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  shootCooldown: number;
  type: 'basic' | 'fast' | 'heavy';
}

export interface PowerUp {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'health' | 'weapon' | 'shield';
  vy: number;
}

export interface GameState {
  mode: GameMode;
  score: number;
  wave: number;
  time: number;
  player: Player;
  playerBullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  powerUps: PowerUp[];
  waveStartTime: number;
  enemySpawnTimer: number;
  combo: number;
  lives: number;
}

// Game constants
const PLAYER_WIDTH = 16;
const PLAYER_HEIGHT = 16;
const PLAYER_SPEED = 120;
const PLAYER_SHOOT_COOLDOWN = 6;
const ENEMY_BULLET_SPEED = 60;
const PLAYER_BULLET_SPEED = 150;

export function createInitialState(): GameState {
  return {
    mode: 'menu',
    score: 0,
    wave: 1,
    time: 0,
    lives: 3,
    player: {
      x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: CANVAS_HEIGHT - 40,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      health: 100,
      maxHealth: 100,
      shootCooldown: 0,
      weaponLevel: 1,
      invulnerable: 0,
    },
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    powerUps: [],
    waveStartTime: 0,
    enemySpawnTimer: 0,
    combo: 0,
  };
}

export function startGame(state: GameState): GameState {
  return {
    ...state,
    mode: 'playing',
    waveStartTime: 0,
    enemySpawnTimer: 0,
    score: 0,
    lives: 3,
    wave: 1,
    player: {
      ...state.player,
      x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: CANVAS_HEIGHT - 40,
      health: 100,
      shootCooldown: 0,
      weaponLevel: 1,
      invulnerable: 0,
    },
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    powerUps: [],
    combo: 0,
  };
}

export function updateGameState(
  state: GameState,
  input: {
    left: boolean;
    right: boolean;
    shoot: boolean;
    pause: boolean;
    touchX?: number;
  },
  deltaTime: number
): GameState {
  if (state.mode === 'menu') {
    return state;
  }

  if (state.mode === 'paused' && input.pause) {
    return {
      ...state,
      mode: 'playing',
    };
  }

  if (state.mode === 'paused') {
    return state;
  }

  if (input.pause) {
    return {
      ...state,
      mode: 'paused',
    };
  }

  let newState = { ...state, time: state.time + deltaTime };

  // Update player position with touch or keyboard
  const moveDistance = PLAYER_SPEED * deltaTime;
  let newPlayerX = newState.player.x;

  if (input.touchX !== undefined) {
    // Touch control: move to touch position
    newPlayerX = Math.max(
      0,
      Math.min(input.touchX - PLAYER_WIDTH / 2, CANVAS_WIDTH - PLAYER_WIDTH)
    );
  } else {
    // Keyboard control
    if (input.left) {
      newPlayerX = Math.max(0, newPlayerX - moveDistance);
    }
    if (input.right) {
      newPlayerX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, newPlayerX + moveDistance);
    }
  }

  // Update invulnerability
  let invulnerable = Math.max(0, newState.player.invulnerable - deltaTime);

  // Update shoot cooldown and handle shooting
  let shootCooldown = Math.max(0, newState.player.shootCooldown - deltaTime);
  let playerBullets = [...newState.playerBullets];

  if (input.shoot && shootCooldown <= 0) {
    const bulletX = newPlayerX + PLAYER_WIDTH / 2;
    const bulletY = newState.player.y;

    if (newState.player.weaponLevel === 1) {
      playerBullets.push({
        x: bulletX - 2,
        y: bulletY - 8,
        vx: 0,
        vy: -PLAYER_BULLET_SPEED,
        width: 4,
        height: 8,
        damage: 25,
        isPlayerBullet: true,
      });
    } else if (newState.player.weaponLevel === 2) {
      // Dual shot
      playerBullets.push(
        {
          x: bulletX - 6,
          y: bulletY - 8,
          vx: -40,
          vy: -PLAYER_BULLET_SPEED,
          width: 4,
          height: 8,
          damage: 20,
          isPlayerBullet: true,
        },
        {
          x: bulletX + 2,
          y: bulletY - 8,
          vx: 40,
          vy: -PLAYER_BULLET_SPEED,
          width: 4,
          height: 8,
          damage: 20,
          isPlayerBullet: true,
        }
      );
    } else {
      // Triple shot
      playerBullets.push(
        {
          x: bulletX - 8,
          y: bulletY - 8,
          vx: -60,
          vy: -PLAYER_BULLET_SPEED,
          width: 4,
          height: 8,
          damage: 15,
          isPlayerBullet: true,
        },
        {
          x: bulletX - 2,
          y: bulletY - 8,
          vx: 0,
          vy: -PLAYER_BULLET_SPEED,
          width: 4,
          height: 8,
          damage: 15,
          isPlayerBullet: true,
        },
        {
          x: bulletX + 4,
          y: bulletY - 8,
          vx: 60,
          vy: -PLAYER_BULLET_SPEED,
          width: 4,
          height: 8,
          damage: 15,
          isPlayerBullet: true,
        }
      );
    }

    shootCooldown = PLAYER_SHOOT_COOLDOWN;
  }

  // Update bullets
  let filteredPlayerBullets = playerBullets.filter((b) => b.y > -10);
  filteredPlayerBullets = filteredPlayerBullets.map((b) => ({
    ...b,
    x: b.x + b.vx * deltaTime,
    y: b.y + b.vy * deltaTime,
  }));

  // Spawn enemies based on wave
  let enemies = [...newState.enemies];
  let enemySpawnTimer = newState.enemySpawnTimer + deltaTime;
  const spawnRate = Math.max(0.5, 2 - newState.wave * 0.1);

  if (enemySpawnTimer > spawnRate && enemies.length < 3 + newState.wave) {
    const enemyType: 'basic' | 'fast' | 'heavy' =
      Math.random() < 0.7 ? 'basic' : Math.random() < 0.5 ? 'fast' : 'heavy';
    const randomX = Math.random() * (CANVAS_WIDTH - 16);

    enemies.push({
      x: randomX,
      y: -16,
      width: 16,
      height: 16,
      vx: 0,
      vy: enemyType === 'fast' ? 100 : 50,
      health: enemyType === 'heavy' ? 50 : 25,
      maxHealth: enemyType === 'heavy' ? 50 : 25,
      shootCooldown: Math.random() * 2,
      type: enemyType,
    });

    enemySpawnTimer = 0;
  }

  // Update enemies and enemy bullets
  let enemyBullets = [...newState.enemyBullets];
  enemies = enemies.map((enemy) => {
    let newEnemy = {
      ...enemy,
      y: enemy.y + enemy.vy * deltaTime,
      shootCooldown: Math.max(0, enemy.shootCooldown - deltaTime),
    };

    // Enemy shoots
    if (newEnemy.shootCooldown <= 0) {
      const bulletsPerShot = newState.wave > 2 ? 2 : 1;
      for (let i = 0; i < bulletsPerShot; i++) {
        const spreadAngle = (i - (bulletsPerShot - 1) / 2) * 15;
        const rad = (spreadAngle * Math.PI) / 180;
        const bvx = Math.sin(rad) * ENEMY_BULLET_SPEED * 0.5;
        const bvy = ENEMY_BULLET_SPEED;

        enemyBullets.push({
          x: newEnemy.x + 8,
          y: newEnemy.y + 8,
          vx: bvx,
          vy: bvy,
          width: 4,
          height: 8,
          damage: 10,
          isPlayerBullet: false,
        });
      }
      newEnemy.shootCooldown = 1.5 + Math.random() * 1;
    }

    return newEnemy;
  });

  // Filter out enemies that left the screen
  enemies = enemies.filter((e) => e.y < CANVAS_HEIGHT + 20);

  // Update enemy bullets
  let filteredEnemyBullets = enemyBullets.filter((b) => b.y < CANVAS_HEIGHT + 10);
  filteredEnemyBullets = filteredEnemyBullets.map((b) => ({
    ...b,
    x: b.x + b.vx * deltaTime,
    y: b.y + b.vy * deltaTime,
  }));

  // Update power-ups
  let powerUps = newState.powerUps.map((p) => ({
    ...p,
    y: p.y + p.vy * deltaTime,
  }));
  powerUps = powerUps.filter((p) => p.y < CANVAS_HEIGHT + 10);

  // Collision detection: player bullets vs enemies
  let score = newState.score;
  let combo = newState.combo;

  filteredPlayerBullets = filteredPlayerBullets.filter((bullet) => {
    let hit = false;

    enemies = enemies
      .map((enemy) => {
        if (
          hit ||
          bullet.x + bullet.width < enemy.x ||
          bullet.x > enemy.x + enemy.width ||
          bullet.y + bullet.height < enemy.y ||
          bullet.y > enemy.y + enemy.height
        ) {
          return enemy;
        }

        hit = true;
        const newHealth = enemy.health - bullet.damage;

        if (newHealth <= 0) {
          score += 100 * newState.wave * (1 + combo * 0.1);
          combo += 1;

          // Drop power-up
          if (Math.random() < 0.3) {
            const type: 'health' | 'weapon' | 'shield' =
              Math.random() < 0.6
                ? 'health'
                : Math.random() < 0.7
                  ? 'weapon'
                  : 'shield';
            powerUps.push({
              x: enemy.x + 8,
              y: enemy.y,
              width: 8,
              height: 8,
              type,
              vy: 60,
            });
          }

          return null;
        }

        return { ...enemy, health: newHealth };
      })
      .filter((e) => e !== null) as Enemy[];

    return !hit;
  });

  // Collision detection: enemy bullets vs player
  let playerHealth = newState.player.health;
  let newInvulnerable = invulnerable;

  filteredEnemyBullets = filteredEnemyBullets.filter((bullet) => {
    if (
      newInvulnerable > 0 ||
      bullet.x + bullet.width < newPlayerX ||
      bullet.x > newPlayerX + PLAYER_WIDTH ||
      bullet.y + bullet.height < newState.player.y ||
      bullet.y > newState.player.y + PLAYER_HEIGHT
    ) {
      return true;
    }

    playerHealth = Math.max(0, playerHealth - bullet.damage);
    newInvulnerable = 2; // 2 seconds of invulnerability

    return false;
  });

  // Collision detection: power-ups vs player
  powerUps = powerUps.filter((powerUp) => {
    if (
      powerUp.x + powerUp.width < newPlayerX ||
      powerUp.x > newPlayerX + PLAYER_WIDTH ||
      powerUp.y + powerUp.height < newState.player.y ||
      powerUp.y > newState.player.y + PLAYER_HEIGHT
    ) {
      return true;
    }

    // Apply power-up
    if (powerUp.type === 'health') {
      playerHealth = Math.min(
        newState.player.maxHealth,
        playerHealth + 25
      );
    } else if (powerUp.type === 'weapon') {
      newState.player.weaponLevel = Math.min(
        3,
        newState.player.weaponLevel + 1
      );
    } else if (powerUp.type === 'shield') {
      newInvulnerable = 5;
    }

    return false;
  });

  // Check game over
  let mode = newState.mode;
  let lives = newState.lives;

  if (playerHealth <= 0) {
    lives -= 1;
    if (lives <= 0) {
      mode = 'gameOver';
    } else {
      // Reset player
      playerHealth = newState.player.maxHealth;
      newPlayerX = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
      newInvulnerable = 3;
      filteredEnemyBullets = [];
      enemies = [];
      powerUps = [];
      combo = 0;
    }
  }

  // Check wave completion
  if (enemies.length === 0 && enemySpawnTimer > 2 && newState.enemies.length > 0) {
    newState.wave += 1;
    enemies = [];
    enemySpawnTimer = 0;
    combo = 0;
  }

  return {
    ...newState,
    mode,
    score,
    lives,
    wave: enemies.length === 0 && newState.enemies.length === 0 ? newState.wave : newState.wave,
    player: {
      ...newState.player,
      x: newPlayerX,
      health: playerHealth,
      shootCooldown,
      invulnerable: newInvulnerable,
      weaponLevel: newState.player.weaponLevel,
    },
    playerBullets: filteredPlayerBullets,
    enemyBullets: filteredEnemyBullets,
    enemies,
    powerUps,
    combo,
    enemySpawnTimer,
  };
}

export function togglePause(state: GameState): GameState {
  if (state.mode === 'playing') {
    return { ...state, mode: 'paused' };
  }
  if (state.mode === 'paused') {
    return { ...state, mode: 'playing' };
  }
  return state;
}

export function restartGame(state: GameState): GameState {
  return startGame(createInitialState());
}
