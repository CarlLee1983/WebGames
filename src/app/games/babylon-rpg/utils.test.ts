import { describe, expect, test } from "bun:test";
import {
  createGameState,
  createSave,
  getCombatStatus,
  getNearbyPrompt,
  getObjective,
  getQuestTarget,
  objectiveIsComplete,
  parseGameSave,
  performAttack,
  performInteraction,
  renderGameToText,
  tickGame,
  togglePause,
  type LevelData,
} from "./utils";

const battleLevel: LevelData = {
  id: "forest",
  chapter: 1,
  title: "Forest Shrine",
  mode: "battle",
  description: "Test forest",
  playerSpawn: { x: 0, y: 1.25, z: 0, yaw: 0 },
  enemies: [{ id: "slime", position: { x: 0, y: 1, z: 2 }, hp: 2 }],
  chests: [],
  gates: [{ id: "forest-gate", position: { x: 0, y: 2, z: 3 }, size: { x: 4, y: 5, z: 1 } }],
  movingPlatforms: [],
  trapZones: [{ id: "roots", min: { x: 5, y: 0, z: 5 }, max: { x: 7, y: 1, z: 7 }, damage: 2 }],
};

const treasureLevel: LevelData = {
  ...battleLevel,
  id: "treasury",
  chapter: 2,
  title: "Sunken Treasury",
  mode: "treasure",
  enemies: [],
  chests: [{ id: "relic", position: { x: 0, y: 1, z: 2 }, loot: ["silver-key"] }],
  gates: [{ id: "treasury-door", position: { x: 0, y: 2, z: 3 }, size: { x: 4, y: 5, z: 1 } }],
};

const terrainLevel: LevelData = {
  ...battleLevel,
  id: "sky-bridge",
  chapter: 3,
  title: "Sky Bridge",
  mode: "terrain",
  playerSpawn: { x: -4, y: 1.25, z: -2, yaw: 0 },
  enemies: [],
  chests: [{ id: "bridge-cache", position: { x: -4, y: 1, z: -2 }, loot: ["bridge-pass"] }],
  gates: [{ id: "sky-exit", position: { x: 4, y: 2, z: 6 }, size: { x: 4, y: 5, z: 1 } }],
  movingPlatforms: [{
    id: "lift-a",
    position: { x: -4, y: 1.4, z: -2 },
    speed: 1.2,
    path: [{ x: -4, y: 1.4, z: -2 }, { x: 0, y: 2.2, z: 2 }],
  }],
  trapZones: [],
};

const still = { up: false, down: false, left: false, right: false };

describe("Babylon RPG rules", () => {
  test("creates a fresh chapter without mutating its level data", () => {
    const state = createGameState(battleLevel);

    expect(state.phase).toBe("playing");
    expect(state.player.hp).toBe(8);
    expect(state.enemies).toHaveLength(1);
    expect(state.gates[0].open).toBe(false);
    expect(battleLevel.enemies[0].hp).toBe(2);
  });

  test("normalizes diagonal movement and preserves the previous state", () => {
    const state = createGameState(battleLevel);
    const moved = tickGame(state, { ...still, right: true, up: true }, 50);

    expect(moved).not.toBe(state);
    expect(state.player.x).toBe(0);
    expect(moved.player.x).toBeCloseTo(moved.player.z, 5);
    expect(Math.hypot(moved.player.x, moved.player.z)).toBeCloseTo(0.26, 2);
  });

  test("maps the upward control to the camera-forward world direction", () => {
    const state = createGameState(battleLevel);
    const forward = tickGame(state, { ...still, up: true }, 50);
    const backward = tickGame(state, { ...still, down: true }, 50);

    expect(forward.player.z).toBeGreaterThan(state.player.z);
    expect(forward.player.yaw).toBe(0);
    expect(backward.player.z).toBeLessThan(state.player.z);
  });

  test("guides toward the nearest active objective with distance and compass direction", () => {
    const level = {
      ...battleLevel,
      enemies: [
        { id: "far", position: { x: -5, y: 1, z: 8 }, hp: 2 },
        { id: "near", position: { x: 3, y: 1, z: 3 }, hp: 2 },
      ],
    };
    const state = createGameState(level);

    expect(getQuestTarget(state)).toEqual({
      id: "near",
      kind: "guardian",
      x: 3,
      z: 3,
      distance: 4.24,
      direction: "NE",
    });

    const cleared = {
      ...state,
      enemies: state.enemies.map((enemy) => ({ ...enemy, alive: false, hp: 0 })),
    };
    expect(getQuestTarget(cleared)?.kind).toBe("gate");
    expect(getQuestTarget(cleared)?.id).toBe("forest-gate");
  });

  test("reports pursuit, sword range, danger, and attack recharge", () => {
    const state = createGameState(battleLevel);
    expect(getCombatStatus(state)).toMatchObject({
      nearestEnemyId: "slime",
      threat: "engaged",
      threatLabel: "Sword range",
      inAttackRange: true,
      attackReady: true,
      attackChargePercent: 100,
    });

    const attacked = performAttack(state);
    expect(getCombatStatus(attacked)).toMatchObject({
      threat: "clear",
      threatLabel: "Realm secure",
      attackReady: false,
      attackCooldownMs: 420,
      attackChargePercent: 0,
    });

    const dangerState = createGameState({
      ...battleLevel,
      enemies: [{ id: "slime", position: { x: 0, y: 1, z: 1.4 }, hp: 2 }],
    });
    expect(getCombatStatus(dangerState).threat).toBe("danger");
  });

  test("attacks nearby enemies, records defeat, and opens the objective gate", () => {
    const state = createGameState(battleLevel);
    const attacked = performAttack(state);

    expect(attacked.enemies[0].alive).toBe(false);
    expect(attacked.defeatedEnemiesByLevel.forest).toEqual(["slime"]);
    expect(objectiveIsComplete(attacked)).toBe(true);

    let opening = attacked;
    for (let step = 0; step < 12; step += 1) opening = tickGame(opening, still, 50);
    expect(opening.gates[0].open).toBe(true);
    expect(opening.unlockedGates).toEqual(["forest-gate"]);
  });

  test("lets nearby enemies chase and damage the player with invulnerability frames", () => {
    const closeLevel = {
      ...battleLevel,
      enemies: [{ ...battleLevel.enemies[0], position: { x: 0, y: 1, z: 1.4 } }],
    };
    const state = createGameState(closeLevel);
    const struck = tickGame(state, still, 50);
    const protectedTick = tickGame(struck, still, 50);

    expect(struck.player.hp).toBe(7);
    expect(struck.player.invulnerableMs).toBeGreaterThan(0);
    expect(protectedTick.player.hp).toBe(7);
  });

  test("enters a defeated phase when an enemy deals the final hit", () => {
    const closeLevel = {
      ...battleLevel,
      enemies: [{ ...battleLevel.enemies[0], position: { x: 0, y: 1, z: 1.4 } }],
    };
    const state = createGameState(closeLevel);
    const defeated = tickGame({ ...state, player: { ...state.player, hp: 1 } }, still, 50);

    expect(defeated.player.hp).toBe(0);
    expect(defeated.phase).toBe("defeated");
    expect(defeated.lastEvent).toBe("The expedition has fallen");
  });

  test("collects treasure once and requests transition at an open nearby gate", () => {
    const state = createGameState(treasureLevel);
    const collected = performInteraction(state);

    expect(collected.state.inventory).toEqual(["silver-key"]);
    expect(collected.state.chests[0].collected).toBe(true);
    expect(getNearbyPrompt(collected.state)).toBeNull();

    let opened = collected.state;
    for (let step = 0; step < 12; step += 1) opened = tickGame(opened, still, 50);
    expect(getNearbyPrompt(opened)).toBe("Enter treasury-door");
    expect(performInteraction(opened).transitionRequested).toBe(true);
    expect(performInteraction(collected.state).state.inventory).toEqual(["silver-key"]);
  });

  test("carries the player on a moving platform and unlocks the terrain objective", () => {
    const state = createGameState(terrainLevel);
    const moved = tickGame(state, still, 50);

    expect(moved.platforms[0].x).toBeGreaterThan(state.platforms[0].x);
    expect(moved.player.x).toBeCloseTo(moved.platforms[0].x, 5);
    expect(moved.player.z).toBeCloseTo(moved.platforms[0].z, 5);
    expect(objectiveIsComplete(moved)).toBe(false);

    const collected = performInteraction(moved).state;
    expect(collected.inventory).toEqual(["bridge-pass"]);
    expect(objectiveIsComplete(collected)).toBe(true);
    expect(getObjective(collected)).toBe("Reach the Sky Exit.");
  });

  test("freezes simulation while paused", () => {
    const state = createGameState(battleLevel);
    const paused = togglePause(state);

    expect(paused.phase).toBe("paused");
    expect(tickGame(paused, { ...still, right: true }, 1000)).toBe(paused);
    expect(togglePause(paused).phase).toBe("playing");
  });

  test("round-trips valid saves and rejects malformed data", () => {
    const state = performAttack(createGameState(battleLevel));
    const save = createSave(state);

    expect(parseGameSave(save)).toEqual(save);
    expect(createGameState(battleLevel, save).enemies[0].alive).toBe(false);
    expect(parseGameSave({ ...save, playerStats: { hp: "many" } })).toBeNull();
    expect(parseGameSave({ ...save, inventory: [42] })).toBeNull();
  });

  test("renders an inspectable state snapshot", () => {
    const snapshot = JSON.parse(renderGameToText(createGameState(battleLevel)));

    expect(snapshot.coordinateSystem).toContain("3D world");
    expect(snapshot.phase).toBe("playing");
    expect(snapshot.enemies).toHaveLength(1);
    expect(snapshot.objective).toContain("1 remaining");
    expect(snapshot.questTarget).toMatchObject({ id: "slime", direction: "N" });
    expect(snapshot.combat).toMatchObject({ threat: "engaged", attackReady: true });
  });
});
