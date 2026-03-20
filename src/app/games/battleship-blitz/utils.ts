// Battleship Blitz - SNES Retro Arcade Shooter
// Canvas dimensions
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 800;

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
  type: 'basic' | 'fast' | 'heavy' | 'boss';
  pattern?: number;
  stateTime?: number;
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
  bossActive: boolean;
}

// Game constants
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 24;
const PLAYER_SPEED = 300;
const PLAYER_SHOOT_COOLDOWN = 0.12;
const ENEMY_BULLET_SPEED = 180;
const PLAYER_BULLET_SPEED = 600;

export function createInitialState(): GameState {
  return {
    mode: 'menu',
    score: 0,
    wave: 1,
    time: 0,
    lives: 3,
    player: {
      x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: CANVAS_HEIGHT - 60,
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
    bossActive: false,
  };
}

export function startGame(state: GameState): GameState {
  const initialState = createInitialState();
  return {
    ...initialState,
    mode: 'playing',
  };
}

export function updateGameState(
  state: GameState,
  input: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    shoot: boolean;
    pause: boolean;
    touchX?: number;
    touchY?: number;
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

  const newState = { ...state, time: state.time + deltaTime };

  // Update player position with touch or keyboard
  const moveDistance = PLAYER_SPEED * deltaTime;
  let newPlayerX = newState.player.x;
  let newPlayerY = newState.player.y;

  if (input.touchX !== undefined && input.touchY !== undefined) {
    // Touch control: move to touch position
    newPlayerX = Math.max(
      0,
      Math.min(input.touchX - PLAYER_WIDTH / 2, CANVAS_WIDTH - PLAYER_WIDTH)
    );
    newPlayerY = Math.max(
      CANVAS_HEIGHT * 0.4, // Don't let player go too high
      Math.min(input.touchY - PLAYER_HEIGHT / 2, CANVAS_HEIGHT - PLAYER_HEIGHT)
    );
  } else {
    // Keyboard control
    if (input.left) {
      newPlayerX = Math.max(0, newPlayerX - moveDistance);
    }
    if (input.right) {
      newPlayerX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, newPlayerX + moveDistance);
    }
    if (input.up) {
      newPlayerY = Math.max(CANVAS_HEIGHT * 0.4, newPlayerY - moveDistance);
    }
    if (input.down) {
      newPlayerY = Math.min(CANVAS_HEIGHT - PLAYER_HEIGHT, newPlayerY + moveDistance);
    }
  }

  // Update invulnerability
  const invulnerable = Math.max(0, newState.player.invulnerable - deltaTime);

  // Update shoot cooldown and handle shooting
  let shootCooldown = Math.max(0, newState.player.shootCooldown - deltaTime);
  const playerBullets = [...newState.playerBullets];

  if (input.shoot && shootCooldown <= 0) {
    const bulletX = newPlayerX + PLAYER_WIDTH / 2;
    const bulletY = newPlayerY;
    const wLevel = newState.player.weaponLevel;

    // Base shot
    playerBullets.push({
      x: bulletX - 3,
      y: bulletY - 8,
      vx: 0,
      vy: -PLAYER_BULLET_SPEED,
      width: 6,
      height: 12,
      damage: 25,
      isPlayerBullet: true,
    });

    if (wLevel >= 2) {
      playerBullets.push(
        { x: bulletX - 12, y: bulletY - 4, vx: -60, vy: -PLAYER_BULLET_SPEED, width: 4, height: 10, damage: 20, isPlayerBullet: true },
        { x: bulletX + 8, y: bulletY - 4, vx: 60, vy: -PLAYER_BULLET_SPEED, width: 4, height: 10, damage: 20, isPlayerBullet: true }
      );
    }
    
    if (wLevel >= 3) {
      playerBullets.push(
        { x: bulletX - 20, y: bulletY, vx: -120, vy: -PLAYER_BULLET_SPEED * 0.9, width: 4, height: 10, damage: 15, isPlayerBullet: true },
        { x: bulletX + 16, y: bulletY, vx: 120, vy: -PLAYER_BULLET_SPEED * 0.9, width: 4, height: 10, damage: 15, isPlayerBullet: true }
      );
    }

    if (wLevel >= 4) {
      playerBullets.push(
        { x: bulletX - 28, y: bulletY + 4, vx: -180, vy: -PLAYER_BULLET_SPEED * 0.8, width: 4, height: 10, damage: 15, isPlayerBullet: true },
        { x: bulletX + 24, y: bulletY + 4, vx: 180, vy: -PLAYER_BULLET_SPEED * 0.8, width: 4, height: 10, damage: 15, isPlayerBullet: true }
      );
    }

    if (wLevel >= 5) {
      // Missiles pointing outward slightly
      playerBullets.push(
        { x: newPlayerX - 10, y: newPlayerY + 10, vx: -50, vy: -PLAYER_BULLET_SPEED * 0.6, width: 8, height: 16, damage: 40, isPlayerBullet: true },
        { x: newPlayerX + PLAYER_WIDTH + 2, y: newPlayerY + 10, vx: 50, vy: -PLAYER_BULLET_SPEED * 0.6, width: 8, height: 16, damage: 40, isPlayerBullet: true }
      );
    }

    shootCooldown = PLAYER_SHOOT_COOLDOWN;
  }

  // Update bullets
  let filteredPlayerBullets = playerBullets.filter((b) => b.y > -20 && b.x > -20 && b.x < CANVAS_WIDTH + 20);
  filteredPlayerBullets = filteredPlayerBullets.map((b) => ({
    ...b,
    x: b.x + b.vx * deltaTime,
    y: b.y + b.vy * deltaTime,
  }));

  // Wait, if wave is boss wave, spawn Boss.
  const isBossWave = newState.wave % 5 === 0;
  
  // Spawn enemies based on wave
  let enemies = [...newState.enemies];
  let enemySpawnTimer = newState.enemySpawnTimer + deltaTime;

  if (isBossWave && !newState.bossActive && enemies.length === 0) {
    // Spawn boss
    newState.bossActive = true;
    enemies.push({
      x: CANVAS_WIDTH / 2 - 40,
      y: -80,
      width: 80,
      height: 80,
      vx: 100,
      vy: 40,
      health: 2000 + newState.wave * 500,
      maxHealth: 2000 + newState.wave * 500,
      shootCooldown: 1,
      type: 'boss',
      pattern: 0,
      stateTime: 0,
    });
  } else if (!isBossWave) {
    const spawnRate = Math.max(0.4, 1.5 - newState.wave * 0.1);
    if (enemySpawnTimer > spawnRate && enemies.length < 5 + newState.wave) {
      const enemyType: 'basic' | 'fast' | 'heavy' =
        Math.random() < 0.7 ? 'basic' : Math.random() < 0.5 ? 'fast' : 'heavy';
      const randomX = Math.random() * (CANVAS_WIDTH - 30) + 10;

      enemies.push({
        x: randomX,
        y: -30,
        width: enemyType === 'heavy' ? 30 : 20,
        height: enemyType === 'heavy' ? 30 : 20,
        vx: 0,
        vy: enemyType === 'fast' ? 150 : 80,
        health: enemyType === 'heavy' ? 80 : 30,
        maxHealth: enemyType === 'heavy' ? 80 : 30,
        shootCooldown: Math.random() * 2,
        type: enemyType,
        stateTime: 0,
      });

      enemySpawnTimer = 0;
    }
  }

  // Update enemies and enemy bullets
  const enemyBullets = [...newState.enemyBullets];
  enemies = enemies.map((enemy) => {
    const newEnemy = {
      ...enemy,
      shootCooldown: Math.max(0, enemy.shootCooldown - deltaTime),
      stateTime: (enemy.stateTime || 0) + deltaTime,
    };

    if (newEnemy.type === 'boss') {
      // Boss movement logic
      if (newEnemy.y < 50) {
        newEnemy.y += newEnemy.vy * deltaTime;
      } else {
        // Move left and right
        newEnemy.x += newEnemy.vx * deltaTime;
        if (newEnemy.x <= 20) {
          newEnemy.x = 20;
          newEnemy.vx = Math.abs(newEnemy.vx);
        } else if (newEnemy.x + newEnemy.width >= CANVAS_WIDTH - 20) {
          newEnemy.x = CANVAS_WIDTH - 20 - newEnemy.width;
          newEnemy.vx = -Math.abs(newEnemy.vx);
        }
      }

      // Boss shooting
      if (newEnemy.shootCooldown <= 0) {
        const pattern = Math.floor(newEnemy.stateTime! / 3) % 3;
        if (pattern === 0) {
          // Circle spread
          for (let i = 0; i < 8; i++) {
            const rad = (i * Math.PI) / 4;
            enemyBullets.push({
              x: newEnemy.x + newEnemy.width / 2,
              y: newEnemy.y + newEnemy.height,
              vx: Math.cos(rad) * ENEMY_BULLET_SPEED,
              vy: Math.sin(rad) * Math.abs(ENEMY_BULLET_SPEED),
              width: 6,
              height: 6,
              damage: 15,
              isPlayerBullet: false,
            });
          }
        } else if (pattern === 1) {
          // Aim at player
          const dx = newPlayerX + PLAYER_WIDTH / 2 - (newEnemy.x + newEnemy.width / 2);
          const dy = newPlayerY + PLAYER_HEIGHT / 2 - (newEnemy.y + newEnemy.height);
          const dist = Math.sqrt(dx * dx + dy * dy);
          enemyBullets.push({
            x: newEnemy.x + newEnemy.width / 2,
            y: newEnemy.y + newEnemy.height,
            vx: (dx / dist) * ENEMY_BULLET_SPEED * 1.5,
            vy: (dy / dist) * ENEMY_BULLET_SPEED * 1.5,
            width: 8,
            height: 12,
            damage: 25,
            isPlayerBullet: false,
          });
        } else {
          // Dense straight attack
          for(let i = -2; i <= 2; i++) {
            enemyBullets.push({
              x: newEnemy.x + newEnemy.width / 2 + i * 15,
              y: newEnemy.y + newEnemy.height,
              vx: 0,
              vy: ENEMY_BULLET_SPEED * 1.2,
              width: 5,
              height: 15,
              damage: 20,
              isPlayerBullet: false,
            });
          }
        }
        newEnemy.shootCooldown = 0.8;
      }
    } else {
      newEnemy.y += newEnemy.vy * deltaTime;
      if (newEnemy.type === 'fast') {
        newEnemy.x += Math.sin(newEnemy.stateTime! * 5) * 60 * deltaTime; // slight weave
      }

      // Normal enemy shoots
      if (newEnemy.shootCooldown <= 0) {
        const bulletsPerShot = newState.wave > 3 ? 2 : 1;
        for (let i = 0; i < bulletsPerShot; i++) {
          const spreadAngle = (i - (bulletsPerShot - 1) / 2) * 15;
          const rad = (spreadAngle * Math.PI) / 180;
          const bvx = Math.sin(rad) * ENEMY_BULLET_SPEED * 0.5;
          const bvy = ENEMY_BULLET_SPEED;

          enemyBullets.push({
            x: newEnemy.x + newEnemy.width / 2,
            y: newEnemy.y + newEnemy.height,
            vx: bvx,
            vy: bvy,
            width: 4,
            height: 10,
            damage: 10,
            isPlayerBullet: false,
          });
        }
        newEnemy.shootCooldown = 1.2 + Math.random() * 1.5;
      }
    }

    return newEnemy;
  });

  // Filter out enemies that left the screen
  enemies = enemies.filter((e) => e.y < CANVAS_HEIGHT + 20);

  // Update enemy bullets
  let filteredEnemyBullets = enemyBullets.filter((b) => b.y < CANVAS_HEIGHT + 10 && b.x > -20 && b.x < CANVAS_WIDTH + 20);
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
  let bossDied = false;

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
          if (enemy.type === 'boss') bossDied = true;
          score += (enemy.type === 'boss' ? 5000 : 100) * newState.wave * (1 + combo * 0.1);
          combo += 1;

          // Drop power-up
          let dropChance = enemy.type === 'boss' ? 1.0 : (enemy.type === 'heavy' ? 0.6 : 0.2);
          if (Math.random() < dropChance) {
            const numDrops = enemy.type === 'boss' ? 5 : 1;
            for(let i=0; i<numDrops; i++) {
              const type: 'health' | 'weapon' | 'shield' =
                Math.random() < 0.4
                  ? 'health'
                  : Math.random() < 0.7
                    ? 'weapon'
                    : 'shield';
              powerUps.push({
                x: enemy.x + enemy.width / 2 + (Math.random() * 40 - 20),
                y: enemy.y + enemy.height / 2,
                width: 12,
                height: 12,
                type,
                vy: 40 + Math.random() * 40,
              });
            }
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
      bullet.x + bullet.width < newPlayerX + 4 ||
      bullet.x > newPlayerX + PLAYER_WIDTH - 4 ||
      bullet.y + bullet.height < newPlayerY + 4 ||
      bullet.y > newPlayerY + PLAYER_HEIGHT - 4
    ) {
      return true;
    }

    playerHealth = Math.max(0, playerHealth - bullet.damage);
    newInvulnerable = 2; // 2 seconds of invulnerability
    combo = 0; // Reset combo on hit

    return false;
  });

  // Collision detection: enemy bodies vs player
  enemies = enemies.filter((enemy) => {
    if (
      newInvulnerable > 0 ||
      enemy.x + enemy.width < newPlayerX ||
      enemy.x > newPlayerX + PLAYER_WIDTH ||
      enemy.y + enemy.height < newPlayerY ||
      enemy.y > newPlayerY + PLAYER_HEIGHT
    ) {
      return true;
    }

    playerHealth = Math.max(0, playerHealth - 30);
    newInvulnerable = 2;
    combo = 0;
    
    // Boss doesn't die on collision, player just takes damage
    if (enemy.type === 'boss') return true;
    return false; // Small enemies explode
  });

  // Collision detection: power-ups vs player
  powerUps = powerUps.filter((powerUp) => {
    if (
      powerUp.x + powerUp.width < newPlayerX ||
      powerUp.x > newPlayerX + PLAYER_WIDTH ||
      powerUp.y + powerUp.height < newPlayerY ||
      powerUp.y > newPlayerY + PLAYER_HEIGHT
    ) {
      return true;
    }

    // Apply power-up
    if (powerUp.type === 'health') {
      playerHealth = Math.min(
        newState.player.maxHealth,
        playerHealth + 30
      );
    } else if (powerUp.type === 'weapon') {
      newState.player.weaponLevel = Math.min(
        5,
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
  let bossActive = newState.bossActive;

  if (bossDied) {
    bossActive = false;
  }

  if (playerHealth <= 0) {
    lives -= 1;
    if (lives <= 0) {
      mode = 'gameOver';
    } else {
      // Reset player
      playerHealth = newState.player.maxHealth;
      newPlayerX = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
      newPlayerY = CANVAS_HEIGHT - 60;
      newInvulnerable = 3;
      // Don't clear enemies/boss, let them keep playing
      combo = 0;
    }
  }

  // Check wave completion
  if (!bossActive && enemies.length === 0 && enemySpawnTimer > 3 && newState.enemies.length > 0) {
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
    bossActive,
    wave: newState.wave,
    player: {
      ...newState.player,
      x: newPlayerX,
      y: newPlayerY,
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

