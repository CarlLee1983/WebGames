import { describe, expect, test } from "bun:test";
import {
  BASE_SPEED,
  GAME_WIDTH,
  PENGUIN_RADIUS,
  circlesCollide,
  clampTargetX,
  getCurrentProgress,
  getScrollSpeed,
  getSpawnInterval,
  getSpeedLevel,
  renderGameToText,
} from "./utils";

describe("Deep Sea Penguin rules", () => {
  test("advances through four documented speed levels", () => {
    expect(getSpeedLevel(500)).toBe(1);
    expect(getSpeedLevel(501)).toBe(2);
    expect(getSpeedLevel(1_001)).toBe(3);
    expect(getSpeedLevel(2_001)).toBe(4);
    expect(getScrollSpeed(2_001)).toBeCloseTo(BASE_SPEED * 2.2);
  });

  test("accelerates spawning without exceeding its safety cap", () => {
    expect(getSpawnInterval(0)).toBe(80);
    expect(getSpawnInterval(1_200)).toBe(60);
    expect(getSpawnInterval(100_000)).toBe(25);
  });

  test("reports progress and remaining distance to the next current", () => {
    expect(getCurrentProgress(250)).toEqual({
      level: 1,
      label: "Calm drift",
      multiplier: 1,
      nextLevelAt: 500,
      metersRemaining: 250,
      percent: 50,
    });
    expect(getCurrentProgress(750)).toMatchObject({
      level: 2,
      nextLevelAt: 1_000,
      metersRemaining: 250,
      percent: 50,
    });
    expect(getCurrentProgress(2_001)).toMatchObject({
      level: 4,
      nextLevelAt: null,
      metersRemaining: 0,
      percent: 100,
    });
  });

  test("keeps the penguin inside the playable horizontal lane", () => {
    const margin = PENGUIN_RADIUS + 20;
    expect(clampTargetX(-100)).toBe(margin);
    expect(clampTargetX(GAME_WIDTH + 100)).toBe(GAME_WIDTH - margin);
    expect(clampTargetX(GAME_WIDTH / 2)).toBe(GAME_WIDTH / 2);
  });

  test("uses strict circle overlap for collision checks", () => {
    const penguin = { x: 0, y: 0, radius: 20 };
    expect(circlesCollide(penguin, { x: 29, y: 0, radius: 10 })).toBe(true);
    expect(circlesCollide(penguin, { x: 30, y: 0, radius: 10 })).toBe(false);
  });

  test("serializes the decision-relevant dive state", () => {
    const rendered = JSON.parse(renderGameToText({
      depth: 750.4,
      lives: 2,
      fishCount: 4,
      speedLevel: 2,
      scrollSpeed: BASE_SPEED * 1.4,
      penguinX: 312.2,
      hazardCount: 3,
      fishInView: 1,
      damageCooldownMs: 640.2,
      feedback: "damage",
      isGameOver: false,
    }, "playing"));

    expect(rendered).toMatchObject({
      mode: "playing",
      depthMeters: 750,
      fishCollected: 4,
      hearts: 2,
      current: { level: 2, nextLevelAt: 1_000, metersRemaining: 250, progressPercent: 50 },
      penguin: { x: 312, laneWidth: GAME_WIDTH },
      onScreen: { hazards: 3, fish: 1 },
      protection: { active: true, remainingMs: 641 },
      feedback: "damage",
    });
  });
});
