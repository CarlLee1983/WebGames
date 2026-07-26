import { describe, expect, test } from "bun:test";
import {
  BASE_SPAWN_RATE,
  BASE_UP_TIME,
  ESCAPE_DISPLAY_MS,
  HIT_DISPLAY_MS,
  LEVEL_GOALS,
  ROUND_SECONDS,
  calculateHitScore,
  createInitialGameState,
  generateRandomHoles,
  getLevelProgress,
  getLevelConfig,
  renderGameToText,
  whackGameReducer,
  type MoleState,
  type WhackGameState,
} from "./utils";

function startPlaying(level = 1) {
  const holes = generateRandomHoles(() => 0.5);
  const intro = whackGameReducer(createInitialGameState(), {
    type: "START_LEVEL",
    level,
    holes,
  });
  return whackGameReducer(intro, { type: "INTRO_COMPLETE" });
}

function withMole(state: WhackGameState, mole: MoleState): WhackGameState {
  return { ...state, moles: { [mole.id]: mole } };
}

describe("Whack-A-Mole rules", () => {
  test("builds a separated three-by-three field inside safe margins", () => {
    const holes = generateRandomHoles(() => 0.5);

    expect(holes).toHaveLength(9);
    expect(new Set(holes.map((hole) => `${hole.x},${hole.y}`)).size).toBe(9);
    expect(holes.every((hole) => hole.x >= 17 && hole.x <= 83)).toBe(true);
    expect(holes.every((hole) => hole.y >= 17 && hole.y <= 83)).toBe(true);
  });

  test("increases difficulty while retaining safe caps", () => {
    expect(getLevelConfig(1)).toEqual({
      spawnRate: BASE_SPAWN_RATE,
      upTime: BASE_UP_TIME,
      helmetChance: 0.12,
      maxMoles: 1,
    });
    expect(getLevelConfig(100)).toEqual({
      spawnRate: 430,
      upTime: 650,
      helmetChance: 0.55,
      maxMoles: 4,
    });
  });

  test("caps the combo bonus at twenty points", () => {
    expect(calculateHitScore("normal", 0)).toEqual({
      basePoints: 10,
      comboBonus: 0,
      total: 10,
    });
    expect(calculateHitScore("helmet", 12)).toEqual({
      basePoints: 20,
      comboBonus: 20,
      total: 40,
    });
  });

  test("requires two hits to score a helmet mole", () => {
    let state = startPlaying();
    state = whackGameReducer(state, {
      type: "SPAWN",
      now: 1_000,
      holeRoll: 0,
      typeRoll: 0,
    });

    state = whackGameReducer(state, { type: "WHACK", id: 0, now: 1_050 });
    expect(state.moles[0].health).toBe(1);
    expect(state.moles[0].createdAt).toBe(1_050);
    expect(state.score).toBe(0);

    const stillExposed = whackGameReducer(state, {
      type: "ADVANCE_MOLES",
      now: 1_050 + BASE_UP_TIME - 1,
    });
    expect(stillExposed.moles[0].status).toBe("up");

    state = whackGameReducer(stillExposed, { type: "WHACK", id: 0, now: 1_050 + BASE_UP_TIME - 1 });
    expect(state.moles[0].status).toBe("hit");
    expect(state.score).toBe(20);
    expect(state.combo).toBe(1);
  });

  test("reports bounded progress toward the current level target", () => {
    expect(getLevelProgress({ ...startPlaying(), score: 200 })).toEqual({
      goal: 800,
      remaining: 600,
      percent: 25,
    });
    expect(getLevelProgress({ ...startPlaying(), score: 900 })).toEqual({
      goal: 800,
      remaining: 0,
      percent: 100,
    });
  });

  test("expires missed moles, breaks the combo, and clears the animation", () => {
    const playing = withMole(
      { ...startPlaying(), combo: 6 },
      {
        id: 0,
        type: "normal",
        status: "up",
        health: 1,
        createdAt: 1_000,
        statusChangedAt: 1_000,
      },
    );
    const escaped = whackGameReducer(playing, {
      type: "ADVANCE_MOLES",
      now: 1_000 + BASE_UP_TIME,
    });

    expect(escaped.moles[0].status).toBe("escaped");
    expect(escaped.combo).toBe(0);
    expect(escaped.misses).toBe(1);

    const hidden = whackGameReducer(escaped, {
      type: "ADVANCE_MOLES",
      now: 1_000 + BASE_UP_TIME + ESCAPE_DISPLAY_MS,
    });
    expect(hidden.moles[0].status).toBe("hiding");
  });

  test("freezes the timer while paused and removes an unfair active target", () => {
    const playing = withMole(
      startPlaying(),
      {
        id: 0,
        type: "normal",
        status: "hit",
        health: 1,
        createdAt: 0,
        statusChangedAt: 0,
      },
    );
    const paused = whackGameReducer(playing, { type: "PAUSE" });
    const ticked = whackGameReducer(paused, { type: "TICK" });

    expect(paused.phase).toBe("paused");
    expect(paused.moles).toEqual({});
    expect(ticked.timeLeft).toBe(ROUND_SECONDS);
    expect(whackGameReducer(ticked, { type: "RESUME" }).phase).toBe("playing");
  });

  test("moves to the win phase as soon as the target is reached", () => {
    const nearlyWon = withMole(
      { ...startPlaying(), score: LEVEL_GOALS[0] - 10 },
      {
        id: 0,
        type: "normal",
        status: "up",
        health: 1,
        createdAt: 0,
        statusChangedAt: 0,
      },
    );
    const won = whackGameReducer(nearlyWon, { type: "WHACK", id: 0, now: HIT_DISPLAY_MS });

    expect(won.phase).toBe("win");
    expect(won.score).toBe(LEVEL_GOALS[0]);
    expect(won.moles).toEqual({});
  });

  test("renders inspectable progress, difficulty, and active targets", () => {
    const state = withMole(
      { ...startPlaying(4), score: 4_000, combo: 7, misses: 2 },
      {
        id: 3,
        type: "helmet",
        status: "up",
        health: 1,
        createdAt: 1_000,
        statusChangedAt: 1_000,
      },
    );
    const rendered = JSON.parse(renderGameToText(state));

    expect(rendered.progress).toEqual({ goal: 5_000, remaining: 1_000, percent: 80 });
    expect(rendered.combo).toBe(7);
    expect(rendered.escaped).toBe(2);
    expect(rendered.difficulty.maxMoles).toBe(2);
    expect(rendered.activeMoles).toEqual([
      { hole: 4, type: "helmet", status: "up", health: 1 },
    ]);
  });
});
