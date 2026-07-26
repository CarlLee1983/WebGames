import * as PIXI from "pixi.js";
import {
  DAMAGE_COOLDOWN_MS,
  FISH_FEEDBACK_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  PENGUIN_RADIUS,
  circlesCollide,
  clampTargetX,
  getScrollSpeed,
  getSpawnInterval,
  getSpeedLevel,
} from "./utils";

export interface GameSnapshot {
  depth: number;
  lives: number;
  fishCount: number;
  speedLevel: number;
  scrollSpeed: number;
  penguinX: number;
  hazardCount: number;
  fishInView: number;
  damageCooldownMs: number;
  feedback: "none" | "fish" | "damage";
  isGameOver: boolean;
}

interface GameCallbacks {
  onUpdate: (state: GameSnapshot) => void;
}

export interface GameController {
  readonly ready: Promise<void>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  focus: () => void;
  setDirection: (direction: "left" | "right", pressed: boolean) => void;
  nudge: (direction: "left" | "right") => void;
  destroy: () => void;
}

interface MovingParticle extends PIXI.Graphics {
  vx: number;
  vy: number;
}

class DeepSeaGame implements GameController {
  readonly ready: Promise<void>;
  private readonly app = new PIXI.Application();
  private readonly callbacks: GameCallbacks;
  private readonly obstacles: PIXI.Container[] = [];
  private readonly collectibles: PIXI.Container[] = [];
  private readonly bubbles: PIXI.Graphics[] = [];
  private readonly particles: MovingParticle[] = [];
  private readonly keys = { left: false, right: false };
  private background: PIXI.Graphics | null = null;
  private penguin: PIXI.Container | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private inputCleanup: (() => void) | null = null;
  private initialized = false;
  private destroyRequested = false;
  private destroyed = false;
  private running = false;
  private depth = 0;
  private lives = 3;
  private fishCount = 0;
  private isGameOver = false;
  private scrollSpeed = getScrollSpeed(0);
  private targetX = GAME_WIDTH / 2;
  private spawnTimer = 0;
  private bubbleTimer = 0;
  private damageUntil = 0;
  private feedbackUntil = 0;
  private feedback: GameSnapshot["feedback"] = "none";
  private pausedAt: number | null = null;
  private lastUpdateAt = 0;

  constructor(container: HTMLDivElement, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.ready = this.init(container).catch((error: unknown) => {
      this.destroy();
      throw error;
    });
  }

  private async init(container: HTMLDivElement) {
    await this.app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x071a33,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });
    this.initialized = true;

    if (!container.isConnected || this.destroyRequested) {
      this.finalizeDestroy();
      return;
    }

    const canvas = this.app.canvas as HTMLCanvasElement;
    this.canvas = canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "Deep Sea Penguin play area. Drag or use Left and Right arrow keys to steer. Press P to pause.",
    );
    container.appendChild(canvas);

    this.createBackground();
    this.createPenguin();
    this.inputCleanup = this.setupInput(canvas);
    this.app.ticker.add(this.tick);
    this.emitSnapshot(true);
  }

  start = () => {
    if (this.destroyRequested || this.isGameOver) return;
    if (this.pausedAt !== null) {
      const pausedFor = performance.now() - this.pausedAt;
      this.damageUntil += pausedFor;
      this.feedbackUntil += pausedFor;
      this.pausedAt = null;
    }
    this.running = true;
    this.focus();
  };

  pause = () => {
    if (this.running) this.pausedAt = performance.now();
    this.running = false;
    this.keys.left = false;
    this.keys.right = false;
    this.emitSnapshot(true);
  };

  resume = () => {
    this.start();
  };

  focus = () => {
    this.canvas?.focus({ preventScroll: true });
  };

  setDirection = (direction: "left" | "right", pressed: boolean) => {
    this.keys[direction] = pressed;
  };

  nudge = (direction: "left" | "right") => {
    if (!this.running) return;
    this.targetX = clampTargetX(this.targetX + (direction === "left" ? -70 : 70));
    this.focus();
  };

  destroy = () => {
    this.destroyRequested = true;
    this.running = false;
    if (this.initialized) this.finalizeDestroy();
  };

  private finalizeDestroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.inputCleanup?.();
    this.inputCleanup = null;
    this.app.ticker.remove(this.tick);
    if (this.initialized) this.app.destroy({ removeView: true });
    this.canvas = null;
    this.penguin = null;
    this.background = null;
    this.obstacles.length = 0;
    this.collectibles.length = 0;
    this.bubbles.length = 0;
    this.particles.length = 0;
  }

  private readonly tick = (ticker: PIXI.Ticker) => {
    if (this.destroyed || !this.penguin) return;

    const now = this.pausedAt ?? performance.now();
    this.updateDamageFeedback(now);
    if (!this.running || this.isGameOver) return;

    const delta = Math.min(ticker.deltaTime, 2);
    this.scrollSpeed = getScrollSpeed(this.depth);
    this.depth += (this.scrollSpeed * delta) / 60;
    this.updateBackground();
    this.updatePlayer(delta);

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnEntity();
      this.spawnTimer = getSpawnInterval(this.depth);
    }

    this.bubbleTimer -= delta;
    if (this.bubbleTimer <= 0) {
      this.spawnDecorativeBubble();
      this.bubbleTimer = 15;
    }

    this.updateObstacles(delta, now);
    this.updateCollectibles(delta);
    this.updateParticles(delta);
    this.updateBubbles(delta);
    this.emitSnapshot();
  };

  private emitSnapshot(force = false) {
    const now = performance.now();
    if (!force && now - this.lastUpdateAt < 100) return;
    this.lastUpdateAt = now;
    const stateNow = this.pausedAt ?? now;
    this.callbacks.onUpdate({
      depth: this.depth,
      lives: this.lives,
      fishCount: this.fishCount,
      speedLevel: getSpeedLevel(this.depth),
      scrollSpeed: this.scrollSpeed,
      penguinX: this.penguin?.x ?? this.targetX,
      hazardCount: this.obstacles.length,
      fishInView: this.collectibles.length,
      damageCooldownMs: this.isGameOver ? 0 : Math.max(0, this.damageUntil - stateNow),
      feedback: !this.isGameOver && stateNow < this.feedbackUntil ? this.feedback : "none",
      isGameOver: this.isGameOver,
    });
  }

  private updatePlayer(delta: number) {
    if (!this.penguin) return;
    if (this.keys.left) this.targetX -= 8 * delta;
    if (this.keys.right) this.targetX += 8 * delta;
    this.targetX = clampTargetX(this.targetX);
    this.penguin.x += (this.targetX - this.penguin.x) * Math.min(1, 0.12 * delta);
    this.penguin.rotation = (this.penguin.x - this.targetX) * -0.015;

    const eyes = this.penguin.getChildByLabel("eyes") as PIXI.Container | null;
    if (eyes) eyes.scale.y = Math.random() > 0.98 ? 0.1 : 1;
  }

  private updateObstacles(delta: number, now: number) {
    if (!this.penguin) return;

    for (let index = this.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = this.obstacles[index];
      obstacle.y -= this.scrollSpeed * 0.85 * delta;

      if (obstacle.label === "jellyfish") {
        obstacle.scale.x = 1 + Math.sin(now / 250) * 0.1;
        obstacle.scale.y = 1 + Math.cos(now / 250) * 0.1;
      } else if (obstacle.label === "pufferfish") {
        const distance = Math.hypot(this.penguin.x - obstacle.x, this.penguin.y - obstacle.y);
        if (distance < 180 && obstacle.scale.x < 1.6) {
          obstacle.scale.x += 0.08 * delta;
          obstacle.scale.y += 0.08 * delta;
        }
      }

      if (this.collidesWithPenguin(obstacle, obstacle.width * 0.4)) {
        this.handleDamage(now);
        this.createExplosion(obstacle.x, obstacle.y, 0xff365f);
        this.app.stage.removeChild(obstacle);
        this.obstacles.splice(index, 1);
        continue;
      }

      if (obstacle.y < -150) {
        this.app.stage.removeChild(obstacle);
        this.obstacles.splice(index, 1);
      }
    }
  }

  private updateCollectibles(delta: number) {
    for (let index = this.collectibles.length - 1; index >= 0; index -= 1) {
      const item = this.collectibles[index];
      item.y -= this.scrollSpeed * delta;
      item.rotation = Math.sin(performance.now() / 150) * 0.25;

      if (this.collidesWithPenguin(item, item.width / 2)) {
        this.fishCount += 1;
        this.feedback = "fish";
        this.feedbackUntil = performance.now() + FISH_FEEDBACK_MS;
        this.createExplosion(item.x, item.y, 0xffdc55);
        this.app.stage.removeChild(item);
        this.collectibles.splice(index, 1);
        this.emitSnapshot(true);
        continue;
      }

      if (item.y < -150) {
        this.app.stage.removeChild(item);
        this.collectibles.splice(index, 1);
      }
    }
  }

  private updateParticles(delta: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.alpha -= 0.02 * delta;
      const scale = Math.pow(0.95, delta);
      particle.scale.x *= scale;
      particle.scale.y *= scale;

      if (particle.alpha <= 0) {
        this.app.stage.removeChild(particle);
        this.particles.splice(index, 1);
      }
    }
  }

  private updateBubbles(delta: number) {
    for (let index = this.bubbles.length - 1; index >= 0; index -= 1) {
      const bubble = this.bubbles[index];
      bubble.y -= this.scrollSpeed * 1.4 * delta;
      bubble.x += Math.sin(bubble.y / 40) * 1.5;
      bubble.alpha -= 0.004 * delta;

      if (bubble.y < -50 || bubble.alpha <= 0) {
        this.app.stage.removeChild(bubble);
        this.bubbles.splice(index, 1);
      }
    }
  }

  private collidesWithPenguin(entity: PIXI.Container, radius: number) {
    if (!this.penguin) return false;
    return circlesCollide(
      { x: this.penguin.x, y: this.penguin.y, radius: PENGUIN_RADIUS * 0.75 },
      { x: entity.x, y: entity.y, radius },
    );
  }

  private handleDamage(now: number) {
    if (this.isGameOver || now < this.damageUntil) return;
    this.lives -= 1;
    this.damageUntil = now + DAMAGE_COOLDOWN_MS;
    this.feedback = "damage";
    this.feedbackUntil = this.damageUntil;

    if (this.lives <= 0) {
      this.lives = 0;
      this.isGameOver = true;
      this.running = false;
    }
    this.emitSnapshot(true);
  }

  private updateDamageFeedback(now: number) {
    if (!this.penguin) return;
    if (now < this.damageUntil) {
      this.app.stage.x = (Math.random() - 0.5) * 16;
      this.app.stage.y = (Math.random() - 0.5) * 16;
      this.penguin.alpha = Math.floor(now / 90) % 2 === 0 ? 0.25 : 1;
      return;
    }
    this.app.stage.x = 0;
    this.app.stage.y = 0;
    this.penguin.alpha = 1;
  }

  private createBackground() {
    const background = new PIXI.Graphics();
    background.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fill({ color: 0x0ab6ff });
    this.app.stage.addChild(background);
    this.background = background;

    for (let index = 0; index < 15; index += 1) {
      const detail = new PIXI.Graphics();
      detail.ellipse(0, 0, 50 + Math.random() * 100, 10 + Math.random() * 20);
      detail.fill({ color: 0xffffff, alpha: 0.05 });
      detail.x = Math.random() * GAME_WIDTH;
      detail.y = Math.random() * GAME_HEIGHT;
      this.app.stage.addChild(detail);
    }
  }

  private updateBackground() {
    if (!this.background) return;
    const progress = Math.min(1, this.depth / 5_000);
    const red = Math.floor(10 + 20 * progress);
    const green = Math.floor(182 - 162 * progress);
    const blue = Math.floor(255 - 175 * progress);
    const color = (red << 16) + (green << 8) + blue;
    this.background.clear();
    this.background.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.background.fill({ color });
  }

  private createPenguin() {
    const penguin = new PIXI.Container();
    penguin.x = GAME_WIDTH / 2;
    penguin.y = 180;

    const shadow = new PIXI.Graphics();
    shadow.ellipse(0, 40, 30, 10);
    shadow.fill({ color: 0x000000, alpha: 0.2 });
    penguin.addChild(shadow);

    const body = new PIXI.Graphics();
    body.roundRect(-28, -40, 56, 80, 28);
    body.fill({ color: 0x24384c });
    body.stroke({ color: 0x142433, width: 2 });
    penguin.addChild(body);

    const belly = new PIXI.Graphics();
    belly.ellipse(0, 10, 20, 30);
    belly.fill({ color: 0xfafafa });
    penguin.addChild(belly);

    const eyes = new PIXI.Container();
    eyes.label = "eyes";
    const leftEye = new PIXI.Graphics();
    leftEye.circle(-10, -15, 5);
    leftEye.fill({ color: 0x000000 });
    const leftShine = new PIXI.Graphics();
    leftShine.circle(-12, -17, 2);
    leftShine.fill({ color: 0xffffff });
    const rightEye = new PIXI.Graphics();
    rightEye.circle(10, -15, 5);
    rightEye.fill({ color: 0x000000 });
    const rightShine = new PIXI.Graphics();
    rightShine.circle(8, -17, 2);
    rightShine.fill({ color: 0xffffff });
    eyes.addChild(leftEye, leftShine, rightEye, rightShine);
    penguin.addChild(eyes);

    const goggles = new PIXI.Graphics();
    goggles.roundRect(-24, -22, 48, 18, 6);
    goggles.fill({ color: 0x00d2ff, alpha: 0.5 });
    goggles.stroke({ color: 0xf1c40f, width: 3 });
    penguin.addChild(goggles);

    const leftFlipper = new PIXI.Graphics();
    leftFlipper.roundRect(-8, -20, 16, 40, 8);
    leftFlipper.fill({ color: 0x24384c });
    leftFlipper.x = -32;
    leftFlipper.y = 10;
    leftFlipper.rotation = 0.4;
    penguin.addChild(leftFlipper);

    const rightFlipper = new PIXI.Graphics();
    rightFlipper.roundRect(-8, -20, 16, 40, 8);
    rightFlipper.fill({ color: 0x24384c });
    rightFlipper.x = 32;
    rightFlipper.y = 10;
    rightFlipper.rotation = -0.4;
    penguin.addChild(rightFlipper);

    const beak = new PIXI.Graphics();
    beak.moveTo(-10, 0);
    beak.lineTo(10, 0);
    beak.lineTo(0, 12);
    beak.fill({ color: 0xe67e22 });
    beak.y = -5;
    penguin.addChild(beak);

    this.penguin = penguin;
    this.app.stage.addChild(penguin);
  }

  private createExplosion(x: number, y: number, color: number) {
    for (let index = 0; index < 8; index += 1) {
      const particle = new PIXI.Graphics() as MovingParticle;
      particle.circle(0, 0, 3 + Math.random() * 4);
      particle.fill({ color });
      particle.x = x;
      particle.y = y;
      particle.vx = (Math.random() - 0.5) * 10;
      particle.vy = (Math.random() - 0.5) * 10;
      this.app.stage.addChild(particle);
      this.particles.push(particle);
    }
  }

  private spawnEntity() {
    const x = 60 + Math.random() * (GAME_WIDTH - 120);
    const y = GAME_HEIGHT + 100;

    if (Math.random() < 0.25) {
      const fish = new PIXI.Container();
      fish.x = x;
      fish.y = y;
      fish.label = "fish";

      const body = new PIXI.Graphics();
      body.ellipse(0, 0, 18, 12);
      body.fill({ color: 0xffa502 });
      body.stroke({ color: 0xff7f50, width: 2 });
      const eye = new PIXI.Graphics();
      eye.circle(8, -2, 2);
      eye.fill({ color: 0x000000 });
      const tail = new PIXI.Graphics();
      tail.moveTo(-12, 0);
      tail.lineTo(-24, -12);
      tail.lineTo(-24, 12);
      tail.fill({ color: 0xffa502 });
      fish.addChild(tail, body, eye);
      this.collectibles.push(fish);
      this.app.stage.addChild(fish);
      return;
    }

    const roll = Math.random();
    let type = "jellyfish";
    if (this.depth > 500 && roll > 0.5) type = "pufferfish";
    if (this.depth > 1_200 && roll > 0.8) type = "urchin";

    const obstacle = new PIXI.Container();
    obstacle.x = x;
    obstacle.y = y;
    obstacle.label = type;

    if (type === "jellyfish") this.drawJellyfish(obstacle);
    else if (type === "pufferfish") this.drawPufferfish(obstacle);
    else this.drawUrchin(obstacle);

    this.obstacles.push(obstacle);
    this.app.stage.addChild(obstacle);
  }

  private drawJellyfish(obstacle: PIXI.Container) {
    const body = new PIXI.Graphics();
    body.arc(0, 0, 24, Math.PI, 0);
    body.fill({ color: 0xed4c67, alpha: 0.75 });
    body.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
    for (let offset = -12; offset <= 12; offset += 8) {
      const tentacle = new PIXI.Graphics();
      tentacle.moveTo(offset, 0);
      tentacle.bezierCurveTo(offset - 5, 10, offset + 5, 20, offset, 30);
      tentacle.stroke({ color: 0xed4c67, width: 3, alpha: 0.6 });
      obstacle.addChild(tentacle);
    }
    obstacle.addChild(body);
  }

  private drawPufferfish(obstacle: PIXI.Container) {
    const body = new PIXI.Graphics();
    body.circle(0, 0, 22);
    body.fill({ color: 0xf1c40f });
    body.stroke({ color: 0xd4ac0d, width: 2 });
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      const spike = new PIXI.Graphics();
      spike.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
      spike.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
      spike.stroke({ color: 0xf39c12, width: 3 });
      obstacle.addChild(spike);
    }
    const eye = new PIXI.Graphics();
    eye.circle(10, -5, 4);
    eye.fill({ color: 0x000000 });
    obstacle.addChild(body, eye);
  }

  private drawUrchin(obstacle: PIXI.Container) {
    const body = new PIXI.Graphics();
    body.circle(0, 0, 18);
    body.fill({ color: 0x1e272e });
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      const spike = new PIXI.Graphics();
      spike.moveTo(0, 0);
      spike.lineTo(Math.cos(angle) * 32, Math.sin(angle) * 32);
      spike.stroke({ color: 0x657787, width: 2 });
      obstacle.addChild(spike);
    }
    obstacle.addChild(body);
  }

  private spawnDecorativeBubble() {
    const bubble = new PIXI.Graphics();
    const radius = 3 + Math.random() * 8;
    bubble.circle(0, 0, radius);
    bubble.fill({ color: 0xffffff, alpha: 0.2 });
    bubble.stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
    bubble.x = Math.random() * GAME_WIDTH;
    bubble.y = GAME_HEIGHT + 20;
    this.app.stage.addChildAt(bubble, 1);
    this.bubbles.push(bubble);
  }

  private setupInput(canvas: HTMLCanvasElement) {
    let pointerDown = false;
    const updateTarget = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      this.targetX = clampTargetX((event.clientX - rect.left) * (GAME_WIDTH / rect.width));
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerDown = true;
      canvas.focus({ preventScroll: true });
      updateTarget(event);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (pointerDown) updateTarget(event);
    };
    const handlePointerUp = () => {
      pointerDown = false;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        this.keys.left = true;
      }
      if (key === "arrowright" || key === "d") {
        event.preventDefault();
        this.keys.right = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") this.keys.left = false;
      if (key === "arrowright" || key === "d") this.keys.right = false;
    };
    const handleBlur = () => {
      this.keys.left = false;
      this.keys.right = false;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("blur", handleBlur);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("blur", handleBlur);
    };
  }
}

export function initGame(
  container: HTMLDivElement,
  callbacks: GameCallbacks,
): GameController {
  return new DeepSeaGame(container, callbacks);
}
