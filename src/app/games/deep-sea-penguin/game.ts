import * as PIXI from 'pixi.js';

interface GameState {
  depth: number;
  lives: number;
  fishCount: number;
  isGameOver: boolean;
}

interface GameCallbacks {
  onUpdate: (state: GameState) => void;
}

let app: PIXI.Application | null = null;

// Game Config
const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;
const PENGUIN_RADIUS = 25;
const BASE_SPEED = 3.5;

// Game State variables
let depth = 0;
let lives = 3;
let fishCount = 0;
let isGameOver = false;
let scrollSpeed = BASE_SPEED;

// Entities
let penguin: PIXI.Container;
const obstacles: PIXI.Container[] = [];
const collectibles: PIXI.Container[] = [];
const bubbles: PIXI.Graphics[] = [];
const particles: PIXI.Graphics[] = [];
const backgroundLayers: PIXI.Graphics[] = [];

// Input
let targetX = GAME_WIDTH / 2;
const keys = { left: false, right: false };

export async function initGame(container: HTMLDivElement, callbacks: GameCallbacks) {
  // Reset state
  depth = 0;
  lives = 3;
  fishCount = 0;
  isGameOver = false;
  scrollSpeed = BASE_SPEED;
  obstacles.length = 0;
  collectibles.length = 0;
  bubbles.length = 0;
  particles.length = 0;
  backgroundLayers.length = 0;
  targetX = GAME_WIDTH / 2;

  app = new PIXI.Application();
  await app.init({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x0a192f,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.objectFit = 'contain';
  app.canvas.style.touchAction = 'none';
  
  container.appendChild(app.canvas as HTMLCanvasElement);

  createBackground();
  createPenguin();
  setupInput(app.canvas as HTMLCanvasElement);

  let spawnTimer = 0;
  let bubbleTimer = 0;

  app.ticker.add((ticker) => {
    if (isGameOver || !app) return;

    const delta = ticker.deltaTime;
    
    // Update Depth & Speed
    depth += (scrollSpeed * delta) / 60;
    
    // Speed progression
    if (depth > 2000) scrollSpeed = BASE_SPEED * 2.2;
    else if (depth > 1000) scrollSpeed = BASE_SPEED * 1.8;
    else if (depth > 500) scrollSpeed = BASE_SPEED * 1.4;

    updateBackground();

    // Player Movement
    if (keys.left) targetX -= 8 * delta;
    if (keys.right) targetX += 8 * delta;
    
    targetX = Math.max(PENGUIN_RADIUS + 20, Math.min(GAME_WIDTH - PENGUIN_RADIUS - 20, targetX));
    penguin.x += (targetX - penguin.x) * 0.12 * delta;
    penguin.rotation = (penguin.x - targetX) * -0.015;

    // Penguin Eye blinking
    const eyes = penguin.getChildByName('eyes') as PIXI.Graphics;
    if (eyes) {
      eyes.scale.y = Math.random() > 0.98 ? 0.1 : 1;
    }

    // Spawn entities
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnEntity();
      spawnTimer = Math.max(25, 80 - (depth / 60));
    }

    // Spawn decorative bubbles
    bubbleTimer -= delta;
    if (bubbleTimer <= 0) {
      spawnDecorativeBubble();
      bubbleTimer = 15;
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.y -= (scrollSpeed * 0.85) * delta;
      
      if (obs.label === 'jellyfish') {
         obs.scale.x = 1 + Math.sin(performance.now() / 250) * 0.1;
         obs.scale.y = 1 + Math.cos(performance.now() / 250) * 0.1;
      } else if (obs.label === 'pufferfish') {
        const dist = Math.hypot(penguin.x - obs.x, penguin.y - obs.y);
        if (dist < 180 && obs.scale.x < 1.6) {
          obs.scale.x += 0.08 * delta;
          obs.scale.y += 0.08 * delta;
        }
      }

      // Collision
      if (checkCollision(penguin, obs, PENGUIN_RADIUS * 0.75, obs.width / 2 * 0.8)) {
        handleDamage();
        createExplosion(obs.x, obs.y, 0xff0000);
        app!.stage.removeChild(obs);
        obstacles.splice(i, 1);
        continue;
      }

      if (obs.y < -150) {
        app!.stage.removeChild(obs);
        obstacles.splice(i, 1);
      }
    }

    // Update collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const item = collectibles[i];
      item.y -= scrollSpeed * delta;
      item.rotation = Math.sin(performance.now() / 150) * 0.25;

      if (checkCollision(penguin, item, PENGUIN_RADIUS, item.width / 2)) {
        if (item.label === 'fish') {
          fishCount++;
          createExplosion(item.x, item.y, 0xffcc00);
        }
        app!.stage.removeChild(item);
        collectibles.splice(i, 1);
        continue;
      }

      if (item.y < -150) {
        app!.stage.removeChild(item);
        collectibles.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
       const p = particles[i];
       p.x += (p as any).vx * delta;
       p.y += (p as any).vy * delta;
       p.alpha -= 0.02 * delta;
       p.scale.x *= 0.95;
       p.scale.y *= 0.95;
       
       if (p.alpha <= 0) {
          app!.stage.removeChild(p);
          particles.splice(i, 1);
       }
    }

    // Update decorative bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
       const b = bubbles[i];
       b.y -= (scrollSpeed * 1.4) * delta;
       b.x += Math.sin(b.y / 40) * 1.5;
       b.alpha -= 0.004 * delta;
       
       if (b.y < -50 || b.alpha <= 0) {
          app!.stage.removeChild(b);
          bubbles.splice(i, 1);
       }
    }

    callbacks.onUpdate({
      depth, lives, fishCount, isGameOver
    });
  });

  return () => {
     window.removeEventListener('keydown', handleKeyDown);
     window.removeEventListener('keyup', handleKeyUp);
  };
}

function handleDamage() {
  if (isGameOver) return;
  lives--;
  
  // Shake Screen
  const originalX = app!.stage.x;
  const originalY = app!.stage.y;
  let shakeCount = 0;
  const shake = setInterval(() => {
    app!.stage.x = originalX + (Math.random() - 0.5) * 20;
    app!.stage.y = originalY + (Math.random() - 0.5) * 20;
    shakeCount++;
    if (shakeCount > 10) {
       clearInterval(shake);
       app!.stage.x = originalX;
       app!.stage.y = originalY;
    }
  }, 30);

  // Flash effect
  let flashCount = 0;
  const flashInterval = setInterval(() => {
    if (!penguin) return clearInterval(flashInterval);
    penguin.alpha = penguin.alpha === 1 ? 0.2 : 1;
    flashCount++;
    if (flashCount > 8) {
      penguin.alpha = 1;
      clearInterval(flashInterval);
    }
  }, 80);

  if (lives <= 0) {
    isGameOver = true;
  }
}

function createBackground() {
  if (!app) return;
  const bg = new PIXI.Graphics();
  bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  bg.fill({ color: 0x0ab6ff });
  app.stage.addChild(bg);
  backgroundLayers.push(bg);

  // Add some faint sea details
  for(let i=0; i<15; i++) {
     const detail = new PIXI.Graphics();
     detail.ellipse(0, 0, 50 + Math.random()*100, 10 + Math.random()*20);
     detail.fill({ color: 0xffffff, alpha: 0.05 });
     detail.x = Math.random() * GAME_WIDTH;
     detail.y = Math.random() * GAME_HEIGHT;
     app.stage.addChild(detail);
  }
}

function updateBackground() {
  if (!backgroundLayers[0]) return;
  
  const maxDepthColor = 5000;
  const progress = Math.min(1, depth / maxDepthColor);
  
  // Transition from light blue to deep purple-navy
  const r = Math.floor(10 + (30 - 10) * progress);
  const g = Math.floor(182 - (182 - 20) * progress);
  const b = Math.floor(255 - (255 - 80) * progress);
  
  const color = (r << 16) + (g << 8) + b;
  backgroundLayers[0].clear();
  backgroundLayers[0].rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  backgroundLayers[0].fill({ color });
}

function createPenguin() {
  if (!app) return;
  penguin = new PIXI.Container();
  penguin.x = GAME_WIDTH / 2;
  penguin.y = 180;

  // Shadow/Glow
  const shadow = new PIXI.Graphics();
  shadow.ellipse(0, 40, 30, 10);
  shadow.fill({ color: 0x000000, alpha: 0.2 });
  penguin.addChild(shadow);

  // Body - More rounded and polished
  const body = new PIXI.Graphics();
  body.roundRect(-28, -40, 56, 80, 28);
  body.fill({ color: 0x2c3e50 });
  body.stroke({ color: 0x1a252f, width: 2 });
  penguin.addChild(body);

  // Belly
  const belly = new PIXI.Graphics();
  belly.ellipse(0, 10, 20, 30);
  belly.fill({ color: 0xfafafa });
  penguin.addChild(belly);

  // Eyes (Container for blinking)
  const eyes = new PIXI.Container();
  eyes.name = 'eyes';
  const eyeL = new PIXI.Graphics();
  eyeL.circle(-10, -15, 5);
  eyeL.fill({ color: 0x000000 });
  const shineL = new PIXI.Graphics();
  shineL.circle(-12, -17, 2);
  shineL.fill({ color: 0xffffff });
  eyeL.addChild(shineL);
  
  const eyeR = new PIXI.Graphics();
  eyeR.circle(10, -15, 5);
  eyeR.fill({ color: 0x000000 });
  const shineR = new PIXI.Graphics();
  shineR.circle(8, -17, 2);
  shineR.fill({ color: 0xffffff });
  eyeR.addChild(shineR);
  
  eyes.addChild(eyeL, eyeR);
  penguin.addChild(eyes);

  // Goggles - Better styling
  const goggles = new PIXI.Graphics();
  goggles.roundRect(-24, -22, 48, 18, 6);
  goggles.fill({ color: 0x00d2ff, alpha: 0.5 });
  goggles.stroke({ color: 0xf1c40f, width: 3 });
  penguin.addChild(goggles);

  // Flippers
  const flipperL = new PIXI.Graphics();
  flipperL.roundRect(-8, -20, 16, 40, 8);
  flipperL.fill({ color: 0x2c3e50 });
  flipperL.x = -32; flipperL.y = 10;
  flipperL.rotation = 0.4;
  penguin.addChild(flipperL);

  const flipperR = new PIXI.Graphics();
  flipperR.roundRect(-8, -20, 16, 40, 8);
  flipperR.fill({ color: 0x2c3e50 });
  flipperR.x = 32; flipperR.y = 10;
  flipperR.rotation = -0.4;
  penguin.addChild(flipperR);

  // Beak
  const beak = new PIXI.Graphics();
  beak.moveTo(-10, 0);
  beak.lineTo(10, 0);
  beak.lineTo(0, 12);
  beak.fill({ color: 0xe67e22 });
  beak.y = -5;
  penguin.addChild(beak);

  app.stage.addChild(penguin);
}

function createExplosion(x: number, y: number, color: number) {
  if (!app) return;
  for (let i = 0; i < 8; i++) {
    const p = new PIXI.Graphics();
    p.circle(0, 0, 3 + Math.random() * 4);
    p.fill({ color });
    p.x = x;
    p.y = y;
    (p as any).vx = (Math.random() - 0.5) * 10;
    (p as any).vy = (Math.random() - 0.5) * 10;
    app.stage.addChild(p);
    particles.push(p);
  }
}

function spawnEntity() {
  if (!app) return;
  const isItem = Math.random() < 0.25; 
  const x = 60 + Math.random() * (GAME_WIDTH - 120);
  const y = GAME_HEIGHT + 100; 

  if (isItem) {
    const fish = new PIXI.Container();
    fish.x = x; fish.y = y; fish.label = 'fish';
    
    const body = new PIXI.Graphics();
    body.ellipse(0, 0, 18, 12);
    body.fill({ color: 0xffa502 });
    body.stroke({ color: 0xff7f50, width: 2 });
    
    const eye = new PIXI.Graphics();
    eye.circle(8, -2, 2);
    eye.fill({ color: 0x000000 });
    
    const tail = new PIXI.Graphics();
    tail.moveTo(-12, 0); tail.lineTo(-24, -12); tail.lineTo(-24, 12);
    tail.fill({ color: 0xffa502 });
    
    fish.addChild(tail, body, eye);
    collectibles.push(fish);
    app.stage.addChild(fish);
  } else {
    const rand = Math.random();
    let type = 'jellyfish';
    if (depth > 500 && rand > 0.5) type = 'pufferfish';
    if (depth > 1200 && rand > 0.8) type = 'urchin';

    const obs = new PIXI.Container();
    obs.x = x; obs.y = y; obs.label = type;

    if (type === 'jellyfish') {
      const body = new PIXI.Graphics();
      body.arc(0, 0, 24, Math.PI, 0);
      body.fill({ color: 0xed4c67, alpha: 0.7 });
      body.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
      for(let i=-12; i<=12; i+=8) {
        const tentacle = new PIXI.Graphics();
        tentacle.moveTo(i, 0);
        tentacle.bezierCurveTo(i-5, 10, i+5, 20, i, 30);
        tentacle.stroke({ color: 0xed4c67, width: 3, alpha: 0.5 });
        obs.addChild(tentacle);
      }
      obs.addChild(body);
    } else if (type === 'pufferfish') {
      const body = new PIXI.Graphics();
      body.circle(0, 0, 22);
      body.fill({ color: 0xf1c40f });
      body.stroke({ color: 0xd4ac0d, width: 2 });
      // Spikes
      for(let i=0; i<10; i++) {
        const angle = (i/10) * Math.PI * 2;
        const spike = new PIXI.Graphics();
        spike.moveTo(Math.cos(angle)*18, Math.sin(angle)*18);
        spike.lineTo(Math.cos(angle)*28, Math.sin(angle)*28);
        spike.stroke({ color: 0xf39c12, width: 3 });
        obs.addChild(spike);
      }
      const eye = new PIXI.Graphics();
      eye.circle(10, -5, 4); eye.fill({ color: 0x000000 });
      obs.addChild(body, eye);
    } else if (type === 'urchin') {
      const body = new PIXI.Graphics();
      body.circle(0, 0, 18);
      body.fill({ color: 0x1e272e });
      for(let i=0; i<16; i++) {
        const angle = (i/16) * Math.PI * 2;
        const spike = new PIXI.Graphics();
        spike.moveTo(0,0);
        spike.lineTo(Math.cos(angle)*32, Math.sin(angle)*32);
        spike.stroke({ color: 0x485460, width: 2 });
        obs.addChild(spike);
      }
      obs.addChild(body);
    }

    obstacles.push(obs);
    app.stage.addChild(obs);
  }
}

function spawnDecorativeBubble() {
  if (!app) return;
  const b = new PIXI.Graphics();
  const radius = 3 + Math.random() * 8;
  b.circle(0, 0, radius);
  b.fill({ color: 0xffffff, alpha: 0.2 });
  b.stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
  b.x = Math.random() * GAME_WIDTH;
  b.y = GAME_HEIGHT + 20;
  app.stage.addChildAt(b, 1);
  bubbles.push(b);
}

function checkCollision(obj1: PIXI.Container, obj2: PIXI.Container, r1: number, r2: number) {
  const dx = obj1.x - obj2.x;
  const dy = obj1.y - obj2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (r1 + r2);
}

let isPointerDown = false;
function setupInput(canvas: HTMLCanvasElement) {
  canvas.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    updateTargetX(e, canvas);
  });
  
  canvas.addEventListener('pointermove', (e) => {
    if (isPointerDown) {
      updateTargetX(e, canvas);
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDown = false;
  });

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
}

function updateTargetX(e: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = GAME_WIDTH / rect.width;
  targetX = (e.clientX - rect.left) * scaleX;
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
}

export function destroyGame() {
  if (app && app.renderer) {
    app.destroy({ removeView: true });
    app = null;
  }
}