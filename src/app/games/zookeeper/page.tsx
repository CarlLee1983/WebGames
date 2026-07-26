"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  ANIMAL_STYLES,
  BOARD_HEIGHT,
  BOARD_LEFT,
  BOARD_TOP,
  BOARD_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLS,
  GameMode,
  GameState,
  MIN_CHAIN_LENGTH,
  ROWS,
  TILE_SIZE,
  advanceGame,
  beginSelection,
  boardToSymbols,
  clearSelection,
  createInitialState,
  extendSelection,
  getChainPreview,
  getRankOutlook,
  isPathValid,
  pointKey,
  resolveSelection,
  requestHint,
  restartGame,
  selectionToKeys,
  startGame,
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
  targetScore: number;
  targetReached: boolean;
  validMoveCount: number;
  moves: number;
  reshuffles: number;
  hintsUsed: number;
  bestChain: number;
  rank: GameState["rank"];
  rankOutlook: GameState["rank"];
  selectedLength: number;
  selectedPoints: number;
  animalsNeeded: number;
  hintLength: number;
  scoreRemaining: number;
  message: string | null;
};

const INITIAL_STATE = createInitialState();
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
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawAnimalFace(
  ctx: CanvasRenderingContext2D,
  animal: keyof typeof ANIMAL_STYLES,
  x: number,
  y: number,
  size: number,
  style: (typeof ANIMAL_STYLES)[keyof typeof ANIMAL_STYLES],
) {
  const centerX = x + size / 2;
  const centerY = y + size / 2 + 2;
  const faceRadius = size * 0.27;
  const eyeY = centerY - size * 0.06;

  const drawEye = (offsetX: number) => {
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(centerX + offsetX, eyeY, 2.6, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawCheeks = () => {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(centerX - size * 0.14, centerY + size * 0.08, 4, 0, Math.PI * 2);
    ctx.arc(centerX + size * 0.14, centerY + size * 0.08, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, faceRadius, 0, Math.PI * 2);
  ctx.fill();

  switch (animal) {
    case "lion":
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, faceRadius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(centerX - 14, y + 18, 8, 0, Math.PI * 2);
      ctx.arc(centerX + 14, y + 18, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "panda":
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(centerX - 15, y + 18, 8, 0, Math.PI * 2);
      ctx.arc(centerX + 15, y + 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(centerX - 12, eyeY, 7, 9, 0.35, 0, Math.PI * 2);
      ctx.ellipse(centerX + 12, eyeY, 7, 9, -0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "frog":
      ctx.fillStyle = "#86efac";
      ctx.beginPath();
      ctx.arc(centerX - 13, y + 20, 9, 0, Math.PI * 2);
      ctx.arc(centerX + 13, y + 20, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(centerX - 13, y + 20, 4, 0, Math.PI * 2);
      ctx.arc(centerX + 13, y + 20, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "fox":
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(centerX - 18, y + 26);
      ctx.lineTo(centerX - 6, y + 10);
      ctx.lineTo(centerX - 1, y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(centerX + 18, y + 26);
      ctx.lineTo(centerX + 6, y + 10);
      ctx.lineTo(centerX + 1, y + 28);
      ctx.closePath();
      ctx.fill();
      break;
    case "elephant":
      ctx.fillStyle = "#93c5fd";
      ctx.beginPath();
      ctx.ellipse(centerX - 18, centerY, 10, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(centerX + 18, centerY, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "hippo":
      ctx.fillStyle = "#d8b4fe";
      ctx.beginPath();
      ctx.arc(centerX - 14, y + 19, 8, 0, Math.PI * 2);
      ctx.arc(centerX + 14, y + 19, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, faceRadius, 0, Math.PI * 2);
  ctx.fill();

  if (animal === "elephant") {
    ctx.fillStyle = "#bfdbfe";
    ctx.beginPath();
    ctx.roundRect(centerX - 7, centerY - 3, 14, 24, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = animal === "frog" ? "#4ade80" : animal === "hippo" ? "#c084fc" : "#fb7185";
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 12, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (animal === "lion") {
    ctx.fillStyle = "#7c2d12";
    ctx.beginPath();
    ctx.arc(centerX, centerY + 10, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (animal === "fox") {
    ctx.fillStyle = "#7c2d12";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 6);
    ctx.lineTo(centerX - 4, centerY + 14);
    ctx.lineTo(centerX + 4, centerY + 14);
    ctx.closePath();
    ctx.fill();
  } else if (animal === "panda") {
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(centerX, centerY + 10, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.arc(centerX, centerY + 10, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEye(-10);
  drawEye(10);
  drawCheeks();
}

function buildUiSnapshot(state: GameState): UiSnapshot {
  const chainPreview = getChainPreview(state.selectedPath.length);
  return {
    mode: state.mode,
    score: state.score,
    targetScore: state.targetScore,
    targetReached: state.targetReached,
    validMoveCount: state.validMoveCount,
    moves: state.moves,
    reshuffles: state.reshuffles,
    hintsUsed: state.hintsUsed,
    bestChain: state.bestChain,
    rank: state.rank,
    rankOutlook: state.mode === "complete" ? state.rank : getRankOutlook(state.moves, state.hintsUsed),
    selectedLength: state.selectedPath.length,
    selectedPoints: chainPreview.points,
    animalsNeeded: chainPreview.animalsNeeded,
    hintLength: state.hintPath.length,
    scoreRemaining: Math.max(0, state.targetScore - state.score),
    message: state.message,
  };
}

function renderGameToText(state: GameState): string {
  const chainPreview = getChainPreview(state.selectedPath.length);
  return JSON.stringify({
    coordinateSystem: "board origin top-left; row increases downward 0-5; col increases rightward 0-5",
    mode: state.mode,
    score: state.score,
    targetScore: state.targetScore,
    targetReached: state.targetReached,
    moves: state.moves,
    reshuffles: state.reshuffles,
    hintsUsed: state.hintsUsed,
    bestChain: state.bestChain,
    rank: state.rank,
    rankOutlook: state.mode === "complete" ? state.rank : getRankOutlook(state.moves, state.hintsUsed),
    scoreRemaining: Math.max(0, state.targetScore - state.score),
    validMoveCount: state.validMoveCount,
    selectedAnimal: state.selectedAnimal,
    selectedPath: selectionToKeys(state.selectedPath),
    hintPath: selectionToKeys(state.hintPath),
    selectionIsValid: isPathValid(state.board, state.selectedPath),
    selectedPoints: chainPreview.points,
    animalsNeeded: chainPreview.animalsNeeded,
    board: boardToSymbols(state.board),
    message: state.message,
  });
}

function drawScene(ctx: CanvasRenderingContext2D, state: GameState) {
  const chainPreview = getChainPreview(state.selectedPath.length);
  const rankOutlook = state.mode === "complete"
    ? state.rank ?? "Bronze"
    : getRankOutlook(state.moves, state.hintsUsed);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, "#fff7ed");
  sky.addColorStop(0.45, "#ecfccb");
  sky.addColorStop(1, "#dbeafe");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.beginPath();
  ctx.arc(110, 96, 78, 0, Math.PI * 2);
  ctx.arc(450, 132, 110, 0, Math.PI * 2);
  ctx.fill();

  fillRoundedRect(ctx, 18, 18, CANVAS_WIDTH - 36, CANVAS_HEIGHT - 36, 28, "rgba(255,255,255,0.82)");
  strokeRoundedRect(ctx, 18, 18, CANVAS_WIDTH - 36, CANVAS_HEIGHT - 36, 28, "rgba(14,116,144,0.14)", 1.5);

  ctx.fillStyle = "#0f172a";
  ctx.font = "800 30px var(--font-geist-sans), sans-serif";
  ctx.fillText("Zookeeper", 34, 54);
  ctx.fillStyle = "#475569";
  ctx.font = "500 13px var(--font-geist-sans), sans-serif";
  ctx.fillText("Tap or drag across adjacent matching animals. Clear 3+ to score.", 34, 76);

  fillRoundedRect(ctx, 34, 96, CANVAS_WIDTH - 68, 58, 22, "#082f49");
  const progressTrackWidth = CANVAS_WIDTH - 196;
  const progressWidth = Math.max(0, Math.min(1, state.score / state.targetScore)) * progressTrackWidth;
  fillRoundedRect(ctx, 172, 116, progressTrackWidth, 18, 9, "rgba(255,255,255,0.14)");
  if (progressWidth > 0) {
    fillRoundedRect(ctx, 172, 116, progressWidth, 18, 9, "#facc15");
  }
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 12px var(--font-geist-sans), sans-serif";
  ctx.fillText("Target", 54, 128);
  ctx.font = "800 20px var(--font-geist-sans), sans-serif";
  ctx.fillText(`${state.score} / ${state.targetScore}`, 54, 147);
  if (state.targetReached) {
    fillRoundedRect(ctx, 444, 108, 80, 28, 14, "rgba(250,204,21,0.2)");
    ctx.fillStyle = "#fde68a";
    ctx.font = "700 12px var(--font-geist-sans), sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Target met", 484, 126);
    ctx.textAlign = "left";
  }

  fillRoundedRect(ctx, BOARD_LEFT - 18, BOARD_TOP - 18, BOARD_WIDTH + 36, BOARD_HEIGHT + 36, 28, "#14532d");
  fillRoundedRect(ctx, BOARD_LEFT - 10, BOARD_TOP - 10, BOARD_WIDTH + 20, BOARD_HEIGHT + 20, 24, "#166534");

  const selectedKeys = new Set(state.selectedPath.map(pointKey));
  const hintKeys = new Set(state.hintPath.map(pointKey));

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = state.board[row][col];
      const x = BOARD_LEFT + col * TILE_SIZE;
      const y = BOARD_TOP + row * TILE_SIZE;
      const selected = selectedKeys.has(pointKey({ row, col }));
      const hinted = hintKeys.has(pointKey({ row, col }));

      if (!cell) {
        fillRoundedRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 20, "rgba(255,255,255,0.2)");
        strokeRoundedRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 20, "rgba(255,255,255,0.35)", 2);
        continue;
      }

      const style = ANIMAL_STYLES[cell];

      fillRoundedRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 20, style.fill);
      strokeRoundedRect(ctx, x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 20, style.stroke, selected ? 4 : 2);

      const highlight = ctx.createLinearGradient(x, y, x, y + TILE_SIZE - 6);
      highlight.addColorStop(0, "rgba(255,255,255,0.34)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");
      fillRoundedRect(ctx, x + 7, y + 7, TILE_SIZE - 14, 24, 12, highlight);

      if (selected) {
        ctx.shadowColor = style.accent;
        ctx.shadowBlur = 16;
        strokeRoundedRect(ctx, x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10, 18, style.accent, 4);
        ctx.shadowBlur = 0;
      }

      if (hinted && !selected) {
        ctx.save();
        ctx.setLineDash([7, 5]);
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 14;
        strokeRoundedRect(ctx, x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12, 18, "#fef08a", 4);
        ctx.restore();
      }

      drawAnimalFace(ctx, cell, x + 3, y + 3, TILE_SIZE - 6, style);
    }
  }

  if (state.selectedPath.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.86)";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    state.selectedPath.forEach((point, index) => {
      const centerX = BOARD_LEFT + point.col * TILE_SIZE + TILE_SIZE / 2;
      const centerY = BOARD_TOP + point.row * TILE_SIZE + TILE_SIZE / 2;
      if (index === 0) {
        ctx.moveTo(centerX, centerY);
      } else {
        ctx.lineTo(centerX, centerY);
      }
    });
    ctx.stroke();
  }

  fillRoundedRect(ctx, 34, 628, CANVAS_WIDTH - 68, 96, 22, "rgba(255,255,255,0.9)");
  strokeRoundedRect(ctx, 34, 628, CANVAS_WIDTH - 68, 96, 22, "rgba(14,116,144,0.14)", 1.5);
  ctx.fillStyle = "#64748b";
  ctx.font = "800 11px var(--font-geist-sans), sans-serif";
  ctx.fillText("CHAIN VALUE", 54, 655);
  ctx.fillText(state.mode === "complete" ? "FINAL RANK" : "RANK PATH", 306, 655);

  ctx.fillStyle = chainPreview.isValid ? "#db2777" : "#334155";
  ctx.font = "900 20px var(--font-geist-sans), sans-serif";
  const chainText = chainPreview.isValid
    ? `${chainPreview.length} animals · +${chainPreview.points}`
    : chainPreview.length > 0
      ? `${chainPreview.animalsNeeded} more needed`
      : "Build a 3+ chain";
  ctx.fillText(chainText, 54, 684);

  ctx.fillStyle = rankOutlook === "Gold" ? "#b45309" : rankOutlook === "Silver" ? "#475569" : "#9a3412";
  ctx.fillText(`${rankOutlook} ${state.mode === "complete" ? "earned" : "open"}`, 306, 684);
  ctx.fillStyle = "#64748b";
  ctx.font = "700 12px var(--font-geist-sans), sans-serif";
  ctx.fillText(`${Math.max(0, state.targetScore - state.score)} points left`, 306, 706);

  if (state.mode === "ready") {
    fillRoundedRect(ctx, 70, 236, CANVAS_WIDTH - 140, 192, 28, "rgba(15,23,42,0.78)");
    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 28px var(--font-geist-sans), sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Solo Puzzle Safari", CANVAS_WIDTH / 2, 284);
    ctx.font = "500 15px var(--font-geist-sans), sans-serif";
    ctx.fillText("Press Start, then drag through matching neighbors.", CANVAS_WIDTH / 2, 320);
    ctx.fillText("Chains need at least 3 animals. Reach 1500 points to win.", CANVAS_WIDTH / 2, 346);
    ctx.fillText("If the board runs dry, it reshuffles automatically.", CANVAS_WIDTH / 2, 372);
    ctx.fillText("Use F for fullscreen. Esc exits fullscreen.", CANVAS_WIDTH / 2, 398);
    ctx.textAlign = "left";
  }

  if (state.mode === "complete") {
    fillRoundedRect(ctx, 68, 226, CANVAS_WIDTH - 136, 236, 30, "rgba(8,47,73,0.92)");
    strokeRoundedRect(ctx, 68, 226, CANVAS_WIDTH - 136, 236, 30, "#fde68a", 3);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fef3c7";
    ctx.font = "800 15px var(--font-geist-sans), sans-serif";
    ctx.fillText("SAFARI COMPLETE", CANVAS_WIDTH / 2, 270);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 38px var(--font-geist-sans), sans-serif";
    ctx.fillText(`${state.rank ?? "Bronze"} Rank`, CANVAS_WIDTH / 2, 320);
    ctx.fillStyle = "#bae6fd";
    ctx.font = "700 17px var(--font-geist-sans), sans-serif";
    ctx.fillText(`${state.score} points · ${state.moves} moves`, CANVAS_WIDTH / 2, 356);
    ctx.font = "600 14px var(--font-geist-sans), sans-serif";
    ctx.fillText(`Best chain ${state.bestChain} · Hints ${state.hintsUsed}`, CANVAS_WIDTH / 2, 386);
    ctx.fillStyle = "#fde68a";
    ctx.font = "700 14px var(--font-geist-sans), sans-serif";
    ctx.fillText("Choose New Safari to play again", CANVAS_WIDTH / 2, 426);
    ctx.textAlign = "left";
  }

}

function getCanvasPoint(
  event: PointerEvent | MouseEvent | Touch,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (("clientX" in event ? event.clientX - rect.left : 0) / rect.width) * CANVAS_WIDTH,
    y: (("clientY" in event ? event.clientY - rect.top : 0) / rect.height) * CANVAS_HEIGHT,
  };
}

function getBoardPoint(x: number, y: number) {
  if (x < BOARD_LEFT || x > BOARD_LEFT + BOARD_WIDTH || y < BOARD_TOP || y > BOARD_TOP + BOARD_HEIGHT) {
    return null;
  }

  const col = Math.floor((x - BOARD_LEFT) / TILE_SIZE);
  const row = Math.floor((y - BOARD_TOP) / TILE_SIZE);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return null;
  }

  return { row, col };
}

export default function ZookeeperPage() {
  const [ui, setUi] = useState<UiSnapshot>(() => buildUiSnapshot(INITIAL_STATE));
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef<GameState>(INITIAL_STATE);
  const draggingRef = useRef(false);

  const updateUi = useCallback((state: GameState) => {
    setUi(buildUiSnapshot(state));
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    const heightBudget = document.fullscreenElement
      ? window.innerHeight - 24
      : window.innerWidth >= 768
        ? Math.max(420, window.innerHeight - 205)
        : window.innerHeight * 0.58;
    const displayWidth = Math.min(
      canvas.parentElement?.clientWidth ?? CANVAS_WIDTH,
      CANVAS_WIDTH,
      heightBudget * aspectRatio,
    );
    const displayHeight = displayWidth * (CANVAS_HEIGHT / CANVAS_WIDTH);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(canvas.width / CANVAS_WIDTH, 0, 0, canvas.height / CANVAS_HEIGHT, 0, 0);
  }, []);

  const drawCurrentState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    drawScene(ctx, stateRef.current);
  }, []);

  const commitState = useCallback((nextState: GameState) => {
    stateRef.current = nextState;
    updateUi(nextState);
    drawCurrentState();
  }, [drawCurrentState, updateUi]);

  const stepSimulation = useCallback((ms: number) => {
    const nextState = advanceGame(stateRef.current, ms);
    if (nextState === stateRef.current) {
      drawCurrentState();
      return;
    }
    commitState(nextState);
  }, [commitState, drawCurrentState]);

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

    const loop = () => {
      stepSimulation(16);
      frameRef.current = window.setTimeout(loop, 16) as unknown as number;
    };

    frameRef.current = window.setTimeout(loop, 16) as unknown as number;

    return () => {
      if (frameRef.current !== null) {
        window.clearTimeout(frameRef.current);
      }
    };
  }, [drawCurrentState, stepSimulation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        event.preventDefault();
      }

      if (stateRef.current.mode === "ready") {
        commitState(startGame(stateRef.current));
      }

      if (stateRef.current.mode !== "playing") {
        return;
      }

      const { x, y } = getCanvasPoint(event, canvas);
      const point = getBoardPoint(x, y);
      if (!point) {
        return;
      }

      draggingRef.current = true;
      canvas.setPointerCapture?.(event.pointerId);

      // Support tap-to-extend: if already has selection, try to extend first
      if (stateRef.current.selectedPath.length > 0) {
        const extended = extendSelection(stateRef.current, point);
        if (extended !== stateRef.current) {
          commitState(extended);
          return;
        }
      }

      commitState(beginSelection(stateRef.current, point));
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current || stateRef.current.mode !== "playing") {
        return;
      }

      const { x, y } = getCanvasPoint(event, canvas);
      const point = getBoardPoint(x, y);
      if (!point) {
        return;
      }

      commitState(extendSelection(stateRef.current, point));
    };

    const finishSelection = () => {
      if (!draggingRef.current) {
        return;
      }

      draggingRef.current = false;
      
      // Only resolve if we have a valid chain (length >= 3)
      if (stateRef.current.selectedPath.length >= MIN_CHAIN_LENGTH) {
        const result = resolveSelection(stateRef.current);
        commitState(result.state);
      }
      // If chain is too short, we keep it selected to allow "tap to extend"
    };

    const cancelSelection = () => {
      if (!draggingRef.current) {
        return;
      }

      draggingRef.current = false;
      commitState(clearSelection(stateRef.current));
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishSelection);
    canvas.addEventListener("pointercancel", cancelSelection);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishSelection);
      canvas.removeEventListener("pointercancel", cancelSelection);
      canvas.removeEventListener("pointerleave", handlePointerMove);
    };
  }, [commitState]);

  useEffect(() => {
    const keysToPrevent = [" ", "Enter", "Escape", "f", "F", "h", "H", "r", "R"];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (keysToPrevent.includes(event.key)) {
        event.preventDefault();
      }

      if (event.key === "f" || event.key === "F") {
        void toggleFullscreen();
        return;
      }

      if (event.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        commitState(restartGame());
        return;
      }

      if (event.key === "h" || event.key === "H") {
        commitState(requestHint(stateRef.current));
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        if (stateRef.current.mode === "ready") {
          commitState(startGame(stateRef.current));
        } else if (stateRef.current.mode === "complete") {
          commitState(startGame(restartGame()));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commitState, toggleFullscreen]);

  useEffect(() => {
    drawCurrentState();
  }, [drawCurrentState, isFullscreen]);

  const handlePrimaryAction = () => {
    if (stateRef.current.mode === "ready") {
      commitState(startGame(stateRef.current));
    } else if (stateRef.current.mode === "complete") {
      commitState(startGame(restartGame()));
    }
  };

  const selectedBonus = ui.selectedPoints > 0
    ? `worth ${ui.selectedPoints} points`
    : `${ui.animalsNeeded} more needed`;
  const scoreProgress = Math.min(100, Math.round((ui.score / ui.targetScore) * 100));
  const rankOutlook = ui.rankOutlook ?? "Bronze";
  const statusMessage =
    ui.mode === "ready"
      ? "Press Start, then drag across adjacent matching animals."
      : ui.mode === "complete"
        ? `Safari complete — ${ui.rank ?? "Bronze"} rank with ${ui.score} points in ${ui.moves} moves.`
        : ui.message ?? (ui.selectedLength > 0
          ? `Chain ${ui.selectedLength}, ${selectedBonus}.`
          : "Trace 3 or more adjacent matching animals to score.");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfccb_0%,_#f8fafc_48%,_#e0f2fe_100%)] py-4 sm:py-6">
      <Container size="lg">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4">
          <header className="text-center">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
              <span className="i-ph-paw-print-duotone text-base" aria-hidden="true" />
              Puzzle Safari
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Zookeeper</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
              Trace adjacent matching animals, build bigger chains, and earn the best safari rank.
            </p>
          </header>

          <div className="grid w-full max-w-4xl items-start gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <canvas
              id="zookeeper-canvas"
              ref={canvasRef}
              role="application"
              tabIndex={0}
              className="w-full max-w-[560px] justify-self-center rounded-[28px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none touch-none focus-visible:ring-4 focus-visible:ring-emerald-400"
              aria-label={`Zookeeper，${ui.mode}，${ui.score} 分，${ui.moves} 步，目前連鎖 ${ui.selectedLength}`}
              aria-describedby="zookeeper-status"
            />

            <div className="flex min-w-0 flex-col gap-3 md:sticky md:top-4">
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              id="zookeeper-start"
              type="button"
              onClick={handlePrimaryAction}
              disabled={ui.mode === "playing"}
              className="min-h-12 rounded-2xl bg-slate-900 px-3 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-default disabled:bg-slate-300 disabled:text-slate-500"
            >
              {ui.mode === "ready" ? "Start Safari" : ui.mode === "complete" ? "New Safari" : "Safari Active"}
            </button>
            <button
              id="zookeeper-restart"
              type="button"
              onClick={() => commitState(restartGame())}
              className="min-h-12 rounded-2xl bg-white px-3 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Restart
            </button>
            <button
              id="zookeeper-hint"
              type="button"
              onClick={() => commitState(requestHint(stateRef.current))}
              disabled={ui.mode !== "playing"}
              aria-label={ui.hintLength >= MIN_CHAIN_LENGTH ? "Hint already active" : "Show a hint; a new hint affects safari rank"}
              className="min-h-12 rounded-2xl bg-emerald-500 px-3 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-500"
            >
              <span className="i-ph-lightbulb-filament-duotone mr-1 inline-flex" aria-hidden="true" />
              {ui.hintLength >= MIN_CHAIN_LENGTH ? "Hint active" : "Hint"}
            </button>
            <button
              id="zookeeper-fullscreen"
              type="button"
              onClick={() => {
                void toggleFullscreen();
              }}
              className="min-h-12 rounded-2xl bg-amber-400 px-3 py-3 text-sm font-bold text-slate-900 transition hover:bg-amber-300"
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
          </div>

          <div
            id="zookeeper-status"
            className="box-border w-full rounded-2xl bg-white/85 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
            aria-live="polite"
          >
            {statusMessage}
          </div>

          <div className="box-border w-full rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3 text-xs font-bold">
              <span className="uppercase tracking-[0.16em] text-sky-200">Safari target</span>
              <span className="tabular-nums text-slate-200">{ui.scoreRemaining} points left</span>
            </div>
            <div
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-label="Progress to safari target"
              aria-valuemin={0}
              aria-valuemax={ui.targetScore}
              aria-valuenow={Math.min(ui.score, ui.targetScore)}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-[width] duration-300" style={{ width: `${scoreProgress}%` }} />
            </div>
          </div>

          <dl className="grid w-full grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Score</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">{ui.score}<span className="text-sm text-slate-400"> / {ui.targetScore}</span></dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Moves</dt>
              <dd className="mt-1 text-xl font-bold text-sky-600">{ui.moves}</dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Chain value</dt>
              <dd className="mt-1 text-xl font-bold text-pink-600">{ui.selectedLength}<span className="ml-1 text-sm text-pink-400">+{ui.selectedPoints}</span></dd>
            </div>
            <div className="rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rank path</dt>
              <dd className={`mt-1 text-xl font-bold ${rankOutlook === "Gold" ? "text-amber-600" : rankOutlook === "Silver" ? "text-slate-500" : "text-orange-700"}`}>{rankOutlook}</dd>
            </div>
          </dl>

          <div className="box-border flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/65 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-white">
            <span>{ui.validMoveCount} live groups on board</span>
            <span>Best chain {ui.bestChain}</span>
            <span>{ui.hintsUsed} hints · {ui.reshuffles} reshuffles</span>
          </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
