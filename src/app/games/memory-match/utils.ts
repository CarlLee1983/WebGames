export type Card = {
  id: string;
  icon: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
};

export type PairCount = 6 | 8 | 12;
export type MemoryPhase = "ready" | "playing" | "resolving" | "paused" | "won";

export type MemoryGameState = {
  pairsCount: PairCount;
  deck: Card[];
  selectedIndices: number[];
  phase: MemoryPhase;
  moves: number;
  matches: number;
  streak: number;
  score: number;
  elapsedSeconds: number;
  feedback: string;
};

type CardFace = Pick<Card, "icon" | "label">;

const ICON_LIBRARY: CardFace[] = [
  { icon: "i-ph-alien-duotone", label: "Alien" },
  { icon: "i-ph-anchor-simple-duotone", label: "Anchor" },
  { icon: "i-ph-apple-podcasts-logo-duotone", label: "Signal" },
  { icon: "i-ph-asterisk-duotone", label: "Spark" },
  { icon: "i-ph-atom-duotone", label: "Atom" },
  { icon: "i-ph-basketball-duotone", label: "Basketball" },
  { icon: "i-ph-bat-duotone", label: "Bat" },
  { icon: "i-ph-bell-ringing-duotone", label: "Bell" },
  { icon: "i-ph-bicycle-duotone", label: "Bicycle" },
  { icon: "i-ph-bird-duotone", label: "Bird" },
  { icon: "i-ph-bomb-duotone", label: "Bomb" },
  { icon: "i-ph-bone-duotone", label: "Bone" },
  { icon: "i-ph-butterfly-duotone", label: "Butterfly" },
  { icon: "i-ph-cactus-duotone", label: "Cactus" },
  { icon: "i-ph-camera-duotone", label: "Camera" },
  { icon: "i-ph-campfire-duotone", label: "Campfire" },
  { icon: "i-ph-car-profile-duotone", label: "Car" },
  { icon: "i-ph-cat-duotone", label: "Cat" },
];

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

export function generateDeck(
  pairsCount: number,
  random: () => number = Math.random,
): Card[] {
  if (!Number.isInteger(pairsCount) || pairsCount < 1 || pairsCount > ICON_LIBRARY.length) {
    throw new RangeError(`pairsCount must be between 1 and ${ICON_LIBRARY.length}`);
  }

  const selectedFaces = shuffle(ICON_LIBRARY, random).slice(0, pairsCount);

  return shuffle([...selectedFaces, ...selectedFaces], random).map(
    (face, index) => ({
      id: `${face.icon}-${index}`,
      ...face,
      isFlipped: false,
      isMatched: false,
    }),
  );
}

export function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createMemoryGame(
  pairsCount: PairCount,
  random: () => number = Math.random,
): MemoryGameState {
  return {
    pairsCount,
    deck: generateDeck(pairsCount, random),
    selectedIndices: [],
    phase: "ready",
    moves: 0,
    matches: 0,
    streak: 0,
    score: 0,
    elapsedSeconds: 0,
    feedback: "Choose a card to begin the expedition.",
  };
}

export function revealCard(state: MemoryGameState, index: number): MemoryGameState {
  if (state.phase !== "ready" && state.phase !== "playing") return state;

  const card = state.deck[index];
  if (!card || card.isFlipped || card.isMatched || state.selectedIndices.length >= 2) return state;

  const deck = state.deck.map((item, cardIndex) =>
    cardIndex === index ? { ...item, isFlipped: true } : item,
  );
  const selectedIndices = [...state.selectedIndices, index];

  if (selectedIndices.length === 1) {
    return {
      ...state,
      deck,
      selectedIndices,
      phase: "playing",
      feedback: `${card.label} revealed. Find its twin.`,
    };
  }

  const firstCard = deck[selectedIndices[0]];
  const isMatch = firstCard.icon === card.icon;
  return {
    ...state,
    deck,
    selectedIndices,
    phase: "resolving",
    moves: state.moves + 1,
    feedback: isMatch
      ? `${card.label} pair discovered!`
      : `${firstCard.label} and ${card.label} do not match.`,
  };
}

export function resolveTurn(state: MemoryGameState): MemoryGameState {
  if (state.phase !== "resolving" || state.selectedIndices.length !== 2) return state;

  const [firstIndex, secondIndex] = state.selectedIndices;
  const isMatch = state.deck[firstIndex].icon === state.deck[secondIndex].icon;

  if (!isMatch) {
    return {
      ...state,
      deck: state.deck.map((card, index) =>
        index === firstIndex || index === secondIndex ? { ...card, isFlipped: false } : card,
      ),
      selectedIndices: [],
      phase: "playing",
      streak: 0,
      score: Math.max(0, state.score - 10),
      feedback: "No match. The archive concealed both symbols again.",
    };
  }

  const matches = state.matches + 1;
  const streak = state.streak + 1;
  const won = matches === state.pairsCount;
  const gain = 100 + (streak - 1) * 25;

  return {
    ...state,
    deck: state.deck.map((card, index) =>
      index === firstIndex || index === secondIndex
        ? { ...card, isMatched: true, isFlipped: true }
        : card,
    ),
    selectedIndices: [],
    phase: won ? "won" : "playing",
    matches,
    streak,
    score: state.score + gain,
    feedback: won
      ? "Archive restored. Every constellation is paired."
      : `Pair secured for ${gain} points. Streak ×${streak}.`,
  };
}

export function togglePause(state: MemoryGameState): MemoryGameState {
  if (state.phase === "playing") {
    return {
      ...state,
      phase: "paused",
      feedback: "Expedition paused. The archive is sealed.",
    };
  }

  if (state.phase === "paused") {
    return {
      ...state,
      phase: "playing",
      feedback: "Expedition resumed. Keep matching.",
    };
  }

  return state;
}

export function tickMemoryGame(state: MemoryGameState): MemoryGameState {
  if (state.phase !== "playing" && state.phase !== "resolving") return state;
  return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
}

export function getRating(pairsCount: PairCount, moves: number): 1 | 2 | 3 {
  if (moves <= pairsCount) return 3;
  if (moves <= Math.ceil(pairsCount * 1.5)) return 2;
  return 1;
}

export function parseBestMoves(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function stateToCardRows(state: MemoryGameState, columns: number): string[] {
  const tokens = state.deck.map((card) =>
    card.isMatched ? `M:${card.label}` : card.isFlipped ? `F:${card.label}` : "H",
  );
  const rows: string[] = [];
  for (let index = 0; index < tokens.length; index += columns) {
    rows.push(tokens.slice(index, index + columns).join(" | "));
  }
  return rows;
}
