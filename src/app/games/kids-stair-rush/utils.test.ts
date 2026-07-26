import { describe, expect, test } from "bun:test";
import {
  CANVAS_WIDTH,
  MAX_HP,
  createInitialState,
  generatePlatform,
  getLandingForecast,
  getPaceProgress,
  getScrollSpeed,
  parseHighScore,
  renderGameToText,
  setPlayerInput,
  startGame,
  tick,
  togglePause,
  type GameState,
  type PlatformType,
} from "./utils";

function landingState(type: PlatformType, hp = MAX_HP): GameState {
  const initial = createInitialState(() => 0.5, 12);
  return {
    ...initial,
    mode: "playing",
    player: {
      ...initial.player,
      x: 120,
      y: 100,
      vy: 100,
      hp,
      groundedPlatformId: null,
    },
    platforms: [{ id: 20, x: 95, y: 144, width: 110, type, touched: false, state: 0 }],
    nextPlatformId: 21,
  };
}

describe("Kids Stair Rush rules", () => {
  test("creates a deterministic safe opening and sanitizes stored scores", () => {
    const state = createInitialState(() => 0.5, 18);

    expect(state.mode).toBe("ready");
    expect(state.platforms).toHaveLength(7);
    expect(state.platforms.every((platform) => platform.type === "normal")).toBe(true);
    expect(state.highScore).toBe(18);
    expect(parseHighScore("42")).toBe(42);
    expect(parseHighScore("not-a-score")).toBe(0);
    expect(parseHighScore("-3")).toBe(0);
  });

  test("raises the shaft speed in documented difficulty bands", () => {
    expect(getScrollSpeed(0)).toBe(60);
    expect(getScrollSpeed(10)).toBe(80);
    expect(getScrollSpeed(30)).toBe(100);
    expect(getScrollSpeed(50)).toBe(120);
    expect(getScrollSpeed(150)).toBe(200);
    expect(getScrollSpeed(500)).toBe(250);

    expect(getPaceProgress(20)).toMatchObject({
      level: 2,
      label: "Quick steps",
      nextFloor: 30,
      floorsRemaining: 10,
      percent: 50,
      speed: 80,
    });
    expect(getPaceProgress(150)).toMatchObject({
      level: 5,
      nextFloor: 200,
      floorsRemaining: 50,
      percent: 50,
      speed: 200,
    });
    expect(getPaceProgress(200)).toMatchObject({
      level: 6,
      nextFloor: null,
      floorsRemaining: 0,
      percent: 100,
      speed: 250,
    });
  });

  test("announces only real pace-band changes", () => {
    const base = startGame(createInitialState(() => 0.5, 0));
    const ordinaryFloor = tick({
      ...base,
      floor: 19,
      distance: 20 * 120 - 1,
      feedbackTimer: 0,
      lastMilestone: 0,
    }, 100);
    expect(ordinaryFloor.floor).toBe(20);
    expect(ordinaryFloor.feedbackTimer).toBe(0);
    expect(ordinaryFloor.lastMilestone).toBe(0);

    const fasterBand = tick({
      ...base,
      floor: 29,
      distance: 30 * 120 - 1,
      feedbackTimer: 0,
      lastMilestone: 10,
    }, 100);
    expect(fasterBand.floor).toBe(30);
    expect(fasterBand.scrollSpeed).toBe(100);
    expect(fasterBand.feedback).toBe("Fast shaft — 100 px/s!");
    expect(fasterBand.lastMilestone).toBe(30);
  });

  test("generates narrower late-game platforms with predictable hazards", () => {
    const rolls = [0.5, 0.1];
    const platform = generatePlatform(7, 600, 120, () => rolls.shift() ?? 0);

    expect(platform.type).toBe("spike");
    expect(platform.width).toBe(60);
    expect(platform.x).toBe((CANVAS_WIDTH - platform.width) / 2);
  });

  test("only accepts movement while playing and preserves pause state", () => {
    const ready = createInitialState(() => 0.5, 0);
    expect(setPlayerInput(ready, "left")).toBe(ready);

    const playing = setPlayerInput(startGame(ready), "left");
    expect(playing.player.inputDir).toBe("left");
    expect(playing.player.facing).toBe("left");
    expect(togglePause(playing).mode).toBe("paused");
    expect(togglePause(togglePause(playing)).mode).toBe("playing");
  });

  test("rewards a first safe landing with healing and a streak", () => {
    const landed = tick(landingState("normal", 8), 100);

    expect(landed.player.groundedPlatformId).toBe(20);
    expect(landed.player.hp).toBe(9);
    expect(landed.landings).toBe(1);
    expect(landed.streak).toBe(1);
    expect(landed.bestStreak).toBe(1);
    expect(landed.feedback).toBe("Safe landing +1 HP");
  });

  test("spikes deal damage and break an active streak", () => {
    const state = { ...landingState("spike"), streak: 4, bestStreak: 6 };
    const landed = tick(state, 100);

    expect(landed.player.hp).toBe(5);
    expect(landed.player.hurtTimer).toBeGreaterThan(0);
    expect(landed.landings).toBe(0);
    expect(landed.streak).toBe(0);
    expect(landed.bestStreak).toBe(6);
    expect(landed.feedback).toBe("Spikes! -5 HP");
  });

  test("a fake platform warns the player before collapsing", () => {
    const landed = tick(landingState("fake"), 100);
    expect(landed.player.groundedPlatformId).toBe(20);
    expect(landed.feedback).toBe("Cracking step — move!");

    const collapsed = tick(landed, 600);
    expect(collapsed.player.groundedPlatformId).toBeNull();
    expect(collapsed.platforms.find((platform) => platform.id === 20)?.state).toBeGreaterThan(0.5);
  });

  test("forecasts the closest usable landing and direction", () => {
    const state = landingState("normal");
    state.player.x = 40;
    state.platforms = [
      { id: 10, x: 30, y: 130, width: 90, type: "fake", touched: true, state: 0.6 },
      { id: 11, x: 180, y: 170, width: 100, type: "spike", touched: false, state: 0 },
      { id: 12, x: 20, y: 240, width: 100, type: "normal", touched: false, state: 0 },
    ];

    expect(getLandingForecast(state)).toEqual({
      platformId: 11,
      type: "spike",
      direction: "right",
      verticalDistance: 38,
      horizontalGap: 134,
    });
  });

  test("renders pace, active feedback, and landing guidance", () => {
    const state = landingState("normal");
    state.floor = 20;
    state.scrollSpeed = getScrollSpeed(20);
    state.feedback = "Safe landing";
    state.feedbackTimer = 0;
    const rendered = JSON.parse(renderGameToText(state));

    expect(rendered).toMatchObject({
      mode: "playing",
      floor: 20,
      feedback: "Safe landing",
      feedbackActive: false,
      scrollSpeed: 80,
      pace: {
        level: 2,
        label: "Quick steps",
        nextFloor: 30,
        floorsRemaining: 10,
        progressPercent: 50,
      },
      nextLanding: {
        platformId: 20,
        type: "normal",
        direction: "hold",
      },
    });
  });
});
