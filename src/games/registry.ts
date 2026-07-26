export type GameStatus = 'published' | 'beta' | 'planned';

export interface QualityVerificationSummary {
  result: 'passed' | 'failed';
  baselineVersion: number;
  revision: string;
  verifiedAt: string;
  record: string;
}

export interface GameDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  status: GameStatus;
  qualityVerification: QualityVerificationSummary | null;
}

export const GAME_REGISTRY: GameDef[] = [
  {
    id: "snake",
    title: "Snake",
    description: "Race through wrap portals, collect every fifth golden fruit, and grow a high-scoring circuit without folding into your tail.",
    icon: "i-ph-snake-duotone",
    href: "/games/snake",
    color: "bg-green-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "memory-match",
    title: "Memory Match",
    description: "Map a cosmic card archive, protect matching streaks, earn star ratings, and improve your best moves across three board sizes.",
    icon: "i-ph-cards-duotone",
    href: "/games/memory-match",
    color: "bg-pink-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "lights-out",
    title: "Lights Out",
    description: "Reroute three circuit sizes, chase the target solution, undo experiments, and black out every node with fewer hints.",
    icon: "i-ph-lightbulb-filament-duotone",
    href: "/games/lights-out",
    color: "bg-yellow-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "tetris",
    title: "Tetris",
    description: "Stack with SRS rotation and hold, chain combo bonuses, chase perfect clears, and react before the danger frame turns critical.",
    icon: "i-ph-squares-four-duotone",
    href: "/games/tetris",
    color: "bg-purple-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "gomoku",
    title: "Gomoku",
    description: "Shape intersecting threats on a coordinate board, challenge three AI levels, and reveal the winning five-stone line.",
    icon: "i-ph-circle-duotone",
    href: "/games/gomoku",
    color: "bg-amber-600",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "sudoku",
    title: "Sudoku",
    description: "Solve three uniquely generated manuscripts with candidate notes, conflict guidance, undo, hints, and star-rated efficiency.",
    icon: "i-ph-grid-nine-duotone",
    href: "/games/sudoku",
    color: "bg-blue-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "zookeeper",
    title: "Zookeeper",
    description: "Price every growing animal chain, protect the open Gold path, and reach 1500 points through a reshuffling puzzle safari.",
    icon: "i-ph-paw-print-duotone",
    href: "/games/zookeeper",
    color: "bg-emerald-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "puzzle-bobble",
    title: "Puzzle Bobble",
    description: "Bank guided shots, drop unsupported clusters, protect a rising chain, and read the pressure before the neon ceiling closes in.",
    icon: "i-ph-circles-three-duotone",
    href: "/games/puzzle-bobble",
    color: "bg-fuchsia-500",
    status: 'published',
    qualityVerification: {
      result: 'passed',
      baselineVersion: 1,
      revision: '5cfc09cde365c927f7b4b00eef7abc1d744c5e66',
      verifiedAt: '2026-07-26',
      record: 'docs/Games/verification/puzzle-bobble/2026-07-26-v1.md',
    },
  },
  {
    id: "kids-stair-rush",
    title: "Kids Stair Rush",
    description: "Read the next color-coded landing, protect your streak and health, and adapt before each major speed surge in the accelerating shaft.",
    icon: "i-ph-stairs-duotone",
    href: "/games/kids-stair-rush",
    color: "bg-sky-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "farm",
    title: "Farm",
    description: "Cultivate a seasonal pixel farm, fulfill timed market orders, grow the field through harvest XP, and tend crops across real-world weather cycles.",
    icon: "i-ph-leaf-duotone",
    href: "/games/farm",
    color: "bg-green-600",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "battleship-blitz",
    title: "Battleship Blitz",
    description: "Defend the fleet through escalating formations, chain kills across four upgradeable weapons, and confront a patterned mothership every fifth wave.",
    icon: "i-ph-rocket-duotone",
    href: "/games/battleship-blitz",
    color: "bg-cyan-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "fire-emblem",
    title: "Fire Emblem",
    description: "Read enemy threat zones and combat forecasts, coordinate three distinct units across terrain, and break the Dread Lord's siege without losing your Lord.",
    icon: "i-ph-chess-knight-duotone",
    href: "/games/fire-emblem",
    color: "bg-rose-600",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "babylon-rpg",
    title: "Babylon RPG",
    description: "Track the nearest objective, read enemy pursuit and sword range, recover persistent relics, and conquer three procedural 3D realms.",
    icon: "i-ph-sword-duotone",
    href: "/games/babylon-rpg",
    color: "bg-cyan-600",
    status: "published",
    qualityVerification: null,
  },
  {
    id: "2048",
    title: "2048",
    description: "Join the numbers and get to the 2048 tile!",
    icon: "i-ph-squares-four-duotone",
    href: "/games/2048",
    color: "bg-orange-500",
    status: 'planned',
    qualityVerification: null,
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    description: "Find and clear all the mines without triggering any.",
    icon: "i-ph-bomb-duotone",
    href: "/games/minesweeper",
    color: "bg-red-500",
    status: 'planned',
    qualityVerification: null,
  },
  {
    id: "city-builder",
    title: "City Builder",
    description: "用即時服務範圍規劃道路與街區，在電力、供水、幸福度與收支之間養成一座大都會。",
    icon: "i-ph-buildings-duotone",
    href: "/games/city-builder",
    color: "bg-teal-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "battle-city",
    title: "Battle City",
    description: "駕駛可升級戰車穿越五區防線，攔截敵軍、搶奪六種戰場補給並守住中央鷹堡。",
    icon: "i-ph-tank-duotone",
    href: "/games/battle-city",
    color: "bg-red-600",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "ice-blocks",
    title: "Ice Blocks",
    description: "接住冰塊與稀有金塊，觀察即時連擊價值再粉碎得分，並閃避會清空冰桶的火球。",
    icon: "i-ph-ice-cream-duotone",
    href: "/games/ice-blocks",
    color: "bg-sky-400",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "monopoly",
    title: "Monopoly",
    description: "雙人擲骰買地、比較租金率與現金水位，在事件卡與收租攻防中壓垮對手。",
    icon: "i-ph-house-duotone",
    href: "/games/monopoly",
    color: "bg-indigo-500",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "whack-a-mole",
    title: "Whack-A-Mole",
    description: "敲擊九宮格地鼠、連打破除鋼盔，守住連擊並挑戰十關逐步加速的分數目標。",
    icon: "i-ph-hammer-duotone",
    href: "/games/whack-a-mole",
    color: "bg-lime-600",
    status: 'published',
    qualityVerification: null,
  },
  {
    id: "deep-sea-penguin",
    title: "Deep Sea Penguin",
    description: "Read each approaching current surge, collect golden fish, and dodge newly unlocked deep-sea hazards under a brief recovery shield.",
    icon: "i-ph-waves-duotone",
    href: "/games/deep-sea-penguin",
    color: "bg-blue-600",
    status: 'published',
    qualityVerification: null,
  },
];

export const getPublishedGames = () => GAME_REGISTRY.filter(g => g.status === 'published');
export const isPlayableStatus = (status: GameStatus) => ['published', 'beta'].includes(status);
export const getPlayableGames = () => GAME_REGISTRY.filter(g => isPlayableStatus(g.status));
export const getPlannedGames = () => GAME_REGISTRY.filter(g => g.status === 'planned');
