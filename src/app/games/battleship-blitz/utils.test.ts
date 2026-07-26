import { describe, expect, test } from "bun:test";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getMissionTelemetry,
  renderGameStateText,
  restartGame,
  sanitizeBestScore,
  startGame,
  togglePause,
  updateGameState,
} from "./utils";

const idleInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  pause: false,
};

describe("Battleship Blitz rules", () => {
  test("starts a fresh three-life run", () => {
    const state = startGame();

    expect(state.mode).toBe("playing");
    expect(state.score).toBe(0);
    expect(state.wave).toBe(1);
    expect(state.lives).toBe(3);
    expect(state.player.health).toBe(state.player.maxHealth);
  });

  test("clamps keyboard and touch movement to the flight zone", () => {
    const state = {
      ...startGame(),
      player: { ...startGame().player, x: 0, y: CANVAS_HEIGHT * 0.4 },
    };
    const keyboard = updateGameState(
      state,
      { ...idleInput, left: true, up: true },
      1,
    );
    const touch = updateGameState(
      state,
      { ...idleInput, touchX: CANVAS_WIDTH * 2, touchY: CANVAS_HEIGHT * 2 },
      0,
    );

    expect(keyboard.player.x).toBe(0);
    expect(keyboard.player.y).toBe(CANVAS_HEIGHT * 0.4);
    expect(touch.player.x + touch.player.width).toBe(CANVAS_WIDTH);
    expect(touch.player.y + touch.player.height).toBe(CANVAS_HEIGHT);
  });

  test("fires immediately and respects the weapon cooldown", () => {
    const state = startGame();
    const fired = updateGameState(state, { ...idleInput, shoot: true }, 0);
    const held = updateGameState(fired, { ...idleInput, shoot: true }, 0.05);

    expect(fired.playerBullets).toHaveLength(1);
    expect(fired.player.shootCooldown).toBeCloseTo(0.12);
    expect(held.playerBullets).toHaveLength(1);
  });

  test("does not mutate the previous player when collecting a weapon", () => {
    const state = startGame();
    const originalPlayer = state.player;
    const withPowerUp = {
      ...state,
      powerUps: [
        {
          x: state.player.x,
          y: state.player.y,
          width: 12,
          height: 12,
          type: "weapon_blaster" as const,
          vy: 0,
        },
      ],
    };
    const collected = updateGameState(withPowerUp, idleInput, 0);

    expect(originalPlayer.weaponLevel).toBe(1);
    expect(collected.player.weaponLevel).toBe(2);
    expect(collected.player).not.toBe(originalPlayer);
  });

  test("freezes while paused and restart restores a clean run", () => {
    const playing = { ...startGame(), score: 900, wave: 4 };
    const paused = togglePause(playing);
    const frozen = updateGameState(paused, { ...idleInput, shoot: true }, 1);
    const restarted = restartGame();

    expect(frozen).toBe(paused);
    expect(togglePause(paused).mode).toBe("playing");
    expect(restarted.score).toBe(0);
    expect(restarted.wave).toBe(1);
  });

  test("freezes simulation after game over", () => {
    const ended = {
      ...startGame(),
      mode: "gameOver" as const,
      score: 4200,
      time: 18,
    };

    expect(updateGameState(ended, { ...idleInput, shoot: true }, 1)).toBe(ended);
  });

  test("removes enemy projectiles after they leave the top edge", () => {
    const state = {
      ...startGame(),
      enemyBullets: [
        {
          x: CANVAS_WIDTH / 2,
          y: -30,
          vx: 0,
          vy: -180,
          width: 6,
          height: 6,
          damage: 10,
          isPlayerBullet: false,
        },
      ],
    };
    const next = updateGameState(state, idleInput, 0);

    expect(next.enemyBullets).toHaveLength(0);
  });

  test("reports boss cadence, rank, and battlefield pressure", () => {
    const state = {
      ...startGame(),
      score: 9000,
      wave: 4,
      enemies: Array.from({ length: 4 }, (_, index) => ({
        x: index * 30,
        y: 100,
        width: 20,
        height: 20,
        vx: 0,
        vy: 0,
        health: 30,
        maxHealth: 30,
        shootCooldown: 1,
        type: "basic" as const,
      })),
    };
    const telemetry = getMissionTelemetry(state);

    expect(telemetry).toEqual({ rank: "Ace", threat: "Engaged", sectorStep: 4, bossIn: 1 });
    expect(getMissionTelemetry({ ...state, wave: 5, bossActive: true }).threat).toBe("Boss");
  });

  test("sanitizes records and renders stable inspectable state", () => {
    const state = { ...startGame(), score: 3200, wave: 2 };
    const rendered = JSON.parse(renderGameStateText(state, 8123.9));

    expect(sanitizeBestScore(-4)).toBe(0);
    expect(sanitizeBestScore(Number.NaN)).toBe(0);
    expect(rendered.bestScore).toBe(8123);
    expect(rendered.rank).toBe("Wingman");
    expect(rendered.bossIn).toBe(3);
    expect(rendered.player.weapon).toBe("blaster");
  });
});
