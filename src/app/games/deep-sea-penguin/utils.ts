export const GAME_WIDTH = 600;
export const GAME_HEIGHT = 800;
export const PENGUIN_RADIUS = 25;
export const BASE_SPEED = 3.5;
export const DAMAGE_COOLDOWN_MS = 1_000;
export const FISH_FEEDBACK_MS = 700;

const CURRENT_START_DEPTHS = [0, 500, 1_000, 2_000] as const;
const CURRENT_SPEED_MULTIPLIERS = [1, 1.4, 1.8, 2.2] as const;

export interface CurrentProgress {
  level: number;
  label: string;
  multiplier: number;
  nextLevelAt: number | null;
  metersRemaining: number;
  percent: number;
}

export interface DiveStateView {
  depth: number;
  lives: number;
  fishCount: number;
  speedLevel: number;
  scrollSpeed: number;
  penguinX: number;
  hazardCount: number;
  fishInView: number;
  damageCooldownMs: number;
  feedback: "none" | "fish" | "damage";
  isGameOver: boolean;
}

export function getSpeedLevel(depth: number) {
  if (depth > 2_000) return 4;
  if (depth > 1_000) return 3;
  if (depth > 500) return 2;
  return 1;
}

export function getScrollSpeed(depth: number) {
  return BASE_SPEED * CURRENT_SPEED_MULTIPLIERS[getSpeedLevel(depth) - 1];
}

export function getCurrentProgress(depth: number): CurrentProgress {
  const safeDepth = Math.max(0, depth);
  const level = getSpeedLevel(safeDepth);
  const startDepth = CURRENT_START_DEPTHS[level - 1];
  const nextLevelAt = level === 4
    ? null
    : CURRENT_START_DEPTHS[level as 1 | 2 | 3];
  const labels = ["Calm drift", "Quick current", "Deep surge", "Abyss rush"];

  if (nextLevelAt === null) {
    return {
      level,
      label: labels[level - 1],
      multiplier: CURRENT_SPEED_MULTIPLIERS[level - 1],
      nextLevelAt,
      metersRemaining: 0,
      percent: 100,
    };
  }

  return {
    level,
    label: labels[level - 1],
    multiplier: CURRENT_SPEED_MULTIPLIERS[level - 1],
    nextLevelAt,
    metersRemaining: Math.max(0, nextLevelAt - safeDepth),
    percent: Math.min(100, Math.max(0, ((safeDepth - startDepth) / (nextLevelAt - startDepth)) * 100)),
  };
}

export function getSpawnInterval(depth: number) {
  return Math.max(25, 80 - depth / 60);
}

export function clampTargetX(targetX: number) {
  const margin = PENGUIN_RADIUS + 20;
  return Math.max(margin, Math.min(GAME_WIDTH - margin, targetX));
}

export function circlesCollide(
  first: { x: number; y: number; radius: number },
  second: { x: number; y: number; radius: number },
) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return Math.hypot(dx, dy) < first.radius + second.radius;
}

export function renderGameToText(state: DiveStateView, mode: string) {
  const current = getCurrentProgress(state.depth);
  return JSON.stringify({
    mode,
    depthMeters: Math.floor(state.depth),
    fishCollected: state.fishCount,
    hearts: state.lives,
    current: {
      level: state.speedLevel,
      label: current.label,
      speed: Number(state.scrollSpeed.toFixed(2)),
      multiplier: current.multiplier,
      nextLevelAt: current.nextLevelAt,
      metersRemaining: Math.ceil(current.metersRemaining),
      progressPercent: Math.round(current.percent),
    },
    penguin: {
      x: Math.round(state.penguinX),
      laneWidth: GAME_WIDTH,
    },
    onScreen: {
      hazards: state.hazardCount,
      fish: state.fishInView,
    },
    protection: {
      active: state.damageCooldownMs > 0,
      remainingMs: Math.ceil(state.damageCooldownMs),
    },
    feedback: state.feedback,
    isGameOver: state.isGameOver,
  });
}
