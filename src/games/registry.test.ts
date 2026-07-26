import { describe, expect, test } from "bun:test";

import {
  GAME_REGISTRY,
  getPlannedGames,
  getPlayableGames,
  getPublishedGames,
} from "./registry";

describe("game registry readiness", () => {
  test("requires an explicit quality-verification value for every game", () => {
    for (const game of GAME_REGISTRY) {
      expect(Object.hasOwn(game, "qualityVerification")).toBe(true);
    }
  });

  test("makes beta games playable without treating them as published or planned", () => {
    const puzzleBobble = GAME_REGISTRY.find((game) => game.id === "puzzle-bobble");

    expect(puzzleBobble).toMatchObject({
      status: "beta",
      qualityVerification: null,
    });
    expect(getPlayableGames()).toContain(puzzleBobble);
    expect(getPublishedGames()).not.toContain(puzzleBobble);
    expect(getPlannedGames()).not.toContain(puzzleBobble);
  });
});
