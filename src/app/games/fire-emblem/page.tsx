"use client";

import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
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
  getReachableTiles,
  handleBoardTap,
  restartGame,
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
};

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

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState) {
  const selected = state.selectedUnitId ? state.units.find((unit) => unit.id === state.selectedUnitId) ?? null : null;
  const moveTiles = state.mode === "player" ? getReachableTiles(state, state.selectedUnitId) : [];
  const attackTargets = state.mode === "player" ? getAttackTargets(state, state.selectedUnitId) : [];
  const moveKeys = new Set(moveTiles.map((point) => `${point.x},${point.y}`));
  const attackKeys = new Set(attackTargets.map((unit) => `${unit.x},${unit.y}`));
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

      ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top, size, size);
    }
  }

  state.units.forEach((unit) => {
    if (!unit.alive) return;
    drawUnit(ctx, unit, unit.id === state.selectedUnitId && state.mode === "player");
  });

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

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 13px var(--font-geist-sans), sans-serif";
  ctx.fillText("Battle Log", PANEL_LEFT + 18, PANEL_TOP + 316);
  ctx.fillStyle = "#475569";
  ctx.font = "500 12px var(--font-geist-sans), sans-serif";
  const wrapped = wrapText(ctx, ui.message, PANEL_WIDTH - 36, 2);
  wrapped.forEach((line, index) => ctx.fillText(line, PANEL_LEFT + 18, PANEL_TOP + 338 + index * 16));

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

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.mode === "player") return;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.74)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

export default function FireEmblemPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTimeRef = useRef<number | null>(null);
  const initialState = createInitialState();
  const stateRef = useRef<GameState>(initialState);
  const [ui, setUi] = useState<UiSnapshot>(() => makeSnapshot(initialState));
  const [isFullscreen, setIsFullscreen] = useState(false);

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

    drawBoard(ctx, state);
    drawPanel(ctx, state, snapshot);
    drawOverlay(ctx, state);
  }, []);

  const commitState = useCallback(
    (nextState: GameState) => {
      stateRef.current = nextState;
      updateUi(nextState);
      drawCurrentState();
    },
    [drawCurrentState, updateUi],
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const maxWidth = isFullscreen
      ? Math.min(window.innerWidth - 32, ((window.innerHeight - 32) * CANVAS_WIDTH) / CANVAS_HEIGHT, 1060)
      : Math.min(canvas.parentElement?.clientWidth ?? CANVAS_WIDTH, CANVAS_WIDTH);
    const displayWidth = Math.max(320, Math.floor(maxWidth));
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
    commitState(startBattle(restartGame()));
  }, [commitState]);

  const restartHandler = useCallback(() => {
    lastTimeRef.current = null;
    commitState(startBattle(restartGame()));
  }, [commitState]);

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
      const nextState = tick(stateRef.current, delta);
      if (nextState !== stateRef.current) {
        stateRef.current = nextState;
        updateUi(nextState);
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
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          void document.exitFullscreen?.();
        }
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (stateRef.current.mode === "menu") {
          startBattleHandler();
        } else if (stateRef.current.mode === "victory" || stateRef.current.mode === "defeat") {
          restartHandler();
        }
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        restartHandler();
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
  }, [resizeCanvas, restartHandler, startBattleHandler, toggleFullscreen]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
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
      if (!canvas) return;

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

  const activeUnit = ui.activeUnit;
  const moveTiles = ui.moveTiles;

  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black text-stone-900 sm:text-5xl">Fire Emblem</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600 sm:text-base">
            A tactics prototype with turn order, terrain bonuses, and a boss objective.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={startBattleHandler}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-600"
          >
            Start Battle
          </button>
          <button
            onClick={() => commitState(waitCurrentUnit(stateRef.current))}
            disabled={ui.mode !== "player" || !activeUnit || activeUnit.hasActed}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Wait
          </button>
          <button
            onClick={() => commitState(ui.mode === "player" ? endPlayerPhase(stateRef.current) : stateRef.current)}
            disabled={ui.mode !== "player"}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            End Phase
          </button>
          <button
            onClick={restartHandler}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-800 shadow-md transition hover:bg-stone-50"
          >
            Restart
          </button>
          <button
            onClick={() => void toggleFullscreen()}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-sky-700"
          >
            Fullscreen
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className="w-full max-w-[960px] rounded-[28px] border border-stone-300 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]"
          style={{ imageRendering: "auto" }}
        />

        <div className="grid w-full max-w-[960px] gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Phase</p>
            <p className="mt-2 text-2xl font-black text-stone-900">{ui.mode}</p>
            <p className="mt-2 text-sm text-stone-600">{ui.message}</p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Active Unit</p>
            <p className="mt-2 text-2xl font-black text-stone-900">{activeUnit ? activeUnit.name : "None"}</p>
            <p className="mt-2 text-sm text-stone-600">
              {activeUnit
                ? `${activeUnit.className} | HP ${activeUnit.hp}/${activeUnit.maxHp} | Move ${activeUnit.move} | Range ${activeUnit.attackMin}-${activeUnit.attackMax}`
                : "Choose Start Battle to begin."}
            </p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-stone-400">Range Preview</p>
            <p className="mt-2 text-2xl font-black text-stone-900">{moveTiles.length} move tiles</p>
            <p className="mt-2 text-sm text-stone-600">
              Click an empty highlighted tile to move. Click a red enemy to attack. Use Wait to end the current unit.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
