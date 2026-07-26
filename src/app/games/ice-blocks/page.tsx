'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Engine as MatterEngine, IEventCollision } from 'matter-js';
import Container from '@/components/common/Container';
import {
  GameState,
  ItemType,
  calculateCrushPoints,
  createInitialGameState,
  getSpawnRate,
  getStackPreview,
  isInsideBucketCaptureZone,
  loseLife,
  renderGameToText,
  selectItemType,
} from './utils';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
  }
}

interface BodyData {
  id: number;
  itemType: ItemType;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  rotation: number;
}

type MatterApi = typeof import('matter-js');

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  wobble: number;
  wobbleSpeed: number;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BUCKET_WIDTH = 150;     // 加寬一點確保能接
const BUCKET_HEIGHT = 100;    // ★ 牆壁加高，讓冰塊不會因為慣性輕易滑出去
const BUCKET_THICKNESS = 16;
const GRAVITY = 1.5;          // ★ 提高重力，讓冰塊更扎實往下沉
const MAX_PHYSICS_STEP_MS = 1000 / 60;
const ICE_COLORS = ['#87CEEB', '#E0F6FF', '#7DF9FF', '#00FFFF', '#1E90FF', '#00BFFF'];

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function IceBlocksGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MatterEngine | null>(null);
  const bodiesRef = useRef<Map<number, BodyData>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const snowflakesRef = useRef<Snowflake[]>([]);
  
  const [uiState, setUiState] = useState<GameState>(createInitialGameState);
  const uiStateRef = useRef<GameState>(uiState);

  const updateUiState = useCallback((updates: Partial<GameState>) => {
    const newState = { ...uiStateRef.current, ...updates };
    uiStateRef.current = newState;
    setUiState(newState);
  }, []);

  const showMessage = useCallback((text: string, color: string, x: number, y: number) => {
    updateUiState({ message: { text, color, x, y, life: 60 } }); // 60 frames
  }, [updateUiState]);

  const bucketRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40 });
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef({ x: CANVAS_WIDTH / 2 });
  const spawnTimerRef = useRef(0);
  const matterRef = useRef<MatterApi | null>(null);
  const crushRequestedRef = useRef(false);

  const handleFireballExplosion = useCallback((x: number, y: number) => {
    const nextState = {
      ...loseLife(uiStateRef.current),
      stack: getStackPreview([]),
    };
    updateUiState(nextState);

    if (nextState.mode !== 'gameOver') {
      showMessage('-1 LIFE. BUCKET CLEARED!', '#ef4444', x, y - 40);

      const engine = engineRef.current;
      const matter = matterRef.current;
      if (engine && matter) {
        bodiesRef.current.forEach((bodyData, id) => {
          if (bodyData.itemType === 'fire') return;
          const matterBody = engine.world.bodies.find((body) => body.id === id);
          if (matterBody && isInsideBucketCaptureZone(
            matterBody.position.x,
            matterBody.position.y,
            bucketRef.current.x,
            bucketRef.current.y,
            BUCKET_WIDTH,
            BUCKET_HEIGHT,
            BUCKET_THICKNESS,
          )) {
            matter.World.remove(engine.world, matterBody);
            bodiesRef.current.delete(id);
          }
        });
      }
    }

    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 1,
        maxLife: Math.random() * 30 + 10,
        color: Math.random() > 0.5 ? '#ef4444' : '#f59e0b',
        size: Math.random() * 6 + 2,
      });
    }
  }, [showMessage, updateUiState]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => undefined;

    void import('matter-js').then((MatterModule) => {
      if (disposed) return;
      const { Engine, World, Body, Bodies, Events } = MatterModule;
      const engine = Engine.create();
      engineRef.current = engine;
      matterRef.current = MatterModule;
      engine.world.gravity.y = GRAVITY;

      const leftWall = Bodies.rectangle(-50, CANVAS_HEIGHT / 2, 100, CANVAS_HEIGHT + 1000, {
        label: 'leftWall',
        isStatic: true,
      });

      const rightWall = Bodies.rectangle(CANVAS_WIDTH + 50, CANVAS_HEIGHT / 2, 100, CANVAS_HEIGHT + 1000, {
        label: 'rightWall',
        isStatic: true,
      });

      // 建立複合結構的桶子
      const floor = Bodies.rectangle(0, BUCKET_HEIGHT / 2 - BUCKET_THICKNESS / 2, BUCKET_WIDTH, BUCKET_THICKNESS, { label: 'bucket_floor' });
      const leftB = Bodies.rectangle(-BUCKET_WIDTH / 2 + BUCKET_THICKNESS / 2, 0, BUCKET_THICKNESS, BUCKET_HEIGHT, { label: 'bucket_left', chamfer: { radius: 5 } });
      const rightB = Bodies.rectangle(BUCKET_WIDTH / 2 - BUCKET_THICKNESS / 2, 0, BUCKET_THICKNESS, BUCKET_HEIGHT, { label: 'bucket_right', chamfer: { radius: 5 } });
      
      const bucket = Body.create({
        parts: [floor, leftB, rightB],
        isStatic: true,
        friction: 1.0,     // ★ 極高摩擦力
        restitution: 0.0,  // ★ 完全不彈跳
        label: 'bucket'
      });
      Body.setPosition(bucket, { x: bucketRef.current.x, y: bucketRef.current.y });

      World.add(engine.world, [leftWall, rightWall, bucket]);

      const handleCollision = (event: IEventCollision<MatterEngine>) => {
        event.pairs.forEach((pair) => {
          const bodyA = pair.bodyA;
          const bodyB = pair.bodyB;

          // 火球砸到桶子底部或接到桶子裡
          const isFireA = (bodyA.label as string || '').startsWith('fire-');
          const isFireB = (bodyB.label as string || '').startsWith('fire-');
          const isBucketPartA = bodyA.label && bodyA.label.startsWith('bucket');
          const isBucketPartB = bodyB.label && bodyB.label.startsWith('bucket');
          
          if ((isFireA && isBucketPartB) || (isFireB && isBucketPartA)) {
            const fireBody = isFireA ? bodyA : bodyB;
            if (bodiesRef.current.has(fireBody.id)) {
              handleFireballExplosion(
                (bodyA.position.x + bodyB.position.x) / 2,
                (bodyA.position.y + bodyB.position.y) / 2,
              );
              World.remove(engine.world, fireBody);
              bodiesRef.current.delete(fireBody.id);
            }
          }

          // 碰撞特效
          const vA = bodyA.velocity || { x: 0, y: 0 };
          const vB = bodyB.velocity || { x: 0, y: 0 };
          const relVel = Math.abs(vA.y - vB.y) + Math.abs(vA.x - vB.x);
          
          if (relVel > 3) {
            const x = (bodyA.position.x + bodyB.position.x) / 2;
            const y = (bodyA.position.y + bodyB.position.y) / 2;
            const particleCount = Math.min(Math.floor(relVel * 1.5), 10);
            
            for (let i = 0; i < particleCount; i++) {
              particlesRef.current.push({
                x, y,
                vx: (Math.random() - 0.5) * relVel * 1.2,
                vy: (Math.random() - 0.5) * relVel * 1.2 - 2,
                life: 1,
                maxLife: Math.random() * 15 + 15,
                color: '#ffffff',
                size: Math.random() * 2 + 1
              });
            }
          }
        });
      };
      Events.on(engine, 'collisionStart', handleCollision);

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, a, input, textarea, select')) return;
        keysPressed.current[e.key.toLowerCase()] = true; 
        if (e.code === 'Space' && uiStateRef.current.mode === 'playing') {
          crushRequestedRef.current = true;
          e.preventDefault();
        } else if (e.key.toLowerCase() === 'p' && !e.repeat) {
          const mode = uiStateRef.current.mode;
          if (mode === 'playing' || mode === 'paused') {
            updateUiState({ mode: mode === 'playing' ? 'paused' : 'playing' });
          }
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
      const handlePointerMove = (e: PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      };
      const handlePointerDown = (e: PointerEvent) => {
        handlePointerMove(e);
        canvasRef.current?.focus();
        if (e.pointerType === 'mouse' && uiStateRef.current.mode === 'playing') {
          crushRequestedRef.current = true;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      const canvas = canvasRef.current;
      canvas?.addEventListener('pointermove', handlePointerMove);
      canvas?.addEventListener('pointerdown', handlePointerDown);

      window.render_game_to_text = () => renderGameToText(
        uiStateRef.current,
        bucketRef.current.x,
        Array.from(bodiesRef.current.values(), (body) => body.itemType),
      );
      window.advanceTime = (ms: number) => {
        let remaining = Math.max(0, ms);
        while (remaining > 0) {
          const step = Math.min(remaining, MAX_PHYSICS_STEP_MS);
          Engine.update(engine, step);
          remaining -= step;
        }
      };

      cleanup = () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        canvas?.removeEventListener('pointermove', handlePointerMove);
        canvas?.removeEventListener('pointerdown', handlePointerDown);
        Events.off(engine, 'collisionStart', handleCollision);
        World.clear(engine.world, false);
        Engine.clear(engine);
        if (engineRef.current === engine) engineRef.current = null;
        if (matterRef.current === MatterModule) matterRef.current = null;
        delete window.render_game_to_text;
        delete window.advanceTime;
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [handleFireballExplosion, updateUiState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const targetWidth = Math.round(CANVAS_WIDTH * pixelRatio);
    const targetHeight = Math.round(CANVAS_HEIGHT * pixelRatio);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    snowflakesRef.current = [];
    for (let i = 0; i < 40; i++) {
      snowflakesRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: Math.random() * 1.5 + 0.5,
        size: Math.random() * 2 + 1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.05 + 0.01,
      });
    }

    let animationFrameId: number;
    let lastFrameTime = Date.now();

    const gameLoop = () => {
      const now = Date.now();
      const deltaTime = Math.min(now - lastFrameTime, 32);
      lastFrameTime = now;

      const state = uiStateRef.current;
      const engine = engineRef.current;
      const matter = matterRef.current;

      if (!engine || !matter) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      const { Engine, World, Body, Bodies } = matter;

      // ====== 狀態更新 ======
      if (state.message && state.mode !== 'paused') {
        state.message.life -= (deltaTime / 16);
        state.message.y -= 0.5;
        if (state.message.life <= 0) {
          updateUiState({ message: null });
        }
      }

      if (state.mode === 'playing') {
        // ====== 平台 (Bucket) 移動邏輯 ======
        const platformSpeed = 10 * (deltaTime / 16.67);
        let targetX = bucketRef.current.x;

        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
          targetX -= platformSpeed;
        } else if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
          targetX += platformSpeed;
        } else {
          targetX = Math.max(BUCKET_WIDTH / 2, Math.min(CANVAS_WIDTH - BUCKET_WIDTH / 2, mousePosRef.current.x));
        }
        targetX = Math.max(BUCKET_WIDTH / 2, Math.min(CANVAS_WIDTH - BUCKET_WIDTH / 2, targetX));

        const prevX = bucketRef.current.x;
        bucketRef.current.x += (targetX - bucketRef.current.x) * 0.35;
        const dx = bucketRef.current.x - prevX;

        const bucket = engine.world.bodies.find((body) => body.label === 'bucket');
        if (bucket) {
          Body.setPosition(bucket, {
            x: bucketRef.current.x,
            y: bucketRef.current.y,
          });

          const velocity = Math.max(-25, Math.min(25, dx * (16.67 / deltaTime)));
          Body.setVelocity(bucket, { x: velocity, y: 0 });
        }
      }

      // ====== 遊戲邏輯 ======
      if (state.mode === 'playing') {
        
        // 處理 Crush 分數結算
        if (crushRequestedRef.current) {
          crushRequestedRef.current = false;
          let blocksInBucket = 0;
          let goldCount = 0;
          const bodiesToRemove: number[] = [];
          
          bodiesRef.current.forEach((bodyData, id) => {
            const matterBody = engine.world.bodies.find((body) => body.id === id);
            if (matterBody && isInsideBucketCaptureZone(
              matterBody.position.x,
              matterBody.position.y,
              bucketRef.current.x,
              bucketRef.current.y,
              BUCKET_WIDTH,
              BUCKET_HEIGHT,
              BUCKET_THICKNESS,
            )) {
              if (bodyData.itemType === 'fire') return; // 火球不能被 Crush，必須躲掉
              
              blocksInBucket++;
              if (bodyData.itemType === 'gold') goldCount++;
              bodiesToRemove.push(id);
              World.remove(engine.world, matterBody);

              // 結算粉碎特效
              for (let i = 0; i < 8; i++) {
                particlesRef.current.push({
                  x: matterBody.position.x, y: matterBody.position.y,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10 - 2,
                  life: 1, maxLife: 20,
                  color: bodyData.color, size: Math.random() * 4 + 2
                });
              }
            }
          });

          if (blocksInBucket > 0) {
             // 結算公式：純數量指數加成 + 金塊獎勵
             // 例如：1塊=10, 5塊=250, 10塊=1000
             const totalEarned = calculateCrushPoints(blocksInBucket, goldCount).total;
             
             updateUiState({
               score: state.score + totalEarned,
               stack: getStackPreview([]),
             });
             showMessage(`+${totalEarned} COMBO x${blocksInBucket}!`, "#22d3ee", bucketRef.current.x, bucketRef.current.y - 80);
          }
          
          bodiesToRemove.forEach(id => bodiesRef.current.delete(id));
        }

        // 生成掉落物
        spawnTimerRef.current += (deltaTime / 16.67);
        const currentSpawnRate = getSpawnRate(state.score);
        
        if (spawnTimerRef.current >= currentSpawnRate) {
          spawnTimerRef.current = 0;
          
          const itemType = selectItemType(Math.random());

          const x = Math.random() * (CANVAS_WIDTH - 60) + 30;

          if (itemType === 'fire') {
            const radius = 18;
            const fireball = Bodies.circle(x, -50, radius, {
              friction: 0.1, restitution: 0.8, density: 0.05,
              label: `fire-${Date.now()}`
            });
            World.add(engine.world, fireball);
            const id = fireball.id;
            bodiesRef.current.set(id, { id, itemType: 'fire', radius, color: '#ef4444', rotation: fireball.angle });
          } else {
            const isWide = Math.random() > 0.5;
            const size = Math.random() * 20 + 20;
            const w = isWide ? size * 1.4 : size;
            const h = !isWide ? size * 1.4 : size;
            const color = itemType === 'gold' ? '#fbbf24' : ICE_COLORS[Math.floor(Math.random() * ICE_COLORS.length)];
            
            const rect = Bodies.rectangle(x, -50, w, h, {
              friction: 1.0,       // 高摩擦力互相緊扣
              restitution: 0.0,    // 取消回彈力
              density: itemType === 'gold' ? 0.3 : 0.15, // ★ 大幅增加冰塊重量，慣性變低就不容易甩飛
              chamfer: { radius: 3 },
              label: `ice-${Date.now()}`
            });
            World.add(engine.world, rect);
            const id = rect.id;
            bodiesRef.current.set(id, { id, itemType, width: w, height: h, color, rotation: rect.angle });
          }
        }

        let remainingPhysicsTime = deltaTime;
        while (remainingPhysicsTime > 0) {
          const step = Math.min(remainingPhysicsTime, MAX_PHYSICS_STEP_MS);
          Engine.update(engine, step);
          remainingPhysicsTime -= step;
        }

        // 進入桶子捕捉區的火球即使先撞上堆疊，也必須爆炸。
        for (const [id, bodyData] of bodiesRef.current) {
          if (bodyData.itemType !== 'fire') continue;
          const matterBody = engine.world.bodies.find((body) => body.id === id);
          if (matterBody && isInsideBucketCaptureZone(
            matterBody.position.x,
            matterBody.position.y,
            bucketRef.current.x,
            bucketRef.current.y,
            BUCKET_WIDTH,
            BUCKET_HEIGHT,
            BUCKET_THICKNESS,
          )) {
            handleFireballExplosion(matterBody.position.x, matterBody.position.y);
            World.remove(engine.world, matterBody);
            bodiesRef.current.delete(id);
            break;
          }
        }

        const stackItems: ItemType[] = [];
        bodiesRef.current.forEach((bodyData, id) => {
          if (bodyData.itemType === 'fire') return;
          const matterBody = engine.world.bodies.find((body) => body.id === id);
          if (matterBody && isInsideBucketCaptureZone(
            matterBody.position.x,
            matterBody.position.y,
            bucketRef.current.x,
            bucketRef.current.y,
            BUCKET_WIDTH,
            BUCKET_HEIGHT,
            BUCKET_THICKNESS,
          )) {
            stackItems.push(bodyData.itemType);
          }
        });
        const nextStack = getStackPreview(stackItems);
        const currentStack = uiStateRef.current.stack;
        if (
          nextStack.blockCount !== currentStack.blockCount
          || nextStack.goldCount !== currentStack.goldCount
          || nextStack.projectedPoints !== currentStack.projectedPoints
        ) {
          updateUiState({ stack: nextStack });
        }

        // 檢查掉落出界
        const bodiesToRemove: number[] = [];
        bodiesRef.current.forEach((bodyData, id) => {
          const matterBody = engine.world.bodies.find((body) => body.id === id);
          if (!matterBody) { bodiesToRemove.push(id); return; }

          bodyData.rotation = matterBody.angle;
          
          if (matterBody.position.y > CANVAS_HEIGHT + 100) {
            bodiesToRemove.push(id);
            World.remove(engine.world, matterBody);

            if (bodyData.itemType === 'ice' || bodyData.itemType === 'gold') {
              // 漏接了能裝的冰塊，扣生命！
              const nextState = loseLife(uiStateRef.current);
              updateUiState(nextState);
              if (nextState.mode !== 'gameOver') {
                showMessage("-1 LIFE (Dropped Ice)", "#ef4444", CANVAS_WIDTH/2, CANVAS_HEIGHT - 60);
              }
            }
          }
        });
        bodiesToRemove.forEach(id => bodiesRef.current.delete(id));
      }

      // ====== 繪圖渲染 ======
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGradient.addColorStop(0, '#040b16');
      bgGradient.addColorStop(1, '#0a2342');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      snowflakesRef.current.forEach(flake => {
        flake.y += flake.speed * (deltaTime / 16);
        flake.wobble += flake.wobbleSpeed * (deltaTime / 16);
        if (flake.y > CANVAS_HEIGHT) {
          flake.y = -10;
          flake.x = Math.random() * CANVAS_WIDTH;
        }
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (flake.size / 10)})`;
        ctx.beginPath();
        ctx.arc(flake.x + Math.sin(flake.wobble) * 15, flake.y, flake.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * (deltaTime / 16);
        p.y += p.vy * (deltaTime / 16);
        p.life += (deltaTime / 16);
        if (p.life >= p.maxLife) { particlesRef.current.splice(i, 1); continue; }
        
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 1 - (p.life / p.maxLife);
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 繪製 Bucket
      ctx.save();
      const bx = bucketRef.current.x;
      const by = bucketRef.current.y;
      ctx.translate(bx, by);

      ctx.shadowColor = '#00f7ff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
      ctx.strokeStyle = '#00f7ff';
      ctx.lineWidth = 3;

      // 繪製 U 型桶外觀
      ctx.beginPath();
      // 左牆
      ctx.roundRect(-BUCKET_WIDTH/2, -BUCKET_HEIGHT/2, BUCKET_THICKNESS, BUCKET_HEIGHT, 4);
      // 底板
      ctx.roundRect(-BUCKET_WIDTH/2, BUCKET_HEIGHT/2 - BUCKET_THICKNESS/2, BUCKET_WIDTH, BUCKET_THICKNESS, 4);
      // 右牆
      ctx.roundRect(BUCKET_WIDTH/2 - BUCKET_THICKNESS, -BUCKET_HEIGHT/2, BUCKET_THICKNESS, BUCKET_HEIGHT, 4);
      ctx.fill();
      ctx.stroke();

      // Bucket 能量光束特效指示區
      ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
      ctx.fillRect(-BUCKET_WIDTH/2 + BUCKET_THICKNESS, -BUCKET_HEIGHT, BUCKET_WIDTH - BUCKET_THICKNESS*2, BUCKET_HEIGHT*2);
      ctx.restore();

      // 繪製動態物體
      bodiesRef.current.forEach((bodyData) => {
        const matterBody = engine.world.bodies.find((body) => body.id === bodyData.id);
        if (!matterBody) return;
        const { x, y } = matterBody.position;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bodyData.rotation);
        
        ctx.shadowColor = bodyData.color;
        ctx.shadowBlur = bodyData.itemType === 'fire' || bodyData.itemType === 'gold' ? 25 : 12;

        if (bodyData.itemType === 'fire' && bodyData.radius) {
          // 火球外觀
          const r = bodyData.radius;
          const grad = ctx.createRadialGradient(0, 0, r/4, 0, 0, r);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.3, '#fef08a'); // yellow-200
          grad.addColorStop(0.7, '#ef4444'); // red-500
          grad.addColorStop(1, '#7f1d1d'); // red-900

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          
          // 畫一點火焰拖尾特效
          ctx.fillStyle = '#ef4444';
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(0, -r, r*0.8, 0, Math.PI * 2);
          ctx.fill();

        } else if (bodyData.width && bodyData.height) {
          // 冰塊或金塊
          const width = bodyData.width;
          const height = bodyData.height;
          ctx.globalAlpha = 0.9;
          const grad = ctx.createLinearGradient(-width/2, -height/2, width/2, height/2);
          
          if (bodyData.itemType === 'gold') {
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.5, '#fbbf24');
            grad.addColorStop(1, '#b45309');
          } else {
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(0.5, bodyData.color);
            grad.addColorStop(1, '#004477');
          }

          ctx.fillStyle = grad;
          drawRoundRect(ctx, -width/2, -height/2, width, height, 4);
          ctx.fill();

          ctx.strokeStyle = bodyData.itemType === 'gold' ? '#fffbeb' : 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          drawRoundRect(ctx, -width/2 + 2, -height/2 + 2, width - 4, height - 4, 3);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 繪製浮動訊息 (Floating Text)
      if (state.message) {
        ctx.save();
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = state.message.color;
        ctx.globalAlpha = Math.max(0, state.message.life / 60);
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 5;
        ctx.fillText(state.message.text, state.message.x, state.message.y);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [handleFireballExplosion, showMessage, updateUiState]);

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    const matter = matterRef.current;
    if (engine && matter) {
      bodiesRef.current.forEach((_, id) => {
        const matterBody = engine.world.bodies.find((body) => body.id === id);
        if (matterBody) matter.World.remove(engine.world, matterBody);
      });
      bodiesRef.current.clear();
      particlesRef.current = [];
    }
    spawnTimerRef.current = 0;
    keysPressed.current = {};
    bucketRef.current.x = CANVAS_WIDTH / 2;
    mousePosRef.current.x = CANVAS_WIDTH / 2;
    updateUiState({
      ...createInitialGameState(uiStateRef.current.highScore),
      mode: 'playing',
    });
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, [updateUiState]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select')) return;
      if (e.key === 'Enter') {
        const state = uiStateRef.current;
        if (state.mode === 'start' || state.mode === 'gameOver') {
          startGame();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [startGame]);

  const togglePause = useCallback(() => {
    const mode = uiStateRef.current.mode;
    if (mode !== 'playing' && mode !== 'paused') return;
    updateUiState({ mode: mode === 'playing' ? 'paused' : 'playing' });
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, [updateUiState]);

  const requestCrush = () => {
    if (uiStateRef.current.mode !== 'playing' || uiStateRef.current.stack.blockCount === 0) return;
    crushRequestedRef.current = true;
  };

  const setDirection = (direction: 'left' | 'right', pressed: boolean) => {
    keysPressed.current[direction === 'left' ? 'arrowleft' : 'arrowright'] = pressed;
  };

  const nudgeBucket = (direction: 'left' | 'right') => {
    if (uiStateRef.current.mode !== 'playing') return;
    const delta = direction === 'left' ? -55 : 55;
    mousePosRef.current.x = Math.max(
      BUCKET_WIDTH / 2,
      Math.min(CANVAS_WIDTH - BUCKET_WIDTH / 2, bucketRef.current.x + delta),
    );
  };

  const modeLabel = {
    start: 'Ready',
    playing: 'Catching',
    paused: 'Paused',
    gameOver: 'Melted',
  }[uiState.mode];

  return (
    <Container>
      <div className="min-h-screen flex flex-col items-center gap-5 py-8 px-2 sm:px-4 font-sans antialiased select-none">
        
        <div className="flex w-full max-w-3xl flex-col items-center gap-5 lg:flex-row lg:justify-center lg:gap-8">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-700 to-cyan-600 drop-shadow-[0_2px_10px_rgba(14,116,144,0.2)]">
              Ice Blocks
            </h1>
            <p className="text-slate-500 font-semibold tracking-[0.14em] uppercase text-sm">Catch · Stack · Crush</p>
          </div>

          <div className="grid w-full max-w-[400px] grid-cols-3 gap-2 lg:flex-1" aria-label="Current run status">
            <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
              <p className="mt-1 text-sm font-black text-slate-800">{modeLabel}</p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Score</p>
              <p className="mt-1 text-sm font-black tabular-nums text-slate-800">{uiState.score.toLocaleString('en-US')}</p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lives</p>
              <p className="mt-1 text-sm font-black text-slate-800">{uiState.lives} / 3</p>
            </div>
          </div>
        </div>

        <div className="relative group w-full max-w-[400px]">
          <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500/30 to-blue-600/30 rounded-[1.25rem] blur-lg group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative border border-cyan-400/40 rounded-2xl overflow-hidden bg-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.1)] ring-1 ring-white/10">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              tabIndex={0}
              role="img"
              aria-label={`Ice Blocks game field. ${modeLabel}. Score ${uiState.score}. ${uiState.lives} lives remaining. Stack ${uiState.stack.blockCount} blocks with ${uiState.stack.goldCount} gold, worth ${uiState.stack.projectedPoints} points.`}
              className="block w-full h-auto cursor-crosshair transform-gpu outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
              style={{ touchAction: 'none', scrollMarginTop: 88 }}
            >
              Ice Blocks physics catcher game. Use the controls below the field to move and crush blocks.
            </canvas>

            {(uiState.mode === 'playing' || uiState.mode === 'paused') && (
              <div className="absolute top-4 left-5 right-5 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col">
                  <span className="text-cyan-300 font-bold text-xs tracking-widest uppercase drop-shadow-md">Score</span>
                  <span className="text-white font-black text-4xl drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] tabular-nums">
                    {uiState.score}
                  </span>
                  <span className="mt-1 rounded-full border border-cyan-300/25 bg-slate-950/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                    Stack {uiState.stack.blockCount} · Gold {uiState.stack.goldCount} · +{uiState.stack.projectedPoints}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[...Array(3)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                        i < uiState.lives 
                          ? 'bg-cyan-400 border-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.9)] scale-100' 
                          : 'bg-transparent border-slate-600/60 scale-75'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            )}

            {uiState.mode === 'paused' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
                <div className="rounded-2xl border border-cyan-400/30 bg-slate-900/90 p-7 text-center shadow-2xl">
                  <div className="i-ph-pause-circle-bold mx-auto mb-3 text-5xl text-cyan-300" aria-hidden="true" />
                  <h2 className="text-3xl font-black text-white">Paused</h2>
                  <p className="mt-2 text-sm text-slate-300">The physics field is frozen.</p>
                  <button
                    type="button"
                    onClick={togglePause}
                    className="mt-5 min-h-12 w-full rounded-xl bg-cyan-400 px-6 font-black uppercase tracking-wider text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
                  >
                    Resume
                  </button>
                </div>
              </div>
            )}

            {uiState.mode === 'start' && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center transition-opacity flex-col border-t border-white/5">
                <div className="p-8 bg-slate-900/80 rounded-3xl border border-cyan-500/20 shadow-2xl backdrop-blur-md text-center transform hover:scale-105 transition-transform duration-300">
                  <div className="w-16 h-16 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    <div className="i-ph-basket-bold text-3xl text-white animate-bounce"></div>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Gather & Crush</h2>
                  <p className="text-cyan-200/80 mb-8 max-w-[220px] mx-auto text-sm leading-relaxed">
                    Collect ice, but watch out for <span className="text-red-400 font-bold">Fireballs</span>!<br/> 
                    Crush uses <span className="font-bold text-white">blocks² × 10</span>; gold adds <span className="font-bold text-yellow-300">+500</span>.
                  </p>
                  <button 
                    onClick={startGame}
                    className="w-full py-3.5 px-6 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] transition-all active:scale-95 uppercase tracking-wider text-sm"
                  >
                    Play Now
                  </button>
                  <p className="text-xs text-slate-400 mt-4 uppercase tracking-widest font-mono">Press ENTER</p>
                </div>
              </div>
            )}

            {uiState.mode === 'gameOver' && (
              <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md flex items-center justify-center flex-col animate-fade-in">
                <div className="p-8 bg-slate-900/90 rounded-3xl border border-cyan-500/30 shadow-2xl backdrop-blur-lg text-center min-w-[300px]">
                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-rose-600 mb-6 drop-shadow-sm">
                    Melted!
                  </h2>
                  <div className="space-y-4 mb-8">
                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                      <p className="text-sm text-cyan-400/80 uppercase tracking-widest font-semibold mb-1">Final Score</p>
                      <p className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] tabular-nums">{uiState.score}</p>
                    </div>
                    <div className="flex justify-center items-center gap-2">
                      <div className="i-ph-trophy-bold text-cyan-400"></div>
                      <p className="text-sm font-medium text-slate-300">Best: <span className="text-white font-bold ml-1">{uiState.highScore}</span></p>
                    </div>
                  </div>
                  <button onClick={startGame} className="w-full py-4 px-6 bg-white hover:bg-cyan-50 text-slate-900 font-bold rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider text-sm flex items-center justify-center gap-2 group">
                    <div className="i-ph-arrow-counter-clockwise-bold group-hover:-rotate-180 transition-transform duration-500"></div> Retry
                  </button>
                  <p className="text-xs text-slate-400 mt-4 uppercase tracking-widest font-mono">Press ENTER</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid w-full max-w-[400px] grid-cols-4 gap-2" aria-label="Game controls">
          <DirectionButton
            direction="left"
            label="Move left"
            disabled={uiState.mode !== 'playing'}
            setDirection={setDirection}
            nudgeBucket={nudgeBucket}
          />
          <button
            type="button"
            disabled={uiState.mode !== 'playing' || uiState.stack.blockCount === 0}
            onClick={requestCrush}
            aria-label={uiState.stack.blockCount > 0 ? `Crush ${uiState.stack.blockCount} blocks for ${uiState.stack.projectedPoints} points` : 'Crush stack, bucket empty'}
            className="col-span-2 min-h-12 rounded-xl bg-rose-500 px-3 py-2 text-white shadow-[0_8px_20px_rgba(244,63,94,0.25)] hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="block text-sm font-black uppercase tracking-wider">
              {uiState.stack.blockCount > 0 ? `Crush +${uiState.stack.projectedPoints}` : 'Bucket empty'}
            </span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
              {uiState.stack.blockCount} blocks · {uiState.stack.goldCount} gold
            </span>
          </button>
          <DirectionButton
            direction="right"
            label="Move right"
            disabled={uiState.mode !== 'playing'}
            setDirection={setDirection}
            nudgeBucket={nudgeBucket}
          />
          {(uiState.mode === 'playing' || uiState.mode === 'paused') && (
            <button
              type="button"
              onClick={togglePause}
              className="col-span-4 min-h-11 rounded-xl border border-cyan-200 bg-white text-sm font-bold text-cyan-800 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
            >
              {uiState.mode === 'paused' ? 'Resume game' : 'Pause game'} · P
            </button>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {modeLabel}. Score {uiState.score}. {uiState.lives} lives remaining. Stack {uiState.stack.blockCount}, worth {uiState.stack.projectedPoints} points.
        </p>

        {/* Controls and Mechanics Panel */}
        <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl px-2">
          {/* Controls Mini-card */}
          <div className="flex-1 bg-slate-900/60 backdrop-blur-sm border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-center">
            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <div className="i-ph-game-controller-bold text-xl"></div> Operation
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-slate-400">Move Bucket</span>
                <div className="flex gap-1.5 focus:outline-none">
                  <span className="text-cyan-300 font-mono text-xs font-bold border border-cyan-900 bg-cyan-900/30 px-2 py-1 rounded">A/D</span>
                  <span className="text-cyan-300 font-mono text-xs font-bold border border-cyan-900 bg-cyan-900/30 px-2 py-1 rounded tracking-tighter">Drag</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-semibold text-rose-300">Crush & Score!</span>
                <span className="text-white font-bold bg-rose-600/80 px-3 py-1 rounded border border-rose-500 text-xs shadow-[0_0_10px_rgba(225,29,72,0.4)]">SPACE / Button</span>
              </div>
            </div>
          </div>

          {/* Rules Details */}
          <div className="flex-[1.8] bg-slate-900/60 backdrop-blur-sm border border-cyan-500/10 p-5 rounded-2xl shadow-lg relative overflow-hidden">
             <div className="absolute top-[-10%] right-[-5%] p-4 opacity-5 pointer-events-none">
              <div className="i-ph-basket-bold text-[10rem] text-cyan-400"></div>
            </div>
            <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <div className="i-ph-strategy-bold text-xl"></div>
              Risk & Reward Mechanics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
               <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 mb-1 text-cyan-300"><div className="w-3 h-3 bg-cyan-400 shadow-[0_0_5px_#22d3ee] rounded-sm"></div> Ice Blocks</div>
                 <p className="text-xs text-slate-400 leading-tight">Must catch them. Drops cost 1 Life.</p>
               </div>
               <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 mb-1 text-yellow-400"><div className="w-3 h-3 bg-yellow-400 shadow-[0_0_5px_#facc15] rounded-sm"></div> Gold Blocks</div>
                 <p className="text-xs text-slate-400 leading-tight">Rare. +500 points bonus when crushed!</p>
               </div>
               <div className="bg-slate-800/50 p-3 rounded-lg border border-rose-900/50 col-span-1 sm:col-span-2">
                 <div className="flex justify-between items-start">
                   <div>
                    <div className="flex items-center gap-2 mb-1 text-rose-400 font-bold"><div className="w-3 h-3 bg-rose-500 shadow-[0_0_5px_#f43f5e] rounded-full"></div> Fireballs</div>
                    <p className="text-xs text-rose-300/80 leading-tight">DODGE THESE! Catching one destroys your bucket contents and loses 1 Life.</p>
                   </div>
                   <div className="text-right shrink-0 ml-2">
                     <p className="text-cyan-300 font-bold mt-1">CRUSH COMBO</p>
                     <p className="text-xs text-slate-400">More blocks crushed = <span className="text-white font-bold">Multiplier!</span></p>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

function DirectionButton({
  direction,
  label,
  disabled,
  setDirection,
  nudgeBucket,
}: {
  direction: 'left' | 'right';
  label: string;
  disabled: boolean;
  setDirection: (direction: 'left' | 'right', pressed: boolean) => void;
  nudgeBucket: (direction: 'left' | 'right') => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => nudgeBucket(direction)}
      onPointerDown={() => setDirection(direction, true)}
      onPointerUp={() => setDirection(direction, false)}
      onPointerCancel={() => setDirection(direction, false)}
      onPointerLeave={() => setDirection(direction, false)}
      onBlur={() => setDirection(direction, false)}
      className="min-h-12 rounded-xl border border-cyan-700 bg-cyan-950 text-2xl font-black text-cyan-100 hover:bg-cyan-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {direction === 'left' ? '←' : '→'}
    </button>
  );
}
