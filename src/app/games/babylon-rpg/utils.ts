export type ChapterMode = 'battle' | 'treasure' | 'terrain';
export type GamePhase = 'playing' | 'paused' | 'defeated' | 'complete';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface LevelEnemy {
  id: string;
  position: Point3;
  hp?: number;
}

export interface LevelChest {
  id: string;
  position: Point3;
  loot?: string[];
}

export interface LevelGate {
  id: string;
  position: Point3;
  size: Point3;
}

export interface LevelPlatform {
  id: string;
  position: Point3;
  speed?: number;
  path?: Point3[];
}

export interface TrapZone {
  id: string;
  min: Point3;
  max: Point3;
  damage: number;
}

export interface LevelData {
  id: string;
  chapter: number;
  title: string;
  mode: ChapterMode;
  description: string;
  playerSpawn: Point3 & { yaw?: number };
  enemies: LevelEnemy[];
  chests: LevelChest[];
  gates: LevelGate[];
  movingPlatforms: LevelPlatform[];
  trapZones: TrapZone[];
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  attackCooldownMs: number;
  invulnerableMs: number;
}

export interface EnemyState {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  attackCooldownMs: number;
  hitFlashMs: number;
}

export interface ChestState {
  id: string;
  x: number;
  y: number;
  z: number;
  loot: string[];
  collected: boolean;
}

export interface GateState {
  id: string;
  x: number;
  y: number;
  z: number;
  open: boolean;
  progress: number;
}

export interface PlatformState {
  id: string;
  path: Point3[];
  speed: number;
  pathIndex: number;
  progress: number;
  x: number;
  y: number;
  z: number;
}

export interface GameState {
  levelId: string;
  chapter: number;
  title: string;
  description: string;
  mode: ChapterMode;
  phase: GamePhase;
  player: PlayerState;
  enemies: EnemyState[];
  chests: ChestState[];
  gates: GateState[];
  platforms: PlatformState[];
  trapZones: TrapZone[];
  inventory: string[];
  unlockedGates: string[];
  collectedItemsByLevel: Record<string, string[]>;
  defeatedEnemiesByLevel: Record<string, string[]>;
  trapCooldownMs: number;
  lastEvent: string;
  eventId: number;
  elapsedMs: number;
}

export interface GameInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface GameSave {
  version: 2;
  levelId: string;
  playerPosition: Pick<PlayerState, 'x' | 'y' | 'z' | 'yaw'>;
  playerStats: Pick<PlayerState, 'hp' | 'maxHp' | 'attack' | 'defense'>;
  inventory: string[];
  unlockedGates: string[];
  collectedItemsByLevel: Record<string, string[]>;
  defeatedEnemiesByLevel: Record<string, string[]>;
}

export interface InteractionResult {
  state: GameState;
  transitionRequested: boolean;
}

export type QuestTargetKind = 'guardian' | 'cache' | 'gate';
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type ThreatLevel = 'clear' | 'tracking' | 'engaged' | 'danger';

export interface QuestTarget {
  id: string;
  kind: QuestTargetKind;
  x: number;
  z: number;
  distance: number;
  direction: CompassDirection;
}

export interface CombatStatus {
  nearestEnemyId: string | null;
  distance: number | null;
  threat: ThreatLevel;
  threatLabel: string;
  inAttackRange: boolean;
  attackReady: boolean;
  attackCooldownMs: number;
  attackChargePercent: number;
}

const MAP_LIMIT = 15;
const PLAYER_SPEED = 5.2;
const ENEMY_SPEED = 1.7;
const ATTACK_RANGE = 3.2;
const ENEMY_AGGRO_RANGE = 8;
const ENEMY_STRIKE_RANGE = 1.55;
const ATTACK_COOLDOWN_MS = 420;
const INTERACT_RANGE = 3;

export function createGameState(level: LevelData, save?: GameSave | null): GameState {
  const restored = save?.levelId === level.id ? save : null;
  const position = restored?.playerPosition ?? {
    x: level.playerSpawn.x,
    y: level.playerSpawn.y,
    z: level.playerSpawn.z,
    yaw: ((level.playerSpawn.yaw ?? 0) * Math.PI) / 180,
  };
  const stats = restored?.playerStats ?? { hp: 8, maxHp: 8, attack: 2, defense: 1 };
  const collectedItemsByLevel = restored?.collectedItemsByLevel ?? {};
  const defeatedEnemiesByLevel = restored?.defeatedEnemiesByLevel ?? {};
  const collected = new Set(collectedItemsByLevel[level.id] ?? []);
  const defeated = new Set(defeatedEnemiesByLevel[level.id] ?? []);
  const unlockedGates = restored?.unlockedGates ?? [];

  return {
    levelId: level.id,
    chapter: level.chapter,
    title: level.title,
    description: level.description,
    mode: level.mode,
    phase: 'playing',
    player: {
      ...position,
      ...stats,
      hp: Math.max(1, stats.hp),
      attackCooldownMs: 0,
      invulnerableMs: 0,
    },
    enemies: level.enemies.map((enemy) => ({
      id: enemy.id,
      x: enemy.position.x,
      y: enemy.position.y,
      z: enemy.position.z,
      hp: defeated.has(enemy.id) ? 0 : (enemy.hp ?? 3),
      maxHp: enemy.hp ?? 3,
      alive: !defeated.has(enemy.id),
      attackCooldownMs: 0,
      hitFlashMs: 0,
    })),
    chests: level.chests.map((chest) => ({
      id: chest.id,
      x: chest.position.x,
      y: chest.position.y,
      z: chest.position.z,
      loot: chest.loot ?? [],
      collected: collected.has(chest.id),
    })),
    gates: level.gates.map((gate) => ({
      id: gate.id,
      x: gate.position.x,
      y: gate.position.y,
      z: gate.position.z,
      open: unlockedGates.includes(gate.id),
      progress: unlockedGates.includes(gate.id) ? 1 : 0,
    })),
    platforms: level.movingPlatforms.map((platform) => ({
      id: platform.id,
      path: platform.path?.length ? platform.path.map((point) => ({ ...point })) : [{ ...platform.position }],
      speed: platform.speed ?? 1.25,
      pathIndex: 0,
      progress: 0,
      x: platform.position.x,
      y: platform.position.y,
      z: platform.position.z,
    })),
    trapZones: level.trapZones.map((trap) => ({ ...trap, min: { ...trap.min }, max: { ...trap.max } })),
    inventory: [...(restored?.inventory ?? [])],
    unlockedGates: [...unlockedGates],
    collectedItemsByLevel: copyRecord(collectedItemsByLevel),
    defeatedEnemiesByLevel: copyRecord(defeatedEnemiesByLevel),
    trapCooldownMs: 0,
    lastEvent: restored ? 'Saved expedition restored' : 'Expedition started',
    eventId: 1,
    elapsedMs: 0,
  };
}

export function tickGame(state: GameState, input: GameInput, deltaMs: number): GameState {
  if (state.phase !== 'playing') return state;
  const dt = Math.min(Math.max(deltaMs, 0), 50) / 1000;
  if (dt === 0) return state;

  const player = {
    ...state.player,
    attackCooldownMs: Math.max(0, state.player.attackCooldownMs - deltaMs),
    invulnerableMs: Math.max(0, state.player.invulnerableMs - deltaMs),
  };
  const horizontal = Number(input.right) - Number(input.left);
  // The default camera looks from negative z toward positive z, so positive z
  // is visually forward and must match W / the upward touch control.
  const vertical = Number(input.up) - Number(input.down);
  if (horizontal !== 0 || vertical !== 0) {
    const length = Math.hypot(horizontal, vertical);
    player.x = clamp(player.x + (horizontal / length) * PLAYER_SPEED * dt, -MAP_LIMIT, MAP_LIMIT);
    player.z = clamp(player.z + (vertical / length) * PLAYER_SPEED * dt, -MAP_LIMIT, MAP_LIMIT);
    player.yaw = Math.atan2(horizontal, vertical);
  }

  let lastEvent = state.lastEvent;
  let eventId = state.eventId;
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive) return enemy;
    const next = {
      ...enemy,
      attackCooldownMs: Math.max(0, enemy.attackCooldownMs - deltaMs),
      hitFlashMs: Math.max(0, enemy.hitFlashMs - deltaMs),
    };
    const distance = distance2d(next, player);
    if (distance <= ENEMY_AGGRO_RANGE && distance > 1.25) {
      const amount = Math.min(ENEMY_SPEED * dt, distance - 1.25);
      next.x += ((player.x - next.x) / distance) * amount;
      next.z += ((player.z - next.z) / distance) * amount;
    }
    if (distance <= ENEMY_STRIKE_RANGE && next.attackCooldownMs === 0 && player.invulnerableMs === 0) {
      const damage = Math.max(1, 2 - player.defense);
      player.hp = Math.max(0, player.hp - damage);
      player.invulnerableMs = 700;
      next.attackCooldownMs = 1100;
      lastEvent = `${next.id} struck for ${damage}`;
      eventId += 1;
    }
    return next;
  });

  let trapCooldownMs = Math.max(0, state.trapCooldownMs - deltaMs);
  if (trapCooldownMs === 0 && player.invulnerableMs === 0) {
    const trap = state.trapZones.find((zone) => pointInside(player, zone));
    if (trap) {
      player.hp = Math.max(0, player.hp - trap.damage);
      player.x = clamp(player.x - Math.sin(player.yaw) * 1.4, -MAP_LIMIT, MAP_LIMIT);
      player.z = clamp(player.z - Math.cos(player.yaw) * 1.4, -MAP_LIMIT, MAP_LIMIT);
      player.invulnerableMs = 800;
      trapCooldownMs = 1000;
      lastEvent = `${trap.id} dealt ${trap.damage} damage`;
      eventId += 1;
    }
  }

  const platforms = updatePlatforms(state.platforms, player, dt);
  const objectiveComplete = objectiveIsComplete({ ...state, enemies, chests: state.chests });
  const gates = state.gates.map((gate) => ({
    ...gate,
    progress: clamp(gate.progress + (objectiveComplete ? dt * 1.8 : -dt * 1.8), 0, 1),
    open: objectiveComplete && gate.progress + dt * 1.8 >= 1,
  }));
  const newlyOpened = gates.find((gate, index) => gate.open && !state.gates[index].open);
  const unlockedGates = newlyOpened
    ? Array.from(new Set([...state.unlockedGates, newlyOpened.id]))
    : state.unlockedGates;
  if (newlyOpened) {
    lastEvent = `${newlyOpened.id} opened`;
    eventId += 1;
  }

  return {
    ...state,
    phase: player.hp <= 0 ? 'defeated' : state.phase,
    player,
    enemies,
    gates,
    platforms,
    unlockedGates,
    trapCooldownMs,
    lastEvent: player.hp <= 0 ? 'The expedition has fallen' : lastEvent,
    eventId: player.hp <= 0 && state.player.hp > 0 ? eventId + 1 : eventId,
    elapsedMs: state.elapsedMs + deltaMs,
  };
}

export function performAttack(state: GameState): GameState {
  if (state.phase !== 'playing' || state.player.attackCooldownMs > 0) return state;
  const target = state.enemies
    .filter((enemy) => enemy.alive && distance2d(enemy, state.player) <= ATTACK_RANGE)
    .sort((a, b) => distance2d(a, state.player) - distance2d(b, state.player))[0];
  const player = { ...state.player, attackCooldownMs: ATTACK_COOLDOWN_MS };
  if (!target) {
    return { ...state, player, lastEvent: 'Sword swing missed', eventId: state.eventId + 1 };
  }

  let defeatedId: string | null = null;
  const enemies = state.enemies.map((enemy) => {
    if (enemy.id !== target.id) return enemy;
    const hp = Math.max(0, enemy.hp - state.player.attack);
    if (hp === 0) defeatedId = enemy.id;
    return { ...enemy, hp, alive: hp > 0, hitFlashMs: 180 };
  });
  const defeatedEnemiesByLevel = defeatedId
    ? {
        ...state.defeatedEnemiesByLevel,
        [state.levelId]: Array.from(new Set([...(state.defeatedEnemiesByLevel[state.levelId] ?? []), defeatedId])),
      }
    : state.defeatedEnemiesByLevel;

  return {
    ...state,
    player,
    enemies,
    defeatedEnemiesByLevel,
    lastEvent: defeatedId ? `${defeatedId} defeated` : `${target.id} took ${state.player.attack} damage`,
    eventId: state.eventId + 1,
  };
}

export function performInteraction(state: GameState): InteractionResult {
  if (state.phase !== 'playing') return { state, transitionRequested: false };
  const chest = state.chests
    .filter((entry) => !entry.collected && distance2d(entry, state.player) <= INTERACT_RANGE)
    .sort((a, b) => distance2d(a, state.player) - distance2d(b, state.player))[0];
  if (chest) {
    const chests = state.chests.map((entry) => entry.id === chest.id ? { ...entry, collected: true } : entry);
    return {
      transitionRequested: false,
      state: {
        ...state,
        chests,
        inventory: Array.from(new Set([...state.inventory, ...chest.loot])),
        collectedItemsByLevel: {
          ...state.collectedItemsByLevel,
          [state.levelId]: Array.from(new Set([...(state.collectedItemsByLevel[state.levelId] ?? []), chest.id])),
        },
        lastEvent: `${chest.id} opened: ${chest.loot.join(', ')}`,
        eventId: state.eventId + 1,
      },
    };
  }

  const openGate = state.gates.find((gate) => gate.open && distance2d(gate, state.player) <= 3.5);
  if (openGate) {
    return {
      transitionRequested: true,
      state: { ...state, lastEvent: `Entering ${openGate.id}`, eventId: state.eventId + 1 },
    };
  }

  return {
    transitionRequested: false,
    state: { ...state, lastEvent: 'Nothing nearby to interact with', eventId: state.eventId + 1 },
  };
}

export function togglePause(state: GameState): GameState {
  if (state.phase === 'defeated' || state.phase === 'complete') return state;
  return { ...state, phase: state.phase === 'paused' ? 'playing' : 'paused' };
}

export function objectiveIsComplete(state: Pick<GameState, 'mode' | 'enemies' | 'chests'>): boolean {
  return state.mode === 'battle'
    ? state.enemies.every((enemy) => !enemy.alive)
    : state.chests.every((chest) => chest.collected);
}

export function getObjective(state: Pick<GameState, 'mode' | 'enemies' | 'chests'>): string {
  if (state.mode === 'battle') {
    const remaining = state.enemies.filter((enemy) => enemy.alive).length;
    return remaining === 0 ? 'The shrine gate is opening.' : `Defeat the roaming guardians (${remaining} remaining).`;
  }
  const remaining = state.chests.filter((chest) => !chest.collected).length;
  if (remaining === 0) return state.mode === 'terrain' ? 'Reach the Sky Exit.' : 'The treasury door is opening.';
  return state.mode === 'terrain' ? 'Cross the hazards and recover the bridge cache.' : 'Find and open the ancient chest.';
}

export function getNearbyPrompt(state: GameState): string | null {
  const chest = state.chests
    .filter((entry) => !entry.collected && distance2d(entry, state.player) <= INTERACT_RANGE)
    .sort((a, b) => distance2d(a, state.player) - distance2d(b, state.player))[0];
  if (chest) return `Open ${chest.id}`;
  const gate = state.gates
    .filter((entry) => entry.open && distance2d(entry, state.player) <= 3.5)
    .sort((a, b) => distance2d(a, state.player) - distance2d(b, state.player))[0];
  if (gate) return `Enter ${gate.id}`;
  return null;
}

export function getQuestTarget(state: Pick<GameState, 'mode' | 'player' | 'enemies' | 'chests' | 'gates'>): QuestTarget | null {
  const candidates: Array<{ id: string; kind: QuestTargetKind; x: number; z: number }> = state.mode === 'battle'
    ? state.enemies.filter((enemy) => enemy.alive).map((enemy) => ({ ...enemy, kind: 'guardian' }))
    : state.chests.filter((chest) => !chest.collected).map((chest) => ({ ...chest, kind: 'cache' }));
  const activeCandidates = candidates.length > 0
    ? candidates
    : state.gates.map((gate) => ({ ...gate, kind: 'gate' as const }));
  const target = activeCandidates.sort((a, b) => distance2d(a, state.player) - distance2d(b, state.player))[0];
  if (!target) return null;
  const distance = distance2d(target, state.player);
  return {
    id: target.id,
    kind: target.kind,
    x: target.x,
    z: target.z,
    distance: round(distance),
    direction: getCompassDirection(target.x - state.player.x, target.z - state.player.z),
  };
}

export function getCombatStatus(state: Pick<GameState, 'phase' | 'player' | 'enemies'>): CombatStatus {
  const nearestEnemy = state.enemies
    .filter((enemy) => enemy.alive)
    .sort((a, b) => distance2d(a, state.player) - distance2d(b, state.player))[0];
  const distance = nearestEnemy ? distance2d(nearestEnemy, state.player) : null;
  const threat: ThreatLevel = distance === null || distance > ENEMY_AGGRO_RANGE
    ? 'clear'
    : distance <= ENEMY_STRIKE_RANGE
      ? 'danger'
      : distance <= ATTACK_RANGE
        ? 'engaged'
        : 'tracking';
  const threatLabel = threat === 'danger'
    ? 'Enemy striking'
    : threat === 'engaged'
      ? 'Sword range'
      : threat === 'tracking'
        ? 'Enemy pursuing'
        : nearestEnemy
          ? 'Outside pursuit range'
          : 'Realm secure';
  const cooldown = Math.max(0, state.player.attackCooldownMs);
  return {
    nearestEnemyId: nearestEnemy?.id ?? null,
    distance: distance === null ? null : round(distance),
    threat,
    threatLabel,
    inAttackRange: distance !== null && distance <= ATTACK_RANGE,
    attackReady: state.phase === 'playing' && cooldown === 0,
    attackCooldownMs: cooldown,
    attackChargePercent: Math.round(clamp(1 - cooldown / ATTACK_COOLDOWN_MS, 0, 1) * 100),
  };
}

export function createSave(state: GameState): GameSave {
  return {
    version: 2,
    levelId: state.levelId,
    playerPosition: {
      x: round(state.player.x),
      y: round(state.player.y),
      z: round(state.player.z),
      yaw: round(state.player.yaw),
    },
    playerStats: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      attack: state.player.attack,
      defense: state.player.defense,
    },
    inventory: [...state.inventory],
    unlockedGates: [...state.unlockedGates],
    collectedItemsByLevel: copyRecord(state.collectedItemsByLevel),
    defeatedEnemiesByLevel: copyRecord(state.defeatedEnemiesByLevel),
  };
}

export function parseGameSave(value: unknown): GameSave | null {
  if (!value || typeof value !== 'object') return null;
  const save = value as Partial<GameSave>;
  const position = save.playerPosition;
  const stats = save.playerStats;
  const validPosition = position && ['x', 'y', 'z', 'yaw'].every((key) => Number.isFinite(position[key as keyof typeof position]));
  const validStats = stats && ['hp', 'maxHp', 'attack', 'defense'].every((key) => Number.isFinite(stats[key as keyof typeof stats]));
  return save.version === 2
    && typeof save.levelId === 'string'
    && validPosition
    && validStats
    && Array.isArray(save.inventory) && save.inventory.every((item) => typeof item === 'string')
    && Array.isArray(save.unlockedGates) && save.unlockedGates.every((item) => typeof item === 'string')
    && validStringArrayRecord(save.collectedItemsByLevel)
    && validStringArrayRecord(save.defeatedEnemiesByLevel)
    ? save as GameSave
    : null;
}

export function renderGameToText(state: GameState): string {
  return JSON.stringify({
    coordinateSystem: '3D world; +x east, +z north/forward, y elevation',
    chapter: state.chapter,
    levelId: state.levelId,
    mode: state.mode,
    phase: state.phase,
    player: state.player,
    objective: getObjective(state),
    inventory: state.inventory,
    enemies: state.enemies.filter((enemy) => enemy.alive),
    chests: state.chests.filter((chest) => !chest.collected),
    gates: state.gates,
    questTarget: getQuestTarget(state),
    combat: getCombatStatus(state),
    nearbyPrompt: getNearbyPrompt(state),
    lastEvent: state.lastEvent,
  });
}

function getCompassDirection(deltaX: number, deltaZ: number): CompassDirection {
  const directions: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const angle = Math.atan2(deltaX, deltaZ);
  const index = Math.round(angle / (Math.PI / 4));
  return directions[(index + directions.length) % directions.length];
}

function updatePlatforms(platforms: PlatformState[], player: PlayerState, dt: number): PlatformState[] {
  return platforms.map((platform) => {
    if (platform.path.length < 2) return platform;
    const current = platform.path[platform.pathIndex] ?? platform.path[0];
    const nextIndex = (platform.pathIndex + 1) % platform.path.length;
    const target = platform.path[nextIndex] ?? platform.path[0];
    const previous = { x: platform.x, z: platform.z };
    let progress = clamp(platform.progress + dt * platform.speed * 0.35, 0, 1);
    const next = {
      ...platform,
      x: lerp(current.x, target.x, progress),
      y: lerp(current.y, target.y, progress),
      z: lerp(current.z, target.z, progress),
      progress,
    };
    if (progress >= 1) {
      next.pathIndex = nextIndex;
      next.progress = 0;
      progress = 0;
    }
    if (distance2d(previous, player) < 1.7) {
      player.x = clamp(player.x + next.x - previous.x, -MAP_LIMIT, MAP_LIMIT);
      player.z = clamp(player.z + next.z - previous.z, -MAP_LIMIT, MAP_LIMIT);
    }
    return next;
  });
}

function pointInside(point: Pick<Point3, 'x' | 'z'>, trap: TrapZone): boolean {
  return point.x >= trap.min.x && point.x <= trap.max.x && point.z >= trap.min.z && point.z <= trap.max.z;
}

function distance2d(a: Pick<Point3, 'x' | 'z'>, b: Pick<Point3, 'x' | 'z'>): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function copyRecord(record: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(record).map(([key, values]) => [key, [...values]]));
}

function validStringArrayRecord(value: unknown): value is Record<string, string[]> {
  return !!value && typeof value === 'object'
    && Object.values(value).every((items) => Array.isArray(items) && items.every((item) => typeof item === 'string'));
}
