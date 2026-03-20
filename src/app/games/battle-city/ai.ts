// Battle City - Enemy AI logic
import { Direction, Tank, GameState, TILE_SIZE, TANK_SIZE } from "./utils";

export type AIState = "moving" | "shooting" | "turning";

interface EnemyAI {
  id: string;
  state: AIState;
  stateTimer: number;
  targetDir: Direction;
  lastShotTime: number;
}

const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

const getRandomDirection = (): Direction => {
  return DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
};

const getDirectionToTarget = (
  tankX: number,
  tankY: number,
  targetX: number,
  targetY: number
): Direction => {
  const dx = targetX - tankX;
  const dy = targetY - tankY;

  // Prefer vertical movement if possible
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy < 0 ? "UP" : "DOWN";
  } else {
    return dx < 0 ? "LEFT" : "RIGHT";
  }
};

const canMoveInDirection = (
  x: number,
  y: number,
  direction: Direction,
  mapGrid: number[][]
): boolean => {
  const [dx, dy] =
    direction === "UP"
      ? [0, -1]
      : direction === "DOWN"
        ? [0, 1]
        : direction === "LEFT"
          ? [-1, 0]
          : [1, 0];

  const newX = Math.round((x + dx * 16) / TILE_SIZE);
  const newY = Math.round((y + dy * 16) / TILE_SIZE);

  // Check bounds
  if (newX < 0 || newY < 0 || newX + TANK_SIZE > mapGrid[0].length || newY + TANK_SIZE > mapGrid.length) {
    return false;
  }

  // Check collision
  for (let dy = 0; dy < TANK_SIZE; dy++) {
    for (let dx = 0; dx < TANK_SIZE; dx++) {
      const tile = mapGrid[newY + dy]?.[newX + dx];
      if (tile === 2 || tile === 1 || tile === 4) return false;
    }
  }

  return true;
};

export const createEnemyAI = (tankId: string): EnemyAI => ({
  id: tankId,
  state: "moving",
  stateTimer: 0,
  targetDir: getRandomDirection(),
  lastShotTime: 0,
});

export const updateEnemyAI = (
  ai: EnemyAI,
  tank: Tank,
  gameState: GameState,
  deltaMs: number
): [EnemyAI, Direction, boolean] => {
  const newAI = { ...ai, stateTimer: ai.stateTimer + deltaMs, lastShotTime: ai.lastShotTime + deltaMs };

  let shouldShoot = false;
  let moveDir = tank.direction;

  // Artillery tanks have different behavior - aim and shoot
  const isArtillery = tank.type === "artillery";

  // State machine
  const stateChangeInterval = isArtillery ? 3000 : 2000;
  if (newAI.stateTimer > stateChangeInterval) {
    // Change strategy
    newAI.state = isArtillery || Math.random() > 0.6 ? "shooting" : "moving";
    newAI.stateTimer = 0;

    // 70% move towards base, 30% random
    if (Math.random() > 0.3) {
      newAI.targetDir = getDirectionToTarget(
        tank.x,
        tank.y,
        gameState.mapGrid[0].length / 2 * TILE_SIZE,
        gameState.mapGrid.length * TILE_SIZE
      );
    } else {
      newAI.targetDir = getRandomDirection();
    }
  }

  // Artillery tanks shoot more often
  if (isArtillery) {
    if (newAI.lastShotTime > 500 && Math.random() > 0.6) {
      shouldShoot = true;
      newAI.lastShotTime = 0;
    }
  } else {
    // Regular tanks shoot less frequently
    if (newAI.lastShotTime > 1000 && Math.random() > 0.7) {
      shouldShoot = true;
      newAI.lastShotTime = 0;
    }
  }

  // Movement logic - artillery tanks are more defensive
  if (isArtillery && newAI.state === "shooting") {
    // Stay in place and shoot
    moveDir = tank.direction;
  } else {
    // Try to move in target direction
    if (canMoveInDirection(tank.x, tank.y, newAI.targetDir, gameState.mapGrid)) {
      moveDir = newAI.targetDir;
    } else {
      // Hit obstacle - try random direction
      const newDir = getRandomDirection();
      if (canMoveInDirection(tank.x, tank.y, newDir, gameState.mapGrid)) {
        moveDir = newDir;
        newAI.targetDir = newDir;
      }
    }
  }

  return [newAI, moveDir, shouldShoot];
};
