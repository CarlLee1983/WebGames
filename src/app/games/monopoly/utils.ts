export type TileType =
  | "start"
  | "property"
  | "station"
  | "chance"
  | "fortune"
  | "tax"
  | "jail"
  | "parking"
  | "go_to_jail";

export interface Tile {
  id: string;
  name: string;
  type: TileType;
  position: number;
  price?: number;
  rent?: number;
  owner?: string | null;
  accent?: string;
  subtitle?: string;
}

export interface Player {
  id: string;
  name: string;
  position: number;
  money: number;
  properties: string[];
  isBankrupt: boolean;
  color: string;
  token: string;
}

export interface GameEvent {
  type: "move" | "purchase" | "pay_rent" | "pass_start" | "chance" | "fortune" | "tax" | "jail" | "bankruptcy";
  playerId: string;
  summary: string;
  details: Record<string, string | number | boolean>;
  timestamp: number;
}

export interface MoveState {
  playerId: string;
  startPosition: number;
  path: number[];
  stepIndex: number;
  stepElapsed: number;
  stepMs: number;
}

export interface PromptState {
  kind: "buy" | "event" | "game_over";
  title: string;
  body: string;
  tileId?: string;
  autoMs?: number | null;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export interface GameState {
  mode: "playing" | "game_over";
  phase: "ready" | "rolling" | "moving" | "prompt" | "game_over";
  board: Tile[];
  players: Player[];
  currentPlayerIndex: number;
  turn: number;
  events: GameEvent[];
  message: string;
  diceFaces: [number, number];
  diceTotal: number;
  rollMs: number;
  move: MoveState | null;
  prompt: PromptState | null;
  animationMs: number;
  rngSeed: number;
}

export type BannerTone = "neutral" | "good" | "warning" | "bad";

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 800;
export const BOARD_GRID = 7;
export const TILE_SIZE = 86;
export const BOARD_SIZE = BOARD_GRID * TILE_SIZE;
export const BOARD_ORIGIN = Math.floor((CANVAS_WIDTH - BOARD_SIZE) / 2);
export const TILE_COUNT = 24;
export const STARTING_MONEY = 1500;
export const PASS_START_REWARD = 200;
export const MOVE_STEP_MS = 140;
export const ROLL_REVEAL_MS = 640;
export const PROMPT_AUTO_MS = 900;
export const PLAYER_COLORS = ["#ff7a59", "#4fd1c5", "#8b5cf6", "#fbbf24"];
export const BOARD_PATH = [
  { x: 6, y: 6 },
  { x: 5, y: 6 },
  { x: 4, y: 6 },
  { x: 3, y: 6 },
  { x: 2, y: 6 },
  { x: 1, y: 6 },
  { x: 0, y: 6 },
  { x: 0, y: 5 },
  { x: 0, y: 4 },
  { x: 0, y: 3 },
  { x: 0, y: 2 },
  { x: 0, y: 1 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 1 },
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 4 },
  { x: 6, y: 5 },
] as const;

const MOD = 2147483647;
const MUL = 48271;

const CHANCE_CARDS = [
  { title: "順風前進", body: "市場熱度上升，獲得 $120。", amount: 120, tone: "good" as const },
  { title: "臨時獎金", body: "公司發放紅利，獲得 $180。", amount: 180, tone: "good" as const },
  { title: "街區修繕", body: "道路維修，支付 $100。", amount: -100, tone: "warning" as const },
  { title: "稅務抽查", body: "帳務查核，支付 $160。", amount: -160, tone: "bad" as const },
];

const FORTUNE_CARDS = [
  { title: "地段升值", body: "資產增值，獲得 $200。", amount: 200, tone: "good" as const },
  { title: "意外分紅", body: "投資回報，獲得 $150。", amount: 150, tone: "good" as const },
  { title: "豪華裝修", body: "維護費用上升，支付 $140。", amount: -140, tone: "warning" as const },
  { title: "合作收益", body: "合作案結算，獲得 $220。", amount: 220, tone: "good" as const },
];

const BOARD_TILES: Array<Omit<Tile, "position">> = [
  { id: "start", name: "起點", type: "start", accent: "#fbbf24", subtitle: "領取回合獎金" },
  { id: "harbor-street", name: "海港街", type: "property", price: 120, rent: 12, accent: "#38bdf8", subtitle: "藍海地段" },
  { id: "chance-1", name: "機會", type: "chance", accent: "#a855f7", subtitle: "抽一張機會卡" },
  { id: "bay-avenue", name: "藍灣大道", type: "property", price: 140, rent: 14, accent: "#0ea5e9", subtitle: "海港商圈" },
  { id: "tax-1", name: "稅務局", type: "tax", accent: "#ef4444", subtitle: "繳納稅金" },
  { id: "pine-road", name: "松濤路", type: "property", price: 160, rent: 16, accent: "#34d399", subtitle: "綠意住宅" },
  { id: "parking", name: "免費停車", type: "parking", accent: "#06b6d4", subtitle: "喘口氣，獲得小額獎金" },
  { id: "dawn-street", name: "晨曦街", type: "property", price: 180, rent: 18, accent: "#84cc16", subtitle: "晨光住宅" },
  { id: "station-1", name: "車站", type: "station", price: 220, rent: 26, accent: "#f59e0b", subtitle: "交通樞紐" },
  { id: "fortune-1", name: "命運", type: "fortune", accent: "#22c55e", subtitle: "命運卡翻開" },
  { id: "sand-avenue", name: "白沙大道", type: "property", price: 200, rent: 20, accent: "#facc15", subtitle: "沙灘別墅" },
  { id: "garden-road", name: "花園路", type: "property", price: 220, rent: 22, accent: "#fb7185", subtitle: "花園街區" },
  { id: "jail", name: "監獄", type: "jail", accent: "#60a5fa", subtitle: "停留觀察" },
  { id: "neon-street", name: "霓虹街", type: "property", price: 240, rent: 24, accent: "#f97316", subtitle: "夜市熱區" },
  { id: "tax-2", name: "稅務局", type: "tax", accent: "#dc2626", subtitle: "高額稅款" },
  { id: "silver-bay", name: "銀灣大道", type: "property", price: 260, rent: 26, accent: "#8b5cf6", subtitle: "銀色海灣" },
  { id: "chance-2", name: "機會", type: "chance", accent: "#c084fc", subtitle: "抽一張機會卡" },
  { id: "crown-street", name: "王冠街", type: "property", price: 280, rent: 28, accent: "#f472b6", subtitle: "核心商業區" },
  { id: "go-to-jail", name: "直接監獄", type: "go_to_jail", accent: "#ef4444", subtitle: "被送往監獄" },
  { id: "star-river", name: "星河大道", type: "property", price: 300, rent: 30, accent: "#38bdf8", subtitle: "星光豪宅" },
  { id: "station-2", name: "車站", type: "station", price: 260, rent: 30, accent: "#f59e0b", subtitle: "運輸樞紐" },
  { id: "fortune-2", name: "命運", type: "fortune", accent: "#22c55e", subtitle: "命運卡翻開" },
  { id: "dusk-street", name: "暮色街", type: "property", price: 320, rent: 32, accent: "#a78bfa", subtitle: "夕暮街區" },
  { id: "long-embankment", name: "長堤路", type: "property", price: 360, rent: 36, accent: "#14b8a6", subtitle: "臨海高價地" },
];

function nextSeed(seed: number) {
  return (seed * MUL) % MOD;
}

function takeRandom(seed: number) {
  const next = nextSeed(seed || 1);
  return {
    seed: next,
    value: (next - 1) / (MOD - 1),
  };
}

function deepCloneState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((tile) => ({ ...tile })),
    players: state.players.map((player) => ({ ...player, properties: [...player.properties] })),
    events: state.events.map((event) => ({ ...event, details: { ...event.details } })),
    move: state.move ? { ...state.move, path: [...state.move.path] } : null,
    prompt: state.prompt ? { ...state.prompt } : null,
  };
}

function buildBoard() {
  return BOARD_TILES.map((tile, position) => ({ ...tile, position }));
}

function getPlayerName(index: number) {
  return ["玩家1", "玩家2", "玩家3", "玩家4"][index] ?? `玩家${index + 1}`;
}

export function getTilePosition(index: number) {
  return BOARD_PATH[index % TILE_COUNT];
}

export function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value))}`;
}

export function createInitialState(): GameState {
  return {
    mode: "playing",
    phase: "ready",
    board: buildBoard(),
    players: Array.from({ length: 2 }, (_, index) => ({
      id: `player-${index}`,
      name: getPlayerName(index),
      position: 0,
      money: STARTING_MONEY,
      properties: [],
      isBankrupt: false,
      color: PLAYER_COLORS[index],
      token: index === 0 ? "A" : "B",
    })),
    currentPlayerIndex: 0,
    turn: 1,
    events: [],
    message: "按下擲骰開始回合，佔領整個棋盤。",
    diceFaces: [1, 1],
    diceTotal: 0,
    rollMs: 0,
    move: null,
    prompt: null,
    animationMs: 0,
    rngSeed: 123456789,
  };
}

function pushEvent(state: GameState, event: Omit<GameEvent, "timestamp">) {
  state.events = [...state.events, { ...event, timestamp: state.animationMs }];
}

function getCurrentPlayerIndex(state: GameState) {
  return Math.max(0, Math.min(state.currentPlayerIndex, state.players.length - 1));
}

function getCurrentPlayer(state: GameState) {
  return state.players[getCurrentPlayerIndex(state)];
}

function getNextActivePlayerIndex(state: GameState, startIndex: number) {
  if (!state.players.length) return 0;

  for (let offset = 0; offset < state.players.length; offset += 1) {
    const index = (startIndex + offset) % state.players.length;
    if (!state.players[index].isBankrupt) {
      return index;
    }
  }

  return startIndex % state.players.length;
}

function markBankrupt(state: GameState, playerIndex: number, reason: string) {
  const player = state.players[playerIndex];
  if (player.isBankrupt) return;

  state.players[playerIndex] = {
    ...player,
    money: 0,
    properties: [],
    isBankrupt: true,
  };

  state.board = state.board.map((tile) =>
    tile.owner === player.id ? { ...tile, owner: null } : tile,
  );

  pushEvent(state, {
    type: "bankruptcy",
    playerId: player.id,
    summary: `${player.name} 破產`,
    details: { reason },
  });
}

function finishIfNeeded(state: GameState) {
  const active = state.players.filter((player) => !player.isBankrupt);
  if (active.length <= 1) {
    state.mode = "game_over";
    state.phase = "game_over";
    const winner = active[0];
    state.prompt = {
      kind: "game_over",
      title: winner ? `${winner.name} 獲勝` : "遊戲結束",
      body: winner ? `${winner.name} 以資產優勢統治棋盤。` : "沒有可用玩家。",
      primaryLabel: "重新開始",
    };
    state.message = winner ? `${winner.name} 成為最後的房地產大亨。` : "遊戲結束。";
  }
}

function beginPrompt(state: GameState, prompt: PromptState) {
  state.phase = "prompt";
  state.prompt = prompt;
  state.rollMs = 0;
  state.move = null;
}

function resolveLanding(state: GameState) {
  if (state.mode !== "playing") return;

  const playerIndex = getCurrentPlayerIndex(state);
  const player = state.players[playerIndex];
  const tile = state.board[player.position];

  switch (tile.type) {
    case "property":
    case "station": {
      if (!tile.owner) {
        beginPrompt(state, {
          kind: "buy",
          title: `買下 ${tile.name}`,
          body: `價格 ${formatMoney(tile.price ?? 0)}，租金 ${formatMoney(tile.rent ?? 0)}。`,
          tileId: tile.id,
          primaryLabel: "買下",
          secondaryLabel: "跳過",
        });
        state.message = `${player.name} 抵達 ${tile.name}。可選擇購買。`;
        return;
      }

      if (tile.owner !== player.id) {
        const ownerIndex = state.players.findIndex((candidate) => candidate.id === tile.owner);
        const rent = tile.rent ?? 0;
        if (ownerIndex !== -1) {
          state.players[playerIndex] = { ...player, money: player.money - rent };
          state.players[ownerIndex] = {
            ...state.players[ownerIndex],
            money: state.players[ownerIndex].money + rent,
          };
          pushEvent(state, {
            type: "pay_rent",
            playerId: player.id,
            summary: `${player.name} 支付租金 ${formatMoney(rent)}`,
            details: { tile: tile.name, owner: state.players[ownerIndex].name, amount: rent },
          });
          if (state.players[playerIndex].money < 0) {
            markBankrupt(state, playerIndex, `${player.name} 無法支付租金`);
          }
        }
        beginPrompt(state, {
          kind: "event",
          title: "租金結算",
          body: `${player.name} 支付 ${formatMoney(rent)} 給 ${state.players[ownerIndex]?.name ?? "房東"}。`,
          autoMs: PROMPT_AUTO_MS,
        });
        state.message = `${player.name} 為 ${tile.name} 支付租金。`;
        return;
      }

      beginPrompt(state, {
        kind: "event",
        title: "自家地產",
        body: `停在自己的 ${tile.name}，免付租金。`,
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 停在自己的地產。`;
      return;
    }

    case "chance": {
      const roll = takeRandom(state.rngSeed);
      state.rngSeed = roll.seed;
      const card = CHANCE_CARDS[Math.floor(roll.value * CHANCE_CARDS.length)];
      state.players[playerIndex] = { ...player, money: player.money + card.amount };
      pushEvent(state, {
        type: "chance",
        playerId: player.id,
        summary: `${card.title} ${formatMoney(card.amount)}`,
        details: { title: card.title, body: card.body, amount: card.amount },
      });
      if (state.players[playerIndex].money < 0) {
        markBankrupt(state, playerIndex, `${player.name} 在機會卡中破產`);
      }
      beginPrompt(state, {
        kind: "event",
        title: card.title,
        body: card.body,
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 抽到機會卡：${card.title}。`;
      return;
    }

    case "fortune": {
      const roll = takeRandom(state.rngSeed);
      state.rngSeed = roll.seed;
      const card = FORTUNE_CARDS[Math.floor(roll.value * FORTUNE_CARDS.length)];
      state.players[playerIndex] = { ...player, money: player.money + card.amount };
      pushEvent(state, {
        type: "fortune",
        playerId: player.id,
        summary: `${card.title} ${formatMoney(card.amount)}`,
        details: { title: card.title, body: card.body, amount: card.amount },
      });
      if (state.players[playerIndex].money < 0) {
        markBankrupt(state, playerIndex, `${player.name} 在命運卡中破產`);
      }
      beginPrompt(state, {
        kind: "event",
        title: card.title,
        body: card.body,
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 抽到命運卡：${card.title}。`;
      return;
    }

    case "tax": {
      const amount = tile.id === "tax-1" ? 120 : 180;
      state.players[playerIndex] = { ...player, money: player.money - amount };
      pushEvent(state, {
        type: "tax",
        playerId: player.id,
        summary: `${player.name} 繳納稅款 ${formatMoney(amount)}`,
        details: { tile: tile.name, amount },
      });
      if (state.players[playerIndex].money < 0) {
        markBankrupt(state, playerIndex, `${player.name} 因稅款破產`);
      }
      beginPrompt(state, {
        kind: "event",
        title: "繳稅",
        body: `${player.name} 向稅務局支付 ${formatMoney(amount)}。`,
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 遇到稅務局。`;
      return;
    }

    case "parking": {
      const amount = 100;
      state.players[playerIndex] = { ...player, money: player.money + amount };
      pushEvent(state, {
        type: "chance",
        playerId: player.id,
        summary: `${player.name} 取得停車獎金 ${formatMoney(amount)}`,
        details: { tile: tile.name, amount },
      });
      beginPrompt(state, {
        kind: "event",
        title: "免費停車",
        body: `${player.name} 取得 ${formatMoney(amount)} 停車獎金。`,
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 停在免費停車。`;
      return;
    }

    case "go_to_jail": {
      const jailIndex = state.board.findIndex((candidate) => candidate.type === "jail");
      state.players[playerIndex] = {
        ...player,
        position: jailIndex >= 0 ? jailIndex : player.position,
      };
      pushEvent(state, {
        type: "jail",
        playerId: player.id,
        summary: `${player.name} 被送進監獄`,
        details: { tile: tile.name, target: jailIndex },
      });
      beginPrompt(state, {
        kind: "event",
        title: "直接監獄",
        body: `${player.name} 被送往監獄，回合結束。`,
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 被送進監獄。`;
      return;
    }

    case "start": {
      beginPrompt(state, {
        kind: "event",
        title: "回到起點",
        body: "領取起點獎金，繼續下一輪布局。",
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 回到起點。`;
      return;
    }

    case "jail": {
      beginPrompt(state, {
        kind: "event",
        title: "監獄探訪",
        body: "你只是路過監獄，沒有被拘留。",
        autoMs: PROMPT_AUTO_MS,
      });
      state.message = `${player.name} 路過監獄。`;
      return;
    }
  }
}

function getMovePath(startPosition: number, diceTotal: number) {
  return Array.from({ length: diceTotal }, (_, index) => (startPosition + index + 1) % TILE_COUNT);
}

function beginRoll(state: GameState) {
  if (state.mode !== "playing" || state.phase !== "ready") return;

  const player = getCurrentPlayer(state);
  if (player.isBankrupt) return;

  const first = takeRandom(state.rngSeed);
  const second = takeRandom(first.seed);
  const diceFaces: [number, number] = [Math.floor(first.value * 6) + 1, Math.floor(second.value * 6) + 1];
  const diceTotal = diceFaces[0] + diceFaces[1];

  state.rngSeed = second.seed;
  state.phase = "rolling";
  state.diceFaces = diceFaces;
  state.diceTotal = diceTotal;
  state.rollMs = ROLL_REVEAL_MS;
  state.message = `${player.name} 擲出 ${diceFaces[0]} + ${diceFaces[1]} = ${diceTotal}。`;
  state.prompt = null;
}

function startMove(state: GameState) {
  const playerIndex = getCurrentPlayerIndex(state);
  const player = state.players[playerIndex];
  const path = getMovePath(player.position, state.diceTotal);
  if (!path.length) {
    state.phase = "prompt";
    resolveLanding(state);
    return;
  }

  state.phase = "moving";
  state.move = {
    playerId: player.id,
    startPosition: player.position,
    path,
    stepIndex: 0,
    stepElapsed: 0,
    stepMs: MOVE_STEP_MS,
  };
  state.message = `${player.name} 正在前進 ${state.diceTotal} 格。`;
}

function finishPrompt(state: GameState) {
  if (!state.prompt) return;

  const promptKind = state.prompt.kind;
  state.prompt = null;

  if (promptKind === "game_over") {
    state.mode = "game_over";
    state.phase = "game_over";
    return;
  }

  if (state.mode !== "playing") return;
  advanceTurn(state);
}

function advanceTurn(state: GameState) {
  if (state.mode !== "playing") return;

  const nextIndex = getNextActivePlayerIndex(state, state.currentPlayerIndex + 1);
  state.currentPlayerIndex = nextIndex;
  state.turn += 1;
  state.phase = "ready";
  state.move = null;
  state.diceTotal = 0;
  state.rollMs = 0;
  state.diceFaces = [1, 1];
  const current = getCurrentPlayer(state);
  state.message = current.isBankrupt ? "下一位玩家已破產，等待跳過。" : `${current.name} 輪到你了。`;
  finishIfNeeded(state);
}

export function rollDice(state: GameState): GameState {
  const next = deepCloneState(state);
  beginRoll(next);
  return next;
}

export function purchaseProperty(state: GameState): GameState {
  const next = deepCloneState(state);
  if (next.mode !== "playing" || next.phase !== "prompt" || !next.prompt || next.prompt.kind !== "buy") return next;

  const playerIndex = getCurrentPlayerIndex(next);
  const player = next.players[playerIndex];
  const tileIndex = next.board.findIndex((tile) => tile.id === next.prompt?.tileId);
  if (tileIndex === -1) return next;

  const tile = next.board[tileIndex];
  if (!tile.price || tile.owner || player.money < tile.price) {
    next.message = "資金不足，無法購買。";
    return next;
  }

  next.players[playerIndex] = {
    ...player,
    money: player.money - tile.price,
    properties: [...player.properties, tile.id],
  };
  next.board[tileIndex] = {
    ...tile,
    owner: player.id,
  };
  pushEvent(next, {
    type: "purchase",
    playerId: player.id,
    summary: `${player.name} 購買 ${tile.name}`,
    details: { tile: tile.name, amount: tile.price },
  });
  next.message = `${player.name} 購買了 ${tile.name}。`;
  next.prompt = null;
  advanceTurn(next);
  return next;
}

export function skipPurchase(state: GameState): GameState {
  const next = deepCloneState(state);
  if (next.mode !== "playing" || next.phase !== "prompt" || !next.prompt || next.prompt.kind !== "buy") return next;

  next.message = `${getCurrentPlayer(next).name} 選擇暫不購買。`;
  next.prompt = null;
  advanceTurn(next);
  return next;
}

export function confirmPrompt(state: GameState): GameState {
  const next = deepCloneState(state);
  if (next.phase !== "prompt" || !next.prompt) return next;
  finishPrompt(next);
  return next;
}

export function restartGame(): GameState {
  return createInitialState();
}

export function advanceGame(state: GameState, deltaMs: number): GameState {
  if (deltaMs <= 0) return state;

  const next = deepCloneState(state);
  next.animationMs += deltaMs;

  let remaining = deltaMs;
  while (remaining > 0) {
    if (next.mode === "game_over" || next.phase === "game_over") {
      next.rollMs = 0;
      next.move = null;
      return next;
    }

    if (next.phase === "rolling") {
      const used = Math.min(remaining, next.rollMs);
      next.rollMs -= used;
      remaining -= used;
      if (next.rollMs > 0) continue;
      startMove(next);
      continue;
    }

    if (next.phase === "moving" && next.move) {
      const move = next.move;
      const used = Math.min(remaining, move.stepMs - move.stepElapsed);
      move.stepElapsed += used;
      remaining -= used;
      if (move.stepElapsed < move.stepMs) continue;

      move.stepElapsed = 0;
      const playerIndex = next.players.findIndex((player) => player.id === move.playerId);
      if (playerIndex === -1) {
        next.phase = "ready";
        next.move = null;
        continue;
      }

      const nextStep = move.path[move.stepIndex];
      next.players[playerIndex] = {
        ...next.players[playerIndex],
        position: nextStep,
      };
      if (nextStep === 0) {
        next.players[playerIndex] = {
          ...next.players[playerIndex],
          money: next.players[playerIndex].money + PASS_START_REWARD,
        };
        pushEvent(next, {
          type: "pass_start",
          playerId: next.players[playerIndex].id,
          summary: `${next.players[playerIndex].name} 經過起點 ${formatMoney(PASS_START_REWARD)}`,
          details: { amount: PASS_START_REWARD },
        });
      }

      move.stepIndex += 1;
      pushEvent(next, {
        type: "move",
        playerId: next.players[playerIndex].id,
        summary: `${next.players[playerIndex].name} 移動到 ${nextStep}`,
        details: { position: nextStep, diceTotal: next.diceTotal },
      });

      if (move.stepIndex >= move.path.length) {
        next.move = null;
        next.phase = "prompt";
        resolveLanding(next);
      }

      continue;
    }

    if (next.phase === "prompt" && next.prompt) {
      if (next.prompt.kind === "buy" || next.prompt.kind === "game_over") return next;

      const autoMs = next.prompt.autoMs ?? null;
      if (autoMs == null) return next;

      const used = Math.min(remaining, autoMs);
      next.prompt.autoMs = autoMs - used;
      remaining -= used;
      if ((next.prompt.autoMs ?? 0) > 0) continue;

      finishPrompt(next);
      continue;
    }

    if (next.phase === "ready") {
      return next;
    }

    return next;
  }

  return next;
}

export function renderGameToText(state: GameState): string {
  const currentPlayer = state.players[getCurrentPlayerIndex(state)];
  const activeTile = state.board[currentPlayer?.position ?? 0];

  return JSON.stringify({
    coordinateSystem: "origin top-left; x increases right; y increases down; board path runs clockwise around a 7x7 grid; tile 0 is the bottom-right start tile",
    mode: state.mode,
    phase: state.phase,
    turn: state.turn,
    message: state.message,
    currentPlayer: currentPlayer
      ? {
          id: currentPlayer.id,
          name: currentPlayer.name,
          position: currentPlayer.position,
          money: currentPlayer.money,
          bankrupt: currentPlayer.isBankrupt,
          properties: [...currentPlayer.properties],
        }
      : null,
    activeTile: activeTile
      ? {
          id: activeTile.id,
          name: activeTile.name,
          type: activeTile.type,
          owner: activeTile.owner,
          price: activeTile.price ?? null,
          rent: activeTile.rent ?? null,
        }
      : null,
    dice: {
      faces: state.diceFaces,
      total: state.diceTotal,
      rolling: state.phase === "rolling",
      revealMs: Math.round(state.rollMs),
    },
    move: state.move
      ? {
          playerId: state.move.playerId,
          startPosition: state.move.startPosition,
          path: [...state.move.path],
          stepIndex: state.move.stepIndex,
          progress: Number((state.move.stepElapsed / state.move.stepMs).toFixed(2)),
        }
      : null,
    prompt: state.prompt
      ? {
          kind: state.prompt.kind,
          title: state.prompt.title,
          body: state.prompt.body,
          tileId: state.prompt.tileId ?? null,
          autoMs: state.prompt.autoMs ?? null,
          primaryLabel: state.prompt.primaryLabel ?? null,
          secondaryLabel: state.prompt.secondaryLabel ?? null,
        }
      : null,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      money: player.money,
      bankrupt: player.isBankrupt,
      properties: [...player.properties],
    })),
    board: state.board.map((tile) => ({
      id: tile.id,
      name: tile.name,
      type: tile.type,
      position: tile.position,
      owner: tile.owner ?? null,
      price: tile.price ?? null,
      rent: tile.rent ?? null,
      accent: tile.accent ?? null,
    })),
    lastEvent: state.events[state.events.length - 1] ?? null,
  });
}
