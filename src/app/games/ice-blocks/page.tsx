'use client';

import { useState, useEffect, useRef } from 'react';
import Container from '@/components/common/Container';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
  }
}

interface GameState {
  mode: 'start' | 'playing' | 'gameOver';
  score: number;
  lives: number;
  highScore: number;
}

interface Body {
  id: string;
  isCircle: boolean;
  radius?: number;
  size?: number;
  color: string;
  rotation: number;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLATFORM_WIDTH = 120;
const PLATFORM_HEIGHT = 15;
const GRAVITY = 1.5;
const SPAWN_RATE = 90; // 每 90 幀產生一個新物體
const COLORS = ['#87CEEB', '#E0F6FF', '#B0E0E6', '#00BFFF', '#1E90FF'];

export default function IceBlocksGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);
  const bodiesRef = useRef<Map<string, Body>>(new Map());
  const gameStateRef = useRef<GameState>({
    mode: 'start',
    score: 0,
    lives: 3,
    highScore: 0,
  });
  const platformRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40 });
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef({ x: CANVAS_WIDTH / 2 });
  const spawnTimerRef = useRef(0);
  const timeAccumulatorRef = useRef(0);
  const fallCountRef = useRef(0);
  const matterRef = useRef<any>(null);

  // 初始化 Matter.js
  useEffect(() => {
    // 動態導入 Matter.js
    import('matter-js').then((MatterModule) => {
      const { Engine, World, Body, Bodies, Events } = MatterModule;

      const engine = Engine.create();
      engineRef.current = engine;
      matterRef.current = { Engine, World, Body, Bodies, Events };
      engine.world.gravity.y = GRAVITY;

      // 建立邊界牆壁
      const leftWall = Bodies.rectangle(-5, CANVAS_HEIGHT / 2, 10, CANVAS_HEIGHT + 200, {
        label: 'leftWall',
        isStatic: true,
      });

      const rightWall = Bodies.rectangle(CANVAS_WIDTH + 5, CANVAS_HEIGHT / 2, 10, CANVAS_HEIGHT + 200, {
        label: 'rightWall',
        isStatic: true,
      });

      // 建立平台（靜態 body）
      const platform = Bodies.rectangle(
        platformRef.current.x,
        platformRef.current.y + PLATFORM_HEIGHT / 2,
        PLATFORM_WIDTH,
        PLATFORM_HEIGHT,
        {
          label: 'platform',
          isStatic: true,
        }
      );

      World.add(engine.world, [leftWall, rightWall, platform]);

      // 鍵盤控制
      const handleKeyDown = (e: KeyboardEvent) => {
        keysPressed.current[e.key.toLowerCase()] = true;
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        keysPressed.current[e.key.toLowerCase()] = false;
      };

      // 滑鼠控制
      const handleMouseMove = (e: MouseEvent) => {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          mousePosRef.current.x = e.clientX - rect.left;
        }
      };

      // 觸控控制
      const handleTouchMove = (e: TouchEvent) => {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          mousePosRef.current.x = e.touches[0].clientX - rect.left;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);

      // 暴露給 Playwright 的介面
      window.render_game_to_text = () => {
        const state = gameStateRef.current;
        return JSON.stringify({
          mode: state.mode,
          score: state.score,
          lives: state.lives,
          platform: { x: platformRef.current.x, y: platformRef.current.y },
          bodiesOnScreen: bodiesRef.current.size,
          coordinate: 'origin top-left, y increases downward',
        });
      };

      window.advanceTime = (ms: number) => {
        Engine.update(engine, ms);
      };

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
      };
    });
  }, []);

  // 主遊戲迴圈
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastFrameTime = Date.now();

    const gameLoop = () => {
      const now = Date.now();
      const deltaTime = Math.min(now - lastFrameTime, 16.67);
      lastFrameTime = now;

      const state = gameStateRef.current;
      const engine = engineRef.current;
      const matter = matterRef.current;

      if (!engine || !matter) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      const { Engine, World, Body, Bodies } = matter;

      // 更新平台位置
      const platformSpeed = 8;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
        platformRef.current.x = Math.max(PLATFORM_WIDTH / 2, platformRef.current.x - platformSpeed);
      }
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        platformRef.current.x = Math.min(CANVAS_WIDTH - PLATFORM_WIDTH / 2, platformRef.current.x + platformSpeed);
      }

      // 滑鼠控制
      const targetX = Math.max(PLATFORM_WIDTH / 2, Math.min(CANVAS_WIDTH - PLATFORM_WIDTH / 2, mousePosRef.current.x));
      platformRef.current.x += (targetX - platformRef.current.x) * 0.1;

      // 更新平台位置
      const platform = engine.world.bodies.find((b: any) => b.label === 'platform');
      if (platform) {
        Body.setPosition(platform, {
          x: platformRef.current.x,
          y: platformRef.current.y + PLATFORM_HEIGHT / 2,
        });
      }

      // 遊戲邏輯
      if (state.mode === 'start') {
        if (keysPressed.current[' '] || keysPressed.current['enter']) {
          state.mode = 'playing';
          keysPressed.current = {};
        }
      } else if (state.mode === 'playing') {
        // 生成新物體
        spawnTimerRef.current++;
        if (spawnTimerRef.current >= SPAWN_RATE) {
          spawnTimerRef.current = 0;
          const isCircle = Math.random() > 0.5;
          const x = Math.random() * (CANVAS_WIDTH - 40) + 20;
          const color = COLORS[Math.floor(Math.random() * COLORS.length)];

          if (isCircle) {
            const radius = Math.random() * 20 + 15;
            const circle = Bodies.circle(x, -30, radius, {
              friction: 0.5,
              restitution: 0.8,
              density: 0.04,
            });
            World.add(engine.world, circle);
            const id = `circle-${Date.now()}-${Math.random()}`;
            (circle as any).id = id;
            bodiesRef.current.set(id, {
              id,
              isCircle: true,
              radius,
              color,
              rotation: circle.angle,
            });
          } else {
            const size = Math.random() * 30 + 25;
            const rect = Bodies.rectangle(x, -30, size, size, {
              friction: 0.5,
              restitution: 0.8,
              density: 0.04,
            });
            World.add(engine.world, rect);
            const id = `rect-${Date.now()}-${Math.random()}`;
            (rect as any).id = id;
            bodiesRef.current.set(id, {
              id,
              isCircle: false,
              size,
              color,
              rotation: rect.angle,
            });
          }
        }

        // 更新 Matter.js 引擎
        Engine.update(engine, 16.67);

        // 檢查掉落與碰撞
        const bodiesToRemove: string[] = [];
        bodiesRef.current.forEach((bodyData, id) => {
          const matterBody = engine.world.bodies.find((b: any) => (b as any).id === id);
          if (!matterBody) {
            bodiesToRemove.push(id);
            return;
          }

          // 更新旋轉
          bodyData.rotation = matterBody.angle;

          // 檢查是否掉落
          if (matterBody.position.y > CANVAS_HEIGHT + 50) {
            bodiesToRemove.push(id);
            World.remove(engine.world, matterBody);
            fallCountRef.current++;

            if (fallCountRef.current >= state.lives) {
              state.mode = 'gameOver';
              if (state.score > state.highScore) {
                state.highScore = state.score;
              }
            }
          }
        });

        // 移除掉落的物體
        bodiesToRemove.forEach(id => bodiesRef.current.delete(id));

        // 更新分數
        state.score = 10 + bodiesRef.current.size * 5;
      } else if (state.mode === 'gameOver') {
        if (keysPressed.current[' '] || keysPressed.current['enter']) {
          // 重新開始
          state.mode = 'start';
          state.score = 0;
          state.lives = 3;
          fallCountRef.current = 0;
          spawnTimerRef.current = 0;

          // 清除所有物體
          bodiesRef.current.forEach((_, id) => {
            const matterBody = engine.world.bodies.find((b: any) => (b as any).id === id);
            if (matterBody) World.remove(engine.world, matterBody);
          });
          bodiesRef.current.clear();

          keysPressed.current = {};
        }
      }

      // 繪製遊戲
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#1a3a52');
      gradient.addColorStop(1, '#0a1a2f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 繪製物體
      bodiesRef.current.forEach((bodyData) => {
        const matterBody = engine.world.bodies.find((b: any) => (b as any).id === bodyData.id);
        if (!matterBody) return;

        const { x, y } = matterBody.position;

        if (bodyData.isCircle && bodyData.radius) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(bodyData.rotation);

          ctx.fillStyle = bodyData.color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(0, 0, bodyData.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(-bodyData.radius * 0.3, -bodyData.radius * 0.3, bodyData.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        } else if (bodyData.size) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(bodyData.rotation);

          ctx.fillStyle = bodyData.color;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(-bodyData.size / 2, -bodyData.size / 2, bodyData.size, bodyData.size);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.strokeRect(-bodyData.size / 2, -bodyData.size / 2, bodyData.size, bodyData.size);

          ctx.restore();
        }
      });

      // 繪製平台
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(
        platformRef.current.x - PLATFORM_WIDTH / 2,
        platformRef.current.y,
        PLATFORM_WIDTH,
        PLATFORM_HEIGHT
      );

      ctx.strokeStyle = '#4da6ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.strokeRect(
        platformRef.current.x - PLATFORM_WIDTH / 2,
        platformRef.current.y,
        PLATFORM_WIDTH,
        PLATFORM_HEIGHT
      );
      ctx.restore();

      // UI 繪製
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`Score: ${state.score}`, 15, 30);
      ctx.fillText(`Lives: ${state.lives - fallCountRef.current}`, 15, 55);

      // Start 畫面
      if (state.mode === 'start') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ice Blocks', CANVAS_WIDTH / 2, 150);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#e0f6ff';
        ctx.fillText('接住從天而降的冰塊', CANVAS_WIDTH / 2, 200);
        ctx.fillText('用鍵盤 A/D 或滑鼠移動平台', CANVAS_WIDTH / 2, 225);

        ctx.fillStyle = '#4da6ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('按 SPACE 開始', CANVAS_WIDTH / 2, 300);
        ctx.textAlign = 'left';
      }

      // Game Over 畫面
      if (state.mode === 'gameOver') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', CANVAS_WIDTH / 2, 150);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#e0f6ff';
        ctx.fillText(`最終分數: ${state.score}`, CANVAS_WIDTH / 2, 220);
        ctx.fillText(`最高分: ${state.highScore}`, CANVAS_WIDTH / 2, 260);

        ctx.fillStyle = '#4da6ff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('按 SPACE 重新開始', CANVAS_WIDTH / 2, 350);
        ctx.textAlign = 'left';
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <Container>
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 py-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">敲冰塊</h1>
          <p className="text-gray-400">Ice Blocks Stacking Game</p>
        </div>

        <div className="border-4 border-cyan-400 rounded-lg overflow-hidden bg-slate-900 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <div className="bg-slate-800 p-4 rounded text-center">
            <p className="text-gray-400 text-sm">鍵盤控制</p>
            <p className="text-white font-bold">A/D 或 ←/→</p>
          </div>
          <div className="bg-slate-800 p-4 rounded text-center">
            <p className="text-gray-400 text-sm">滑鼠控制</p>
            <p className="text-white font-bold">移動滑鼠</p>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded max-w-md">
          <h2 className="text-lg font-bold text-cyan-400 mb-3">遊戲說明</h2>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>• 接住從天而降的冰塊（圓形或方形）</li>
            <li>• 每接到一個冰塊獲得分數</li>
            <li>• 冰塊掉落 3 次後遊戲結束</li>
            <li>• 物體疊得越高，分數越高</li>
          </ul>
        </div>
      </div>
    </Container>
  );
}
