"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  BOARD_HEIGHT,
  BOARD_LEFT,
  BOARD_TOP,
  BOARD_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL_SIZE,
  COLS,
  GameMode,
  GameState,
  PANEL_LEFT,
  PANEL_TOP,
  PANEL_WIDTH,
  PIECES,
  PieceType,
  ROWS,
  boardToRows,
  createInitialState,
  getDropInterval,
  getGhostY,
  hardDrop,
  holdPiece,
  movePiece,
  restartGame,
  rotatePiece,
  softDrop,
  startGame,
  tick,
  togglePause,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
  }
}

type UiSnapshot = {
  mode: GameMode;
  score: number;
  level: number;
  lines: number;
  nextPiece: PieceType | null;
  holdPiece: PieceType | null;
  canHold: boolean;
};

const FRAME_MS = 1000 / 60;
const INITIAL_TETRIS_STATE = createInitialState();
const HOLD_PANEL_HEIGHT = 104;
const NEXT_PANEL_Y = PANEL_TOP + HOLD_PANEL_HEIGHT + 14;
const NEXT_PANEL_HEIGHT = 118;
const METRICS_PANEL_Y = NEXT_PANEL_Y + NEXT_PANEL_HEIGHT + 14;
const METRICS_PANEL_HEIGHT = 188;
const QUEUE_PANEL_Y = METRICS_PANEL_Y + METRICS_PANEL_HEIGHT + 14;
const QUEUE_PANEL_HEIGHT = 106;

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

function getOccupiedBounds(matrix: number[][]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) return;
      minX = Math.min(minX, colIndex);
      minY = Math.min(minY, rowIndex);
      maxX = Math.max(maxX, colIndex);
      maxY = Math.max(maxY, rowIndex);
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  type: PieceType,
  alpha = 1,
  inset = 3,
) {
  const style = PIECES[type];
  const x = BOARD_LEFT + cellX * CELL_SIZE + inset;
  const y = BOARD_TOP + cellY * CELL_SIZE + inset;
  const size = CELL_SIZE - inset * 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = alpha < 0.5 ? 0 : 10;
  fillRoundedRect(ctx, x, y, size, size, 7, style.fill);
  ctx.shadowBlur = 0;
  strokeRoundedRect(ctx, x, y, size, size, 7, style.stroke, 2);

  const highlight = ctx.createLinearGradient(x, y, x, y + size);
  highlight.addColorStop(0, "rgba(255,255,255,0.34)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  fillRoundedRect(ctx, x + 2, y + 2, size - 4, Math.max(8, size * 0.42), 5, highlight);
  ctx.restore();
}

function drawPiecePreview(
  ctx: CanvasRenderingContext2D,
  type: PieceType | null,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
  alpha = 1,
) {
  if (!type) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 12px var(--font-geist-sans), sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Empty", x + boxWidth / 2, y + boxHeight / 2 + 4);
    ctx.textAlign = "left";
    return;
  }

  const matrix = PIECES[type].matrix;
  const bounds = getOccupiedBounds(matrix);
  const previewCell = Math.max(14, Math.min(22, Math.floor(Math.min((boxWidth - 24) / bounds.width, (boxHeight - 24) / bounds.height))));
  const pieceWidth = bounds.width * previewCell;
  const pieceHeight = bounds.height * previewCell;
  const startX = x + (boxWidth - pieceWidth) / 2;
  const startY = y + (boxHeight - pieceHeight) / 2;

  matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) return;
      const cellX = startX + (colIndex - bounds.minX) * previewCell;
      const cellY = startY + (rowIndex - bounds.minY) * previewCell;
      const style = PIECES[type];

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = alpha < 0.6 ? 0 : 8;
      fillRoundedRect(ctx, cellX, cellY, previewCell - 2, previewCell - 2, 5, style.fill);
      ctx.shadowBlur = 0;
      strokeRoundedRect(ctx, cellX, cellY, previewCell - 2, previewCell - 2, 5, style.stroke, 1.5);
      ctx.restore();
    });
  });
}

function renderGameToText(state: GameState): string {
  return JSON.stringify({
    coordinateSystem: "board origin top-left; x increases right 0-9; y increases down 0-19",
    mode: state.mode,
    score: state.score,
    level: state.level,
    lines: state.lines,
    hold: state.hold,
    canHold: state.canHold,
    dropIntervalMs: getDropInterval(state.level),
    active: {
      type: state.active.type,
      x: state.active.x,
      y: state.active.y,
      rotation: state.active.rotation,
      width: state.active.matrix[0]?.length ?? 0,
      height: state.active.matrix.length,
    },
    ghostY: getGhostY(state.board, state.active),
    queue: state.queue.slice(0, 5),
    board: boardToRows(state.board),
  });
}

function drawScene(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const background = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  background.addColorStop(0, "#f8fafc");
  background.addColorStop(1, "#dbeafe");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(84, 94, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#bfdbfe";
  ctx.beginPath();
  ctx.arc(436, 128, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  fillRoundedRect(ctx, 18, 22, CANVAS_WIDTH - 36, CANVAS_HEIGHT - 44, 30, "rgba(15, 23, 42, 0.08)");
  fillRoundedRect(ctx, 14, 18, CANVAS_WIDTH - 36, CANVAS_HEIGHT - 44, 30, "rgba(255, 255, 255, 0.82)");

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px var(--font-geist-sans), sans-serif";
  ctx.fillText("Tetris Arcade", 28, 52);
  ctx.fillStyle = "#475569";
  ctx.font = "500 13px var(--font-geist-sans), sans-serif";
  ctx.fillText("Hold queue plus SRS wall kicks, rendered on a single deterministic canvas.", 28, 72);

  fillRoundedRect(ctx, BOARD_LEFT - 10, BOARD_TOP - 10, BOARD_WIDTH + 20, BOARD_HEIGHT + 20, 24, "#0f172a");
  fillRoundedRect(ctx, BOARD_LEFT, BOARD_TOP, BOARD_WIDTH, BOARD_HEIGHT, 18, "#111827");

  ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
  ctx.lineWidth = 1;
  for (let rowIndex = 1; rowIndex < ROWS; rowIndex += 1) {
    const y = BOARD_TOP + rowIndex * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(BOARD_LEFT, y);
    ctx.lineTo(BOARD_LEFT + BOARD_WIDTH, y);
    ctx.stroke();
  }
  for (let colIndex = 1; colIndex < COLS; colIndex += 1) {
    const x = BOARD_LEFT + colIndex * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, BOARD_TOP);
    ctx.lineTo(x, BOARD_TOP + BOARD_HEIGHT);
    ctx.stroke();
  }

  state.board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) return;
      drawBlock(ctx, colIndex, rowIndex, cell);
    });
  });

  const ghostY = getGhostY(state.board, state.active);
  state.active.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) return;
      const drawY = ghostY + rowIndex;
      if (drawY < 0) return;
      drawBlock(ctx, state.active.x + colIndex, drawY, state.active.type, 0.18, 6);
    });
  });

  state.active.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value === 0) return;
      const drawY = state.active.y + rowIndex;
      if (drawY < 0) return;
      drawBlock(ctx, state.active.x + colIndex, drawY, state.active.type);
    });
  });

  fillRoundedRect(ctx, PANEL_LEFT, PANEL_TOP, PANEL_WIDTH, HOLD_PANEL_HEIGHT, 22, "#eff6ff");
  fillRoundedRect(ctx, PANEL_LEFT, NEXT_PANEL_Y, PANEL_WIDTH, NEXT_PANEL_HEIGHT, 22, "#eff6ff");
  fillRoundedRect(ctx, PANEL_LEFT, METRICS_PANEL_Y, PANEL_WIDTH, METRICS_PANEL_HEIGHT, 22, "#eff6ff");
  fillRoundedRect(ctx, PANEL_LEFT, QUEUE_PANEL_Y, PANEL_WIDTH, QUEUE_PANEL_HEIGHT, 22, "#eff6ff");

  ctx.fillStyle = "#1e293b";
  ctx.font = "700 14px var(--font-geist-sans), sans-serif";
  ctx.fillText("Hold", PANEL_LEFT + 16, PANEL_TOP + 24);
  drawPiecePreview(ctx, state.hold, PANEL_LEFT + 16, PANEL_TOP + 30, PANEL_WIDTH - 32, 50, state.canHold ? 1 : 0.42);
  ctx.fillStyle = state.canHold ? "#0f766e" : "#b45309";
  ctx.font = "700 11px var(--font-geist-sans), sans-serif";
  ctx.fillText(state.canHold ? "READY" : "LOCKED", PANEL_LEFT + 16, PANEL_TOP + 92);

  ctx.fillStyle = "#1e293b";
  ctx.font = "700 14px var(--font-geist-sans), sans-serif";
  ctx.fillText("Next Piece", PANEL_LEFT + 16, NEXT_PANEL_Y + 24);
  drawPiecePreview(ctx, state.queue[0] ?? state.active.type, PANEL_LEFT + 16, NEXT_PANEL_Y + 30, PANEL_WIDTH - 32, 68);

  const metrics = [
    { label: "Score", value: String(state.score), color: "#0f172a" },
    { label: "Level", value: String(state.level), color: "#7c3aed" },
    { label: "Lines", value: String(state.lines), color: "#0891b2" },
    {
      label: "Speed",
      value: `${Math.round((1000 / getDropInterval(state.level)) * 10) / 10}x`,
      color: "#ea580c",
    },
  ];

  metrics.forEach((metric, index) => {
    const cardX = PANEL_LEFT + 14;
    const cardY = METRICS_PANEL_Y + 18 + index * 42;
    fillRoundedRect(ctx, cardX, cardY, PANEL_WIDTH - 28, 34, 12, "#ffffff");
    ctx.fillStyle = "#64748b";
    ctx.font = "600 10px var(--font-geist-sans), sans-serif";
    ctx.fillText(metric.label.toUpperCase(), cardX + 10, cardY + 13);
    ctx.fillStyle = metric.color;
    ctx.font = "700 16px var(--font-geist-sans), sans-serif";
    ctx.fillText(metric.value, cardX + 10, cardY + 27);
  });

  ctx.fillStyle = "#1e293b";
  ctx.font = "700 14px var(--font-geist-sans), sans-serif";
  ctx.fillText("Queue", PANEL_LEFT + 16, QUEUE_PANEL_Y + 24);
  ctx.font = "600 13px var(--font-geist-mono), monospace";
  state.queue.slice(0, 4).forEach((piece, index) => {
    ctx.fillStyle = PIECES[piece].fill;
    ctx.fillText(`${index + 1}. ${piece}`, PANEL_LEFT + 18, QUEUE_PANEL_Y + 50 + index * 16);
  });

  if (state.lastClear > 0 && state.mode === "playing") {
    fillRoundedRect(ctx, BOARD_LEFT + 48, BOARD_TOP + 22, BOARD_WIDTH - 96, 44, 18, "rgba(250, 204, 21, 0.96)");
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 18px var(--font-geist-sans), sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${state.lastClear} line${state.lastClear > 1 ? "s" : ""} cleared`, BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 50);
    ctx.textAlign = "left";
  }

  if (state.mode !== "playing") {
    fillRoundedRect(ctx, BOARD_LEFT + 18, BOARD_TOP + 110, BOARD_WIDTH - 36, 260, 26, "rgba(15, 23, 42, 0.88)");
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.font = "800 28px var(--font-geist-sans), sans-serif";

    if (state.mode === "ready") {
      ctx.fillText("Start the Stack", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 160);
      ctx.font = "500 14px var(--font-geist-sans), sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("Enter starts. A / C / Shift holds. Up / X rotates right.", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 200);
      ctx.fillText("Z / B rotates left. Space hard drops. Down soft drops.", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 226);
      ctx.fillText("P or Esc pauses. F toggles fullscreen.", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 252);
    }

    if (state.mode === "paused") {
      ctx.fillText("Paused", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 176);
      ctx.font = "500 16px var(--font-geist-sans), sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("Resume from the button row or press P / Esc.", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 218);
      ctx.fillText("The queue, hold slot, and board stay frozen while paused.", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 246);
    }

    if (state.mode === "gameOver") {
      ctx.fillText("Top Out", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 160);
      ctx.font = "600 18px var(--font-geist-sans), sans-serif";
      ctx.fillStyle = "#fda4af";
      ctx.fillText(`Final score ${state.score}`, BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 200);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "500 16px var(--font-geist-sans), sans-serif";
      ctx.fillText("Press Enter or Restart to spin up a new seeded run.", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 232);
    }

    fillRoundedRect(ctx, BOARD_LEFT + 74, BOARD_TOP + 286, BOARD_WIDTH - 148, 46, 16, "#f59e0b");
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 18px var(--font-geist-sans), sans-serif";
    ctx.fillText(state.mode === "gameOver" ? "Restart" : state.mode === "paused" ? "Resume" : "Start", BOARD_LEFT + BOARD_WIDTH / 2, BOARD_TOP + 316);
    ctx.textAlign = "left";
  }
}

function makeSnapshot(state: GameState): UiSnapshot {
  return {
    mode: state.mode,
    score: state.score,
    level: state.level,
    lines: state.lines,
    nextPiece: state.queue[0] ?? null,
    holdPiece: state.hold,
    canHold: state.canHold,
  };
}

export default function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const stateRef = useRef<GameState>(INITIAL_TETRIS_STATE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ui, setUi] = useState<UiSnapshot>(() => makeSnapshot(INITIAL_TETRIS_STATE));

  const updateUi = useCallback((state: GameState) => {
    const next = makeSnapshot(state);
    setUi((previous) => {
      if (
        previous.mode === next.mode &&
        previous.score === next.score &&
        previous.level === next.level &&
        previous.lines === next.lines &&
        previous.nextPiece === next.nextPiece &&
        previous.holdPiece === next.holdPiece &&
        previous.canHold === next.canHold
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const maxWidth = isFullscreen
      ? Math.min(window.innerWidth - 48, ((window.innerHeight - 48) * CANVAS_WIDTH) / CANVAS_HEIGHT, 860)
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

  const drawCurrentState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, stateRef.current);
  }, []);

  const commitState = useCallback(
    (nextState: GameState) => {
      stateRef.current = nextState;
      updateUi(nextState);
      drawCurrentState();
    },
    [drawCurrentState, updateUi],
  );

  const applyTransform = useCallback(
    (transform: (state: GameState) => GameState) => {
      commitState(transform(stateRef.current));
    },
    [commitState],
  );

  const stepSimulation = useCallback(
    (ms: number) => {
      let remaining = ms;
      let nextState = stateRef.current;

      while (remaining > 0) {
        const delta = Math.min(FRAME_MS, remaining);
        nextState = tick(nextState, delta);
        remaining -= delta;
      }

      commitState(nextState);
    },
    [commitState],
  );

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await canvasRef.current?.requestFullscreen?.();
      return;
    }

    await document.exitFullscreen();
  }, []);

  useEffect(() => {
    resizeCanvas();
    drawCurrentState();

    const handleResize = () => {
      resizeCanvas();
      drawCurrentState();
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      handleResize();
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [drawCurrentState, resizeCanvas]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
      stepSimulation(ms);
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [stepSimulation]);

  useEffect(() => {
    if (navigator.webdriver) {
      drawCurrentState();
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const delta = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;
      stateRef.current = tick(stateRef.current, delta);
      updateUi(stateRef.current);
      drawCurrentState();
      frameRef.current = window.requestAnimationFrame(loop);
    };

    frameRef.current = window.requestAnimationFrame(loop);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      lastTimeRef.current = null;
    };
  }, [drawCurrentState, updateUi]);

  useEffect(() => {
    const keysToPrevent = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      " ",
      "Enter",
      "Escape",
      "Shift",
      "f",
      "F",
      "p",
      "P",
      "r",
      "R",
      "a",
      "A",
      "b",
      "B",
      "c",
      "C",
      "x",
      "X",
      "z",
      "Z",
    ];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (keysToPrevent.includes(event.key)) {
        event.preventDefault();
      }

      if (event.key === "f" || event.key === "F") {
        void toggleFullscreen();
        return;
      }

      if (event.key === "p" || event.key === "P" || event.key === "Escape") {
        applyTransform(togglePause);
        return;
      }

      if (event.key === "r" || event.key === "R") {
        commitState(restartGame());
        return;
      }

      if (event.key === "Enter") {
        applyTransform(startGame);
        return;
      }

      if (["a", "A", "c", "C", "Shift"].includes(event.key)) {
        applyTransform(holdPiece);
        return;
      }

      if (event.key === " ") {
        if (stateRef.current.mode === "ready") {
          applyTransform(startGame);
          return;
        }
        applyTransform(hardDrop);
        return;
      }

      if (stateRef.current.mode !== "playing") {
        return;
      }

      if (event.key === "ArrowLeft") {
        applyTransform((state) => movePiece(state, -1));
        return;
      }

      if (event.key === "ArrowRight") {
        applyTransform((state) => movePiece(state, 1));
        return;
      }

      if (["ArrowUp", "x", "X"].includes(event.key)) {
        applyTransform((state) => rotatePiece(state, 1));
        return;
      }

      if (["z", "Z", "b", "B"].includes(event.key)) {
        applyTransform((state) => rotatePiece(state, -1));
        return;
      }

      if (event.key === "ArrowDown") {
        applyTransform(softDrop);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyTransform, commitState, toggleFullscreen]);

  useEffect(() => {
    drawCurrentState();
  }, [drawCurrentState, isFullscreen]);

  const primaryActionLabel = ui.mode === "paused" ? "Resume" : ui.mode === "gameOver" ? "Restart" : "Start";
  const holdDisabled = ui.mode !== "playing" || !ui.canHold;

  return (
    <div className="py-10 sm:py-14">
      <Container size="lg">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
          <header className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Tetris</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Classic stacking with hold support, SRS wall kicks, static export safety, and deterministic browser-test hooks.
            </p>
          </header>

          <canvas
            ref={canvasRef}
            className="w-full max-w-[520px] rounded-[32px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
            aria-label="Tetris game canvas"
          />

          <div className="grid w-full max-w-[520px] grid-cols-2 gap-3 sm:grid-cols-5">
            <button
              id="tetris-start"
              type="button"
              onClick={() => applyTransform(startGame)}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {primaryActionLabel}
            </button>
            <button
              id="tetris-pause"
              type="button"
              onClick={() => applyTransform(togglePause)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              {ui.mode === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              id="tetris-hold"
              type="button"
              onClick={() => applyTransform(holdPiece)}
              disabled={holdDisabled}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {ui.canHold ? "Hold" : "Hold Locked"}
            </button>
            <button
              id="tetris-restart"
              type="button"
              onClick={() => commitState(restartGame())}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Restart
            </button>
            <button
              id="tetris-fullscreen"
              type="button"
              onClick={() => {
                void toggleFullscreen();
              }}
              className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
            >
              Fullscreen
            </button>
          </div>

          <div className="grid w-full max-w-[520px] grid-cols-2 gap-3 sm:grid-cols-5">
            <button
              type="button"
              onClick={() => applyTransform((state) => movePiece(state, -1))}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => applyTransform((state) => rotatePiece(state, -1))}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Rotate L
            </button>
            <button
              type="button"
              onClick={() => applyTransform((state) => rotatePiece(state, 1))}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Rotate R
            </button>
            <button
              type="button"
              onClick={() => applyTransform((state) => movePiece(state, 1))}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => applyTransform(softDrop)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Soft Drop
            </button>
            <button
              type="button"
              onClick={() => applyTransform(hardDrop)}
              className="col-span-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 sm:col-span-5"
            >
              Hard Drop
            </button>
          </div>

          <dl className="grid w-full max-w-[520px] grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Score</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-900">{ui.score}</dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Level</dt>
              <dd className="mt-1 text-2xl font-bold text-violet-600">{ui.level}</dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lines</dt>
              <dd className="mt-1 text-2xl font-bold text-cyan-600">{ui.lines}</dd>
            </div>
          </dl>
        </div>
      </Container>
    </div>
  );
}
