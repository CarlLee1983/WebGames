import { describe, expect, test } from 'bun:test';
import {
  BASE_SPAWN_RATE,
  MIN_SPAWN_RATE,
  calculateCrushPoints,
  createInitialGameState,
  getSpawnRate,
  getStackPreview,
  isInsideBucketCaptureZone,
  loseLife,
  renderGameToText,
  selectItemType,
} from './utils';

describe('Ice Blocks rules', () => {
  test('starts a clean three-life run', () => {
    const state = createInitialGameState(900);

    expect(state.mode).toBe('start');
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
    expect(state.highScore).toBe(900);
  });

  test('rewards quadratic combos and gold bonuses', () => {
    expect(calculateCrushPoints(1, 0)).toEqual({
      comboPoints: 10,
      goldPoints: 0,
      total: 10,
    });
    expect(calculateCrushPoints(5, 2).total).toBe(1250);
    expect(calculateCrushPoints(0, 3).total).toBe(0);
  });

  test('previews only catchable blocks in the current crush stack', () => {
    expect(getStackPreview(['ice', 'gold', 'fire', 'ice'])).toEqual({
      blockCount: 3,
      goldCount: 1,
      projectedPoints: 590,
    });
    expect(getStackPreview(['fire'])).toEqual({
      blockCount: 0,
      goldCount: 0,
      projectedPoints: 0,
    });
  });

  test('only counts block centers that are actually inside the bucket capture zone', () => {
    const zone = [200, 560, 150, 100, 16] as const;

    expect(isInsideBucketCaptureZone(200, 520, ...zone)).toBe(true);
    expect(isInsideBucketCaptureZone(267, 460, ...zone)).toBe(true);
    expect(isInsideBucketCaptureZone(268, 520, ...zone)).toBe(false);
    expect(isInsideBucketCaptureZone(200, 459, ...zone)).toBe(false);
    expect(isInsideBucketCaptureZone(200, 611, ...zone)).toBe(false);
  });

  test('accelerates spawning without exceeding the cap', () => {
    expect(getSpawnRate(0)).toBe(BASE_SPAWN_RATE);
    expect(getSpawnRate(2_500)).toBe(75);
    expect(getSpawnRate(100_000)).toBe(MIN_SPAWN_RATE);
  });

  test('maps the documented drop probabilities', () => {
    expect(selectItemType(0.5)).toBe('ice');
    expect(selectItemType(0.83)).toBe('fire');
    expect(selectItemType(0.96)).toBe('gold');
  });

  test('ends the run on the final life and records the best score', () => {
    const playing = {
      ...createInitialGameState(700),
      mode: 'playing' as const,
      score: 1_250,
      lives: 1,
      stack: getStackPreview(['ice', 'gold']),
    };
    const gameOver = loseLife(playing);

    expect(gameOver.lives).toBe(0);
    expect(gameOver.mode).toBe('gameOver');
    expect(gameOver.highScore).toBe(1_250);
    expect(gameOver.stack).toEqual({ blockCount: 0, goldCount: 0, projectedPoints: 0 });
  });

  test('renders score pressure, bucket position, stack value, and active drops', () => {
    const state = {
      ...createInitialGameState(900),
      mode: 'playing' as const,
      score: 2_500,
      stack: getStackPreview(['ice', 'gold']),
    };
    const rendered = JSON.parse(renderGameToText(state, 187.6, ['ice', 'gold', 'fire']));

    expect(rendered.bucketX).toBe(188);
    expect(rendered.spawnRate).toBe(75);
    expect(rendered.stack).toEqual({ blockCount: 2, goldCount: 1, projectedPoints: 540 });
    expect(rendered.activeItems).toEqual({ ice: 1, gold: 1, fire: 1 });
  });
});
