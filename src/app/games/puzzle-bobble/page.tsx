"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Container from "@/components/common/Container";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BUBBLE_DIAMETER,
  BUBBLE_RADIUS,
  COLORS,
  COLS,
  MAX_ROWS,
  distance,
  findFloating,
  findMatches,
  getBubbleX,
  getBubbleY,
  getGridPos,
  type Bubble,
  type FlyingBubble,
} from "./utils";

const SHOTS_BEFORE_DROP = 6;
const CANNON_X = BOARD_WIDTH / 2;
const CANNON_Y = BOARD_HEIGHT - BUBBLE_RADIUS - 6;

const COLOR_DETAILS: Record<string, { light: string; dark: string; symbol: string; name: string }> = {
  "#ef4444": { light: "#fb7185", dark: "#991b1b", symbol: "✦", name: "Coral" },
  "#3b82f6": { light: "#60a5fa", dark: "#1e3a8a", symbol: "◆", name: "Blue" },
  "#eab308": { light: "#fde047", dark: "#854d0e", symbol: "●", name: "Gold" },
  "#22c55e": { light: "#4ade80", dark: "#166534", symbol: "▲", name: "Green" },
  "#a855f7": { light: "#c084fc", dark: "#6b21a8", symbol: "✚", name: "Violet" },
  "#f97316": { light: "#fb923c", dark: "#9a3412", symbol: "≈", name: "Orange" },
};

const SOUND_PATHS = {
  button: "/games/puzzle-bobble/audio/button.ogg",
  drop: "/games/puzzle-bobble/audio/drop.ogg",
  pop: "/games/puzzle-bobble/audio/pop.ogg",
  shoot: "/games/puzzle-bobble/audio/shoot.ogg",
  stick: "/games/puzzle-bobble/audio/stick.ogg",
} as const;

type SoundName = keyof typeof SOUND_PATHS;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
  gravity: number;
};

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function createInitialBoard(): Bubble[] {
  const board: Bubble[] = [];

  for (let row = 0; row < 5; row += 1) {
    const columns = row % 2 === 1 ? COLS - 1 : COLS;

    for (let col = 0; col < columns; col += 1) {
      board.push({ row, col, color: randomColor() });
    }
  }

  return board;
}

function pickBoardColor(board: Bubble[]) {
  if (board.length === 0) return randomColor();
  return board[Math.floor(Math.random() * board.length)].color;
}

function getAssetPath(path: string) {
  if (typeof window === "undefined") return path;
  const basePath = window.location.pathname.startsWith("/WebGames/") ? "/WebGames" : "";
  return `${basePath}${path}`;
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale = 1,
  alpha = 1,
) {
  const details = COLOR_DETAILS[color] ?? COLOR_DETAILS[COLORS[0]];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  const gradient = ctx.createRadialGradient(-7, -9, 1, 0, 0, BUBBLE_RADIUS);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.16, details.light);
  gradient.addColorStop(0.72, color);
  gradient.addColorStop(1, details.dark);

  ctx.beginPath();
  ctx.arc(0, 0, BUBBLE_RADIUS - 1.2, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-6, -7, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fill();

  ctx.font = "900 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(details.symbol, 2, 3);
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D) {
  const background = ctx.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
  background.addColorStop(0, "#16233f");
  background.addColorStop(0.55, "#101a33");
  background.addColorStop(1, "#070d1c");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const glow = ctx.createRadialGradient(BOARD_WIDTH / 2, BOARD_HEIGHT * 0.62, 0, BOARD_WIDTH / 2, BOARD_HEIGHT * 0.62, 220);
  glow.addColorStop(0, "rgba(168,85,247,0.13)");
  glow.addColorStop(1, "rgba(15,23,42,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 73 + 31) % BOARD_WIDTH;
    const y = (index * 47 + 121) % BOARD_HEIGHT;
    const size = index % 4 === 0 ? 1.4 : 0.75;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAimGuide(ctx: CanvasRenderingContext2D, board: Bubble[], angle: number) {
  let x = CANNON_X;
  let y = CANNON_Y - BUBBLE_RADIUS;
  let vx = Math.cos(angle) * 5;
  const vy = -Math.sin(angle) * 5;

  ctx.save();
  for (let step = 0; step < 92; step += 1) {
    x += vx;
    y += vy;

    if (x <= BUBBLE_RADIUS || x >= BOARD_WIDTH - BUBBLE_RADIUS) {
      x = Math.max(BUBBLE_RADIUS, Math.min(BOARD_WIDTH - BUBBLE_RADIUS, x));
      vx *= -1;
    }

    const collision = board.some((bubble) => (
      distance(x, y, getBubbleX(bubble.row, bubble.col), getBubbleY(bubble.row)) <= BUBBLE_DIAMETER - 2
    ));

    if (step % 5 === 0) {
      const progress = step / 92;
      ctx.beginPath();
      ctx.arc(x, y, 2.4 - progress, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.9 - progress * 0.65})`;
      ctx.fill();
    }

    if (collision || y <= BUBBLE_RADIUS) break;
  }
  ctx.restore();
}

export default function PuzzleBobbleGame() {
  const [initialBoard] = useState(createInitialBoard);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Bubble[]>(initialBoard);
  const flyingBubbleRef = useRef<FlyingBubble | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const angleRef = useRef(Math.PI / 2);
  const currentColorRef = useRef(pickBoardColor(initialBoard));
  const nextColorRef = useRef(pickBoardColor(initialBoard));
  const shotsFiredRef = useRef(0);
  const gameOverRef = useRef(false);
  const gameWonRef = useRef(false);
  const pausedRef = useRef(false);
  const mutedRef = useRef(false);
  const shakeRef = useRef(0);
  const gainTimeoutRef = useRef<number | null>(null);
  const audioRef = useRef<Partial<Record<SoundName, HTMLAudioElement>>>({});

  const [score, setScore] = useState(0);
  const [shotsFired, setShotsFired] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [, setBoardRevision] = useState(0);

  const playSound = useCallback((name: SoundName, volume = 0.5) => {
    if (mutedRef.current) return;
    const source = audioRef.current[name];
    if (!source) return;

    const sound = source.cloneNode() as HTMLAudioElement;
    sound.volume = volume;
    void sound.play().catch(() => undefined);
  }, []);

  const finishGame = useCallback((winner: boolean) => {
    gameWonRef.current = winner;
    gameOverRef.current = !winner;
    setGameWon(winner);
    setGameOver(!winner);
    playSound(winner ? "pop" : "drop", winner ? 0.75 : 0.65);
  }, [playSound]);

  const resetGame = useCallback(() => {
    const board = createInitialBoard();
    boardRef.current = board;
    flyingBubbleRef.current = null;
    particlesRef.current = [];
    currentColorRef.current = pickBoardColor(board);
    nextColorRef.current = pickBoardColor(board);
    angleRef.current = Math.PI / 2;
    shotsFiredRef.current = 0;
    gameOverRef.current = false;
    gameWonRef.current = false;
    pausedRef.current = false;
    shakeRef.current = 0;
    setScore(0);
    setShotsFired(0);
    setCombo(0);
    setLastGain(0);
    setGameOver(false);
    setGameWon(false);
    setIsPaused(false);
    setBoardRevision((revision) => revision + 1);
    playSound("button", 0.35);
  }, [playSound]);

  const spawnParticles = useCallback((bubbles: Bubble[], falling: boolean) => {
    for (const bubble of bubbles) {
      const x = getBubbleX(bubble.row, bubble.col);
      const y = getBubbleY(bubble.row);
      const count = falling ? 3 : 7;

      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
        const speed = falling ? 1.2 + Math.random() * 1.8 : 1.8 + Math.random() * 2.8;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: falling ? Math.random() * 1.5 : Math.sin(angle) * speed,
          color: bubble.color,
          life: 1,
          size: falling ? 7 + Math.random() * 4 : 2.5 + Math.random() * 3,
          gravity: falling ? 0.11 : 0.045,
        });
      }
    }

    particlesRef.current = particlesRef.current.slice(-220);
  }, []);

  const dropCeiling = useCallback(() => {
    const shiftedBoard = boardRef.current.map((bubble) => ({ ...bubble, row: bubble.row + 1 }));

    for (let col = 0; col < COLS; col += 1) {
      shiftedBoard.push({ row: 0, col, color: randomColor() });
    }

    boardRef.current = shiftedBoard;
    setBoardRevision((revision) => revision + 1);
    shakeRef.current = 5;
    playSound("drop", 0.55);

    if (shiftedBoard.some((bubble) => getBubbleY(bubble.row) > BOARD_HEIGHT - BUBBLE_DIAMETER * 2)) {
      finishGame(false);
    }
  }, [finishGame, playSound]);

  const showGain = useCallback((points: number) => {
    if (gainTimeoutRef.current !== null) window.clearTimeout(gainTimeoutRef.current);
    setLastGain(points);
    gainTimeoutRef.current = window.setTimeout(() => setLastGain(0), 900);
  }, []);

  const shoot = useCallback(() => {
    if (gameOverRef.current || gameWonRef.current || pausedRef.current || flyingBubbleRef.current) return;

    const speed = 11.5;
    flyingBubbleRef.current = {
      x: CANNON_X,
      y: CANNON_Y - 4,
      vx: Math.cos(angleRef.current) * speed,
      vy: Math.sin(angleRef.current) * speed,
      color: currentColorRef.current,
    };
    playSound("shoot", 0.35);
  }, [playSound]);

  const togglePause = useCallback(() => {
    if (gameOverRef.current || gameWonRef.current) return;
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused;
    setIsPaused(nextPaused);
    playSound("button", 0.3);
  }, [playSound]);

  const toggleMuted = useCallback(() => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) window.setTimeout(() => playSound("button", 0.3), 0);
  }, [playSound]);

  const updateAim = useCallback((clientX: number, clientY: number) => {
    if (gameOverRef.current || gameWonRef.current || pausedRef.current || flyingBubbleRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (BOARD_WIDTH / rect.width);
    const y = (clientY - rect.top) * (BOARD_HEIGHT / rect.height);
    const angle = Math.atan2(CANNON_Y - y, x - CANNON_X);
    angleRef.current = Math.max(0.22, Math.min(Math.PI - 0.22, angle));
  }, []);

  useEffect(() => {
    for (const [name, path] of Object.entries(SOUND_PATHS) as Array<[SoundName, string]>) {
      const audio = new Audio(getAssetPath(path));
      audio.preload = "auto";
      audioRef.current[name] = audio;
    }

    return () => {
      if (gainTimeoutRef.current !== null) window.clearTimeout(gainTimeoutRef.current);
      for (const audio of Object.values(audioRef.current)) audio?.pause();
      audioRef.current = {};
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " ", "Enter"].includes(event.key)) event.preventDefault();

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        angleRef.current = Math.min(Math.PI - 0.22, angleRef.current + 0.08);
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        angleRef.current = Math.max(0.22, angleRef.current - 0.08);
      } else if (event.key === " " || event.key === "Enter") {
        shoot();
      } else if (event.key.toLowerCase() === "p" || event.key === "Escape") {
        togglePause();
      } else if (event.key.toLowerCase() === "r") {
        resetGame();
      } else if (event.key.toLowerCase() === "m") {
        toggleMuted();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetGame, shoot, toggleMuted, togglePause]);

  useEffect(() => {
    let animationFrame = 0;
    let previousTime = performance.now();

    const render = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const renderWidth = Math.round(BOARD_WIDTH * pixelRatio);
      const renderHeight = Math.round(BOARD_HEIGHT * pixelRatio);
      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
      }
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const delta = Math.min(2, Math.max(0.25, (timestamp - previousTime) / (1000 / 60)));
      previousTime = timestamp;
      ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.save();
      if (shakeRef.current > 0.1) {
        ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
        shakeRef.current *= 0.84;
      }

      drawBackdrop(ctx);

      const dangerY = BOARD_HEIGHT - BUBBLE_DIAMETER * 2;
      const dangerGradient = ctx.createLinearGradient(0, dangerY, BOARD_WIDTH, dangerY);
      dangerGradient.addColorStop(0, "rgba(244,63,94,0)");
      dangerGradient.addColorStop(0.5, "rgba(244,63,94,0.7)");
      dangerGradient.addColorStop(1, "rgba(244,63,94,0)");
      ctx.fillStyle = dangerGradient;
      ctx.fillRect(0, dangerY, BOARD_WIDTH, 1);

      for (const bubble of boardRef.current) {
        drawBubble(ctx, getBubbleX(bubble.row, bubble.col), getBubbleY(bubble.row), bubble.color);
      }

      if (!gameOverRef.current && !gameWonRef.current && !pausedRef.current && !flyingBubbleRef.current) {
        drawAimGuide(ctx, boardRef.current, angleRef.current);
      }

      const cannonGradient = ctx.createLinearGradient(CANNON_X, CANNON_Y - 20, CANNON_X, CANNON_Y + 20);
      cannonGradient.addColorStop(0, "#a78bfa");
      cannonGradient.addColorStop(1, "#4c1d95");
      ctx.beginPath();
      ctx.arc(CANNON_X, CANNON_Y + 18, 31, Math.PI, Math.PI * 2);
      ctx.fillStyle = cannonGradient;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (!flyingBubbleRef.current && !gameOverRef.current && !gameWonRef.current) {
        drawBubble(ctx, CANNON_X, CANNON_Y, currentColorRef.current, 1.08);
      }

      drawBubble(ctx, 39, CANNON_Y + 3, nextColorRef.current, 0.78);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "800 8px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NEXT", 39, CANNON_Y + 28);

      const flying = flyingBubbleRef.current;
      if (flying && !pausedRef.current) {
        flying.x += flying.vx * delta;
        flying.y -= flying.vy * delta;

        if (flying.x - BUBBLE_RADIUS <= 0) {
          flying.x = BUBBLE_RADIUS;
          flying.vx *= -1;
          playSound("stick", 0.18);
        } else if (flying.x + BUBBLE_RADIUS >= BOARD_WIDTH) {
          flying.x = BOARD_WIDTH - BUBBLE_RADIUS;
          flying.vx *= -1;
          playSound("stick", 0.18);
        }

        const hitCeiling = flying.y - BUBBLE_RADIUS <= 0;
        const hitBubble = boardRef.current.some((bubble) => (
          distance(flying.x, flying.y, getBubbleX(bubble.row, bubble.col), getBubbleY(bubble.row)) <= BUBBLE_DIAMETER - 2
        ));

        if (hitCeiling || hitBubble) {
          const gridPosition = getGridPos(flying.x, Math.max(BUBBLE_RADIUS, flying.y));
          let finalRow = gridPosition.row;
          while (boardRef.current.some((bubble) => bubble.row === finalRow && bubble.col === gridPosition.col)) {
            finalRow += 1;
          }

          const newBubble: Bubble = { row: finalRow, col: gridPosition.col, color: flying.color };
          const boardWithBubble = [...boardRef.current, newBubble];
          const matches = findMatches(boardWithBubble, newBubble);
          let resolvedBoard = boardWithBubble;

          if (matches.length >= 3) {
            const matchKeys = new Set(matches.map((bubble) => `${bubble.row},${bubble.col}`));
            resolvedBoard = boardWithBubble.filter((bubble) => !matchKeys.has(`${bubble.row},${bubble.col}`));
            const floating = findFloating(resolvedBoard);
            const floatingKeys = new Set(floating.map((bubble) => `${bubble.row},${bubble.col}`));
            resolvedBoard = resolvedBoard.filter((bubble) => !floatingKeys.has(`${bubble.row},${bubble.col}`));

            const nextCombo = combo + 1;
            const points = matches.length * 10 + floating.length * 20 + Math.max(0, nextCombo - 1) * 15;
            setCombo(nextCombo);
            setScore((currentScore) => currentScore + points);
            showGain(points);
            spawnParticles(matches, false);
            spawnParticles(floating, true);
            shakeRef.current = Math.min(8, 3 + matches.length * 0.6);
            playSound("pop", 0.6);

            if (resolvedBoard.length === 0) finishGame(true);
          } else {
            setCombo(0);
            playSound("stick", 0.35);
          }

          boardRef.current = resolvedBoard;
          setBoardRevision((revision) => revision + 1);
          flyingBubbleRef.current = null;
          currentColorRef.current = nextColorRef.current;
          nextColorRef.current = pickBoardColor(resolvedBoard);

          const nextShots = shotsFiredRef.current + 1;
          shotsFiredRef.current = nextShots;
          setShotsFired(nextShots);

          if (!gameWonRef.current && nextShots % SHOTS_BEFORE_DROP === 0) dropCeiling();
          if (!gameWonRef.current && finalRow >= MAX_ROWS - 1) finishGame(false);
        } else {
          drawBubble(ctx, flying.x, flying.y, flying.color, 1.02);
        }
      } else if (flying) {
        drawBubble(ctx, flying.x, flying.y, flying.color, 1.02);
      }

      if (!pausedRef.current) {
        particlesRef.current = particlesRef.current.filter((particle) => {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          particle.vy += particle.gravity * delta;
          particle.life -= 0.025 * delta;
          return particle.life > 0;
        });
      }

      for (const particle of particlesRef.current) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * Math.max(0.25, particle.life), 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [combo, dropCeiling, finishGame, playSound, showGain, spawnParticles]);

  const shotsUntilDrop = SHOTS_BEFORE_DROP - (shotsFired % SHOTS_BEFORE_DROP);
  const statusLabel = gameWon ? "Stage clear" : gameOver ? "Run ended" : isPaused ? "Paused" : "Aim and release";

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 py-8 text-white sm:py-12"
      style={{
        backgroundImage:
          "radial-gradient(circle at 15% 10%, rgba(217,70,239,0.18), transparent 28%), radial-gradient(circle at 85% 25%, rgba(59,130,246,0.16), transparent 30%), linear-gradient(180deg, #090d1b 0%, #11152a 52%, #080b16 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />

      <Container size="xl" className="relative">
        <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-fuchsia-200">
              <span className="i-ph-sparkle-fill text-fuchsia-300" />
              Neon arcade
            </div>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">
              Puzzle <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">Bobble</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Bank shots off the walls, build color chains, and clear the ceiling before it closes in.
            </p>
          </div>

          <div className="flex flex-wrap gap-3" aria-label="Game controls">
            <button
              type="button"
              onClick={toggleMuted}
              className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-bold text-slate-100 transition hover:border-fuchsia-300/40 hover:bg-white/14 focus:outline-none focus:ring-3 focus:ring-fuchsia-400/40"
              aria-label={isMuted ? "Turn sound on" : "Mute sound"}
            >
              <span className={isMuted ? "i-ph-speaker-slash-fill text-xl" : "i-ph-speaker-high-fill text-xl"} />
              <span className="hidden sm:inline">{isMuted ? "Sound off" : "Sound on"}</span>
            </button>
            <button
              type="button"
              onClick={togglePause}
              disabled={gameOver || gameWon}
              aria-label={isPaused ? "Resume game" : "Pause game"}
              className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-bold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/14 focus:outline-none focus:ring-3 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className={isPaused ? "i-ph-play-fill text-xl" : "i-ph-pause-fill text-xl"} />
              <span className="hidden sm:inline">{isPaused ? "Resume" : "Pause"}</span>
            </button>
            <button
              type="button"
              onClick={resetGame}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:-translate-y-0.5 hover:shadow-fuchsia-500/25 focus:outline-none focus:ring-3 focus:ring-fuchsia-300/50 active:translate-y-0"
            >
              <span className="i-ph-arrow-counter-clockwise-bold text-xl" />
              Restart
            </button>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,620px)_minmax(280px,360px)] lg:justify-center xl:gap-9">
          <section className="mx-auto w-full max-w-[620px]" aria-label="Puzzle Bobble game">
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/8 px-4 py-3 shadow-lg shadow-black/15 backdrop-blur">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Score</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-white sm:text-3xl">{score.toLocaleString()}</div>
                {lastGain > 0 && <div className="absolute right-3 top-3 text-sm font-black text-emerald-300">+{lastGain}</div>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 shadow-lg shadow-black/15 backdrop-blur">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Drop in</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-black tabular-nums text-rose-300 sm:text-3xl">{shotsUntilDrop}</span>
                  <div className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: SHOTS_BEFORE_DROP }).map((_, index) => (
                      <span key={index} className={`h-2 w-2 rounded-full ${index < shotsUntilDrop ? "bg-rose-300" : "bg-white/15"}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 shadow-lg shadow-black/15 backdrop-blur">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Chain</div>
                <div className="mt-1 text-2xl font-black tabular-nums text-cyan-300 sm:text-3xl">×{Math.max(1, combo)}</div>
              </div>
            </div>

            <div className="rounded-[2rem] bg-gradient-to-br from-fuchsia-400 via-violet-500 to-cyan-400 p-[3px] shadow-[0_28px_90px_rgba(76,29,149,0.42)]">
              <div className="relative overflow-hidden rounded-[calc(2rem-3px)] bg-slate-950 p-2 sm:p-3">
                <canvas
                  ref={canvasRef}
                  className="block aspect-[352/450] w-full cursor-crosshair rounded-[1.35rem] bg-slate-900 outline-none"
                  role="application"
                  tabIndex={0}
                  aria-label="Puzzle Bobble board. Move the pointer or use left and right arrows to aim. Release, Space, or Enter to shoot."
                  onPointerDown={(event) => {
                    event.currentTarget.focus();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateAim(event.clientX, event.clientY);
                  }}
                  onPointerMove={(event) => updateAim(event.clientX, event.clientY)}
                  onPointerUp={(event) => {
                    updateAim(event.clientX, event.clientY);
                    shoot();
                  }}
                  style={{ touchAction: "none" }}
                />

                {(isPaused || gameOver || gameWon) && (
                  <div className="absolute inset-2 flex items-center justify-center rounded-[1.35rem] bg-slate-950/82 p-6 text-center backdrop-blur-sm sm:inset-3">
                    <div className="max-w-sm">
                      <div className={`mx-auto mb-4 h-16 w-16 ${gameWon ? "i-ph-trophy-fill text-yellow-300" : gameOver ? "i-ph-skull-duotone text-rose-300" : "i-ph-pause-circle-fill text-cyan-300"}`} />
                      <div className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{statusLabel}</div>
                      <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                        {gameWon ? "Ceiling cleared!" : gameOver ? "Bubbles broke through" : "Take a breather"}
                      </h2>
                      {(gameOver || gameWon) && <p className="mt-3 text-lg text-slate-300">Final score: <strong className="text-fuchsia-300">{score.toLocaleString()}</strong></p>}
                      <button
                        type="button"
                        onClick={isPaused ? togglePause : resetGame}
                        className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-black text-slate-950 shadow-xl transition hover:scale-105 focus:outline-none focus:ring-3 focus:ring-fuchsia-300/60"
                      >
                        <span className={isPaused ? "i-ph-play-fill text-xl" : "i-ph-arrow-counter-clockwise-bold text-xl"} />
                        {isPaused ? "Resume game" : "Play again"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-slate-400 sm:text-base">
              <span className="i-ph-hand-tap-duotone text-xl text-cyan-300" />
              Drag to aim, then release to shoot
            </div>
          </section>

          <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/7 p-6 shadow-xl shadow-black/15 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">Mission</div>
                  <h2 className="mt-1 text-2xl font-black text-white">Clear every bubble</h2>
                </div>
                <div className="i-ph-target-duotone text-4xl text-fuchsia-300" />
              </div>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Connect three or more matching bubbles. Unsupported groups fall for bonus points.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/7 p-6 shadow-xl shadow-black/15 backdrop-blur">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <span className="i-ph-keyboard-duotone text-2xl text-cyan-300" />
                Controls
              </h2>
              <dl className="mt-4 grid gap-3 text-sm sm:text-base">
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Aim</dt><dd className="font-bold text-slate-100">Pointer · A / D</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Shoot</dt><dd className="font-bold text-slate-100">Release · Space</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Pause</dt><dd className="font-bold text-slate-100">P · Esc</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Restart / mute</dt><dd className="font-bold text-slate-100">R / M</dd></div>
              </dl>
            </div>

            <div className="rounded-3xl border border-amber-300/15 bg-amber-300/8 p-6 sm:col-span-2 lg:col-span-1">
              <h2 className="flex items-center gap-2 text-lg font-black text-amber-100">
                <span className="i-ph-warning-diamond-fill text-2xl text-amber-300" />
                Pressure rule
              </h2>
              <p className="mt-3 text-base leading-7 text-amber-50/75">
                The ceiling advances every six shots. Use bank shots early so the lower rows stay open.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/7 p-6 sm:col-span-2 lg:col-span-1">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Color symbols</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {COLORS.map((color) => (
                  <div key={color} className="flex min-h-12 items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-lg" style={{ backgroundColor: color }}>{COLOR_DETAILS[color].symbol}</span>
                    <span className="truncate text-xs font-bold text-slate-300">{COLOR_DETAILS[color].name}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
