export const HOLE_COUNT = 7;
export const PLAY_AREA_SIZE = 100; // Percentage

export const BASE_SPAWN_RATE = 1500; // ms
export const BASE_UP_TIME = 2000; // ms
export const HELMET_MOLE_CHANCE = 0.1;

export const LEVEL_GOALS = [
  150,  // Level 1
  350,  // Level 2
  600,  // Level 3
  900,  // Level 4
  1300, // Level 5
  1800, // Level 6
  2400, // Level 7
  3100, // Level 8
  3900, // Level 9
  5000  // Level 10
];

export type MoleType = "normal" | "helmet";
export type MoleStatus = "hiding" | "up" | "hit" | "escaped";

export interface MoleState {
  id: number;
  type: MoleType;
  status: MoleStatus;
  health: number;
  createdAt: number;
}

export function generateRandomHoles() {
  const holes: { id: number; x: number; y: number }[] = [];
  const minDistance = 25; // Minimum percentage distance between holes
  const margin = 15; // Margin from edges

  for (let i = 0; i < HOLE_COUNT; i++) {
    let x, y, valid;
    let attempts = 0;
    do {
      valid = true;
      x = margin + Math.random() * (100 - margin * 2);
      y = margin + Math.random() * (100 - margin * 2);
      
      for (const h of holes) {
        const dist = Math.sqrt(Math.pow(h.x - x, 2) + Math.pow(h.y - y, 2));
        if (dist < minDistance) {
          valid = false;
          break;
        }
      }
      attempts++;
    } while (!valid && attempts < 100);

    holes.push({ id: i, x, y });
  }

  return holes;
}
