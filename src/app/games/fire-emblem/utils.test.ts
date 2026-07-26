import { describe, expect, test } from "bun:test";
import {
  ENEMY_STEP_MS,
  createInitialState,
  endPlayerPhase,
  getCombatForecast,
  getEnemyThreatTiles,
  getReachableTiles,
  handleBoardTap,
  restartGame,
  selectUnit,
  startBattle,
  tick,
  waitCurrentUnit,
} from "./utils";

describe("Fire Emblem rules", () => {
  test("starts a six-unit battle with the Lord selected", () => {
    const menu = createInitialState();
    const battle = startBattle(menu);

    expect(menu.mode).toBe("menu");
    expect(battle.mode).toBe("player");
    expect(battle.units.filter((unit) => unit.side === "ally")).toHaveLength(3);
    expect(battle.units.filter((unit) => unit.side === "enemy")).toHaveLength(3);
    expect(battle.selectedUnitId).toBe("lord");
  });

  test("respects terrain cost, walls, and occupied tiles", () => {
    const battle = startBattle(createInitialState());
    const reachable = getReachableTiles(battle, "lord");
    const keys = new Set(reachable.map((point) => `${point.x},${point.y}`));

    expect(keys.has("1,2")).toBe(true);
    expect(keys.has("1,1")).toBe(false);
    expect(keys.has("3,2")).toBe(false);
    expect(keys.has("2,6")).toBe(false);
  });

  test("moves, attacks, counterattacks, and advances unit selection", () => {
    const selected = selectUnit(startBattle(createInitialState()), "cavalier");
    const moved = handleBoardTap(selected, 3, 5);
    const attacked = handleBoardTap(moved, 3, 4);
    const cavalier = attacked.units.find((unit) => unit.id === "cavalier");
    const brigand = attacked.units.find((unit) => unit.id === "brigand");

    expect(moved.units.find((unit) => unit.id === "cavalier")?.hasMoved).toBe(true);
    expect(brigand?.hp).toBe(9);
    expect(cavalier?.hp).toBe(22);
    expect(cavalier?.hasActed).toBe(true);
    expect(attacked.selectedUnitId).toBe("archer");
  });

  test("forecasts damage, terrain defense, and counterattacks before committing", () => {
    const battle = selectUnit(startBattle(createInitialState()), "cavalier");
    const moved = handleBoardTap(battle, 3, 5);
    const forecast = getCombatForecast(moved, "cavalier", "brigand");

    expect(forecast).toEqual({
      attackerId: "cavalier",
      defenderId: "brigand",
      attackerDamage: 7,
      defenderDamage: 2,
      defenderCanCounter: true,
      attackerHpAfter: 22,
      defenderHpAfter: 9,
    });

    const archerState = {
      ...startBattle(createInitialState()),
      units: startBattle(createInitialState()).units.map((unit) =>
        unit.id === "archer" ? { ...unit, x: 3, y: 6 } : unit,
      ),
    };
    expect(getCombatForecast(archerState, "archer", "brigand")?.defenderCanCounter).toBe(false);
  });

  test("projects a bounded, deduplicated enemy threat field", () => {
    const threats = getEnemyThreatTiles(startBattle(createInitialState()));
    const keys = threats.map((point) => `${point.x},${point.y}`);

    expect(keys).toContain("1,6");
    expect(keys).not.toContain("3,2");
    expect(new Set(keys).size).toBe(keys.length);
    expect(threats.every((point) => point.x >= 0 && point.x < 8 && point.y >= 0 && point.y < 8)).toBe(true);
  });

  test("waiting every ally starts and resolves the enemy phase", () => {
    let state = startBattle(createInitialState());
    state = waitCurrentUnit(state);
    state = waitCurrentUnit(state);
    state = waitCurrentUnit(state);

    expect(state.mode).toBe("enemy");

    const nextTurn = tick(state, ENEMY_STEP_MS * 4);
    expect(nextTurn.mode).toBe("player");
    expect(nextTurn.turn).toBe(2);
    expect(nextTurn.selectedUnitId).toBe("lord");
    expect(nextTurn.units.filter((unit) => unit.side === "ally").every((unit) => !unit.hasActed)).toBe(true);
  });

  test("end phase marks allies done before enemy actions", () => {
    const enemyPhase = endPlayerPhase(startBattle(createInitialState()));

    expect(enemyPhase.mode).toBe("enemy");
    expect(enemyPhase.units.filter((unit) => unit.side === "ally").every((unit) => unit.hasActed)).toBe(true);
    expect(enemyPhase.enemyQueue).toEqual(["brigand", "mage", "boss"]);
  });

  test("defeating the boss produces victory and restart restores the menu", () => {
    const battle = startBattle(createInitialState());
    const staged = {
      ...selectUnit(battle, "cavalier"),
      units: battle.units.map((unit) =>
        unit.id === "boss" ? { ...unit, x: 3, y: 5, hp: 1 } : unit,
      ),
    };
    const moved = handleBoardTap(staged, 3, 6);
    const victory = handleBoardTap(moved, 3, 5);
    const restarted = restartGame();

    expect(victory.mode).toBe("victory");
    expect(victory.selectedUnitId).toBeNull();
    expect(restarted.mode).toBe("menu");
    expect(restarted.units.every((unit) => unit.alive)).toBe(true);
  });
});
