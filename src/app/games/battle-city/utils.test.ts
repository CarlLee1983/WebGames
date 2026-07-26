import { describe, expect, test } from "bun:test";
import {
  GameState,
  advanceStage,
  applyPowerUp,
  createInitialState,
  setPlayerInput,
  shootBullet,
  startGame,
  tick,
  togglePause,
} from "./utils";

const beginPlaying = () => tick(startGame(createInitialState()), 2001);

describe("Battle City rules", () => {
  test("starts in a three-life menu and deploys into stage one", () => {
    const initial = createInitialState();
    expect(initial.mode).toBe("menu");
    expect(initial.lives).toBe(3);
    expect(initial.enemyQueue).toHaveLength(8);

    const deployed = startGame(initial);
    expect(deployed.mode).toBe("stageStart");
    expect(tick(deployed, 2001).mode).toBe("playing");
  });

  test("spawns enemies inside the steel border without mutating the prior state", () => {
    const playing = beginPlaying();
    const originalQueue = [...playing.enemyQueue];
    const spawned = tick(playing, 17);

    expect(spawned.enemies).toHaveLength(1);
    expect(spawned.enemies[0].y).toBeGreaterThanOrEqual(16);
    // A newly spawned tank is also advanced by its 2 px movement step in this tick.
    expect(spawned.enemies[0].y).toBeLessThanOrEqual(34);
    expect(spawned.enemies[0].x).toBeGreaterThanOrEqual(16);
    expect(spawned.enemies[0].x).toBeLessThanOrEqual(368);
    const spawnGridX = Math.floor(spawned.enemies[0].x / 16);
    const spawnGridY = Math.floor(spawned.enemies[0].y / 16);
    const spawnEndX = Math.floor((spawned.enemies[0].x + 31.9) / 16);
    const spawnEndY = Math.floor((spawned.enemies[0].y + 31.9) / 16);
    for (let y = spawnGridY; y <= spawnEndY; y++) {
      for (let x = spawnGridX; x <= spawnEndX; x++) {
        expect([1, 2, 4]).not.toContain(spawned.mapGrid[y][x]);
      }
    }
    expect(spawned.enemyQueue).toHaveLength(7);
    expect(playing.enemyQueue).toEqual(originalQueue);
    expect(playing.enemies).toHaveLength(0);
  });

  test("moves, fires, and respects the shooting cooldown", () => {
    const playing = beginPlaying();
    const moving = tick(setPlayerInput(playing, "UP"), 17);
    expect(moving.player.direction).toBe("UP");
    expect(moving.player.y).toBeLessThan(playing.player.y);

    const fired = shootBullet(moving);
    expect(fired.bullets).toHaveLength(1);
    expect(fired.player.shootCooldown).toBeGreaterThan(0);
    expect(shootBullet(fired).bullets).toHaveLength(1);
  });

  test("freezes enemies temporarily without erasing their movement speed", () => {
    const emptyGrid = Array.from({ length: 26 }, () => Array<0>(26).fill(0));
    const base = beginPlaying();
    const frozen: GameState = {
      ...base,
      mapGrid: emptyGrid,
      brickHealth: emptyGrid.map((row) => row.map(() => 0)),
      enemyQueue: ["basic"],
      enemySpawnTimer: 9999,
      frozenTimer: 100,
      enemies: [{
        id: "enemy-test",
        x: 64,
        y: 64,
        direction: "RIGHT",
        speed: 2,
        health: 100,
        maxHealth: 100,
        shootCooldown: 0,
        bulletPower: 1,
        invincible: 0,
        type: "basic",
      }],
      enemyAIMap: {
        "enemy-test": {
          id: "enemy-test",
          state: "moving",
          stateTimer: 0,
          targetDir: "RIGHT",
          lastShotTime: 0,
        },
      },
    };

    const held = tick(frozen, 50);
    expect(held.enemies[0].x).toBe(64);
    expect(held.enemies[0].speed).toBe(2);

    const released = tick(held, 60);
    expect(released.frozenTimer).toBe(0);
    expect(released.enemies[0].x).toBeGreaterThan(64);
    expect(released.enemies[0].speed).toBe(2);
  });

  test("applies field upgrades and clears defeated enemy AI", () => {
    const base = beginPlaying();
    const centeredPowerUp = {
      x: base.player.x + 16,
      y: base.player.y + 16,
      blinkTimer: 0,
    };

    const upgraded = applyPowerUp({ ...base, powerUp: { ...centeredPowerUp, type: "star" } });
    expect(upgraded.player.level).toBe(2);
    expect(upgraded.player.bulletPower).toBe(2);
    expect(upgraded.score).toBe(500);

    const bombed = applyPowerUp({
      ...base,
      enemies: [{ ...base.player, id: "enemy-test", type: "basic" }],
      enemyAIMap: {
        "enemy-test": { id: "enemy-test", state: "moving", stateTimer: 0, targetDir: "DOWN", lastShotTime: 0 },
      },
      powerUp: { ...centeredPowerUp, type: "bomb" },
    });
    expect(bombed.enemies).toHaveLength(0);
    expect(bombed.enemyAIMap).toEqual({});

    const shielded = applyPowerUp({ ...base, powerUp: { ...centeredPowerUp, type: "shield" } });
    expect(shielded.player.shield).toBe(true);
    expect(shielded.powerUp).toBeNull();
  });

  test("consumes a shield before an enemy shell can damage armor", () => {
    const base = beginPlaying();
    const emptyGrid = Array.from({ length: 26 }, () => Array<0>(26).fill(0));
    const enemyBullet = {
      id: "enemy-shell",
      x: base.player.x + 16,
      y: base.player.y + 16,
      vx: 0,
      vy: 0,
      ownerId: "enemy-test",
      isPlayer: false,
      power: 1,
    };
    const target: GameState = {
      ...base,
      mapGrid: emptyGrid,
      brickHealth: emptyGrid.map((row) => row.map(() => 0)),
      player: { ...base.player, invincible: 0, shield: true },
      bullets: [enemyBullet],
      enemyQueue: ["basic"],
      enemySpawnTimer: 9999,
    };

    const absorbed = tick(target, 17);
    expect(absorbed.player.health).toBe(100);
    expect(absorbed.player.shield).toBe(false);
    expect(absorbed.player.invincible).toBeGreaterThan(0);
    expect(absorbed.bullets).toHaveLength(0);

    const damaged = tick({ ...target, player: { ...target.player, shield: false } }, 17);
    expect(damaged.player.health).toBe(50);
  });

  test("pauses safely and advances a completed stage with a fresh enemy wave", () => {
    const playing = beginPlaying();
    const paused = togglePause(playing);
    expect(paused.mode).toBe("paused");
    expect(tick(paused, 1000).mode).toBe("paused");
    expect(togglePause(paused).mode).toBe("playing");

    const completed = tick({ ...playing, enemies: [], enemyQueue: [] }, 17);
    expect(completed.mode).toBe("stageComplete");

    const nextStage = advanceStage(completed);
    expect(nextStage.mode).toBe("stageStart");
    expect(nextStage.stage).toBe(2);
    expect(nextStage.enemyQueue).toHaveLength(8);
    expect(nextStage.enemiesDefeated).toBe(0);
  });
});
