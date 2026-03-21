"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  BOARD_ORIGIN,
  BOARD_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GameState,
  Tile,
  TILE_SIZE,
  advanceGame as tickGame,
  confirmPrompt,
  createInitialState,
  formatMoney,
  getTilePosition,
  purchaseProperty,
  restartGame,
  rollDice,
  skipPurchase,
  renderGameToText,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void | Promise<void>;
  }
}

const FRAME_MS = 1000 / 60;

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient,
) {
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke: string,
  lineWidth: number,
) {
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

function tileRect(index: number) {
  const { x, y } = getTilePosition(index);
  return {
    x: BOARD_ORIGIN + x * TILE_SIZE,
    y: BOARD_ORIGIN + y * TILE_SIZE,
    width: TILE_SIZE,
    height: TILE_SIZE,
    cx: BOARD_ORIGIN + x * TILE_SIZE + TILE_SIZE / 2,
    cy: BOARD_ORIGIN + y * TILE_SIZE + TILE_SIZE / 2,
    gridX: x,
    gridY: y,
  };
}

function tileDirection(index: number) {
  const { x, y } = getTilePosition(index);
  if (y === 6) return "bottom";
  if (x === 0) return "left";
  if (y === 0) return "top";
  return "right";
}

function tileLabelFont(label: string) {
  if (label.length >= 6) return "10px";
  if (label.length >= 4) return "11px";
  return "12px";
}

function toneForType(type: Tile["type"]) {
  switch (type) {
    case "start":
      return { fill: "#f59e0b", glow: "rgba(245, 158, 11, 0.35)", badge: "START" };
    case "property":
      return { fill: "#2563eb", glow: "rgba(96, 165, 250, 0.28)", badge: "HOUSE" };
    case "station":
      return { fill: "#f97316", glow: "rgba(251, 146, 60, 0.3)", badge: "LINE" };
    case "chance":
      return { fill: "#a855f7", glow: "rgba(168, 85, 247, 0.32)", badge: "?" };
    case "fortune":
      return { fill: "#10b981", glow: "rgba(16, 185, 129, 0.3)", badge: "!" };
    case "tax":
      return { fill: "#ef4444", glow: "rgba(239, 68, 68, 0.28)", badge: "TAX" };
    case "jail":
      return { fill: "#60a5fa", glow: "rgba(96, 165, 250, 0.3)", badge: "JAIL" };
    case "parking":
      return { fill: "#06b6d4", glow: "rgba(6, 182, 212, 0.3)", badge: "P" };
    case "go_to_jail":
      return { fill: "#f43f5e", glow: "rgba(244, 63, 94, 0.3)", badge: "!" };
  }
}

function drawDice(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  face: number,
  accent: string,
  wobble = 0,
) {
  const offsetX = Math.sin(wobble * 1.6) * 4;
  const offsetY = Math.cos(wobble * 1.3) * 4;

  ctx.save();
  ctx.translate(x + offsetX, y + offsetY);
  ctx.shadowColor = "rgba(15, 23, 42, 0.45)";
  ctx.shadowBlur = 18;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#f8fafc");
  gradient.addColorStop(1, "#cbd5e1");
  fillRoundRect(ctx, 0, 0, size, size, 14, gradient);
  strokeRoundRect(ctx, 0, 0, size, size, 14, accent, 2);

  const pip = (px: number, py: number) => {
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(px, py, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  };

  const c = size / 2;
  const o = size * 0.24;
  if (face === 1 || face === 3 || face === 5) pip(c, c);
  if (face >= 2) pip(c - o, c - o);
  if (face >= 4) pip(c + o, c + o);
  if (face >= 6) {
    pip(c - o, c + o);
    pip(c + o, c - o);
  }
  if (face === 3 || face === 5) pip(c - o, c + o);
  if (face === 5) pip(c + o, c - o);

  ctx.restore();
}

function drawRoundLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  fill: string,
  stroke: string,
  textColor: string,
) {
  fillRoundRect(ctx, x, y, width, 22, 11, fill);
  strokeRoundRect(ctx, x, y, width, 22, 11, stroke, 1);
  ctx.fillStyle = textColor;
  ctx.font = "700 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + 11);
}

function tokenOffsets(count: number) {
  switch (count) {
    case 1:
      return [[0, 0]];
    case 2:
      return [[-14, 0], [14, 0]];
    case 3:
      return [[-12, -8], [12, -8], [0, 12]];
    default:
      return [[-14, -14], [14, -14], [-14, 14], [14, 14]];
  }
}

type TokenPoint = { x: number; y: number; tileIndex: number; playerId: string; moving: boolean };

function playerDisplayPoint(state: GameState, playerId: string): { x: number; y: number; tileIndex: number } {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return { x: 0, y: 0, tileIndex: 0 };

  if (state.move?.playerId === playerId && state.phase === "moving") {
    const step = clamp(state.move.stepIndex, 0, state.move.path.length - 1);
    const startIndex = step === 0 ? state.move.startPosition : state.move.path[step - 1];
    const targetIndex = state.move.path[step] ?? player.position;
    const start = tileRect(startIndex);
    const end = tileRect(targetIndex);
    const progress = easeOutCubic(state.move.stepElapsed / state.move.stepMs);
    return {
      x: lerp(start.cx, end.cx, progress),
      y: lerp(start.cy, end.cy, progress),
      tileIndex: targetIndex,
    };
  }

  const rect = tileRect(player.position);
  return { x: rect.cx, y: rect.cy, tileIndex: player.position };
}

function drawToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  token: string,
  active: boolean,
  moving: boolean,
  animationMs: number,
) {
  const bob = active ? Math.sin(animationMs / 220) * 4 : 0;
  const radius = 16;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 24 : 14;
  const gradient = ctx.createRadialGradient(-5, -5, 4, 0, 0, radius + 2);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = active ? 3 : 2;
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${moving ? "13px" : "12px"} Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(token, 0, 0.5);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#09111f");
  bg.addColorStop(0.45, "#111827");
  bg.addColorStop(1, "#1f123d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow1 = ctx.createRadialGradient(150, 120, 10, 150, 120, 220);
  glow1.addColorStop(0, "rgba(59, 130, 246, 0.28)");
  glow1.addColorStop(1, "rgba(59, 130, 246, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(640, 180, 10, 640, 180, 260);
  glow2.addColorStop(0, "rgba(244, 114, 182, 0.22)");
  glow2.addColorStop(1, "rgba(244, 114, 182, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 80; i += 1) {
    const seed = (state.animationMs + i * 97) % 1000;
    const sx = (seed * 131 + i * 37) % width;
    const sy = (seed * 173 + i * 53) % height;
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoardFrame(ctx: CanvasRenderingContext2D) {
  const boardX = BOARD_ORIGIN - 18;
  const boardY = BOARD_ORIGIN - 18;
  const size = BOARD_SIZE + 36;

  const frame = ctx.createLinearGradient(boardX, boardY, boardX + size, boardY + size);
  frame.addColorStop(0, "rgba(15, 23, 42, 0.82)");
  frame.addColorStop(1, "rgba(30, 41, 59, 0.88)");
  fillRoundRect(ctx, boardX, boardY, size, size, 32, frame);
  strokeRoundRect(ctx, boardX, boardY, size, size, 32, "rgba(255,255,255,0.12)", 2);

  const boardFill = ctx.createLinearGradient(BOARD_ORIGIN, BOARD_ORIGIN, BOARD_ORIGIN + BOARD_SIZE, BOARD_ORIGIN + BOARD_SIZE);
  boardFill.addColorStop(0, "#123a25");
  boardFill.addColorStop(1, "#0f2e1d");
  fillRoundRect(ctx, BOARD_ORIGIN, BOARD_ORIGIN, BOARD_SIZE, BOARD_SIZE, 24, boardFill);
  strokeRoundRect(ctx, BOARD_ORIGIN, BOARD_ORIGIN, BOARD_SIZE, BOARD_SIZE, 24, "rgba(255,255,255,0.16)", 2);

  const center = BOARD_ORIGIN + TILE_SIZE;
  const centerSize = TILE_SIZE * 5;
  const centerFill = ctx.createLinearGradient(center, center, center + centerSize, center + centerSize);
  centerFill.addColorStop(0, "rgba(15, 23, 42, 0.88)");
  centerFill.addColorStop(1, "rgba(30, 41, 59, 0.92)");
  fillRoundRect(ctx, center, center, centerSize, centerSize, 26, centerFill);
  strokeRoundRect(ctx, center, center, centerSize, centerSize, 26, "rgba(255,255,255,0.08)", 1.5);
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, state: GameState) {
  const rect = tileRect(tile.position);
  const tone = toneForType(tile.type);
  const direction = tileDirection(tile.position);
  const ownedBy = tile.owner ? state.players.find((player) => player.id === tile.owner) : null;
  const isCurrent = state.players[state.currentPlayerIndex]?.position === tile.position && state.phase !== "moving";

  ctx.save();
  ctx.shadowColor = tone.glow;
  ctx.shadowBlur = ownedBy ? 22 : 10;

  const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
  fill.addColorStop(0, ownedBy ? "#1e293b" : "#0f172a");
  fill.addColorStop(1, ownedBy ? "#334155" : "#111827");
  fillRoundRect(ctx, rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 14, fill);

  const accentThickness = 12;
  ctx.shadowBlur = 0;
  ctx.fillStyle = tile.accent ?? tone.fill;
  if (direction === "bottom") {
    ctx.fillRect(rect.x + 5, rect.y + 5, rect.width - 10, accentThickness);
  } else if (direction === "top") {
    ctx.fillRect(rect.x + 5, rect.y + rect.height - accentThickness - 5, rect.width - 10, accentThickness);
  } else if (direction === "left") {
    ctx.fillRect(rect.x + rect.width - accentThickness - 5, rect.y + 5, accentThickness, rect.height - 10);
  } else {
    ctx.fillRect(rect.x + 5, rect.y + 5, accentThickness, rect.height - 10);
  }

  ctx.strokeStyle = isCurrent ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = isCurrent ? 2.5 : 1;
  strokeRoundRect(ctx, rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, 14, ctx.strokeStyle as string, ctx.lineWidth);

  const badgeX = direction === "left" ? rect.x + 10 : rect.x + rect.width - 42;
  const badgeY = direction === "top" ? rect.y + 10 : rect.y + rect.height - 36;
  drawRoundLabel(
    ctx,
    tone.badge,
    badgeX,
    badgeY,
    30,
    tile.type === "tax" ? "rgba(239,68,68,0.84)" : "rgba(15,23,42,0.82)",
    tile.accent ?? tone.fill,
    "#ffffff",
  );

  ctx.fillStyle = "#e2e8f0";
  ctx.font = `700 ${tileLabelFont(tile.name)} Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textX = rect.x + rect.width / 2;
  const textY = rect.y + rect.height / 2 - 6;
  ctx.fillText(tile.name, textX, textY);

  ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
  ctx.font = "600 9px Inter, system-ui, sans-serif";
  const info = tile.price ? `${formatMoney(tile.price)} / ${formatMoney(tile.rent ?? 0)}` : tile.subtitle ?? "";
  ctx.fillText(info, textX, textY + 16);

  if (ownedBy) {
    ctx.fillStyle = ownedBy.color;
    ctx.beginPath();
    ctx.arc(rect.x + rect.width / 2, rect.y + rect.height - 18, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (tile.type === "start") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText("GO", textX, textY + 28);
  }

  ctx.restore();
}

function drawCenterHub(ctx: CanvasRenderingContext2D, state: GameState) {
  const center = BOARD_ORIGIN + TILE_SIZE;
  const size = TILE_SIZE * 5;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const centerX = center + size / 2;
  const centerY = center + size / 2;

  const hubGradient = ctx.createLinearGradient(center, center, center + size, center + size);
  hubGradient.addColorStop(0, "rgba(15, 23, 42, 0.95)");
  hubGradient.addColorStop(1, "rgba(30, 41, 59, 0.98)");
  fillRoundRect(ctx, center + 10, center + 10, size - 20, size - 20, 24, hubGradient);
  strokeRoundRect(ctx, center + 10, center + 10, size - 20, size - 20, 24, "rgba(255,255,255,0.08)", 1.5);

  ctx.save();
  ctx.fillStyle = "rgba(59,130,246,0.14)";
  ctx.beginPath();
  ctx.arc(centerX - 140, centerY - 90, 88, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(244,114,182,0.12)";
  ctx.beginPath();
  ctx.arc(centerX + 110, centerY + 80, 76, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 30px Inter, system-ui, sans-serif";
  ctx.fillText("MONOPOLY", centerX, centerY - 122);
  ctx.fillStyle = "rgba(226,232,240,0.72)";
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.fillText("買地、收租、壓制對手", centerX, centerY - 94);

  const playerLabel = currentPlayer ? `${currentPlayer.name} 的回合` : "等待玩家";
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText(playerLabel, centerX, centerY - 48);
  ctx.fillStyle = "rgba(226,232,240,0.72)";
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.fillText(state.message, centerX, centerY - 23);

  const currentTile = currentPlayer ? state.board[currentPlayer.position] : null;
  if (currentTile) {
    drawRoundLabel(
      ctx,
      currentTile.name,
      centerX - 70,
      centerY + 2,
      140,
      "rgba(15,23,42,0.85)",
      currentTile.accent ?? "#38bdf8",
      "#ffffff",
    );
  }

  const diceBaseX = centerX - 76;
  const diceBaseY = centerY + 44;
  const wobble = state.phase === "rolling" ? state.animationMs / 90 : state.animationMs / 220;
  drawDice(ctx, diceBaseX, diceBaseY, 60, state.diceFaces[0], "#cbd5e1", wobble);
  drawDice(ctx, diceBaseX + 74, diceBaseY, 60, state.diceFaces[1], "#cbd5e1", wobble + 0.7);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "800 11px Inter, system-ui, sans-serif";
  ctx.fillText(`骰子合計 ${state.diceTotal || "?"}`, centerX, centerY + 114);

  if (state.prompt) {
    drawRoundRect(ctx, center + 28, center + 28, size - 56, size - 56, 22);
    ctx.fillStyle = "rgba(2, 6, 23, 0.64)";
    ctx.fill();

    const cardFill = ctx.createLinearGradient(center + 48, center + 50, center + size - 48, center + size - 60);
    cardFill.addColorStop(0, "rgba(15, 23, 42, 0.98)");
    cardFill.addColorStop(1, "rgba(30, 41, 59, 0.98)");
    fillRoundRect(ctx, center + 56, center + 66, size - 112, size - 132, 22, cardFill);
    strokeRoundRect(ctx, center + 56, center + 66, size - 112, size - 132, 22, "rgba(255,255,255,0.16)", 1.5);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 24px Inter, system-ui, sans-serif";
    ctx.fillText(state.prompt.title, centerX, centerY - 48);
    ctx.fillStyle = "rgba(226,232,240,0.82)";
    ctx.font = "600 14px Inter, system-ui, sans-serif";
    ctx.fillText(state.prompt.body, centerX, centerY - 18);

    const promptTone = state.prompt.kind === "buy" ? "#22c55e" : state.prompt.kind === "game_over" ? "#f59e0b" : "#60a5fa";
    drawRoundLabel(
      ctx,
      state.prompt.kind === "buy" ? "購買決策" : state.prompt.kind === "game_over" ? "遊戲結束" : "事件卡",
      centerX - 62,
      centerY + 8,
      124,
      "rgba(15,23,42,0.88)",
      promptTone,
      "#ffffff",
    );

    if (state.prompt.kind === "buy") {
      drawRoundLabel(ctx, state.prompt.primaryLabel ?? "買下", centerX - 120, centerY + 64, 78, "rgba(34,197,94,0.92)", "rgba(255,255,255,0.12)", "#ffffff");
      drawRoundLabel(ctx, state.prompt.secondaryLabel ?? "跳過", centerX + 46, centerY + 64, 78, "rgba(148,163,184,0.88)", "rgba(255,255,255,0.12)", "#ffffff");
    } else if (state.prompt.kind === "game_over") {
      drawRoundLabel(ctx, state.prompt.primaryLabel ?? "重新開始", centerX - 44, centerY + 64, 88, "rgba(245,158,11,0.94)", "rgba(255,255,255,0.12)", "#ffffff");
    } else {
      drawRoundLabel(ctx, "自動推進中", centerX - 44, centerY + 64, 88, "rgba(96,165,250,0.92)", "rgba(255,255,255,0.12)", "#ffffff");
    }
  }

  const currentPhase = state.phase === "prompt" ? state.prompt?.kind ?? "prompt" : state.phase;
  drawRoundLabel(
    ctx,
    `${currentPhase.toUpperCase()} / 第 ${state.turn} 回合`,
    BOARD_ORIGIN + BOARD_SIZE - 182,
    BOARD_ORIGIN + 20,
    170,
    "rgba(15,23,42,0.8)",
    "rgba(255,255,255,0.16)",
    "#e2e8f0",
  );
}

function drawTokens(ctx: CanvasRenderingContext2D, state: GameState) {
  const movingPlayerId = state.move?.playerId ?? null;
  const tokens: TokenPoint[] = [];

  state.players.forEach((player) => {
    if (player.isBankrupt) return;
    const moving = player.id === movingPlayerId && state.phase === "moving";
    const point = playerDisplayPoint(state, player.id);
    tokens.push({ ...point, playerId: player.id, moving });
  });

  const grouped = new Map<number, TokenPoint[]>();
  tokens.forEach((token) => {
    const list = grouped.get(token.tileIndex) ?? [];
    list.push(token);
    grouped.set(token.tileIndex, list);
  });

  grouped.forEach((list) => {
    const offsets = tokenOffsets(list.length);
    list.forEach((token, index) => {
      const player = state.players.find((candidate) => candidate.id === token.playerId);
      if (!player) return;
      const offset = offsets[index] ?? [0, 0];
      drawToken(
        ctx,
        token.x + offset[0],
        token.y + offset[1],
        player.color,
        player.token,
        player.id === state.players[state.currentPlayerIndex]?.id,
        token.moving,
        state.animationMs,
      );
    });
  });
}

function drawCanvas(state: GameState, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx, state, canvas.width, canvas.height);
  drawBoardFrame(ctx);

  state.board.forEach((tile) => drawTile(ctx, tile, state));
  drawCenterHub(ctx, state);
  drawTokens(ctx, state);

  const messageBarX = BOARD_ORIGIN;
  const messageBarY = BOARD_ORIGIN + BOARD_SIZE + 16;
  const messageBarWidth = BOARD_SIZE;
  fillRoundRect(ctx, messageBarX, messageBarY, messageBarWidth, 44, 18, "rgba(15,23,42,0.84)");
  strokeRoundRect(ctx, messageBarX, messageBarY, messageBarWidth, 44, 18, "rgba(255,255,255,0.09)", 1);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(state.message, messageBarX + 18, messageBarY + 22);

  ctx.restore();
}

function makeStateSummary(state: GameState) {
  const current = state.players[state.currentPlayerIndex];
  const active = state.players.filter((player) => !player.isBankrupt);
  return {
    turn: state.turn,
    phase: state.phase,
    mode: state.mode,
    currentPlayer: current,
    activeCount: active.length,
    prompt: state.prompt,
  };
}

export default function MonopolyGame() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(gameState);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const syncState = useCallback((next: GameState) => {
    stateRef.current = next;
    setGameState(next);
  }, []);

  const runAction = useCallback((action: "roll" | "buy" | "skip" | "confirm" | "restart") => {
    const current = stateRef.current;
    let next = current;

    switch (action) {
      case "roll":
        next = rollDice(current);
        break;
      case "buy":
        next = purchaseProperty(current);
        break;
      case "skip":
        next = skipPurchase(current);
        break;
      case "confirm":
        next = confirmPrompt(current);
        break;
      case "restart":
        next = restartGame();
        break;
    }

    syncState(next);
  }, [syncState]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await shellRef.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }
      if (key === "d" || key === " ") {
        event.preventDefault();
        runAction("roll");
        return;
      }
      if (key === "b") {
        event.preventDefault();
        runAction("buy");
        return;
      }
      if (key === "n") {
        event.preventDefault();
        runAction("skip");
        return;
      }
      if (key === "r") {
        event.preventDefault();
        runAction("restart");
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        runAction("confirm");
      }
    };

    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [runAction, toggleFullscreen]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(stateRef.current);
    window.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / FRAME_MS));
      let next = stateRef.current;
      for (let index = 0; index < steps; index += 1) {
        next = tickGame(next, FRAME_MS);
      }
      syncState(next);
    };
  }, [syncState]);

  useEffect(() => {
    const loop = () => {
      const next = tickGame(stateRef.current, FRAME_MS);
      if (next !== stateRef.current) {
        syncState(next);
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };

    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [syncState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas(gameState, canvas);
  }, [gameState]);

  const summary = useMemo(() => makeStateSummary(gameState), [gameState]);
  const currentPlayer = summary.currentPlayer;
  const currentTile = currentPlayer ? gameState.board[currentPlayer.position] : null;
  const lastEvents = [...gameState.events].slice(-3).reverse();

  return (
    <Container size="full" className="min-h-screen py-6">
      <div
        ref={shellRef}
        className="min-h-[calc(100vh-3rem)] rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(244,114,182,0.16),_transparent_22%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(2,6,23,0.98))] p-5 shadow-[0_32px_120px_rgba(2,6,23,0.55)]"
      >
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-sky-200/80">
              Property showdown
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[0.08em] text-white">
              Monopoly
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200/78">
              擲骰、買地、收租、翻事件卡。這版把棋盤、節奏與特效都做成更接近桌遊現場的節奏。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ActionChip
              label="擲骰"
              hint="D / Space"
              tone="sky"
              active={gameState.phase === "ready"}
              onClick={() => runAction("roll")}
            />
            <ActionChip
              label="買地"
              hint="B"
              tone="emerald"
              active={gameState.prompt?.kind === "buy"}
              onClick={() => runAction("buy")}
            />
            <ActionChip
              label="跳過"
              hint="N"
              tone="slate"
              active={gameState.prompt?.kind === "buy"}
              onClick={() => runAction("skip")}
            />
            <ActionChip
              label={isFullscreen ? "退出全螢幕" : "全螢幕"}
              hint="F / Esc"
              tone="amber"
              active={isFullscreen}
              onClick={() => void toggleFullscreen()}
            />
            <ActionChip
              label="重開"
              hint="R"
              tone="rose"
              active={false}
              onClick={() => runAction("restart")}
            />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_284px]">
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.35)]">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="h-auto w-full rounded-[22px] border border-white/6 bg-slate-950 shadow-[0_20px_70px_rgba(2,6,23,0.5)]"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/7 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.34em] text-sky-200/70">
                    Turn
                  </p>
                  <h2 className="mt-1 truncate text-xl font-black text-white">
                    {currentPlayer?.name ?? "等待中"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-300/72">
                    {currentTile?.name ?? "未知"} · {gameState.phase}
                  </p>
                </div>
                <div className="rounded-full border border-white/12 bg-slate-950/55 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-100">
                  #{gameState.turn}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricCard label="現金" value={currentPlayer ? formatMoney(currentPlayer.money) : "$0"} compact />
                <MetricCard label="地產" value={String(currentPlayer?.properties.length ?? 0)} compact />
                <MetricCard label="骰子" value={gameState.diceTotal ? String(gameState.diceTotal) : "?"} compact />
                <MetricCard label="玩家" value={String(summary.activeCount)} compact />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/7 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.34em] text-sky-200/70">Players</p>
              <div className="mt-2 space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2.5"
                    style={{ boxShadow: `inset 0 0 0 1px ${player.color}22` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                        style={{ background: player.color }}
                      >
                        {player.token}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-white">{player.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${player.isBankrupt ? "bg-rose-500/20 text-rose-200" : "bg-emerald-500/20 text-emerald-200"}`}
                          >
                            {player.isBankrupt ? "破產" : "活躍"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-300/72">
                          {player.position === 0 ? "起點" : `P${player.position}`} · {formatMoney(player.money)} · {player.properties.length} 地產
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/7 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)] backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.34em] text-sky-200/70">Log</p>
              <div className="mt-2 space-y-1.5">
                {lastEvents.length ? (
                  lastEvents.map((event) => (
                    <div
                      key={`${event.timestamp}-${event.type}-${event.playerId}`}
                      className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-2"
                    >
                      <p className="text-sm font-bold leading-5 text-white">{event.summary}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-300/70">
                        {Object.entries(event.details)
                          .map(([key, value]) => `${key}:${value}`)
                          .join(" · ")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-3 py-4 text-sm text-slate-300/72">
                    擲骰後，事件會出現在這裡。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-[rgba(2,6,23,0.65)] p-3 shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.34em] text-amber-200/80">Controls</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <KeyCap label="D / Space" value="Roll" />
                <KeyCap label="B" value="Buy" />
                <KeyCap label="N" value="Skip" />
                <KeyCap label="Enter" value="OK" />
                <KeyCap label="F" value="Fullscreen" />
                <KeyCap label="R" value="Restart" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

function ActionChip({
  label,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  tone: "sky" | "emerald" | "slate" | "amber" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    sky: "from-sky-400/90 to-cyan-500/90",
    emerald: "from-emerald-400/90 to-emerald-600/90",
    slate: "from-slate-500/90 to-slate-700/90",
    amber: "from-amber-300/90 to-amber-500/90",
    rose: "from-rose-400/90 to-rose-600/90",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tones[tone]} px-4 py-3 text-left shadow-[0_12px_36px_rgba(15,23,42,0.28)] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.01] ${active ? "ring-2 ring-white/70" : ""}`}
    >
      <div className="text-sm font-black text-white">{label}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">{hint}</div>
    </button>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-slate-950/52 ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
      <p className={`${compact ? "text-[10px] tracking-[0.2em]" : "text-[11px] tracking-[0.24em]"} uppercase text-slate-300/72`}>
        {label}
      </p>
      <p className={`${compact ? "mt-0.5 text-base" : "mt-1 text-lg"} font-black text-white`}>{value}</p>
    </div>
  );
}

function KeyCap({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[92px] rounded-2xl border border-white/8 bg-slate-950/55 px-2.5 py-2">
      <p className="text-[11px] font-black leading-4 text-white">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-300/76">{value}</p>
    </div>
  );
}
