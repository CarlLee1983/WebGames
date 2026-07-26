import { describe, expect, test } from "bun:test";
import {
  PASS_START_REWARD,
  STARTING_MONEY,
  TILE_COUNT,
  advanceGame,
  confirmPrompt,
  createInitialState,
  getPurchaseDecision,
  purchaseProperty,
  renderGameToText,
  restartGame,
  rollDice,
  skipPurchase,
} from "./utils";

function completeFirstTurn() {
  return advanceGame(rollDice(createInitialState()), 5_000);
}

function reachFirstPurchase() {
  return advanceGame(rollDice(completeFirstTurn()), 5_000);
}

describe("Monopoly rules", () => {
  test("creates a clean two-player board", () => {
    const state = createInitialState();

    expect(state.mode).toBe("playing");
    expect(state.phase).toBe("ready");
    expect(state.board).toHaveLength(TILE_COUNT);
    expect(state.players).toHaveLength(2);
    expect(state.players.every((player) => player.money === STARTING_MONEY)).toBe(true);
    expect(state.board.every((tile) => !tile.owner)).toBe(true);
  });

  test("uses deterministic dice and resolves timed event prompts", () => {
    const rolled = rollDice(createInitialState());
    const resolved = advanceGame(rolled, 5_000);

    expect(rolled.diceFaces).toEqual([1, 1]);
    expect(rolled.diceTotal).toBe(2);
    expect(resolved.players[0].position).toBe(2);
    expect(resolved.players[0].money).toBe(1_400);
    expect(resolved.currentPlayerIndex).toBe(1);
    expect(resolved.turn).toBe(2);
    expect(resolved.phase).toBe("ready");
  });

  test("buys a property without mutating the prompt state", () => {
    const promptState = reachFirstPurchase();
    const decision = getPurchaseDecision(promptState);
    const purchased = purchaseProperty(promptState);
    const station = purchased.board.find((tile) => tile.id === "station-1");

    expect(promptState.prompt?.kind).toBe("buy");
    expect(promptState.players[1].money).toBe(STARTING_MONEY);
    expect(decision).toEqual({
      tileId: "station-1",
      tileName: "車站",
      price: 220,
      rent: 26,
      cashBefore: 1_500,
      cashAfter: 1_280,
      yieldPercent: 11.8,
      affordable: true,
    });
    expect(purchased.players[1].money).toBe(1_280);
    expect(purchased.players[1].properties).toEqual(["station-1"]);
    expect(station?.owner).toBe("player-1");
    expect(purchased.currentPlayerIndex).toBe(0);
    expect(purchased.turn).toBe(3);
  });

  test("skips the purchase decision when the current player cannot afford the property", () => {
    const initial = createInitialState();
    const moving = {
      ...initial,
      phase: "moving" as const,
      diceTotal: 1,
      players: initial.players.map((player, index) =>
        index === 0 ? { ...player, money: 100 } : player,
      ),
      move: {
        playerId: "player-0",
        startPosition: 0,
        path: [1],
        stepIndex: 0,
        stepElapsed: 0,
        stepMs: 140,
      },
    };
    const resolved = advanceGame(moving, 140);

    expect(resolved.prompt?.kind).toBe("event");
    expect(resolved.prompt?.title).toBe("資金不足");
    expect(resolved.prompt?.body).toContain("尚差 $20");
    expect(getPurchaseDecision(resolved)).toBeNull();
  });

  test("skips an offered property without charging the player", () => {
    const promptState = reachFirstPurchase();
    const skipped = skipPurchase(promptState);
    const station = skipped.board.find((tile) => tile.id === "station-1");

    expect(skipped.players[1].money).toBe(STARTING_MONEY);
    expect(skipped.players[1].properties).toEqual([]);
    expect(station?.owner).toBeUndefined();
    expect(skipped.turn).toBe(3);
  });

  test("awards the start bonus while crossing tile zero", () => {
    const initial = createInitialState();
    const moving = {
      ...initial,
      phase: "moving" as const,
      diceTotal: 2,
      players: initial.players.map((player, index) =>
        index === 0 ? { ...player, position: 23 } : player,
      ),
      move: {
        playerId: "player-0",
        startPosition: 23,
        path: [0, 1],
        stepIndex: 0,
        stepElapsed: 0,
        stepMs: 140,
      },
    };
    const crossed = advanceGame(moving, 140);

    expect(crossed.players[0].position).toBe(0);
    expect(crossed.players[0].money).toBe(STARTING_MONEY + PASS_START_REWARD);
    expect(crossed.events.some((event) => event.type === "pass_start")).toBe(true);
  });

  test("ends the game when rent bankrupts the final opponent", () => {
    const initial = createInitialState();
    const moving = {
      ...initial,
      phase: "moving" as const,
      diceTotal: 1,
      board: initial.board.map((tile) =>
        tile.id === "harbor-street" ? { ...tile, owner: "player-1" } : tile,
      ),
      players: initial.players.map((player, index) =>
        index === 0
          ? { ...player, money: 5 }
          : { ...player, properties: ["harbor-street"] },
      ),
      move: {
        playerId: "player-0",
        startPosition: 0,
        path: [1],
        stepIndex: 0,
        stepElapsed: 0,
        stepMs: 140,
      },
    };
    const rentPrompt = advanceGame(moving, 140);
    const finished = confirmPrompt(rentPrompt);

    expect(rentPrompt.players[0].isBankrupt).toBe(true);
    expect(rentPrompt.events.some((event) => event.type === "bankruptcy")).toBe(true);
    expect(finished.mode).toBe("game_over");
    expect(finished.prompt?.kind).toBe("game_over");
    expect(finished.prompt?.title).toBe("玩家2 獲勝");
  });

  test("restarts cleanly and renders inspectable game state", () => {
    const restarted = restartGame();
    const rendered = JSON.parse(renderGameToText(restarted));
    const purchaseRendered = JSON.parse(renderGameToText(reachFirstPurchase()));

    expect(restarted.turn).toBe(1);
    expect(restarted.events).toEqual([]);
    expect(rendered.mode).toBe("playing");
    expect(rendered.currentPlayer.name).toBe("玩家1");
    expect(rendered.board).toHaveLength(TILE_COUNT);
    expect(purchaseRendered.purchaseDecision.cashAfter).toBe(1_280);
    expect(purchaseRendered.purchaseDecision.yieldPercent).toBe(11.8);
  });
});
