"use client";

import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Container from "@/components/common/Container";
import {
  BOARD_HEIGHT,
  BOARD_LEFT,
  BOARD_TOP,
  BOARD_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLS,
  GameMode,
  GameState,
  PANEL_LEFT,
  PANEL_TOP,
  PANEL_WIDTH,
  ROWS,
  Side,
  Unit,
  createInitialState,
  endPlayerPhase,
  getAttackTargets,
  getCombatForecast,
  getEnemyThreatTiles,
  getReachableTiles,
  handleBoardTap,
  restartGame,
  selectUnit,
  startBattle,
  terrainRows,
  tick,
  waitCurrentUnit,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void | Promise<void>;
  }
}

type UiSnapshot = {
  mode: GameMode;
  turn: number;
  message: string;
  moveTiles: string[];
  activeUnit: {
    id: string;
    name: string;
    className: string;
    side: Side;
    hp: number;
    maxHp: number;
    move: number;
    attackMin: number;
    attackMax: number;
    hasMoved: boolean;
    hasActed: boolean;
    boss: boolean;
    lord: boolean;
  } | null;
  allyCount: number;
  enemyCount: number;
  bossAlive: boolean;
  threatTiles: string[];
  combatForecasts: Array<{
    attackerId: string;
    attackerName: string;
    attackerHpAfter: number;
    defenderId: string;
    defenderName: string;
    defenderHpAfter: number;
    attackerDamage: number;
    defenderDamage: number;
    defenderCanCounter: boolean;
  }>;
  allies: Array<{
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    hasMoved: boolean;
    hasActed: boolean;
  }>;
  tileLabels: string[];
};

type BoardPoint = { x: number; y: number };

const FRAME_MS = 1000 / 60;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient,
) {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke: string,
  lineWidth: number,
) {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function makeSnapshot(state: GameState): UiSnapshot {
  const active = state.selectedUnitId ? state.units.find((unit) => unit.id === state.selectedUnitId) ?? null : null;
  const allies = state.units.filter((unit) => unit.alive && unit.side === "ally");
  const enemies = state.units.filter((unit) => unit.alive && unit.side === "enemy");
  const moveTiles = getReachableTiles(state, state.selectedUnitId).map((point) => `${point.x},${point.y}`);
  const threatTiles = state.mode === "player"
    ? getEnemyThreatTiles(state).map((point) => `${point.x},${point.y}`)
    : [];
  const threatened = new Set(threatTiles);
  const combatForecasts = active
    ? getAttackTargets(state, active.id).flatMap((target) => {
        const forecast = getCombatForecast(state, active.id, target.id);
        return forecast
          ? [{
              ...forecast,
              attackerName: active.name,
              defenderName: target.name,
            }]
          : [];
      })
    : [];

  return {
    mode: state.mode,
    turn: state.turn,
    message: state.message,
    moveTiles,
    activeUnit: active
      ? {
          id: active.id,
          name: active.name,
          className: active.className,
          side: active.side,
          hp: active.hp,
          maxHp: active.maxHp,
          move: active.move,
          attackMin: active.attackMin,
          attackMax: active.attackMax,
          hasMoved: active.hasMoved,
          hasActed: active.hasActed,
          boss: Boolean(active.boss),
          lord: Boolean(active.lord),
        }
      : null,
    allyCount: allies.length,
    enemyCount: enemies.length,
    bossAlive: enemies.some((unit) => unit.boss),
    threatTiles,
    combatForecasts,
    allies: allies.map((unit) => ({
      id: unit.id,
      name: unit.name,
      hp: unit.hp,
      maxHp: unit.maxHp,
      hasMoved: unit.hasMoved,
      hasActed: unit.hasActed,
    })),
    tileLabels: Array.from({ length: ROWS * COLS }, (_, index) =>
      describeBoardTile(
        state,
        index % COLS,
        Math.floor(index / COLS),
        threatened.has(`${index % COLS},${Math.floor(index / COLS)}`),
      ),
    ),
  };
}

function renderGameToText(state: GameState): string {
  const active = state.selectedUnitId ? state.units.find((unit) => unit.id === state.selectedUnitId) ?? null : null;
  const moveTiles = getReachableTiles(state, state.selectedUnitId).map((point) => `${point.x},${point.y}`);
  const attackTargets = getAttackTargets(state, state.selectedUnitId).map((unit) => ({
    id: unit.id,
    x: unit.x,
    y: unit.y,
    hp: unit.hp,
  }));
  const combatForecasts = active
    ? getAttackTargets(state, active.id).flatMap((target) => {
        const forecast = getCombatForecast(state, active.id, target.id);
        return forecast ? [{ ...forecast, attackerName: active.name, defenderName: target.name }] : [];
      })
    : [];

  return JSON.stringify({
    coordinateSystem: "origin top-left; x increases right; y increases down; board is 8x8",
    mode: state.mode,
    turn: state.turn,
    message: state.message,
    activeUnit: active
      ? {
          id: active.id,
          name: active.name,
          side: active.side,
          x: active.x,
          y: active.y,
          hp: active.hp,
          maxHp: active.maxHp,
          move: active.move,
          attackMin: active.attackMin,
          attackMax: active.attackMax,
          hasMoved: active.hasMoved,
          hasActed: active.hasActed,
          boss: Boolean(active.boss),
          lord: Boolean(active.lord),
        }
      : null,
    units: state.units
      .filter((unit) => unit.alive)
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        side: unit.side,
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        maxHp: unit.maxHp,
        moved: unit.hasMoved,
        acted: unit.hasActed,
        boss: Boolean(unit.boss),
        lord: Boolean(unit.lord),
      })),
    terrain: terrainRows(),
    moveTiles,
    attackTargets,
    threatTiles: getEnemyThreatTiles(state).map((point) => `${point.x},${point.y}`),
    combatForecasts,
    enemyStep:
      state.mode === "enemy"
        ? {
            index: state.enemyIndex,
            remaining: Math.max(0, state.enemyQueue.length - state.enemyIndex),
            timerMs: Math.round(state.phaseTimer),
          }
        : null,
  });
}

function terrainColor(tile: string) {
  switch (tile) {
    case "forest":
      return "#6aa84f";
    case "fort":
      return "#7cb2d6";
    case "throne":
      return "#d6b16b";
    case "wall":
      return "#6b7280";
    default:
      return "#d9c7a2";
  }
}

function terrainAccent(tile: string) {
  switch (tile) {
    case "forest":
      return "#355f1b";
    case "fort":
      return "#1e40af";
    case "throne":
      return "#7c5d19";
    case "wall":
      return "#374151";
    default:
      return "#8f7555";
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, isSelected: boolean, flash = 1) {
  const centerX = BOARD_LEFT + unit.x * 64 + 32;
  const centerY = BOARD_TOP + unit.y * 64 + 32;
  const fill = unit.side === "ally" ? unit.color : unit.color;
  const glow = unit.side === "ally" ? "#60a5fa" : "#fb7185";

  ctx.save();
  ctx.translate(centerX, centerY);

  if (isSelected) {
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = flash;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  fillRoundedRect(ctx, -19, -20, 38, 40, 15, fill);
  ctx.shadowBlur = 0;
  strokeRoundedRect(ctx, -19, -20, 38, 40, 15, "rgba(15, 23, 42, 0.5)", 2);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 18px var(--font-geist-sans), sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(unit.emblem, 0, 7);

  ctx.fillStyle = unit.side === "ally" ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(0, -11, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -11, 12, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const hpBarWidth = 40;
  const hpRatio = Math.max(0, unit.hp / unit.maxHp);
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  ctx.fillRect(-20, 26, hpBarWidth, 6);
  ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
  ctx.fillRect(-20, 26, hpBarWidth * hpRatio, 6);

  ctx.restore();
}

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, cursor: BoardPoint | null) {
  const selected = state.selectedUnitId ? state.units.find((unit) => unit.id === state.selectedUnitId) ?? null : null;
  const moveTiles = state.mode === "player" ? getReachableTiles(state, state.selectedUnitId) : [];
  const attackTargets = state.mode === "player" ? getAttackTargets(state, state.selectedUnitId) : [];
  const threatTiles = state.mode === "player" ? getEnemyThreatTiles(state) : [];
  const moveKeys = new Set(moveTiles.map((point) => `${point.x},${point.y}`));
  const attackKeys = new Set(attackTargets.map((unit) => `${unit.x},${unit.y}`));
  const threatKeys = new Set(threatTiles.map((point) => `${point.x},${point.y}`));
  const terrainMap: string[] = terrainRows();

  fillRoundedRect(ctx, BOARD_LEFT - 14, BOARD_TOP - 14, BOARD_WIDTH + 28, BOARD_HEIGHT + 28, 26, "#172554");
  fillRoundedRect(ctx, BOARD_LEFT - 8, BOARD_TOP - 8, BOARD_WIDTH + 16, BOARD_HEIGHT + 16, 20, "#0f172a");
  fillRoundedRect(ctx, BOARD_LEFT, BOARD_TOP, BOARD_WIDTH, BOARD_HEIGHT, 14, "#f8f1df");

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile: string = terrainMap[y]?.charAt(x) ?? ".";
      const left = BOARD_LEFT + x * 64 + 2;
      const top = BOARD_TOP + y * 64 + 2;
      const size = 60;
      const terrainType = tile === "f" ? "forest" : tile === "o" ? "fort" : tile === "#" ? "wall" : tile === "t" ? "throne" : "plain";

      ctx.save();
      fillRoundedRect(ctx, left, top, size, size, 10, terrainColor(terrainType));
      ctx.fillStyle = terrainAccent(terrainType);
      ctx.globalAlpha = terrainType === "forest" ? 0.3 : 0.16;
      if (terrainType === "forest") {
        ctx.beginPath();
        ctx.arc(left + 18, top + 18, 8, 0, Math.PI * 2);
        ctx.arc(left + 42, top + 26, 9, 0, Math.PI * 2);
        ctx.arc(left + 24, top + 42, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (terrainType === "fort") {
        ctx.fillRect(left + 14, top + 14, 32, 32);
      } else if (terrainType === "wall") {
        ctx.fillRect(left + 8, top + 26, 44, 8);
      } else if (terrainType === "throne") {
        ctx.fillRect(left + 20, top + 12, 20, 16);
        ctx.fillRect(left + 14, top + 28, 32, 18);
      }
      ctx.restore();

      if (moveKeys.has(`${x},${y}`) && !(selected?.x === x && selected?.y === y)) {
        ctx.save();
        ctx.fillStyle = "rgba(59, 130, 246, 0.24)";
        fillRoundedRect(ctx, left + 2, top + 2, size - 4, size - 4, 10, "rgba(59,130,246,0.22)");
        ctx.strokeStyle = "rgba(96, 165, 250, 0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(left + 4, top + 4, size - 8, size - 8);
        ctx.restore();
      }

      if (attackKeys.has(`${x},${y}`)) {
        ctx.save();
        ctx.fillStyle = "rgba(248, 113, 113, 0.26)";
        fillRoundedRect(ctx, left + 3, top + 3, size - 6, size - 6, 10, "rgba(248,113,113,0.24)");
        ctx.strokeStyle = "rgba(248, 113, 113, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(left + 5, top + 5, size - 10, size - 10);
        ctx.restore();
      }

      if (threatKeys.has(`${x},${y}`)) {
        ctx.save();
        ctx.fillStyle = "rgba(190, 24, 93, 0.8)";
        ctx.beginPath();
        ctx.moveTo(left + size - 16, top + 2);
        ctx.lineTo(left + size - 2, top + 2);
        ctx.lineTo(left + size - 2, top + 16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top, size, size);
    }
  }

  state.units.forEach((unit) => {
    if (!unit.alive) return;
    drawUnit(ctx, unit, unit.id === state.selectedUnitId && state.mode === "player");
  });

  if (cursor && state.mode === "player") {
    const left = BOARD_LEFT + cursor.x * 64 + 4;
    const top = BOARD_TOP + cursor.y * 64 + 4;
    ctx.save();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 14;
    strokeRoundedRect(ctx, left, top, 56, 56, 10, "#fef08a", 4);
    ctx.restore();
  }

  if (selected && selected.alive && state.mode === "player") {
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.font = "700 12px var(--font-geist-sans), sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${selected.name} | ${selected.hasMoved ? "Moved" : "Ready"} | ${selected.hasActed ? "Done" : "Active"}`,
      BOARD_LEFT + BOARD_WIDTH / 2,
      BOARD_TOP - 22,
    );
    ctx.restore();
  }
}

function drawPanel(ctx: CanvasRenderingContext2D, state: GameState, ui: UiSnapshot) {
  fillRoundedRect(ctx, PANEL_LEFT, PANEL_TOP, PANEL_WIDTH, 192, 24, "rgba(15, 23, 42, 0.9)");
  fillRoundedRect(ctx, PANEL_LEFT, PANEL_TOP + 206, PANEL_WIDTH, 156, 24, "rgba(248, 250, 252, 0.94)");

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 18px var(--font-geist-sans), sans-serif";
  ctx.fillText("Fire Emblem", PANEL_LEFT + 18, PANEL_TOP + 30);
  ctx.font = "600 13px var(--font-geist-sans), sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Tactics on a fixed battlefield", PANEL_LEFT + 18, PANEL_TOP + 52);

  const badges = [
    { label: "Phase", value: ui.mode },
    { label: "Turn", value: String(ui.turn) },
    { label: "Allies", value: String(ui.allyCount) },
    { label: "Enemies", value: String(ui.enemyCount) },
  ];

  badges.forEach((badge, index) => {
    const x = PANEL_LEFT + 18 + (index % 2) * 150;
    const y = PANEL_TOP + 70 + Math.floor(index / 2) * 44;
    fillRoundedRect(ctx, x, y, 132, 34, 12, "rgba(255,255,255,0.08)");
    ctx.fillStyle = "#93c5fd";
    ctx.font = "600 10px var(--font-geist-sans), sans-serif";
    ctx.fillText(badge.label.toUpperCase(), x + 10, y + 13);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 15px var(--font-geist-sans), sans-serif";
    ctx.fillText(badge.value, x + 10, y + 26);
  });

  if (ui.activeUnit) {
    fillRoundedRect(ctx, PANEL_LEFT + 12, PANEL_TOP + 216, PANEL_WIDTH - 24, 70, 18, "#ffffff");
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 15px var(--font-geist-sans), sans-serif";
    ctx.fillText(ui.activeUnit.name, PANEL_LEFT + 26, PANEL_TOP + 240);
    ctx.fillStyle = ui.activeUnit.side === "ally" ? "#2563eb" : "#dc2626";
    ctx.font = "700 11px var(--font-geist-sans), sans-serif";
    ctx.fillText(ui.activeUnit.className, PANEL_LEFT + 26, PANEL_TOP + 256);
    ctx.fillStyle = "#334155";
    ctx.fillText(
      `HP ${ui.activeUnit.hp}/${ui.activeUnit.maxHp} | Move ${ui.activeUnit.move} | Range ${ui.activeUnit.attackMin}-${ui.activeUnit.attackMax}`,
      PANEL_LEFT + 26,
      PANEL_TOP + 272,
    );
  } else {
    fillRoundedRect(ctx, PANEL_LEFT + 12, PANEL_TOP + 216, PANEL_WIDTH - 24, 70, 18, "#ffffff");
    ctx.fillStyle = "#475569";
    ctx.font = "700 14px var(--font-geist-sans), sans-serif";
    ctx.fillText("No unit selected", PANEL_LEFT + 26, PANEL_TOP + 248);
  }

  const forecast = ui.combatForecasts[0];
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 13px var(--font-geist-sans), sans-serif";
  ctx.fillText(forecast ? "Combat Forecast" : "Battle Log", PANEL_LEFT + 18, PANEL_TOP + 316);
  ctx.fillStyle = "#475569";
  ctx.font = "500 12px var(--font-geist-sans), sans-serif";
  if (forecast) {
    ctx.fillText(`${forecast.attackerName} → ${forecast.defenderName}: ${forecast.attackerDamage} damage`, PANEL_LEFT + 18, PANEL_TOP + 338);
    ctx.fillText(
      forecast.defenderCanCounter
        ? `Counter ${forecast.defenderDamage} · ${forecast.attackerName} ${forecast.attackerHpAfter} HP · ${forecast.defenderName} ${forecast.defenderHpAfter} HP`
        : `No counter · Target HP after: ${forecast.defenderHpAfter}`,
      PANEL_LEFT + 18,
      PANEL_TOP + 356,
    );
  } else {
    const wrapped = wrapText(ctx, ui.message, PANEL_WIDTH - 36, 2);
    wrapped.forEach((line, index) => ctx.fillText(line, PANEL_LEFT + 18, PANEL_TOP + 338 + index * 16));
  }

  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 12px var(--font-geist-sans), sans-serif";
  ctx.fillText("Objective", PANEL_LEFT + 18, PANEL_TOP + 384);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Defeat the Dread Lord before your Lord falls.", PANEL_LEFT + 18, PANEL_TOP + 402);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function describeBoardTile(state: GameState, x: number, y: number, isThreatened = false) {
  const terrainCode = terrainRows()[y]?.charAt(x) ?? ".";
  const terrain = terrainCode === "f" ? "forest" : terrainCode === "o" ? "fort" : terrainCode === "#" ? "wall" : terrainCode === "t" ? "throne" : "plain";
  const unit = state.units.find((candidate) => candidate.alive && candidate.x === x && candidate.y === y);
  const occupant = unit
    ? `${unit.side === "ally" ? "Ally" : "Enemy"} ${unit.name}, HP ${unit.hp} of ${unit.maxHp}`
    : "empty";
  return `Row ${y + 1}, column ${x + 1}, ${terrain}, ${occupant}.${isThreatened ? " Enemy threat range." : ""} Select, move, or attack.`;
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.mode === "player") return;

  ctx.save();
  ctx.fillStyle = state.mode === "enemy" ? "rgba(15, 23, 42, 0.18)" : "rgba(15, 23, 42, 0.68)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (state.mode === "enemy") {
    fillRoundedRect(ctx, BOARD_LEFT + 130, BOARD_TOP + 218, 330, 76, 24, "rgba(15, 23, 42, 0.9)");
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.font = "900 22px var(--font-geist-sans), sans-serif";
    ctx.fillText("Enemy Phase", BOARD_LEFT + 295, BOARD_TOP + 248);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 13px var(--font-geist-sans), sans-serif";
    ctx.fillText("Hostiles are advancing…", BOARD_LEFT + 295, BOARD_TOP + 274);
    ctx.restore();
    return;
  }

  fillRoundedRect(ctx, BOARD_LEFT + 84, BOARD_TOP + 126, 420, 182, 28, "rgba(255, 251, 235, 0.96)");
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "900 28px var(--font-geist-sans), sans-serif";

  if (state.mode === "menu") {
    ctx.fillText("Fire Emblem", BOARD_LEFT + 294, BOARD_TOP + 170);
    ctx.font = "600 14px var(--font-geist-sans), sans-serif";
    ctx.fillText("Move, attack, and protect the Lord across a fixed tactical map.", BOARD_LEFT + 294, BOARD_TOP + 198);
    ctx.fillText("Click tiles to move. Click enemies to attack. Wait ends the turn.", BOARD_LEFT + 294, BOARD_TOP + 220);
    ctx.fillText("Press Enter or Start Battle to begin. F toggles fullscreen.", BOARD_LEFT + 294, BOARD_TOP + 242);
  } else if (state.mode === "victory") {
    ctx.fillStyle = "#166534";
    ctx.fillText("Victory", BOARD_LEFT + 294, BOARD_TOP + 174);
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px var(--font-geist-sans), sans-serif";
    ctx.fillText("The Dread Lord has fallen.", BOARD_LEFT + 294, BOARD_TOP + 205);
    ctx.fillText("Press Restart or Space to play again.", BOARD_LEFT + 294, BOARD_TOP + 230);
  } else if (state.mode === "defeat") {
    ctx.fillStyle = "#b91c1c";
    ctx.fillText("Defeat", BOARD_LEFT + 294, BOARD_TOP + 174);
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px var(--font-geist-sans), sans-serif";
    ctx.fillText("Your Lord has fallen. The battle is lost.", BOARD_LEFT + 294, BOARD_TOP + 205);
    ctx.fillText("Press Restart or Space to try again.", BOARD_LEFT + 294, BOARD_TOP + 230);
  }

  ctx.restore();
}

function BattleOverlay({
  mode,
  isPaused,
  onStart,
  onResume,
  onRestart,
}: {
  mode: GameMode;
  isPaused: boolean;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
}) {
  if (!isPaused && mode !== "menu" && mode !== "victory" && mode !== "defeat") return null;

  const title = isPaused ? "Battle Paused" : mode === "menu" ? "The Siege Begins" : mode === "victory" ? "Victory" : "Defeat";
  const body = isPaused
    ? "Unit movement and the enemy phase are frozen."
    : mode === "menu"
      ? "Guide the Lord and allies through terrain, defeat the Dread Lord, and keep your commander alive."
      : mode === "victory"
        ? "The Dread Lord has fallen and the throne is secure."
        : "Your Lord has fallen. Regroup and try a new approach.";

  return (
    <div className="absolute inset-y-0 left-0 flex w-[calc(100vw-64px)] items-center justify-center rounded-[26px] bg-slate-950/58 p-4 backdrop-blur-[2px] sm:inset-0 sm:w-auto">
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="fire-emblem-overlay-title"
        aria-describedby="fire-emblem-overlay-body"
        className="w-full max-w-md rounded-[26px] border border-amber-200/22 bg-slate-950/94 p-5 text-center shadow-[0_26px_90px_rgba(15,23,42,0.62)] sm:p-7"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.36em] text-amber-300/80">
          {isPaused ? "Tactical break" : mode === "menu" ? "Chapter 1" : "Battle result"}
        </p>
        <h2 id="fire-emblem-overlay-title" className="mt-2 text-2xl font-black text-white sm:text-3xl">
          {title}
        </h2>
        <p id="fire-emblem-overlay-body" className="mt-3 text-sm leading-6 text-slate-200/78">
          {body}
        </p>
        <button
          type="button"
          onClick={isPaused ? onResume : mode === "menu" ? onStart : onRestart}
          className="mt-5 min-h-12 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/18 transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {isPaused ? "Resume Battle" : mode === "menu" ? "Begin Campaign" : "Fight Again"}
        </button>
      </section>
    </div>
  );
}

export default function FireEmblemPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef<number | null>(null);
  const initialState = createInitialState();
  const stateRef = useRef<GameState>(initialState);
  const cursorRef = useRef<BoardPoint>({ x: 1, y: 6 });
  const pausedRef = useRef(false);
  const [ui, setUi] = useState<UiSnapshot>(() => makeSnapshot(initialState));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cursor, setCursor] = useState<BoardPoint>({ x: 1, y: 6 });

  const updateUi = useCallback((state: GameState) => {
    setUi(makeSnapshot(state));
  }, []);

  const drawCurrentState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;
    const snapshot = makeSnapshot(state);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const background = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    background.addColorStop(0, "#f8fafc");
    background.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(108, 100, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath();
    ctx.arc(840, 112, 104, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 28px var(--font-geist-sans), sans-serif";
    ctx.fillText("Fire Emblem", 40, 48);
    ctx.fillStyle = "#475569";
    ctx.font = "500 14px var(--font-geist-sans), sans-serif";
    ctx.fillText("A compact tactics duel with movement, attack ranges, and enemy turns.", 40, 72);

    drawBoard(ctx, state, cursorRef.current);
    drawPanel(ctx, state, snapshot);
    drawOverlay(ctx, state);
  }, []);

  const moveCursor = useCallback((next: BoardPoint) => {
    const clamped = {
      x: Math.max(0, Math.min(COLS - 1, next.x)),
      y: Math.max(0, Math.min(ROWS - 1, next.y)),
    };
    cursorRef.current = clamped;
    setCursor(clamped);
    drawCurrentState();
  }, [drawCurrentState]);

  const commitState = useCallback(
    (nextState: GameState) => {
      stateRef.current = nextState;
      const selected = nextState.selectedUnitId
        ? nextState.units.find((unit) => unit.id === nextState.selectedUnitId && unit.alive)
        : null;
      if (selected) {
        cursorRef.current = { x: selected.x, y: selected.y };
        setCursor(cursorRef.current);
      }
      if (nextState.mode === "victory" || nextState.mode === "defeat") {
        viewportRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      }
      updateUi(nextState);
      drawCurrentState();
    },
    [drawCurrentState, updateUi],
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const availableWidth = viewportRef.current?.clientWidth ?? CANVAS_WIDTH;
    const isCompact = window.innerWidth < 640 && !isFullscreen;
    const canvasTop = canvas.getBoundingClientRect().top || 260;
    const availableHeight = Math.max(280, window.innerHeight - canvasTop - 24);
    const maxByHeight = (availableHeight * CANVAS_WIDTH) / CANVAS_HEIGHT;
    const maxWidth = isFullscreen
      ? Math.min(window.innerWidth - 32, ((window.innerHeight - 32) * CANVAS_WIDTH) / CANVAS_HEIGHT, 1060)
      : isCompact
        ? 720
        : Math.min(availableWidth, CANVAS_WIDTH, maxByHeight);
    const displayWidth = Math.max(isCompact ? 720 : 420, Math.floor(maxWidth));
    const displayHeight = Math.floor((displayWidth * CANVAS_HEIGHT) / CANVAS_WIDTH);

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(canvas.width / CANVAS_WIDTH, 0, 0, canvas.height / CANVAS_HEIGHT, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }, [isFullscreen]);

  const startBattleHandler = useCallback(() => {
    lastTimeRef.current = null;
    pausedRef.current = false;
    setIsPaused(false);
    commitState(startBattle(restartGame()));
  }, [commitState]);

  const restartHandler = useCallback(() => {
    lastTimeRef.current = null;
    pausedRef.current = false;
    setIsPaused(false);
    commitState(startBattle(restartGame()));
  }, [commitState]);

  const togglePause = useCallback(() => {
    if (stateRef.current.mode !== "player" && stateRef.current.mode !== "enemy") return;
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
    lastTimeRef.current = null;
    if (pausedRef.current) {
      viewportRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    drawCurrentState();
  }, [drawCurrentState, resizeCanvas]);

  useEffect(() => {
    let raf = 0;

    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }

      const delta = Math.min(time - lastTimeRef.current, 100);
      lastTimeRef.current = time;
      if (!pausedRef.current) {
        const nextState = tick(stateRef.current, delta);
        if (nextState !== stateRef.current) {
          stateRef.current = nextState;
          updateUi(nextState);
        }
      }
      drawCurrentState();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawCurrentState, updateUi]);

  useEffect(() => {
    const handleResize = () => resizeCanvas();
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      requestAnimationFrame(() => resizeCanvas());
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target === canvasRef.current) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.repeat) return;

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePause();
        return;
      }

      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          void document.exitFullscreen?.();
        }
        return;
      }

      if ((event.key === "Enter" || event.key === " ") && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (stateRef.current.mode === "menu") {
          startBattleHandler();
        } else if (stateRef.current.mode === "victory" || stateRef.current.mode === "defeat") {
          restartHandler();
        }
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        restartHandler();
        return;
      }

      if ((event.key === "w" || event.key === "W") && stateRef.current.mode === "player" && !pausedRef.current) {
        event.preventDefault();
        commitState(waitCurrentUnit(stateRef.current));
        return;
      }

      if ((event.key === "e" || event.key === "E") && stateRef.current.mode === "player" && !pausedRef.current) {
        event.preventDefault();
        commitState(endPlayerPhase(stateRef.current));
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [commitState, resizeCanvas, restartHandler, startBattleHandler, toggleFullscreen, togglePause]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
      if (pausedRef.current) return;
      if (ms <= 0) {
        drawCurrentState();
        return;
      }

      let remaining = ms;
      while (remaining > 0) {
        const step = Math.min(FRAME_MS, remaining);
        stateRef.current = tick(stateRef.current, step);
        remaining -= step;
      }

      updateUi(stateRef.current);
      lastTimeRef.current = null;
      drawCurrentState();
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [drawCurrentState, updateUi]);

  const handleCanvasClick = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || pausedRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      if (stateRef.current.mode === "menu") {
        startBattleHandler();
        return;
      }

      if (stateRef.current.mode === "victory" || stateRef.current.mode === "defeat") {
        restartHandler();
        return;
      }

      if (x >= BOARD_LEFT && x < BOARD_LEFT + BOARD_WIDTH && y >= BOARD_TOP && y < BOARD_TOP + BOARD_HEIGHT) {
        const gridX = Math.floor((x - BOARD_LEFT) / 64);
        const gridY = Math.floor((y - BOARD_TOP) / 64);
        commitState(handleBoardTap(stateRef.current, gridX, gridY));
      }
    },
    [commitState, restartHandler, startBattleHandler],
  );

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();

      if (key === "p") {
        event.preventDefault();
        togglePause();
        return;
      }

      if (isPaused) return;

      if (stateRef.current.mode === "menu" && (key === "enter" || key === " ")) {
        event.preventDefault();
        startBattleHandler();
        return;
      }

      if ((stateRef.current.mode === "victory" || stateRef.current.mode === "defeat") && (key === "enter" || key === " ")) {
        event.preventDefault();
        restartHandler();
        return;
      }

      if (stateRef.current.mode !== "player") return;

      const directions: Record<string, BoardPoint> = {
        arrowup: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
      };
      const direction = directions[key];
      if (direction) {
        event.preventDefault();
        moveCursor({ x: cursorRef.current.x + direction.x, y: cursorRef.current.y + direction.y });
        return;
      }

      if (key === "enter" || key === " ") {
        event.preventDefault();
        commitState(handleBoardTap(stateRef.current, cursorRef.current.x, cursorRef.current.y));
        return;
      }

      if (key === "w") {
        event.preventDefault();
        commitState(waitCurrentUnit(stateRef.current));
      } else if (key === "e") {
        event.preventDefault();
        commitState(endPlayerPhase(stateRef.current));
      }
    },
    [commitState, isPaused, moveCursor, restartHandler, startBattleHandler, togglePause],
  );

  const activeUnit = ui.activeUnit;
  const moveTiles = ui.moveTiles;
  // Fast Refresh can retain a pre-change snapshot while this component reloads.
  const allies = ui.allies ?? [];
  const tileLabels = ui.tileLabels ?? [];

  return (
    <Container size="full" className="py-6">
      <div className="rounded-[34px] border border-slate-900/8 bg-[radial-gradient(circle_at_8%_8%,_rgba(251,191,36,0.18),_transparent_28%),radial-gradient(circle_at_92%_10%,_rgba(59,130,246,0.16),_transparent_24%),linear-gradient(145deg,_#fffdf7,_#eef2f7)] p-4 shadow-[0_30px_100px_rgba(15,23,42,0.14)] sm:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-rose-700/70">Turn-based campaign</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Fire Emblem</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Command three distinct units, read the terrain, and break the Dread Lord&apos;s siege before your Lord falls.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {ui.mode === "menu" ? (
              <button type="button" onClick={startBattleHandler} className="min-h-12 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-emerald-600/18 transition hover:bg-emerald-500">
                Start Battle
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => commitState(waitCurrentUnit(stateRef.current))}
              disabled={ui.mode !== "player" || isPaused || !activeUnit || activeUnit.hasActed}
              className="min-h-12 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-md transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-38"
            >
              Wait <span className="ml-1 text-white/60">W</span>
            </button>
            <button
              type="button"
              onClick={() => commitState(ui.mode === "player" ? endPlayerPhase(stateRef.current) : stateRef.current)}
              disabled={ui.mode !== "player" || isPaused}
              className="min-h-12 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 shadow-md transition enabled:hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-38"
            >
              End Phase <span className="ml-1 text-slate-950/60">E</span>
            </button>
            <button
              type="button"
              onClick={togglePause}
              disabled={ui.mode !== "player" && ui.mode !== "enemy"}
              aria-pressed={isPaused}
              className="min-h-12 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-md transition enabled:hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-38"
            >
              {isPaused ? "Resume" : "Pause"} <span className="ml-1 text-white/60">P</span>
            </button>
            <button type="button" onClick={restartHandler} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-md transition hover:bg-slate-50">
              Restart <span className="ml-1 text-slate-400">R</span>
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} className="min-h-12 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-black text-white shadow-md transition hover:bg-sky-600">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"} <span className="ml-1 text-white/60">F</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div
            ref={viewportRef}
            className="w-full overflow-x-auto rounded-[28px] border border-slate-300/80 bg-slate-900/8 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.18)] [scrollbar-color:#94a3b8_transparent]"
            aria-label="Scrollable tactical battlefield"
          >
            <div className="relative mx-auto w-max">
              {ui.mode === "player" && !isPaused ? (
                <div role="note" aria-label="Battlefield overlay legend" className="pointer-events-none absolute left-3 top-3 z-20 flex gap-1.5 rounded-full border border-slate-200/70 bg-white/90 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-700 shadow-md backdrop-blur-sm">
                  <span><span className="text-sky-500">■</span> Move</span>
                  <span><span className="text-rose-400">■</span> Target</span>
                  <span><span className="text-pink-700">◢</span> Threat</span>
                </div>
              ) : null}
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                tabIndex={0}
                role="application"
                aria-label={`Tactical battlefield. Phase ${ui.mode}, turn ${ui.turn}. ${activeUnit ? `${activeUnit.name} selected.` : "No unit selected."} Keyboard cursor column ${cursor.x + 1}, row ${cursor.y + 1}. Use arrow keys to move the cursor and Enter to select, move, or attack.`}
                onClick={handleCanvasClick}
                onKeyDown={handleCanvasKeyDown}
                className="block shrink-0 rounded-[26px] bg-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                style={{ imageRendering: "auto" }}
              />
              {ui.mode === "player" && !isPaused ? (
                <div role="group" aria-label="Battlefield tiles" className="pointer-events-none absolute inset-0">
                  {Array.from({ length: ROWS * COLS }, (_, index) => {
                    const x = index % COLS;
                    const y = Math.floor(index / COLS);
                    return (
                      <button
                        key={`${x}-${y}`}
                        type="button"
                        tabIndex={-1}
                        aria-label={tileLabels[index] ?? `Row ${y + 1}, column ${x + 1}. Select, move, or attack.`}
                        onClick={() => commitState(handleBoardTap(stateRef.current, x, y))}
                        className="pointer-events-auto absolute rounded-[10px] bg-transparent transition hover:bg-white/10 focus-visible:bg-amber-300/18 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-amber-300"
                        style={{
                          left: `${((BOARD_LEFT + x * 64) / CANVAS_WIDTH) * 100}%`,
                          top: `${((BOARD_TOP + y * 64) / CANVAS_HEIGHT) * 100}%`,
                          width: `${(64 / CANVAS_WIDTH) * 100}%`,
                          height: `${(64 / CANVAS_HEIGHT) * 100}%`,
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
              <BattleOverlay mode={ui.mode} isPaused={isPaused} onStart={startBattleHandler} onResume={togglePause} onRestart={restartHandler} />
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Select an allied unit">
            {allies.map((ally) => (
              <button
                key={ally.id}
                type="button"
                onClick={() => commitState(selectUnit(stateRef.current, ally.id))}
                disabled={ui.mode !== "player" || isPaused || ally.hasActed}
                aria-pressed={activeUnit?.id === ally.id}
                className="min-h-12 min-w-[132px] rounded-2xl border border-slate-200 bg-white/88 px-4 py-2.5 text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-sky-500 aria-pressed:bg-sky-50 aria-pressed:ring-2 aria-pressed:ring-sky-200"
              >
                <span className="block text-sm font-black text-slate-900">{ally.name}</span>
                <span className="block text-xs text-slate-500">HP {ally.hp}/{ally.maxHp} · {ally.hasActed ? "Done" : ally.hasMoved ? "Moved" : "Ready"}</span>
              </button>
            ))}
          </div>

          {ui.combatForecasts.length > 0 ? (
            <section className="w-full rounded-3xl border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 p-4 shadow-sm" aria-labelledby="combat-forecast-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">Before you commit</p>
                  <h2 id="combat-forecast-heading" className="mt-1 text-lg font-black text-slate-950">Combat forecast</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ui.combatForecasts.map((forecast) => (
                    <div key={forecast.defenderId} className="min-w-[220px] rounded-2xl border border-white/90 bg-white/86 px-4 py-3 shadow-sm">
                      <p className="text-sm font-black text-slate-900">{forecast.attackerName} → {forecast.defenderName}</p>
                      <p className="mt-1 text-xs font-bold text-rose-700">Deal {forecast.attackerDamage} · target {forecast.defenderHpAfter} HP</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {forecast.defenderCanCounter
                          ? `Counter ${forecast.defenderDamage} · ${forecast.attackerName} ends at ${forecast.attackerHpAfter} HP`
                          : "No counterattack at this range"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid w-full gap-4 md:grid-cols-3" aria-live="polite">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Phase</p>
              <p className="mt-2 text-2xl font-black capitalize text-slate-900">{isPaused ? "paused" : ui.mode} · Turn {ui.turn}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{ui.message}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Active Unit</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{activeUnit ? activeUnit.name : "None"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {activeUnit
                  ? `${activeUnit.className} · HP ${activeUnit.hp}/${activeUnit.maxHp} · Move ${activeUnit.move} · Range ${activeUnit.attackMin}-${activeUnit.attackMax}`
                  : "Begin the battle to select your Lord."}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Range & controls</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{moveTiles.length} move · {ui.threatTiles.length} threat</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Blue is movement, rose is an attack target, and a dark red corner marks enemy threat. Arrows + Enter operate the keyboard cursor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
