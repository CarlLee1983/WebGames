export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 640;

export const COLS = 8;
export const ROWS = 8;
export const TILE_SIZE = 64;
export const BOARD_LEFT = 40;
export const BOARD_TOP = 88;
export const BOARD_WIDTH = COLS * TILE_SIZE;
export const BOARD_HEIGHT = ROWS * TILE_SIZE;
export const PANEL_LEFT = BOARD_LEFT + BOARD_WIDTH + 24;
export const PANEL_TOP = 88;
export const PANEL_WIDTH = CANVAS_WIDTH - PANEL_LEFT - 40;

export const ENEMY_STEP_MS = 480;

export type GameMode = "menu" | "player" | "enemy" | "victory" | "defeat";
export type Side = "ally" | "enemy";
export type Terrain = "plain" | "forest" | "fort" | "wall" | "throne";

export interface Unit {
  id: string;
  name: string;
  className: string;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  move: number;
  attackMin: number;
  attackMax: number;
  attack: number;
  defense: number;
  color: string;
  emblem: string;
  boss?: boolean;
  lord?: boolean;
  alive: boolean;
  hasMoved: boolean;
  hasActed: boolean;
}

export interface GameState {
  mode: GameMode;
  turn: number;
  message: string;
  units: Unit[];
  selectedUnitId: string | null;
  enemyQueue: string[];
  enemyIndex: number;
  phaseTimer: number;
}

type Point = { x: number; y: number };

const TERRAIN_MAP: Terrain[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "forest", "plain", "plain", "plain", "plain", "throne", "plain"],
  ["plain", "plain", "plain", "wall", "wall", "plain", "plain", "plain"],
  ["plain", "plain", "forest", "wall", "wall", "forest", "plain", "plain"],
  ["plain", "plain", "forest", "plain", "plain", "forest", "plain", "plain"],
  ["plain", "fort", "plain", "plain", "plain", "plain", "forest", "plain"],
  ["plain", "plain", "plain", "plain", "forest", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

function cloneUnits(units: Unit[]): Unit[] {
  return units.map((unit) => ({ ...unit }));
}

function createUnit(unit: Omit<Unit, "alive" | "hasMoved" | "hasActed">): Unit {
  return {
    ...unit,
    alive: true,
    hasMoved: false,
    hasActed: false,
  };
}

export function createInitialState(): GameState {
  return {
    mode: "menu",
    turn: 1,
    message: "The kingdom stands at the edge of war. Lead your squad to the throne.",
    units: cloneUnits([
      createUnit({
        id: "lord",
        name: "Lord",
        className: "Lord",
        side: "ally",
        x: 1,
        y: 6,
        hp: 20,
        maxHp: 20,
        move: 5,
        attackMin: 1,
        attackMax: 1,
        attack: 7,
        defense: 2,
        color: "#fbbf24",
        emblem: "L",
        lord: true,
      }),
      createUnit({
        id: "cavalier",
        name: "Cavalier",
        className: "Cavalier",
        side: "ally",
        x: 2,
        y: 6,
        hp: 24,
        maxHp: 24,
        move: 6,
        attackMin: 1,
        attackMax: 1,
        attack: 8,
        defense: 4,
        color: "#60a5fa",
        emblem: "C",
      }),
      createUnit({
        id: "archer",
        name: "Archer",
        className: "Archer",
        side: "ally",
        x: 0,
        y: 7,
        hp: 16,
        maxHp: 16,
        move: 5,
        attackMin: 2,
        attackMax: 3,
        attack: 6,
        defense: 1,
        color: "#34d399",
        emblem: "A",
      }),
      createUnit({
        id: "brigand",
        name: "Brigand",
        className: "Brigand",
        side: "enemy",
        x: 3,
        y: 4,
        hp: 16,
        maxHp: 16,
        move: 4,
        attackMin: 1,
        attackMax: 1,
        attack: 6,
        defense: 1,
        color: "#fb7185",
        emblem: "B",
      }),
      createUnit({
        id: "mage",
        name: "Mage",
        className: "Mage",
        side: "enemy",
        x: 6,
        y: 2,
        hp: 14,
        maxHp: 14,
        move: 4,
        attackMin: 1,
        attackMax: 2,
        attack: 7,
        defense: 0,
        color: "#c084fc",
        emblem: "M",
      }),
      createUnit({
        id: "boss",
        name: "Dread Lord",
        className: "Boss",
        side: "enemy",
        x: 6,
        y: 0,
        hp: 28,
        maxHp: 28,
        move: 5,
        attackMin: 1,
        attackMax: 1,
        attack: 9,
        defense: 3,
        color: "#f97316",
        emblem: "X",
        boss: true,
      }),
    ]),
    selectedUnitId: null,
    enemyQueue: [],
    enemyIndex: 0,
    phaseTimer: 0,
  };
}

export function restartGame(): GameState {
  return createInitialState();
}

export function startBattle(state: GameState): GameState {
  const units = cloneUnits(state.units);
  resetTurnFlags(units);

  const next = {
    ...state,
    mode: "player" as const,
    turn: 1,
    message: "Player phase. Move the Lord to break the siege.",
    units,
    selectedUnitId: getNextAllyId(units, null),
    enemyQueue: [],
    enemyIndex: 0,
    phaseTimer: 0,
  };

  return next;
}

function resetTurnFlags(units: Unit[]) {
  units.forEach((unit) => {
    if (!unit.alive) return;
    unit.hasMoved = false;
    unit.hasActed = false;
  });
}

function getUnitById(state: GameState, unitId: string | null) {
  if (!unitId) return null;
  return state.units.find((unit) => unit.id === unitId) ?? null;
}

function getUnitAt(state: GameState, x: number, y: number) {
  return state.units.find((unit) => unit.alive && unit.x === x && unit.y === y) ?? null;
}

function inBounds(x: number, y: number) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function terrainAt(x: number, y: number): Terrain {
  return TERRAIN_MAP[y]?.[x] ?? "plain";
}

function terrainDefense(terrain: Terrain) {
  switch (terrain) {
    case "forest":
      return 1;
    case "fort":
      return 2;
    case "throne":
      return 3;
    default:
      return 0;
  }
}

function terrainMoveCost(terrain: Terrain): number {
  switch (terrain) {
    case "forest":
      return 2; // 森林：消耗 2 移動力
    case "fort":
      return 1; // 堡壘：正常移動
    case "throne":
      return 1; // 王座：正常移動
    case "wall":
      return Infinity; // 城牆：不可通行
    default:
      return 1; // 平地：正常移動
  }
}

function isPassable(x: number, y: number) {
  return inBounds(x, y) && terrainAt(x, y) !== "wall";
}

function getOccupiedKey(unit: Unit) {
  return `${unit.x},${unit.y}`;
}

function getOccupiedSet(state: GameState, ignoreUnitId?: string) {
  const occupied = new Set<string>();
  state.units.forEach((unit) => {
    if (!unit.alive || unit.id === ignoreUnitId) return;
    occupied.add(getOccupiedKey(unit));
  });
  return occupied;
}

function keyOf(point: Point) {
  return `${point.x},${point.y}`;
}

function getNextAllyId(units: Unit[], afterId: string | null) {
  const allies = units.filter((unit) => unit.alive && unit.side === "ally");
  if (allies.length === 0) return null;

  if (!afterId) {
    return allies[0]?.id ?? null;
  }

  const currentIndex = allies.findIndex((unit) => unit.id === afterId);
  for (let i = currentIndex + 1; i < allies.length; i += 1) {
    if (!allies[i].hasActed) return allies[i].id;
  }
  return null;
}

function startEnemyPhase(state: GameState): GameState {
  const enemyQueue = state.units
    .filter((unit) => unit.alive && unit.side === "enemy")
    .map((unit) => unit.id);

  return {
    ...state,
    mode: "enemy",
    selectedUnitId: null,
    enemyQueue,
    enemyIndex: 0,
    phaseTimer: 0,
    message: "Enemy phase. The hostiles surge forward.",
  };
}

function startPlayerPhase(state: GameState, turn = state.turn + 1): GameState {
  const units = cloneUnits(state.units);
  resetTurnFlags(units);

  return {
    ...state,
    mode: "player",
    turn,
    units,
    selectedUnitId: getNextAllyId(units, null),
    enemyQueue: [],
    enemyIndex: 0,
    phaseTimer: 0,
    message: "Player phase. Advance the Lord and protect the line.",
  };
}

export function boardToRows(): string[] {
  return TERRAIN_MAP.map((row) =>
    row
      .map((terrain) => {
        switch (terrain) {
          case "forest":
            return "f";
          case "fort":
            return "o";
          case "wall":
            return "#";
          case "throne":
            return "t";
          default:
            return ".";
        }
      })
      .join(""),
  );
}

export function getReachableTiles(state: GameState, unitId: string | null): Point[] {
  const unit = getUnitById(state, unitId);
  if (!unit || !unit.alive || unit.hasMoved) return [];

  const occupied = getOccupiedSet(state, unit.id);
  const queue: Array<{ x: number; y: number; remaining: number }> = [{ x: unit.x, y: unit.y, remaining: unit.move }];
  // 追蹤每格的最大剩餘移動力，以支援 Dijkstra 風格的最優性
  const bestRemaining = new Map<string, number>();
  bestRemaining.set(keyOf(unit), unit.move);
  const reachable: Point[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    reachable.push({ x: current.x, y: current.y });
    if (current.remaining <= 0) continue;

    [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].forEach((dir) => {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (!isPassable(next.x, next.y)) return;
      if (occupied.has(keyOf(next))) return;

      const terrain = terrainAt(next.x, next.y);
      const cost = terrainMoveCost(terrain);
      const newRemaining = current.remaining - cost;

      if (newRemaining < 0) return; // 移動力不足

      const nextKey = keyOf(next);
      const prevBest = bestRemaining.get(nextKey) ?? -1;

      // 只在有更多剩餘移動力時入隊
      if (newRemaining > prevBest) {
        bestRemaining.set(nextKey, newRemaining);
        queue.push({ x: next.x, y: next.y, remaining: newRemaining });
      }
    });
  }

  return reachable;
}

export function getAttackTargets(state: GameState, unitId: string | null): Unit[] {
  const unit = getUnitById(state, unitId);
  if (!unit || !unit.alive || unit.hasActed) return [];

  return state.units.filter((target) => {
    if (!target.alive || target.side === unit.side) return false;
    const distance = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
    return distance >= unit.attackMin && distance <= unit.attackMax;
  });
}

function damageTo(attacker: Unit, defender: Unit): number {
  const terrainBonus = terrainDefense(terrainAt(defender.x, defender.y));
  return Math.max(1, attacker.attack - defender.defense - terrainBonus);
}

function applyDamage(units: Unit[], attacker: Unit, defender: Unit) {
  const nextUnits = cloneUnits(units);
  const target = nextUnits.find((unit) => unit.id === defender.id);
  if (!target || !target.alive) return nextUnits;

  const damage = damageTo(attacker, target);
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp <= 0) {
    target.alive = false;
    target.hasMoved = true;
    target.hasActed = true;
  }
  return nextUnits;
}

function canCounterattack(attacker: Unit, defender: Unit) {
  const distance = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
  return distance >= defender.attackMin && distance <= defender.attackMax;
}

function resolveAttack(state: GameState, attackerId: string, defenderId: string): GameState {
  const attacker = getUnitById(state, attackerId);
  const defender = getUnitById(state, defenderId);
  if (!attacker || !defender || !attacker.alive || !defender.alive) return state;
  if (attacker.side === defender.side) return state;

  const distance = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
  if (distance < attacker.attackMin || distance > attacker.attackMax) return state;

  let units = applyDamage(state.units, attacker, defender);
  const defenderAfter = units.find((unit) => unit.id === defender.id);
  const attackerAfter = units.find((unit) => unit.id === attacker.id);

  const attackLog = `${attacker.name} strikes ${defender.name}.`;
  let message = attackLog;

  if (defenderAfter?.alive && attackerAfter && canCounterattack(attackerAfter, defenderAfter)) {
    units = applyDamage(units, defenderAfter, attackerAfter);
    const attackerResult = units.find((unit) => unit.id === attacker.id);
    if (attackerResult && !attackerResult.alive) {
      message = `${attackLog} ${defender.name} counterattacks! ${attacker.name} falls.`;
    } else {
      message = `${attackLog} ${defender.name} counterattacks.`;
    }
  }

  const nextState: GameState = {
    ...state,
    units,
    message,
  };

  return finalizeAfterAction(nextState, attacker.id);
}

function moveUnit(state: GameState, unitId: string, x: number, y: number): GameState {
  const unit = getUnitById(state, unitId);
  if (!unit || !unit.alive || unit.hasMoved || unit.hasActed) return state;
  if (!isPassable(x, y)) return state;
  if (getUnitAt(state, x, y)) return state;

  const reachable = getReachableTiles(state, unitId);
  if (!reachable.some((point) => point.x === x && point.y === y)) return state;

  const units = cloneUnits(state.units);
  const nextUnit = units.find((entry) => entry.id === unit.id);
  if (!nextUnit) return state;
  nextUnit.x = x;
  nextUnit.y = y;
  nextUnit.hasMoved = true;

  return {
    ...state,
    units,
    selectedUnitId: unit.id,
    message: `${unit.name} moved to ${x},${y}.`,
  };
}

function finishUnit(state: GameState, unitId: string, message: string) {
  const units = cloneUnits(state.units);
  const unit = units.find((entry) => entry.id === unitId);
  if (!unit) return state;
  unit.hasActed = true;
  return finalizeAfterAction({ ...state, units, message }, unitId);
}

function finalizeAfterAction(state: GameState, actedUnitId: string): GameState {
  const currentUnit = getUnitById(state, actedUnitId);
  if (!currentUnit || !currentUnit.alive) {
    const lordAlive = state.units.some((unit) => unit.alive && unit.lord);
    const bossAlive = state.units.some((unit) => unit.alive && unit.boss);
    if (!lordAlive) return { ...state, mode: "defeat", selectedUnitId: null, message: "The Lord has fallen." };
    if (!bossAlive) return { ...state, mode: "victory", selectedUnitId: null, message: "The Dread Lord has fallen." };
    return state.mode === "enemy" ? state : advancePlayerSelection(state, actedUnitId);
  }

  const bossAlive = state.units.some((unit) => unit.alive && unit.boss);
  if (!bossAlive) {
    return { ...state, mode: "victory", selectedUnitId: null, message: "The Dread Lord has fallen." };
  }

  const lordAlive = state.units.some((unit) => unit.alive && unit.lord);
  if (!lordAlive) {
    return { ...state, mode: "defeat", selectedUnitId: null, message: "The Lord has fallen." };
  }

  if (state.mode !== "player") return state;
  return advancePlayerSelection(state, actedUnitId);
}

function advancePlayerSelection(state: GameState, actedUnitId: string) {
  const units = cloneUnits(state.units);
  const acted = units.find((unit) => unit.id === actedUnitId);
  if (acted) acted.hasActed = true;

  const nextUnitId = getNextAllyId(units, actedUnitId);
  if (nextUnitId) {
    return {
      ...state,
      units,
      selectedUnitId: nextUnitId,
      message: `${units.find((unit) => unit.id === nextUnitId)?.name ?? "Unit"} is next.`,
    };
  }

  return startEnemyPhase({ ...state, units });
}

function chooseEnemyMove(state: GameState, enemy: Unit) {
  const occupied = getOccupiedSet(state, enemy.id);
  const allies = state.units.filter((unit) => unit.alive && unit.side === "ally");
  const targetPriority = allies.find((unit) => unit.lord) ?? allies.sort((a, b) => a.hp - b.hp)[0] ?? null;
  if (!targetPriority) return { x: enemy.x, y: enemy.y };

  const queue: Array<{ x: number; y: number; distance: number }> = [{ x: enemy.x, y: enemy.y, distance: 0 }];
  const visited = new Set<string>([keyOf(enemy)]);
  const bestMoves: Array<{ point: Point; score: number; attackable: boolean }> = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const currentPoint = { x: current.x, y: current.y };
    const attackable = allies.some((ally) => {
      const distance = Math.abs(ally.x - current.x) + Math.abs(ally.y - current.y);
      return distance >= enemy.attackMin && distance <= enemy.attackMax;
    });
    const score =
      Math.abs(targetPriority.x - current.x) +
      Math.abs(targetPriority.y - current.y) -
      (attackable ? 12 : 0) +
      current.distance * 0.15;
    bestMoves.push({ point: currentPoint, score, attackable });

    if (current.distance >= enemy.move) continue;

    [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].forEach((dir) => {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (!isPassable(next.x, next.y)) return;
      if (occupied.has(keyOf(next))) return;
      const nextKey = keyOf(next);
      if (visited.has(nextKey)) return;
      visited.add(nextKey);
      queue.push({ x: next.x, y: next.y, distance: current.distance + 1 });
    });
  }

  bestMoves.sort((a, b) => a.score - b.score);
  return bestMoves[0]?.point ?? { x: enemy.x, y: enemy.y };
}

function resolveEnemyAction(state: GameState, enemyId: string): GameState {
  const enemy = getUnitById(state, enemyId);
  if (!enemy || !enemy.alive) return state;

  const allies = state.units.filter((unit) => unit.alive && unit.side === "ally");
  if (allies.length === 0) {
    return { ...state, mode: "defeat", selectedUnitId: null, message: "The squad has been wiped out." };
  }

  const moveTarget = chooseEnemyMove(state, enemy);
  let units = cloneUnits(state.units);
  const enemyCopy = units.find((unit) => unit.id === enemy.id);
  if (!enemyCopy) return state;
  enemyCopy.x = moveTarget.x;
  enemyCopy.y = moveTarget.y;

  const afterMoveEnemy = units.find((unit) => unit.id === enemy.id);
  const attackableAllies = units.filter((ally) => {
    if (!ally.alive || ally.side !== "ally" || !afterMoveEnemy) return false;
    const distance = Math.abs(ally.x - afterMoveEnemy.x) + Math.abs(ally.y - afterMoveEnemy.y);
    return distance >= afterMoveEnemy.attackMin && distance <= afterMoveEnemy.attackMax;
  });

  let message = `${enemy.name} advances.`;
  if (attackableAllies.length > 0 && afterMoveEnemy) {
    const target =
      attackableAllies.find((ally) => ally.lord) ??
      attackableAllies.sort((a, b) => a.hp - b.hp || Math.abs(a.x - afterMoveEnemy.x) - Math.abs(b.x - afterMoveEnemy.x))[0];
    if (target) {
      units = applyDamage(units, afterMoveEnemy, target);
      const targetAfter = units.find((unit) => unit.id === target.id);
      message = `${enemy.name} attacks ${target.name}.`;
      if (targetAfter?.alive && canCounterattack(targetAfter, afterMoveEnemy)) {
        units = applyDamage(units, targetAfter, afterMoveEnemy);
        const enemyAfterCounter = units.find((unit) => unit.id === enemy.id);
        if (enemyAfterCounter && !enemyAfterCounter.alive) {
          message = `${enemy.name} attacks ${target.name}. ${target.name} counterattacks and defeats ${enemy.name}.`;
        } else {
          message = `${enemy.name} attacks ${target.name}. ${target.name} counterattacks.`;
        }
      }
    }
  }

  const nextState: GameState = {
    ...state,
    units,
    message,
  };

  const lordAlive = units.some((unit) => unit.alive && unit.lord);
  if (!lordAlive) {
    return { ...nextState, mode: "defeat", selectedUnitId: null, enemyQueue: [], enemyIndex: 0, phaseTimer: 0 };
  }

  const bossAlive = units.some((unit) => unit.alive && unit.boss);
  if (!bossAlive) {
    return { ...nextState, mode: "victory", selectedUnitId: null, enemyQueue: [], enemyIndex: 0, phaseTimer: 0 };
  }

  return nextState;
}

function finalizeEnemyPhase(state: GameState): GameState {
  return startPlayerPhase(state, state.turn + 1);
}

export function tick(state: GameState, deltaMs: number): GameState {
  if (state.mode !== "enemy") return state;
  if (deltaMs <= 0) return state;

  let nextState = { ...state, phaseTimer: state.phaseTimer + deltaMs };

  while (nextState.mode === "enemy" && nextState.phaseTimer >= ENEMY_STEP_MS) {
    nextState = { ...nextState, phaseTimer: nextState.phaseTimer - ENEMY_STEP_MS };

    if (nextState.enemyIndex >= nextState.enemyQueue.length) {
      return finalizeEnemyPhase(nextState);
    }

    const enemyId = nextState.enemyQueue[nextState.enemyIndex];
    nextState = resolveEnemyAction(nextState, enemyId);
    nextState = {
      ...nextState,
      enemyIndex: nextState.enemyIndex + 1,
    };

    if (nextState.mode === "victory" || nextState.mode === "defeat") {
      return nextState;
    }
  }

  if (nextState.enemyIndex >= nextState.enemyQueue.length) {
    return finalizeEnemyPhase(nextState);
  }

  return nextState;
}

export function selectUnit(state: GameState, unitId: string): GameState {
  if (state.mode !== "player") return state;
  const unit = getUnitById(state, unitId);
  if (!unit || !unit.alive || unit.side !== "ally" || unit.hasActed) return state;
  return {
    ...state,
    selectedUnitId: unit.id,
    message: `${unit.name} is selected.`,
  };
}

export function handleBoardTap(state: GameState, x: number, y: number): GameState {
  if (state.mode !== "player") return state;
  const activeUnit = getUnitById(state, state.selectedUnitId);
  if (!activeUnit || !activeUnit.alive || activeUnit.side !== "ally") return state;

  const clickedUnit = getUnitAt(state, x, y);
  if (clickedUnit && clickedUnit.side === "ally") {
    if (clickedUnit.id === activeUnit.id) {
      return waitCurrentUnit(state);
    }
    return selectUnit(state, clickedUnit.id);
  }

  if (clickedUnit && clickedUnit.side === "enemy") {
    return resolveAttack(state, activeUnit.id, clickedUnit.id);
  }

  return moveUnit(state, activeUnit.id, x, y);
}

export function waitCurrentUnit(state: GameState): GameState {
  if (state.mode !== "player") return state;
  const activeUnit = getUnitById(state, state.selectedUnitId);
  if (!activeUnit || !activeUnit.alive || activeUnit.side !== "ally") return state;
  return finishUnit(state, activeUnit.id, `${activeUnit.name} waits.`);
}

export function endPlayerPhase(state: GameState): GameState {
  if (state.mode !== "player") return state;
  const units = cloneUnits(state.units);
  units.forEach((unit) => {
    if (unit.side === "ally" && unit.alive) {
      unit.hasActed = true;
    }
  });
  return startEnemyPhase({ ...state, units });
}

export function terrainRows(): string[] {
  return boardToRows();
}
