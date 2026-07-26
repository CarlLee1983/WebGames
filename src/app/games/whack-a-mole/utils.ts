export const HOLE_COUNT = 9;
export const ROUND_SECONDS = 60;
export const INTRO_DURATION_MS = 900;
export const BASE_SPAWN_RATE = 1_100;
export const BASE_UP_TIME = 1_500;
export const HELMET_MOLE_CHANCE = 0.12;
export const HIT_DISPLAY_MS = 360;
export const ESCAPE_DISPLAY_MS = 520;

export const LEVEL_GOALS = [
  800,
  1_800,
  3_200,
  5_000,
  7_500,
  10_500,
  14_000,
  18_500,
  24_000,
  30_000,
];

export type GamePhase =
  | "start"
  | "intro"
  | "playing"
  | "paused"
  | "gameover"
  | "win";
export type MoleType = "normal" | "helmet";
export type MoleStatus = "hiding" | "up" | "hit" | "escaped";

export interface Hole {
  id: number;
  x: number;
  y: number;
}

export interface MoleState {
  id: number;
  type: MoleType;
  status: MoleStatus;
  health: number;
  createdAt: number;
  statusChangedAt: number;
}

export interface WhackGameState {
  phase: GamePhase;
  level: number;
  score: number;
  timeLeft: number;
  holes: Hole[];
  moles: Record<number, MoleState>;
  combo: number;
  misses: number;
}

export type WhackAction =
  | { type: "START_LEVEL"; level: number; holes: Hole[] }
  | { type: "INTRO_COMPLETE" }
  | { type: "TICK" }
  | { type: "SPAWN"; now: number; holeRoll: number; typeRoll: number }
  | { type: "ADVANCE_MOLES"; now: number }
  | { type: "WHACK"; id: number; now: number }
  | { type: "PAUSE" }
  | { type: "RESUME" };

export interface LevelConfig {
  spawnRate: number;
  upTime: number;
  helmetChance: number;
  maxMoles: number;
}

export interface LevelProgress {
  goal: number;
  remaining: number;
  percent: number;
}

export function createInitialGameState(): WhackGameState {
  return {
    phase: "start",
    level: 1,
    score: 0,
    timeLeft: ROUND_SECONDS,
    holes: [],
    moles: {},
    combo: 0,
    misses: 0,
  };
}

export function generateRandomHoles(random = Math.random): Hole[] {
  return Array.from({ length: HOLE_COUNT }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const jitterX = (random() - 0.5) * 6;
    const jitterY = (random() - 0.5) * 6;

    return {
      id: index,
      x: 20 + column * 30 + jitterX,
      y: 20 + row * 30 + jitterY,
    };
  });
}

export function getLevelConfig(level: number): LevelConfig {
  const levelIndex = Math.max(0, level - 1);

  return {
    spawnRate: Math.max(430, BASE_SPAWN_RATE - levelIndex * 70),
    upTime: Math.max(650, BASE_UP_TIME - levelIndex * 85),
    helmetChance: Math.min(0.55, HELMET_MOLE_CHANCE + levelIndex * 0.045),
    maxMoles: Math.min(4, 1 + Math.floor(levelIndex / 3)),
  };
}

export function calculateHitScore(type: MoleType, combo: number) {
  const basePoints = type === "helmet" ? 20 : 10;
  const comboBonus = Math.min(Math.max(0, combo) * 2, 20);

  return {
    basePoints,
    comboBonus,
    total: basePoints + comboBonus,
  };
}

export function getLevelProgress(state: WhackGameState): LevelProgress {
  const goal = LEVEL_GOALS[state.level - 1] ?? LEVEL_GOALS.at(-1) ?? 0;
  const safeScore = Math.max(0, state.score);
  return {
    goal,
    remaining: Math.max(0, goal - safeScore),
    percent: goal > 0 ? Math.min(100, Math.round((safeScore / goal) * 100)) : 100,
  };
}

export function renderGameToText(state: WhackGameState) {
  return JSON.stringify({
    phase: state.phase,
    level: state.level,
    score: state.score,
    timeLeft: state.timeLeft,
    combo: state.combo,
    escaped: state.misses,
    progress: getLevelProgress(state),
    difficulty: getLevelConfig(state.level),
    activeMoles: Object.values(state.moles)
      .filter((mole) => mole.status !== "hiding")
      .map((mole) => ({
        hole: mole.id + 1,
        type: mole.type,
        status: mole.status,
        health: mole.health,
      })),
  });
}

function normalizeRoll(roll: number) {
  return Math.min(0.999_999, Math.max(0, roll));
}

export function whackGameReducer(
  state: WhackGameState,
  action: WhackAction,
): WhackGameState {
  switch (action.type) {
    case "START_LEVEL":
      return {
        ...state,
        phase: "intro",
        level: action.level,
        score: action.level === 1 ? 0 : state.score,
        timeLeft: ROUND_SECONDS,
        holes: action.holes,
        moles: {},
        combo: 0,
        misses: action.level === 1 ? 0 : state.misses,
      };

    case "INTRO_COMPLETE":
      return state.phase === "intro" ? { ...state, phase: "playing" } : state;

    case "TICK":
      if (state.phase !== "playing") return state;
      if (state.timeLeft <= 1) {
        return { ...state, phase: "gameover", timeLeft: 0, moles: {} };
      }
      return { ...state, timeLeft: state.timeLeft - 1 };

    case "SPAWN": {
      if (state.phase !== "playing") return state;

      const config = getLevelConfig(state.level);
      const activeMoles = Object.values(state.moles).filter(
        (mole) => mole.status !== "hiding",
      );
      if (activeMoles.length >= config.maxMoles) return state;

      const availableHoles = state.holes.filter(
        (hole) => state.moles[hole.id]?.status !== "up" &&
          state.moles[hole.id]?.status !== "hit" &&
          state.moles[hole.id]?.status !== "escaped",
      );
      if (availableHoles.length === 0) return state;

      const holeIndex = Math.floor(normalizeRoll(action.holeRoll) * availableHoles.length);
      const hole = availableHoles[holeIndex];
      const type = normalizeRoll(action.typeRoll) < config.helmetChance
        ? "helmet"
        : "normal";

      return {
        ...state,
        moles: {
          ...state.moles,
          [hole.id]: {
            id: hole.id,
            type,
            status: "up",
            health: type === "helmet" ? 2 : 1,
            createdAt: action.now,
            statusChangedAt: action.now,
          },
        },
      };
    }

    case "ADVANCE_MOLES": {
      if (state.phase !== "playing") return state;

      const upTime = getLevelConfig(state.level).upTime;
      let changed = false;
      let escapedCount = 0;
      const moles: Record<number, MoleState> = {};

      for (const [id, mole] of Object.entries(state.moles)) {
        let nextMole = mole;
        if (mole.status === "up" && action.now - mole.createdAt >= upTime) {
          changed = true;
          escapedCount += 1;
          nextMole = { ...mole, status: "escaped", statusChangedAt: action.now };
        } else if (
          mole.status === "hit" &&
          action.now - mole.statusChangedAt >= HIT_DISPLAY_MS
        ) {
          changed = true;
          nextMole = { ...mole, status: "hiding", statusChangedAt: action.now };
        } else if (
          mole.status === "escaped" &&
          action.now - mole.statusChangedAt >= ESCAPE_DISPLAY_MS
        ) {
          changed = true;
          nextMole = { ...mole, status: "hiding", statusChangedAt: action.now };
        }
        moles[Number(id)] = nextMole;
      }

      if (!changed) return state;
      return {
        ...state,
        moles,
        combo: escapedCount > 0 ? 0 : state.combo,
        misses: state.misses + escapedCount,
      };
    }

    case "WHACK": {
      if (state.phase !== "playing") return state;
      const mole = state.moles[action.id];
      if (!mole || mole.status !== "up") return state;

      if (mole.type === "helmet" && mole.health === 2) {
        return {
          ...state,
          moles: {
            ...state.moles,
            [action.id]: {
              ...mole,
              health: 1,
              createdAt: action.now,
              statusChangedAt: action.now,
            },
          },
        };
      }

      const points = calculateHitScore(mole.type, state.combo).total;
      const score = state.score + points;
      const won = score >= LEVEL_GOALS[state.level - 1];

      return {
        ...state,
        phase: won ? "win" : state.phase,
        score,
        combo: state.combo + 1,
        moles: won
          ? {}
          : {
              ...state.moles,
              [action.id]: {
                ...mole,
                status: "hit",
                statusChangedAt: action.now,
              },
            },
      };
    }

    case "PAUSE":
      return state.phase === "playing"
        ? { ...state, phase: "paused", moles: {} }
        : state;

    case "RESUME":
      return state.phase === "paused" ? { ...state, phase: "playing" } : state;

    default:
      return state;
  }
}
