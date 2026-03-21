export const HOLE_COUNT = 9; // 增加洞穴數量讓隨機感更強
export const PLAY_AREA_SIZE = 100; // Percentage

export const BASE_SPAWN_RATE = 1200; // 縮短生成間隔 (從 1500 -> 1200ms)
export const BASE_UP_TIME = 1500;    // 縮短地鼠停留時間 (從 2000 -> 1500ms)
export const HELMET_MOLE_CHANCE = 0.15; // 提高鋼盔地鼠基礎機率

export const LEVEL_GOALS = [
  800,   // Level 1 (之前是 300) - 需更多命中數來暖身
  1800,  // Level 2 (之前是 600)
  3200,  // Level 3 (之前是 1000)
  5000,  // Level 4 (之前是 1500)
  7500,  // Level 5 (之前是 2200) - 難度開始大幅躍升
  10500, // Level 6
  14000, // Level 7
  18500, // Level 8
  24000, // Level 9
  30000  // Level 10 - 終極挑戰
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
  const minDistance = 22; // 稍微縮減間距以容納更多洞穴
  const margin = 12; // 邊緣留白縮小，增加活動範圍

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
