// 記憶翻牌遊戲工具

export type Card = {
  id: string;
  icon: string;
  isFlipped: boolean;
  isMatched: boolean;
};

const ICON_LIBRARY = [
  'i-ph-alien-duotone',
  'i-ph-anchor-simple-duotone',
  'i-ph-apple-podcasts-logo-duotone',
  'i-ph-asterisk-duotone',
  'i-ph-atom-duotone',
  'i-ph-basketball-duotone',
  'i-ph-bat-duotone',
  'i-ph-bell-ringing-duotone',
  'i-ph-bicycle-duotone',
  'i-ph-bird-duotone',
  'i-ph-bomb-duotone',
  'i-ph-bone-duotone',
  'i-ph-butterfly-duotone',
  'i-ph-cactus-duotone',
  'i-ph-camera-duotone',
  'i-ph-campfire-duotone',
  'i-ph-car-profile-duotone',
  'i-ph-cat-duotone',
];

export function generateDeck(pairsCount: number): Card[] {
  // 1. Shuffle the icon library and pick the required number of pairs
  const shuffledIcons = [...ICON_LIBRARY].sort(() => Math.random() - 0.5);
  const selectedIcons = shuffledIcons.slice(0, pairsCount);

  // 2. Duplicate them to create pairs
  const pairedIcons = [...selectedIcons, ...selectedIcons];

  // 3. Shuffle the deck and map to Card objects
  const deck = pairedIcons
    .sort(() => Math.random() - 0.5)
    .map((icon, index) => ({
      id: `${icon}-${index}`,
      icon,
      isFlipped: false,
      isMatched: false,
    }));

  return deck;
}
