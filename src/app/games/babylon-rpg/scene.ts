import type {
  ArcRotateCamera,
  Engine,
  Mesh,
  Scene,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';
import { getQuestTarget, type GameState } from './utils';

export type BabylonModule = typeof import('./runtime');

export interface ChapterScene {
  scene: Scene;
  camera: ArcRotateCamera;
  player: TransformNode;
  playerBody: Mesh;
  sword: Mesh;
  enemyMeshes: Map<string, Mesh>;
  enemyMaterials: Map<string, StandardMaterial>;
  enemyHealthBars: Map<string, Mesh>;
  chestMeshes: Map<string, TransformNode>;
  gateMeshes: Map<string, TransformNode>;
  platformMeshes: Map<string, Mesh>;
  objectiveMarker: Mesh;
}

export function createChapterScene(
  B: BabylonModule,
  engine: Engine,
  canvas: HTMLCanvasElement,
  state: GameState
): ChapterScene {
  const scene = new B.Scene(engine);
  const palette = getPalette(state.mode);
  scene.clearColor = B.Color4.FromHexString(palette.sky);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = state.mode === 'battle' ? 0.018 : 0.012;
  scene.fogColor = B.Color3.FromHexString(palette.fog);

  const camera = new B.ArcRotateCamera(
    'quest-camera',
    -Math.PI / 2,
    0.82,
    25,
    new B.Vector3(state.player.x, 1, state.player.z),
    scene
  );
  camera.lowerRadiusLimit = 16;
  camera.upperRadiusLimit = 32;
  camera.lowerBetaLimit = 0.55;
  camera.upperBetaLimit = 1.05;
  camera.wheelPrecision = 28;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

  const ambient = new B.HemisphericLight('ambient', new B.Vector3(0.2, 1, 0.1), scene);
  ambient.intensity = state.mode === 'treasure' ? 0.68 : 0.82;
  ambient.groundColor = B.Color3.FromHexString(palette.shadow);
  const sun = new B.DirectionalLight('sun', new B.Vector3(-0.45, -1, 0.35), scene);
  sun.position = new B.Vector3(14, 24, -12);
  sun.intensity = 1.25;
  const shadows = new B.ShadowGenerator(1024, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  shadows.setDarkness(0.35);

  const ground = B.MeshBuilder.CreateGround('ground', { width: 32, height: 32, subdivisions: 4 }, scene);
  const groundMaterial = makeMaterial(B, scene, 'ground-material', palette.ground, palette.groundGlow);
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  createBoundary(B, scene, state.mode, palette, shadows);
  createLandmarks(B, scene, state.mode, palette, shadows);

  state.trapZones.forEach((trap) => {
    const width = trap.max.x - trap.min.x;
    const depth = trap.max.z - trap.min.z;
    const trapMesh = B.MeshBuilder.CreateBox(`trap-${trap.id}`, { width, depth, height: 0.08 }, scene);
    trapMesh.position.set((trap.min.x + trap.max.x) / 2, 0.04, (trap.min.z + trap.max.z) / 2);
    trapMesh.material = makeMaterial(B, scene, `trap-material-${trap.id}`, '#7f1d1d', '#ef4444');
  });

  const player = new B.TransformNode('player-root', scene);
  const playerBody = B.MeshBuilder.CreateCapsule('player-body', { height: 1.7, radius: 0.46 }, scene);
  playerBody.parent = player;
  playerBody.position.y = 0.9;
  playerBody.material = makeMaterial(B, scene, 'player-material', '#f8fafc', '#38bdf8');
  shadows.addShadowCaster(playerBody);
  const cloak = B.MeshBuilder.CreateCylinder('player-cloak', { height: 1.1, diameterTop: 0.35, diameterBottom: 1.05, tessellation: 16 }, scene);
  cloak.parent = player;
  cloak.position.set(0, 0.83, 0.24);
  cloak.material = makeMaterial(B, scene, 'cloak-material', '#0e7490', '#164e63');
  shadows.addShadowCaster(cloak);
  const sword = B.MeshBuilder.CreateBox('player-sword', { width: 0.12, height: 1.35, depth: 0.12 }, scene);
  sword.parent = player;
  sword.position.set(0.72, 0.8, 0.1);
  sword.rotation.z = -0.35;
  sword.material = makeMaterial(B, scene, 'sword-material', '#e2e8f0', '#67e8f9');
  shadows.addShadowCaster(sword);

  const enemyMeshes = new Map<string, Mesh>();
  const enemyMaterials = new Map<string, StandardMaterial>();
  const enemyHealthBars = new Map<string, Mesh>();
  state.enemies.forEach((enemy, index) => {
    const mesh = B.MeshBuilder.CreateSphere(`enemy-${enemy.id}`, { diameter: 1.35, segments: 20 }, scene);
    mesh.scaling.y = 0.72;
    mesh.position.set(enemy.x, 0.72, enemy.z);
    const color = index % 2 === 0 ? '#ef4444' : '#f97316';
    const material = makeMaterial(B, scene, `enemy-material-${enemy.id}`, color, '#7f1d1d');
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    const eye = B.MeshBuilder.CreateSphere(`enemy-eye-${enemy.id}`, { diameter: 0.22, segments: 8 }, scene);
    eye.parent = mesh;
    eye.position.set(0, 0.18, -0.58);
    eye.scaling.x = 1.6;
    eye.material = makeMaterial(B, scene, `enemy-eye-material-${enemy.id}`, '#f8fafc', '#f8fafc');
    const healthRoot = new B.TransformNode(`enemy-health-${enemy.id}`, scene);
    healthRoot.parent = mesh;
    healthRoot.position.set(0, 1.35, 0);
    healthRoot.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    const healthBack = B.MeshBuilder.CreatePlane(`enemy-health-back-${enemy.id}`, { width: 1.12, height: 0.16 }, scene);
    healthBack.parent = healthRoot;
    healthBack.material = makeMaterial(B, scene, `enemy-health-back-material-${enemy.id}`, '#0f172a', '#0f172a');
    const healthFill = B.MeshBuilder.CreatePlane(`enemy-health-fill-${enemy.id}`, { width: 1, height: 0.09 }, scene);
    healthFill.parent = healthRoot;
    healthFill.position.z = -0.01;
    healthFill.material = makeMaterial(B, scene, `enemy-health-fill-material-${enemy.id}`, '#fb7185', '#ef4444');
    enemyMeshes.set(enemy.id, mesh);
    enemyMaterials.set(enemy.id, material);
    enemyHealthBars.set(enemy.id, healthFill);
  });

  const chestMeshes = new Map<string, TransformNode>();
  state.chests.forEach((chest) => {
    const root = new B.TransformNode(`chest-${chest.id}`, scene);
    root.position.set(chest.x, 0, chest.z);
    const base = B.MeshBuilder.CreateBox(`chest-base-${chest.id}`, { width: 1.4, height: 0.72, depth: 0.92 }, scene);
    base.parent = root;
    base.position.y = 0.38;
    base.material = makeMaterial(B, scene, `chest-base-material-${chest.id}`, '#92400e', '#f59e0b');
    const lid = B.MeshBuilder.CreateCylinder(`chest-lid-${chest.id}`, { height: 1.4, diameter: 0.94, tessellation: 16, arc: 0.5 }, scene);
    lid.parent = root;
    lid.rotation.z = Math.PI / 2;
    lid.position.y = 0.72;
    lid.material = makeMaterial(B, scene, `chest-lid-material-${chest.id}`, '#b45309', '#fbbf24');
    shadows.addShadowCaster(base);
    shadows.addShadowCaster(lid);
    chestMeshes.set(chest.id, root);
  });

  const gateMeshes = new Map<string, TransformNode>();
  state.gates.forEach((gate) => {
    const root = new B.TransformNode(`gate-${gate.id}`, scene);
    root.position.set(gate.x, 0, gate.z);
    const material = makeMaterial(B, scene, `gate-material-${gate.id}`, '#155e75', '#22d3ee');
    const left = B.MeshBuilder.CreateBox(`gate-left-${gate.id}`, { width: 0.62, height: 4.2, depth: 0.8 }, scene);
    left.parent = root;
    left.position.set(-1.6, 2.1, 0);
    left.material = material;
    const right = left.clone(`gate-right-${gate.id}`)!;
    right.parent = root;
    right.position.x = 1.6;
    const lintel = B.MeshBuilder.CreateBox(`gate-lintel-${gate.id}`, { width: 3.8, height: 0.62, depth: 0.8 }, scene);
    lintel.parent = root;
    lintel.position.y = 4;
    lintel.material = material;
    const door = B.MeshBuilder.CreateBox(`gate-door-${gate.id}`, { width: 2.55, height: 3.55, depth: 0.42 }, scene);
    door.parent = root;
    door.position.y = 1.78;
    door.material = makeMaterial(B, scene, `gate-door-material-${gate.id}`, '#0f172a', '#0891b2');
    shadows.addShadowCaster(left);
    shadows.addShadowCaster(right);
    shadows.addShadowCaster(lintel);
    shadows.addShadowCaster(door);
    gateMeshes.set(gate.id, root);
  });

  const platformMeshes = new Map<string, Mesh>();
  state.platforms.forEach((platform) => {
    const mesh = B.MeshBuilder.CreateBox(`platform-${platform.id}`, { width: 3.2, height: 0.45, depth: 3.2 }, scene);
    mesh.position.set(platform.x, platform.y - 0.2, platform.z);
    mesh.material = makeMaterial(B, scene, `platform-material-${platform.id}`, '#ca8a04', '#fde047');
    shadows.addShadowCaster(mesh);
    platformMeshes.set(platform.id, mesh);
  });

  const objectiveMarker = B.MeshBuilder.CreateTorus('objective-marker', { diameter: 2.15, thickness: 0.12, tessellation: 40 }, scene);
  objectiveMarker.rotation.x = Math.PI / 2;
  objectiveMarker.position.y = 0.12;
  objectiveMarker.material = makeMaterial(B, scene, 'objective-marker-material', '#22d3ee', '#67e8f9');

  const glow = new B.GlowLayer('quest-glow', scene, { blurKernelSize: 32 });
  glow.intensity = 0.45;

  return {
    scene,
    camera,
    player,
    playerBody,
    sword,
    enemyMeshes,
    enemyMaterials,
    enemyHealthBars,
    chestMeshes,
    gateMeshes,
    platformMeshes,
    objectiveMarker,
  };
}

export function syncChapterScene(B: BabylonModule, runtime: ChapterScene, state: GameState) {
  runtime.player.position.set(state.player.x, 0, state.player.z);
  runtime.player.rotation.y = state.player.yaw;
  runtime.playerBody.scaling.y = state.player.invulnerableMs > 0 && Math.floor(state.player.invulnerableMs / 80) % 2 === 0 ? 0.78 : 1;
  const attackProgress = state.player.attackCooldownMs > 0 ? state.player.attackCooldownMs / 420 : 0;
  runtime.sword.rotation.z = -0.35 - Math.sin((1 - attackProgress) * Math.PI) * 1.75;

  const target = new B.Vector3(state.player.x, 1, state.player.z);
  runtime.camera.target = B.Vector3.Lerp(runtime.camera.target, target, 0.08);

  state.enemies.forEach((enemy) => {
    const mesh = runtime.enemyMeshes.get(enemy.id);
    const material = runtime.enemyMaterials.get(enemy.id);
    const healthBar = runtime.enemyHealthBars.get(enemy.id);
    if (!mesh || !material) return;
    mesh.setEnabled(enemy.alive);
    mesh.position.set(enemy.x, 0.72 + Math.sin(state.elapsedMs * 0.005 + enemy.x) * 0.08, enemy.z);
    material.emissiveColor = enemy.hitFlashMs > 0
      ? B.Color3.FromHexString('#ffffff')
      : B.Color3.FromHexString('#7f1d1d');
    if (healthBar) {
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      healthBar.scaling.x = ratio;
      healthBar.position.x = -(1 - ratio) * 0.5;
    }
  });

  state.chests.forEach((chest) => {
    runtime.chestMeshes.get(chest.id)?.setEnabled(!chest.collected);
  });
  state.gates.forEach((gate) => {
    const mesh = runtime.gateMeshes.get(gate.id);
    if (mesh) mesh.position.y = gate.progress * 4.1;
  });
  state.platforms.forEach((platform) => {
    runtime.platformMeshes.get(platform.id)?.position.set(platform.x, platform.y - 0.2, platform.z);
  });

  const objective = getQuestTarget(state);
  runtime.objectiveMarker.setEnabled(Boolean(objective) && state.phase !== 'complete');
  if (objective) {
    runtime.objectiveMarker.position.x = objective.x;
    runtime.objectiveMarker.position.z = objective.z;
    runtime.objectiveMarker.rotation.z = state.elapsedMs * 0.0012;
    runtime.objectiveMarker.scaling.setAll(1 + Math.sin(state.elapsedMs * 0.004) * 0.08);
  }
}

function createBoundary(
  B: BabylonModule,
  scene: Scene,
  mode: GameState['mode'],
  palette: ReturnType<typeof getPalette>,
  shadows: import('@babylonjs/core').ShadowGenerator
) {
  const positions = [
    [-14, -14], [-10, -14], [-6, -14], [6, -14], [10, -14], [14, -14],
    [-14, 14], [-10, 14], [-6, 14], [6, 14], [10, 14], [14, 14],
    [-14, -10], [-14, -5], [-14, 5], [-14, 10], [14, -10], [14, -5], [14, 5], [14, 10],
  ];
  const trunkMaterial = makeMaterial(B, scene, 'boundary-trunk-material', palette.trunk, palette.trunk);
  const crownMaterial = makeMaterial(B, scene, 'boundary-crown-material', palette.crown, palette.crownGlow);
  positions.forEach(([x, z], index) => {
    const trunk = B.MeshBuilder.CreateCylinder(`boundary-trunk-${index}`, {
      height: mode === 'terrain' ? 2.4 : 3.4,
      diameterTop: 0.55,
      diameterBottom: 0.9,
      tessellation: mode === 'treasure' ? 6 : 10,
    }, scene);
    trunk.position.set(x, 1.7, z);
    trunk.material = trunkMaterial;
    const crown = mode === 'treasure'
      ? B.MeshBuilder.CreateBox(`boundary-crown-${index}`, { size: 1.8 }, scene)
      : B.MeshBuilder.CreateSphere(`boundary-crown-${index}`, { diameter: mode === 'terrain' ? 1.9 : 2.8, segments: 10 }, scene);
    crown.position.set(x, mode === 'terrain' ? 2.8 : 4.1, z);
    crown.material = crownMaterial;
    shadows.addShadowCaster(trunk);
    shadows.addShadowCaster(crown);
  });
}

function createLandmarks(
  B: BabylonModule,
  scene: Scene,
  mode: GameState['mode'],
  palette: ReturnType<typeof getPalette>,
  shadows: import('@babylonjs/core').ShadowGenerator
) {
  const points = mode === 'battle'
    ? [[-9, -7], [8, -5], [-10, 9], [9, 9]]
    : mode === 'treasure'
      ? [[-8, -7], [8, -7], [-8, 7], [8, 7]]
      : [[-8, -4], [2, -8], [8, 3], [-9, 8]];
  points.forEach(([x, z], index) => {
    const mesh = mode === 'battle'
      ? B.MeshBuilder.CreateCylinder(`landmark-${index}`, { height: 1.3, diameterTop: 1.1, diameterBottom: 1.6, tessellation: 7 }, scene)
      : B.MeshBuilder.CreateBox(`landmark-${index}`, { width: 1.4, height: 2.8, depth: 1.4 }, scene);
    mesh.position.set(x, mode === 'battle' ? 0.65 : 1.4, z);
    mesh.rotation.y = index * 0.7;
    mesh.material = makeMaterial(B, scene, `landmark-material-${index}`, palette.landmark, palette.landmarkGlow);
    shadows.addShadowCaster(mesh);
  });
}

function makeMaterial(
  B: BabylonModule,
  scene: Scene,
  name: string,
  diffuse: string,
  emissive: string
): StandardMaterial {
  const material = new B.StandardMaterial(name, scene);
  material.diffuseColor = B.Color3.FromHexString(diffuse);
  material.emissiveColor = B.Color3.FromHexString(emissive).scale(0.22);
  material.specularColor = B.Color3.FromHexString('#64748b').scale(0.28);
  return material;
}

function getPalette(mode: GameState['mode']) {
  if (mode === 'treasure') {
    return {
      sky: '#160f2aff', fog: '#211633', shadow: '#1e1b4b', ground: '#382b22', groundGlow: '#78350f',
      trunk: '#4c1d95', crown: '#7e22ce', crownGlow: '#a855f7', landmark: '#a16207', landmarkGlow: '#f59e0b',
    };
  }
  if (mode === 'terrain') {
    return {
      sky: '#071c34ff', fog: '#0c2742', shadow: '#082f49', ground: '#1e3a5f', groundGlow: '#0ea5e9',
      trunk: '#334155', crown: '#38bdf8', crownGlow: '#67e8f9', landmark: '#475569', landmarkGlow: '#38bdf8',
    };
  }
  return {
    sky: '#061b16ff', fog: '#0c2c24', shadow: '#052e16', ground: '#173c2d', groundGlow: '#166534',
    trunk: '#6b4423', crown: '#15803d', crownGlow: '#22c55e', landmark: '#475569', landmarkGlow: '#16a34a',
  };
}
