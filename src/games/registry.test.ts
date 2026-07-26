import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  GAME_REGISTRY,
  getPlannedGames,
  getPlayableGames,
  getPublishedGames,
  isPlayableStatus,
} from "./registry";

function parseFrontmatter(record: string) {
  const match = /^---\n([\s\S]*?)\n---/.exec(record);
  if (!match) throw new Error("Verification record is missing frontmatter");

  return Object.fromEntries(
    match[1]
      .split("\n")
      .filter((line) => line && !line.startsWith(" "))
      .map((line) => {
        const separator = line.indexOf(":");
        return [line.slice(0, separator), line.slice(separator + 1).trim()];
      }),
  );
}

describe("game registry readiness", () => {
  test("requires an explicit quality-verification value for every game", () => {
    for (const game of GAME_REGISTRY) {
      expect(Object.hasOwn(game, "qualityVerification")).toBe(true);
    }
  });

  test("makes beta a playable release stage", () => {
    expect(isPlayableStatus("beta")).toBe(true);
    expect(isPlayableStatus("published")).toBe(true);
    expect(isPlayableStatus("planned")).toBe(false);
  });

  test("matches every quality summary to its verification record", () => {
    for (const game of GAME_REGISTRY) {
      if (!game.qualityVerification) continue;

      const summary = game.qualityVerification;
      const record = readFileSync(resolve(process.cwd(), summary.record), "utf8");
      const frontmatter = parseFrontmatter(record);

      expect(frontmatter.game).toBe(game.id);
      expect(frontmatter.result).toBe(summary.result);
      expect(Number(frontmatter.baselineVersion)).toBe(summary.baselineVersion);
      expect(frontmatter.revision).toBe(summary.revision);
      expect(frontmatter.verifiedAt).toBe(summary.verifiedAt);
    }
  });

  test("publishes Puzzle Bobble with revision-bound quality evidence", () => {
    const puzzleBobble = GAME_REGISTRY.find((game) => game.id === "puzzle-bobble");

    expect(puzzleBobble).toMatchObject({
      status: "published",
      qualityVerification: {
        result: "passed",
        baselineVersion: 1,
        revision: "5cfc09cde365c927f7b4b00eef7abc1d744c5e66",
        verifiedAt: "2026-07-26",
        record: "docs/Games/verification/puzzle-bobble/2026-07-26-v1.md",
      },
    });
    expect(getPlayableGames()).toContain(puzzleBobble);
    expect(getPublishedGames()).toContain(puzzleBobble);
    expect(getPlannedGames()).not.toContain(puzzleBobble);
  });
});
