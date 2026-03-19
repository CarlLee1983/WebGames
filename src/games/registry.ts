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
];

export const getPublishedGames = () => GAME_REGISTRY.filter(g => g.status === 'published');
export const getPlannedGames = () => GAME_REGISTRY.filter(g => ['planned', 'beta'].includes(g.status));
