export type GameMode = 'start' | 'playing' | 'paused' | 'gameOver';

export type ItemType = 'ice' | 'gold' | 'fire';

export interface FloatingMessage {
  text: string;
  color: string;
  life: number;
  x: number;
  y: number;
}

export interface StackPreview {
  blockCount: number;
  goldCount: number;
  projectedPoints: number;
}

export interface GameState {
  mode: GameMode;
  score: number;
  lives: number;
  highScore: number;
  stack: StackPreview;
  message: FloatingMessage | null;
}

export const MAX_LIVES = 3;
export const BASE_SPAWN_RATE = 100;
export const MIN_SPAWN_RATE = 35;

export function createInitialGameState(highScore = 0): GameState {
  return {
    mode: 'start',
    score: 0,
    lives: MAX_LIVES,
    highScore,
    stack: getStackPreview([]),
    message: null,
  };
}

export function calculateCrushPoints(blockCount: number, goldCount: number) {
  const safeBlocks = Math.max(0, Math.floor(blockCount));
  const safeGold = Math.min(safeBlocks, Math.max(0, Math.floor(goldCount)));
  const comboPoints = safeBlocks * safeBlocks * 10;
  const goldPoints = safeGold * 500;

  return {
    comboPoints,
    goldPoints,
    total: comboPoints + goldPoints,
  };
}

export function getSpawnRate(score: number) {
  return Math.max(
    MIN_SPAWN_RATE,
    BASE_SPAWN_RATE - Math.floor(Math.max(0, score) / 500) * 5,
  );
}

export function selectItemType(roll: number): ItemType {
  if (roll > 0.95) return 'gold';
  if (roll > 0.82) return 'fire';
  return 'ice';
}

export function getStackPreview(items: ItemType[]): StackPreview {
  const catchableItems = items.filter((item) => item !== 'fire');
  const goldCount = catchableItems.filter((item) => item === 'gold').length;
  return {
    blockCount: catchableItems.length,
    goldCount,
    projectedPoints: calculateCrushPoints(catchableItems.length, goldCount).total,
  };
}

export function isInsideBucketCaptureZone(
  x: number,
  y: number,
  bucketX: number,
  bucketY: number,
  bucketWidth: number,
  bucketHeight: number,
  wallThickness: number,
) {
  const interiorHalfWidth = Math.max(0, bucketWidth / 2 - wallThickness / 2);
  const top = bucketY - bucketHeight;
  const bottom = bucketY + bucketHeight / 2;
  return Math.abs(x - bucketX) <= interiorHalfWidth && y >= top && y <= bottom;
}

export function renderGameToText(state: GameState, bucketX: number, activeItems: ItemType[]) {
  const counts = activeItems.reduce(
    (summary, item) => ({ ...summary, [item]: summary[item] + 1 }),
    { ice: 0, gold: 0, fire: 0 },
  );

  return JSON.stringify({
    mode: state.mode,
    score: state.score,
    lives: state.lives,
    highScore: state.highScore,
    stack: state.stack,
    bucketX: Math.round(bucketX),
    spawnRate: getSpawnRate(state.score),
    activeItems: counts,
    message: state.message?.text ?? null,
  });
}

export function loseLife(state: GameState): GameState {
  const lives = Math.max(0, state.lives - 1);
  if (lives === 0) {
    return {
      ...state,
      lives,
      mode: 'gameOver',
      highScore: Math.max(state.score, state.highScore),
      stack: getStackPreview([]),
    };
  }

  return { ...state, lives };
}
