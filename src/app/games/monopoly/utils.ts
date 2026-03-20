// ============ Types & Interfaces ============

export type TileType = 'start' | 'property' | 'chance' | 'fortune' | 'jail' | 'parking' | 'go_to_jail';

export interface Tile {
  id: string;
  name: string;
  type: TileType;
  price?: number;
  rent?: number;
  owner?: string | null;
  position: number;
}

export interface Player {
  id: string;
  name: string;
  position: number;
  money: number;
  properties: string[];
  isBankrupt: boolean;
  color: string;
}

export interface GameEvent {
  type: 'move' | 'purchase' | 'pay_rent' | 'pass_start' | 'chance' | 'fortune' | 'bankruptcy';
  playerId: string;
  details: Record<string, any>;
  timestamp: number;
}

export interface GameState {
  mode: 'setup' | 'playing' | 'game_over';
  board: Tile[];
  players: Player[];
  currentPlayerIndex: number;
  events: GameEvent[];
  diceValue: number;
  selectedAction: 'buy' | 'pass' | null;
}

// ============ Constants ============

export const TILE_COUNT = 24;
export const STARTING_MONEY = 1500;
export const PASS_START_REWARD = 200;

export const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];

const CHANCE_CARDS = [
  { text: '進階3格', effect: 3 },
  { text: '後退2格', effect: -2 },
  { text: '獲得100元', effect: 100 },
  { text: '失去150元', effect: -150 },
];

const FORTUNE_CARDS = [
  { text: '免費停車獎金200元', effect: 200 },
  { text: '修繕支出300元', effect: -300 },
  { text: '意外之喜500元', effect: 500 },
  { text: '醫療費用100元', effect: -100 },
];

// ============ Board Generation ============

export function generateBoard(): Tile[] {
  const board: Tile[] = [];
  const propertyTypes: TileType[] = ['property', 'property', 'property', 'property'];
  const specialTypes: TileType[] = ['chance', 'fortune', 'jail', 'parking', 'go_to_jail'];

  board.push({
    id: 'start',
    name: '起點',
    type: 'start',
    position: 0,
  });

  for (let i = 1; i < TILE_COUNT; i++) {
    let type: TileType;

    if (i % 6 === 0) {
      type = specialTypes[Math.floor(Math.random() * specialTypes.length)];
    } else {
      type = 'property';
    }

    if (type === 'property') {
      board.push({
        id: `property-${i}`,
        name: `地產${i}`,
        type: 'property',
        price: 100 + i * 50,
        rent: 20 + i * 10,
        owner: null,
        position: i,
      });
    } else {
      board.push({
        id: `tile-${i}`,
        name: getTileName(type),
        type: type,
        position: i,
      });
    }
  }

  return board;
}

function getTileName(type: TileType): string {
  const names: Record<TileType, string> = {
    start: '起點',
    property: '地產',
    chance: '機會',
    fortune: '命運',
    jail: '監獄',
    parking: '免費停車',
    go_to_jail: '直接監獄',
  };
  return names[type];
}

// ============ Player Initialization ============

export function initializePlayers(count: number = 2): Player[] {
  const players: Player[] = [];
  const names = ['玩家1', '玩家2', '玩家3', '玩家4'];

  for (let i = 0; i < Math.min(count, 4); i++) {
    players.push({
      id: `player-${i}`,
      name: names[i],
      position: 0,
      money: STARTING_MONEY,
      properties: [],
      isBankrupt: false,
      color: PLAYER_COLORS[i],
    });
  }

  return players;
}

// ============ Game State Management ============

export function createInitialState(): GameState {
  return {
    mode: 'playing',
    board: generateBoard(),
    players: initializePlayers(2),
    currentPlayerIndex: 0,
    events: [],
    diceValue: 0,
    selectedAction: null,
  };
}

// ============ Game Logic ============

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function movePlayer(
  state: GameState,
  playerId: string,
  diceValue: number
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  const oldPosition = player.position;
  const newPosition = (oldPosition + diceValue) % TILE_COUNT;

  // Check if passed start
  const newState = { ...state };
  newState.players = [...state.players];
  newState.players[playerIndex] = { ...player, position: newPosition };

  if (newPosition < oldPosition) {
    newState.players[playerIndex].money += PASS_START_REWARD;
    newState.events.push({
      type: 'pass_start',
      playerId,
      details: { amount: PASS_START_REWARD },
      timestamp: Date.now(),
    });
  }

  newState.diceValue = diceValue;
  return newState;
}

export function handleTileInteraction(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  const tile = state.board[player.position];
  const newState = { ...state };

  switch (tile.type) {
    case 'property': {
      if (!tile.owner) {
        // Property available for purchase
        newState.selectedAction = 'buy';
      } else if (tile.owner !== playerId && tile.rent) {
        // Pay rent to owner
        const ownerIndex = newState.players.findIndex((p) => p.id === tile.owner);
        if (ownerIndex !== -1) {
          const rentAmount = tile.rent;
          newState.players[playerIndex].money -= rentAmount;
          newState.players[ownerIndex].money += rentAmount;

          newState.events.push({
            type: 'pay_rent',
            playerId,
            details: { amount: rentAmount, owner: tile.owner, property: tile.name },
            timestamp: Date.now(),
          });
        }
      }
      break;
    }

    case 'chance': {
      const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
      newState.players[playerIndex].money += card.effect;
      newState.events.push({
        type: 'chance',
        playerId,
        details: { text: card.text, effect: card.effect },
        timestamp: Date.now(),
      });
      break;
    }

    case 'fortune': {
      const card = FORTUNE_CARDS[Math.floor(Math.random() * FORTUNE_CARDS.length)];
      newState.players[playerIndex].money += card.effect;
      newState.events.push({
        type: 'fortune',
        playerId,
        details: { text: card.text, effect: card.effect },
        timestamp: Date.now(),
      });
      break;
    }

    case 'go_to_jail': {
      newState.players[playerIndex].position = 10; // Move to jail position
      break;
    }
  }

  return newState;
}

export function purchaseProperty(
  state: GameState,
  playerId: string,
  tileId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const tileIndex = state.board.findIndex((t) => t.id === tileId);

  if (playerIndex === -1 || tileIndex === -1) return state;

  const player = state.players[playerIndex];
  const tile = state.board[tileIndex];

  if (!tile.price || player.money < tile.price || tile.owner) return state;

  const newState = { ...state };
  newState.players = [...state.players];
  newState.board = [...state.board];

  newState.players[playerIndex] = {
    ...player,
    money: player.money - tile.price,
    properties: [...player.properties, tileId],
  };

  newState.board[tileIndex] = {
    ...tile,
    owner: playerId,
  };

  newState.selectedAction = null;

  return newState;
}

export function passAction(state: GameState): GameState {
  const newState = { ...state };
  newState.selectedAction = null;
  newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
  return newState;
}

export function checkGameOver(state: GameState): boolean {
  const activePlayers = state.players.filter((p) => !p.isBankrupt);
  return activePlayers.length === 1;
}

export function renderGameToText(state: GameState): string {
  return JSON.stringify({
    mode: state.mode,
    currentPlayer: state.players[state.currentPlayerIndex],
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      money: p.money,
      properties: p.properties.length,
    })),
    diceValue: state.diceValue,
    selectedAction: state.selectedAction,
    boardTileCount: state.board.length,
    lastEvent: state.events[state.events.length - 1] || null,
  });
}
