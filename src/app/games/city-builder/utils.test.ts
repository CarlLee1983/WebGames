import { describe, expect, test } from "bun:test";
import {
  GRID_COLS,
  GRID_ROWS,
  bulldoze,
  createInitialState,
  getCoverageCells,
  getCityRank,
  getPlacementError,
  parseCityState,
  placeBuilding,
  simulateTick,
  type BuildingType,
  type CityState,
} from "./utils";

function build(state: CityState, col: number, row: number, type: BuildingType) {
  return placeBuilding(state, col, row, type);
}

function buildServicedBlock() {
  let state = createInitialState();
  state = build(state, 5, 5, "road");
  state = build(state, 5, 6, "road");
  state = build(state, 4, 5, "power_plant");
  state = build(state, 4, 6, "water_pump");
  state = build(state, 6, 5, "residential");
  state = build(state, 6, 6, "commercial");
  state = build(state, 5, 7, "industrial");
  return state;
}

describe("City Builder rules", () => {
  test("starts with a 30 by 20 empty map and a road selected", () => {
    const state = createInitialState();

    expect(state.grid).toHaveLength(GRID_ROWS);
    expect(state.grid.every((row) => row.length === GRID_COLS)).toBe(true);
    expect(state.grid.flat().every((cell) => cell.type === "empty")).toBe(true);
    expect(state.money).toBe(5000);
    expect(state.selectedTool).toBe("road");
  });

  test("reports placement errors and leaves rejected builds unchanged", () => {
    const initial = createInitialState();
    expect(getPlacementError(initial, -1, 0, "road")).toContain("超出");
    expect(getPlacementError(initial, 0, 0, "empty")).toContain("選擇");

    const road = build(initial, 0, 0, "road");
    expect(road).not.toBe(initial);
    expect(initial.grid[0][0].type).toBe("empty");
    expect(road.grid[0][0].type).toBe("road");
    expect(road.money).toBe(4990);
    expect(getPlacementError(road, 0, 0, "residential")).toContain("已有");

    const broke = { ...initial, money: 9 };
    expect(getPlacementError(broke, 1, 1, "road")).toContain("不足");
    expect(placeBuilding(broke, 1, 1, "road")).toBe(broke);
  });

  test("describes bounded utility and park coverage footprints", () => {
    const power = getCoverageCells("power_plant", 10, 10);
    const park = getCoverageCells("park", 10, 10);
    const cornerWater = getCoverageCells("water_pump", 0, 0);

    expect(power).toHaveLength(81);
    expect(power).toContainEqual({ col: 15, row: 10 });
    expect(power).not.toContainEqual({ col: 16, row: 10 });
    expect(park).toHaveLength(25);
    expect(park).toContainEqual({ col: 12, row: 12 });
    expect(cornerWater.every(({ col, row }) => col >= 0 && row >= 0 && col < GRID_COLS && row < GRID_ROWS)).toBe(true);
  });

  test("refreshes road and utility service as soon as construction changes", () => {
    let state = createInitialState();
    state = build(state, 5, 5, "road");
    state = build(state, 6, 5, "residential");

    expect(state.grid[5][6].connectedToRoad).toBe(true);
    expect(state.grid[5][6].powered).toBe(false);
    expect(state.grid[5][6].hasWater).toBe(false);

    state = build(state, 4, 5, "power_plant");
    state = build(state, 4, 6, "water_pump");
    expect(state.grid[5][6]).toMatchObject({ connectedToRoad: true, powered: true, hasWater: true });
    expect(state.power).toBe(200);
    expect(state.water).toBe(150);
    expect(state.powerUsage).toBe(2);
    expect(state.waterUsage).toBe(2);

    state = bulldoze(state, 4, 5);
    expect(state.grid[5][6].powered).toBe(false);
    expect(state.power).toBe(0);
  });

  test("bulldozing refunds half the build cost and records the action", () => {
    const built = build(createInitialState(), 3, 3, "industrial");
    const removed = bulldoze(built, 3, 3);

    expect(removed.grid[3][3].type).toBe("empty");
    expect(removed.money).toBe(built.money + 50);
    expect(removed.notifications.at(-1)?.message).toContain("回收 $50");
  });

  test("treats every road-adjacent district as reachable in the open sandbox", () => {
    let state = createInitialState();
    state = build(state, 1, 1, "road");
    state = build(state, 2, 1, "residential");
    state = build(state, 20, 10, "road");
    state = build(state, 21, 10, "commercial");

    const ticked = simulateTick(state);
    expect(ticked.grid[1][2].connectedToRoad).toBe(true);
    expect(ticked.grid[10][21].connectedToRoad).toBe(true);
  });

  test("grows a fully serviced residential district", () => {
    const ticked = simulateTick(buildServicedBlock());
    const residential = ticked.grid[5][6];

    expect(residential.connectedToRoad).toBe(true);
    expect(residential.powered).toBe(true);
    expect(residential.hasWater).toBe(true);
    expect(residential.population).toBe(5);
    expect(ticked.population).toBe(5);
    expect(ticked.power).toBe(200);
    expect(ticked.water).toBe(150);
  });

  test("active commercial and industrial districts generate stable revenue", () => {
    const ticked = simulateTick(buildServicedBlock());

    expect(ticked.grid[6][6].connectedToRoad).toBe(true);
    expect(ticked.grid[7][5].connectedToRoad).toBe(true);
    expect(ticked.income).toBe(125);
    expect(ticked.expenses).toBe(115);
    expect(ticked.money).toBe(5000 - 750 + 10);
  });

  test("does not advance while paused", () => {
    const paused = { ...createInitialState(), gameSpeed: "paused" as const };
    expect(simulateTick(paused)).toBe(paused);
  });

  test("reports city rank thresholds", () => {
    const initial = createInitialState();
    expect(getCityRank(initial)).toEqual({ name: "Settlement", nextPopulation: 25 });
    expect(getCityRank({ ...initial, population: 25 }).name).toBe("Village");
    expect(getCityRank({ ...initial, population: 100 }).name).toBe("Town");
    expect(getCityRank({ ...initial, population: 250 }).name).toBe("City");
    expect(getCityRank({ ...initial, population: 500 })).toEqual({ name: "Metropolis", nextPopulation: null });
  });

  test("accepts valid saves and rejects malformed or unknown city data", () => {
    const valid = createInitialState();
    expect(parseCityState(valid)).toBe(valid);
    expect(parseCityState({ ...valid, money: Number.NaN })).toBeNull();
    expect(parseCityState({ ...valid, grid: [] })).toBeNull();

    const unknown = createInitialState();
    unknown.grid[0][0] = { ...unknown.grid[0][0], type: "castle" as BuildingType };
    expect(parseCityState(unknown)).toBeNull();

    const incompleteCell = createInitialState() as unknown as { grid: unknown[][] };
    incompleteCell.grid[0][0] = { type: "road" };
    expect(parseCityState(incompleteCell)).toBeNull();
  });
});
