import { describe, expect, test } from "bun:test";
import {
  createMemoryGame,
  formatElapsed,
  generateDeck,
  getRating,
  parseBestMoves,
  resolveTurn,
  revealCard,
  stateToCardRows,
  tickMemoryGame,
  togglePause,
} from "./utils";

describe("generateDeck", () => {
  test("creates exactly two cards for every selected face", () => {
    const deck = generateDeck(6, () => 0.42);
    const faceCounts = deck.reduce<Record<string, number>>((counts, card) => {
      counts[card.icon] = (counts[card.icon] ?? 0) + 1;
      return counts;
    }, {});

    expect(deck).toHaveLength(12);
    expect(Object.keys(faceCounts)).toHaveLength(6);
    expect(Object.values(faceCounts).every((count) => count === 2)).toBe(true);
    expect(deck.every((card) => !card.isFlipped && !card.isMatched)).toBe(true);
  });

  test("rejects unsupported pair counts", () => {
    expect(() => generateDeck(0)).toThrow(RangeError);
    expect(() => generateDeck(19)).toThrow(RangeError);
  });
});

describe("formatElapsed", () => {
  test("formats elapsed seconds as a stable clock", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(-9)).toBe("00:00");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(3_661)).toBe("61:01");
  });
});

describe("memory round state", () => {
  test("reveals a pair and resolves a scored match without mutating the opening deck", () => {
    const initial = createMemoryGame(6, () => 0.42);
    const firstIndex = 0;
    const secondIndex = initial.deck.findIndex(
      (card, index) => index !== firstIndex && card.icon === initial.deck[firstIndex].icon,
    );
    const firstReveal = revealCard(initial, firstIndex);
    const pending = revealCard(firstReveal, secondIndex);
    const resolved = resolveTurn(pending);

    expect(initial.deck[firstIndex].isFlipped).toBe(false);
    expect(firstReveal.phase).toBe("playing");
    expect(pending.phase).toBe("resolving");
    expect(pending.moves).toBe(1);
    expect(resolved.deck[firstIndex].isMatched).toBe(true);
    expect(resolved.deck[secondIndex].isMatched).toBe(true);
    expect(resolved.matches).toBe(1);
    expect(resolved.streak).toBe(1);
    expect(resolved.score).toBe(100);
  });

  test("conceals a mismatch, breaks the streak, and applies the score floor", () => {
    const initial = {
      ...createMemoryGame(6, () => 0.42),
      phase: "playing" as const,
      score: 100,
      streak: 3,
    };
    const firstIndex = 0;
    const secondIndex = initial.deck.findIndex((card) => card.icon !== initial.deck[firstIndex].icon);
    const pending = revealCard(revealCard(initial, firstIndex), secondIndex);
    const resolved = resolveTurn(pending);

    expect(resolved.phase).toBe("playing");
    expect(resolved.deck[firstIndex].isFlipped).toBe(false);
    expect(resolved.deck[secondIndex].isFlipped).toBe(false);
    expect(resolved.streak).toBe(0);
    expect(resolved.score).toBe(90);
    expect(resolveTurn(resolved)).toBe(resolved);
  });

  test("finishes a perfect round with a three-star rating", () => {
    let state = createMemoryGame(6, () => 0.42);
    const pairs = new Map<string, number[]>();
    state.deck.forEach((card, index) => {
      pairs.set(card.icon, [...(pairs.get(card.icon) ?? []), index]);
    });

    for (const [firstIndex, secondIndex] of pairs.values()) {
      state = revealCard(state, firstIndex);
      state = revealCard(state, secondIndex);
      state = resolveTurn(state);
    }

    expect(state.phase).toBe("won");
    expect(state.matches).toBe(6);
    expect(state.moves).toBe(6);
    expect(getRating(state.pairsCount, state.moves)).toBe(3);
    expect(getRating(6, 8)).toBe(2);
    expect(getRating(6, 10)).toBe(1);
  });

  test("pauses only an active round and freezes elapsed time", () => {
    const ready = createMemoryGame(6, () => 0.42);
    const playing = revealCard(ready, 0);
    const paused = togglePause(playing);

    expect(togglePause(ready)).toBe(ready);
    expect(paused.phase).toBe("paused");
    expect(tickMemoryGame(paused)).toBe(paused);
    expect(togglePause(paused).phase).toBe("playing");
    expect(tickMemoryGame(playing).elapsedSeconds).toBe(1);
  });

  test("sanitizes stored records and renders inspectable rows", () => {
    const state = revealCard(createMemoryGame(6, () => 0.42), 0);

    expect(parseBestMoves("7")).toBe(7);
    expect(parseBestMoves("0")).toBeNull();
    expect(parseBestMoves("7.5")).toBeNull();
    expect(parseBestMoves("oops")).toBeNull();
    expect(stateToCardRows(state, 3)).toHaveLength(4);
    expect(stateToCardRows(state, 3)[0]).toContain("F:");
  });
});
