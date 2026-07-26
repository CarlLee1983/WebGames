import { describe, expect, test } from "bun:test";
import {
  CROP_DEFS,
  TRADE_CYCLE_MS,
  createInitialState,
  farmStateToRows,
  fulfillTradeRequest,
  getUnlockLevelForPlot,
  harvestPlot,
  migrateSave,
  moveFarmFocus,
  refreshTradeRequest,
  seedPlot,
  sellCrop,
  tillPlot,
  waterPlot,
} from "./utils";

const SUMMER_NOW = new Date(2026, 6, 1, 12, 0, 0).getTime();
const SPRING_NOW = new Date(2026, 3, 1, 12, 0, 0).getTime();

describe("farm progression", () => {
  test("starts with a 3 by 3 field and unlocks larger squares by level", () => {
    const state = createInitialState(SUMMER_NOW);

    expect(state.plots.filter((plot) => plot.isUnlocked)).toHaveLength(9);
    expect(getUnlockLevelForPlot(0)).toBe(1);
    expect(getUnlockLevelForPlot(21)).toBe(2);
    expect(getUnlockLevelForPlot(35)).toBe(4);

    const readyToLevel = {
      ...state,
      player: { ...state.player, xp: 80, level: 1 },
      plots: state.plots.map((plot) =>
        plot.id === 0
          ? { ...plot, cropId: "carrot", status: "ready" as const }
          : plot,
      ),
    };
    const levelTwo = harvestPlot(readyToLevel, 0, SUMMER_NOW);

    expect(levelTwo.player.level).toBe(2);
    expect(levelTwo.plots.filter((plot) => plot.isUnlocked)).toHaveLength(16);
  });

  test("charges for seeds even when harvested produce is in inventory", () => {
    const initial = createInitialState(SUMMER_NOW);
    const withProduce = {
      ...initial,
      inventory: { carrot: 3 },
    };
    const tilled = tillPlot(withProduce, 0);
    const planted = seedPlot(tilled, 0, "carrot", SUMMER_NOW);

    expect(planted.player.coins).toBe(95);
    expect(planted.inventory.carrot).toBe(3);
    expect(planted.plots[0].status).toBe("seeded");
  });

  test("only plants crops that are in season", () => {
    const summerPlot = tillPlot(createInitialState(SUMMER_NOW), 0);
    const blocked = seedPlot(summerPlot, 0, "strawberry", SUMMER_NOW);
    expect(blocked).toBe(summerPlot);

    const springPlot = tillPlot(createInitialState(SPRING_NOW), 0);
    const planted = seedPlot(springPlot, 0, "strawberry", SPRING_NOW);
    expect(planted.plots[0].cropId).toBe("strawberry");
  });

  test("keeps harvest rewards and produce sales as separate steps", () => {
    const crop = CROP_DEFS.carrot;
    let state = tillPlot(createInitialState(SUMMER_NOW), 0);
    state = seedPlot(state, 0, crop.id, SUMMER_NOW);

    for (let water = 0; water < crop.waterNeeded; water += 1) {
      const at = SUMMER_NOW + water * crop.growthHours * 60 * 60 * 1000;
      state = waterPlot(state, 0, at);
    }

    expect(state.plots[0].status).toBe("ready");
    state = harvestPlot(state, 0, SUMMER_NOW + 8 * 60 * 60 * 1000);
    expect(state.player.coins).toBe(95);
    expect(state.player.xp).toBe(20);
    expect(state.inventory.carrot).toBe(1);

    state = sellCrop(state, crop.id, 1);
    expect(state.player.coins).toBe(110);
    expect(state.inventory.carrot).toBe(0);
  });

  test("falls back safely when a save has the wrong shape", () => {
    const migrated = migrateSave({ version: 1, plots: [] });
    expect(migrated.plots).toHaveLength(36);
    expect(migrated.player.coins).toBe(100);
  });

  test("creates one deterministic in-season market order per trade cycle", () => {
    const initial = createInitialState(SUMMER_NOW);
    const ordered = refreshTradeRequest(initial, SUMMER_NOW);

    expect(ordered.activeTradeRequest?.cropId).toBe("carrot");
    expect(ordered.activeTradeRequest?.quantity).toBeGreaterThanOrEqual(2);
    expect(ordered.activeTradeRequest?.reward).toBeGreaterThan(
      CROP_DEFS.carrot.sellPrice * (ordered.activeTradeRequest?.quantity ?? 0),
    );
    expect(refreshTradeRequest(ordered, SUMMER_NOW + 1000)).toBe(ordered);
    expect(initial.activeTradeRequest).toBeNull();
  });

  test("fulfills a stocked order once and waits for the next cycle", () => {
    const ordered = refreshTradeRequest(createInitialState(SUMMER_NOW), SUMMER_NOW);
    const request = ordered.activeTradeRequest!;
    expect(fulfillTradeRequest(ordered, SUMMER_NOW)).toBe(ordered);

    const stocked = {
      ...ordered,
      inventory: { [request.cropId]: request.quantity + 1 },
    };
    const completed = fulfillTradeRequest(stocked, SUMMER_NOW);

    expect(completed.activeTradeRequest).toBeNull();
    expect(completed.inventory[request.cropId]).toBe(1);
    expect(completed.player.coins).toBe(stocked.player.coins + request.reward);
    expect(completed.achievements.marketOrders).toBe(1);
    expect(refreshTradeRequest(completed, SUMMER_NOW)).toBe(completed);

    const nextCycle = refreshTradeRequest(completed, SUMMER_NOW + TRADE_CYCLE_MS);
    expect(nextCycle.activeTradeRequest).not.toBeNull();
  });

  test("moves one roving farm focus within row and field boundaries", () => {
    expect(moveFarmFocus(0, "ArrowLeft")).toBe(0);
    expect(moveFarmFocus(0, "ArrowUp")).toBe(0);
    expect(moveFarmFocus(0, "ArrowRight")).toBe(1);
    expect(moveFarmFocus(0, "ArrowDown")).toBe(6);
    expect(moveFarmFocus(14, "Home")).toBe(12);
    expect(moveFarmFocus(14, "End")).toBe(17);
    expect(moveFarmFocus(35, "ArrowDown")).toBe(35);
  });

  test("renders a stable text field with locked plots distinguished", () => {
    const initial = createInitialState(SUMMER_NOW);
    const tilled = tillPlot(initial, 0);

    expect(farmStateToRows(tilled)).toEqual([
      "T..###",
      "...###",
      "...###",
      "######",
      "######",
      "######",
    ]);
  });
});
