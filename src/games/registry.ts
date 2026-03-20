export type GameStatus = 'published' | 'beta' | 'planned';

export interface GameDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  status: GameStatus;
}

export const GAME_REGISTRY: GameDef[] = [
  {
    id: "snake",
    title: "Snake",
    description: "Classic retro game. Control the snake, eat the food, and avoid hitting the walls or yourself.",
    icon: "i-ph-snake-duotone",
    href: "/games/snake",
    color: "bg-green-500",
    status: 'published',
  },
  {
    id: "memory-match",
    title: "Memory Match",
    description: "Test your memory by finding matching pairs of cards.",
    icon: "i-ph-cards-duotone",
    href: "/games/memory-match",
    color: "bg-pink-500",
    status: 'published',
  },
  {
    id: "lights-out",
    title: "Lights Out",
    description: "A logic puzzle where you must turn off all the lights. Clicking one toggles its neighbors!",
    icon: "i-ph-lightbulb-filament-duotone",
    href: "/games/lights-out",
    color: "bg-yellow-500",
    status: 'published',
  },
  {
    id: "tetris",
    title: "Tetris",
    description: "Stack the falling blocks to clear lines and score points. Don't let them reach the top!",
    icon: "i-ph-squares-four-duotone",
    href: "/games/tetris",
    color: "bg-purple-500",
    status: 'published',
  },
  {
    id: "gomoku",
    title: "Gomoku",
    description: "The strategy board game where you aim to get five in a row.",
    icon: "i-ph-circle-duotone",
    href: "/games/gomoku",
    color: "bg-amber-600",
    status: 'published',
  },
  {
    id: "sudoku",
    title: "Sudoku",
    description: "The classic logic-based number placement puzzle game.",
    icon: "i-ph-grid-nine-duotone",
    href: "/games/sudoku",
    color: "bg-blue-500",
    status: 'published',
  },
  {
    id: "zookeeper",
    title: "Zookeeper",
    description: "Chain together matching zoo animals, trigger reshuffles, and hit the target score in a solo safari puzzle run.",
    icon: "i-ph-paw-print-duotone",
    href: "/games/zookeeper",
    color: "bg-emerald-500",
    status: 'published',
  },
  {
    id: "kids-stair-rush",
    title: "Kids Stair Rush",
    description: "Help the little one dash down the stairs! Dodge obstacles and react fast as the stairs speed up.",
    icon: "i-ph-stairs-duotone",
    href: "/games/kids-stair-rush",
    color: "bg-sky-500",
    status: 'published',
  },
  {
    id: "farm",
    title: "Farm",
    description: "Grow crops, water them, and harvest for coins and XP! A relaxing pixel farming game.",
    icon: "i-ph-leaf-duotone",
    href: "/games/farm",
    color: "bg-green-600",
    status: 'published',
  },
  {
    id: "battleship-blitz",
    title: "Battleship Blitz",
    description: "A retro arcade space shooter! Dodge bullets, destroy enemies, and collect power-ups to survive the waves.",
    icon: "i-ph-rocket-duotone",
    href: "/games/battleship-blitz",
    color: "bg-cyan-500",
    status: 'published',
  },
  {
    id: "fire-emblem",
    title: "Fire Emblem",
    description: "A compact tactics skirmish with movement ranges, terrain bonuses, enemy counterattacks, and a boss objective.",
    icon: "i-ph-chess-knight-duotone",
    href: "/games/fire-emblem",
    color: "bg-rose-600",
    status: 'published',
  },
  {
    id: "2048",
    title: "2048",
    description: "Join the numbers and get to the 2048 tile!",
    icon: "i-ph-squares-four-duotone",
    href: "/games/2048",
    color: "bg-orange-500",
    status: 'planned',
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    description: "Find and clear all the mines without triggering any.",
    icon: "i-ph-bomb-duotone",
    href: "/games/minesweeper",
    color: "bg-red-500",
    status: 'planned',
  },
  {
    id: "city-builder",
    title: "City Builder",
    description: "規劃道路、興建住宅、接通電力，打造屬於你的繁榮城市！",
    icon: "i-ph-buildings-duotone",
    href: "/games/city-builder",
    color: "bg-teal-500",
    status: 'published',
  },
  {
    id: "battle-city",
    title: "Battle City",
    description: "Classic retro tank battle game. Destroy enemy tanks, collect power-ups, and defend your base!",
    icon: "i-ph-tank-duotone",
    href: "/games/battle-city",
    color: "bg-red-600",
    status: 'published',
  },
  {
    id: "ice-blocks",
    title: "Ice Blocks",
    description: "接住從天而降的冰塊，疊得越高分數越高！",
    icon: "i-ph-ice-cream-duotone",
    href: "/games/ice-blocks",
    color: "bg-sky-400",
    status: 'published',
  },
  {
    id: "monopoly",
    title: "Monopoly",
    description: "經典大富翁遊戲！購買地產、收租金、與對手競爭！",
    icon: "i-ph-house-duotone",
    href: "/games/monopoly",
    color: "bg-indigo-500",
    status: 'published',
  },
];

export const getPublishedGames = () => GAME_REGISTRY.filter(g => g.status === 'published');
export const getPlannedGames = () => GAME_REGISTRY.filter(g => ['planned', 'beta'].includes(g.status));
