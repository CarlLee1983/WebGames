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
  message: { text: string; color: string; life: number; x: number; y: number } | null;
}

type ItemType = 'ice' | 'gold' | 'fire';

interface BodyData {
  id: string;
  itemType: ItemType;
  size?: number;
  radius?: number;
  color: string;
  rotation: number;
}

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
const SPAWN_RATE = 100; // 基礎生成速率
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
  const engineRef = useRef<any>(null);
  const bodiesRef = useRef<Map<string, BodyData>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const snowflakesRef = useRef<Snowflake[]>([]);
  
  const [uiState, setUiState] = useState<GameState>({
    mode: 'start',
    score: 0,
    lives: 3,
    highScore: 0,
    message: null,
  });
  const uiStateRef = useRef<GameState>(uiState);

  const updateUiState = (updates: Partial<GameState>) => {
    const newState = { ...uiStateRef.current, ...updates };
    uiStateRef.current = newState;
    setUiState(newState);
  };

  const showMessage = (text: string, color: string, x: number, y: number) => {
    updateUiState({ message: { text, color, x, y, life: 60 } }); // 60 frames
  };

  const bucketRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40 });
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef({ x: CANVAS_WIDTH / 2 });
  const spawnTimerRef = useRef(0);
  const matterRef = useRef<any>(null);
  const crushRequestedRef = useRef(false);

  useEffect(() => {
    import('matter-js').then((MatterModule) => {
      const { Engine, World, Body, Bodies, Events } = MatterModule;
      const engine = Engine.create();
      engineRef.current = engine;
      matterRef.current = { Engine, World, Body, Bodies, Events };
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

      Events.on(engine, 'collisionStart', (event: any) => {
        event.pairs.forEach((pair: any) => {
          let bodyA = pair.bodyA;
          let bodyB = pair.bodyB;

          // 火球砸到桶子底部或接到桶子裡
          const isFireA = (bodyA.label as string || '').startsWith('fire-');
          const isFireB = (bodyB.label as string || '').startsWith('fire-');
          const isBucketPartA = bodyA.label && bodyA.label.startsWith('bucket');
          const isBucketPartB = bodyB.label && bodyB.label.startsWith('bucket');
          
          if ((isFireA && isBucketPartB) || (isFireB && isBucketPartA)) {
            const fireBodyId = isFireA ? bodyA.id_string : bodyB.id_string;
            if (fireBodyId && bodiesRef.current.has(fireBodyId)) {
              handleFireballExplosion(xPos(bodyA, bodyB), yPos(bodyA, bodyB));
              World.remove(engine.world, isFireA ? bodyA : bodyB);
              bodiesRef.current.delete(fireBodyId);
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
      });

      const handleKeyDown = (e: KeyboardEvent) => { 
        keysPressed.current[e.key.toLowerCase()] = true; 
        if (e.code === 'Space' && uiStateRef.current.mode === 'playing') {
          crushRequestedRef.current = true;
          e.preventDefault();
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key.toLowerCase()] = false; };
      const handleMouseMove = (e: MouseEvent) => {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
        }
      };
      const handleMouseDown = (e: MouseEvent) => {
        if (uiStateRef.current.mode === 'playing') {
          crushRequestedRef.current = true;
        }
      }
      const handleTouchMove = (e: TouchEvent) => {
        if (canvasRef.current && e.touches.length > 0) {
          const rect = canvasRef.current.getBoundingClientRect();
          mousePosRef.current.x = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_WIDTH;
          e.preventDefault();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });

      window.render_game_to_text = () => JSON.stringify(uiStateRef.current);
      window.advanceTime = (ms: number) => { Engine.update(engine, ms); };

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('touchmove', handleTouchMove);
      };
    });
  }, []);

  const xPos = (a: any, b: any) => (a.position.x + b.position.x) / 2;
  const yPos = (a: any, b: any) => (a.position.y + b.position.y) / 2;

  const handleFireballExplosion = (x: number, y: number) => {
    // 扣除生命
    const state = uiStateRef.current;
    if (state.lives - 1 <= 0) {
      updateUiState({ mode: 'gameOver', highScore: Math.max(state.score, state.highScore) });
    } else {
      updateUiState({ lives: state.lives - 1 });
      showMessage("-1 LIFE. BUCKET CLEARED!", "#ef4444", x, y - 40);
      
      // 炸彈會將桶內所有物品蒸發
      const engine = engineRef.current;
      const matter = matterRef.current;
      if (engine && matter) {
        bodiesRef.current.forEach((bodyData, id) => {
           if (bodyData.itemType === 'ice' || bodyData.itemType === 'gold') {
             const matterBody = engine.world.bodies.find((b: any) => (b as any).id_string === id);
             if (matterBody && matterBody.position.y > bucketRef.current.y - BUCKET_HEIGHT) {
                matter.World.remove(engine.world, matterBody);
                bodiesRef.current.delete(id);
             }
           }
        });
      }
    }

    // 火焰粒子特效
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 1,
        maxLife: Math.random() * 30 + 10,
        color: Math.random() > 0.5 ? '#ef4444' : '#f59e0b',
        size: Math.random() * 6 + 2
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
      if (state.message) {
        state.message.life -= (deltaTime / 16);
        state.message.y -= 0.5;
        if (state.message.life <= 0) {
          updateUiState({ message: null });
        }
      }

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

      const bucket = engine.world.bodies.find((b: any) => b.label === 'bucket');
      if (bucket) {
        Body.setPosition(bucket, {
          x: bucketRef.current.x,
          y: bucketRef.current.y,
        });
        
        // ★ 限制物理推力的上限，避免滑鼠瞬間移動時將冰塊像棒球一樣擊飛
        let velX = dx * (16.67 / deltaTime);
        velX = Math.max(-25, Math.min(25, velX));

        Body.setVelocity(bucket, { x: velX, y: 0 });
      }

      // ====== 遊戲邏輯 ======
      if (state.mode === 'playing') {
        
        // 處理 Crush 分數結算
        if (crushRequestedRef.current) {
          crushRequestedRef.current = false;
          let blocksInBucket = 0;
          let goldCount = 0;
          const bodiesToRemove: string[] = [];
          
          bodiesRef.current.forEach((bodyData, id) => {
            const matterBody = engine.world.bodies.find((b: any) => (b as any).id_string === id);
            if (matterBody && matterBody.position.y > bucketRef.current.y - BUCKET_HEIGHT - 30) {
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
             const comboMultiplier = blocksInBucket * blocksInBucket;
             const basePoints = comboMultiplier * 10;
             const goldPoints = goldCount * 500;
             const totalEarned = basePoints + goldPoints;
             
             updateUiState({ score: state.score + totalEarned });
             showMessage(`+${totalEarned} COMBO x${blocksInBucket}!`, "#22d3ee", bucketRef.current.x, bucketRef.current.y - 80);
          }
          
          bodiesToRemove.forEach(id => bodiesRef.current.delete(id));
        }

        // 生成掉落物
        spawnTimerRef.current += (deltaTime / 16.67);
        let currentSpawnRate = Math.max(35, SPAWN_RATE - Math.floor(state.score / 500) * 5); 
        
        if (spawnTimerRef.current >= currentSpawnRate) {
          spawnTimerRef.current = 0;
          
          const roll = Math.random();
          let itemType: ItemType = 'ice';
          if (roll > 0.95) itemType = 'gold';       // 5% 黃金塊
          else if (roll > 0.82) itemType = 'fire';  // 13% 火球

          const x = Math.random() * (CANVAS_WIDTH - 60) + 30;

          if (itemType === 'fire') {
            const radius = 18;
            const fireball = Bodies.circle(x, -50, radius, {
              friction: 0.1, restitution: 0.8, density: 0.05,
              label: `fire-${Date.now()}`
            });
            World.add(engine.world, fireball);
            const id = `fireBody-${Date.now()}-${Math.random()}`;
            (fireball as any).id_string = id;
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
            const id = `iceRect-${Date.now()}-${Math.random()}`;
            (rect as any).id_string = id;
            bodiesRef.current.set(id, { id, itemType, size: Math.max(w, h), color, rotation: rect.angle });
          }
        }

        Engine.update(engine, deltaTime);

        // 檢查掉落出界
        const bodiesToRemove: string[] = [];
        bodiesRef.current.forEach((bodyData, id) => {
          const matterBody = engine.world.bodies.find((b: any) => (b as any).id_string === id);
          if (!matterBody) { bodiesToRemove.push(id); return; }

          bodyData.rotation = matterBody.angle;
          
          if (matterBody.position.y > CANVAS_HEIGHT + 100) {
            bodiesToRemove.push(id);
            World.remove(engine.world, matterBody);

            if (bodyData.itemType === 'ice' || bodyData.itemType === 'gold') {
              // 漏接了能裝的冰塊，扣生命！
              if (state.lives - 1 <= 0) {
                updateUiState({ mode: 'gameOver', highScore: Math.max(state.score, state.highScore) });
              } else {
                updateUiState({ lives: state.lives - 1 });
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
        const matterBody = engine.world.bodies.find((b: any) => (b as any).id_string === bodyData.id);
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

        } else if (bodyData.size) {
          // 冰塊或金塊
          const s = bodyData.size;
          ctx.globalAlpha = 0.9;
          const grad = ctx.createLinearGradient(-s/2, -s/2, s/2, s/2);
          
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
          drawRoundRect(ctx, -s/2, -s/2, s, s, 4);
          ctx.fill();

          ctx.strokeStyle = bodyData.itemType === 'gold' ? '#fffbeb' : 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          drawRoundRect(ctx, -s/2 + 2, -s/2 + 2, s - 4, s - 4, 3);
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
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const state = uiStateRef.current;
        if (state.mode === 'start' || state.mode === 'gameOver') {
          startGame();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const startGame = () => {
    const engine = engineRef.current;
    if (engine) {
      bodiesRef.current.forEach((_, id) => {
        const matterBody = engine.world.bodies.find((b: any) => (b as any).id_string === id);
        if (matterBody) matterRef.current.World.remove(engine.world, matterBody);
      });
      bodiesRef.current.clear();
      particlesRef.current = [];
    }
    spawnTimerRef.current = 0;
    keysPressed.current = {};
    updateUiState({ mode: 'playing', score: 0, lives: 3, message: null });
  };

  return (
    <Container>
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 py-8 px-4 font-sans antialiased text-slate-100 select-none">
        
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 drop-shadow-[0_2px_10px_rgba(34,211,238,0.4)]">
            Ice Bucket Challenge
          </h1>
          <p className="text-cyan-200/80 font-medium tracking-wide">Risk & Reward Catcher</p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500/30 to-blue-600/30 rounded-[1.25rem] blur-lg group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative border border-cyan-400/40 rounded-2xl overflow-hidden bg-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.1)] ring-1 ring-white/10">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block cursor-crosshair transform-gpu"
            />

            {uiState.mode === 'playing' && (
              <div className="absolute top-4 left-5 right-5 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col">
                  <span className="text-cyan-300 font-bold text-xs tracking-widest uppercase drop-shadow-md">Score</span>
                  <span className="text-white font-black text-4xl drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] tabular-nums">
                    {uiState.score}
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

            {uiState.mode === 'start' && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center transition-opacity flex-col border-t border-white/5">
                <div className="p-8 bg-slate-900/80 rounded-3xl border border-cyan-500/20 shadow-2xl backdrop-blur-md text-center transform hover:scale-105 transition-transform duration-300">
                  <div className="w-16 h-16 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    <div className="i-ph-basket-bold text-3xl text-white animate-bounce"></div>
                  </div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Gather & Crush</h2>
                  <p className="text-cyan-200/80 mb-8 max-w-[220px] mx-auto text-sm leading-relaxed">
                    Collect ice, but watch out for <span className="text-red-400 font-bold">Fireballs</span>!<br/> 
                    Crush your bucket for massive combos!
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
                  <span className="text-cyan-300 font-mono text-xs font-bold border border-cyan-900 bg-cyan-900/30 px-2 py-1 rounded tracking-tighter">Mouse</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-semibold text-rose-300">Crush & Score!</span>
                <span className="text-white font-bold bg-rose-600/80 px-3 py-1 rounded border border-rose-500 text-xs shadow-[0_0_10px_rgba(225,29,72,0.4)]">SPACE / Click</span>
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
