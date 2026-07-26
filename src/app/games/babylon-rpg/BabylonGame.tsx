'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createChapterScene, syncChapterScene, type BabylonModule, type ChapterScene } from './scene';
import {
  createGameState,
  createSave,
  getCombatStatus,
  getNearbyPrompt,
  getObjective,
  getQuestTarget,
  objectiveIsComplete,
  parseGameSave,
  performAttack,
  performInteraction,
  renderGameToText,
  tickGame,
  togglePause,
  type GameInput,
  type GameSave,
  type GameState,
  type LevelData,
} from './utils';
import type { Engine } from '@babylonjs/core/Engines/engine';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void | Promise<void>;
  }
}

interface Manifest {
  startLevelId: string;
  levels: { id: string; path: string }[];
}

interface LoaderApi {
  mountLevel: (level: LevelData, save: GameSave | null, event: string) => Promise<void>;
  advanceChapter: () => Promise<void>;
  restartChapter: () => Promise<void>;
  resetRun: () => Promise<void>;
  loadSaveSlot: () => Promise<void>;
}

const EMPTY_INPUT: GameInput = { up: false, down: false, left: false, right: false };
const TARGET_KIND_LABELS = {
  guardian: 'Guardian',
  cache: 'Relic cache',
  gate: 'Realm gate',
} as const;
const THREAT_TONES = {
  clear: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  tracking: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  engaged: 'border-orange-300/30 bg-orange-400/10 text-orange-200',
  danger: 'border-rose-300/35 bg-rose-400/15 text-rose-200',
} as const;

export default function BabylonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const babylonRef = useRef<BabylonModule | null>(null);
  const sceneRef = useRef<ChapterScene | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const inputRef = useRef<GameInput>({ ...EMPTY_INPUT });
  const loaderRef = useRef<LoaderApi | null>(null);
  const [uiState, setUiState] = useState<GameState | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('Summoning the 3D realm…');
  const [toast, setToast] = useState('Move toward the cyan quest marker.');
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveAvailable, setSaveAvailable] = useState(false);

  const commitState = useCallback((next: GameState) => {
    stateRef.current = next;
    setUiState(next);
    const B = babylonRef.current;
    const runtime = sceneRef.current;
    if (B && runtime) syncChapterScene(B, runtime, next);
  }, []);

  const saveProgress = useCallback(async (message = 'Progress saved') => {
    const state = stateRef.current;
    if (!state) return;
    await writeSave(createSave(state));
    setSaveAvailable(true);
    setToast(message);
  }, []);

  const attack = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const next = performAttack(current);
    if (next === current) return;
    commitState(next);
    setToast(next.lastEvent);
    if (next.enemies.filter((enemy) => enemy.alive).length < current.enemies.filter((enemy) => enemy.alive).length) {
      void writeSave(createSave(next));
    }
  }, [commitState]);

  const interact = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const result = performInteraction(current);
    commitState(result.state);
    setToast(result.state.lastEvent);
    if (result.state !== current) void writeSave(createSave(result.state));
    if (result.transitionRequested) void loaderRef.current?.advanceChapter();
  }, [commitState]);

  const pause = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    inputRef.current = { ...EMPTY_INPUT };
    const next = togglePause(current);
    commitState(next);
    setToast(next.phase === 'paused' ? 'Expedition paused' : 'Expedition resumed');
  }, [commitState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let uiAccumulator = 0;
    let autosaveAccumulator = 0;
    let lastEventId = 0;

    const boot = async () => {
      const basePath = window.location.pathname.startsWith('/WebGames/') ? '/WebGames' : '';
      const runtimeUrl = `${basePath}/games/babylon-rpg/runtime.js`;
      const B = await import(
        /* webpackIgnore: true */
        /* turbopackIgnore: true */
        runtimeUrl
      ) as BabylonModule;
      if (cancelled) return;
      babylonRef.current = B;
      const engine = new B.Engine(canvas, true, {
        preserveDrawingBuffer: false,
        stencil: true,
        powerPreference: 'high-performance',
      }, true);
      engineRef.current = engine;
      engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

      const fetchManifest = async () => {
        if (manifestRef.current) return manifestRef.current;
        const response = await fetch(`${basePath}/games/babylon-rpg/levels/manifest.json`);
        if (!response.ok) throw new Error('Chapter manifest could not be loaded.');
        const manifest = await response.json() as Manifest;
        manifestRef.current = manifest;
        return manifest;
      };
      const fetchLevel = async (levelId: string) => {
        const manifest = await fetchManifest();
        const entry = manifest.levels.find((candidate) => candidate.id === levelId) ?? manifest.levels[0];
        const response = await fetch(`${basePath}/games/babylon-rpg/levels/${entry.path}`);
        if (!response.ok) throw new Error(`Chapter ${entry.id} could not be loaded.`);
        return response.json() as Promise<LevelData>;
      };

      const mountLevel = async (level: LevelData, save: GameSave | null, event: string) => {
        const next = createGameState(level, save);
        next.lastEvent = event;
        next.eventId += 1;
        sceneRef.current?.scene.dispose();
        sceneRef.current = createChapterScene(B, engine, canvas, next);
        syncChapterScene(B, sceneRef.current, next);
        stateRef.current = next;
        setUiState(next);
        setLoadingLabel('');
        setToast(event);
      };

      const advanceChapter = async () => {
        const current = stateRef.current;
        const manifest = await fetchManifest();
        if (!current || !objectiveIsComplete(current)) {
          setToast('The chapter objective is not complete yet.');
          return;
        }
        const index = manifest.levels.findIndex((entry) => entry.id === current.levelId);
        if (index < 0 || index === manifest.levels.length - 1) {
          const complete = { ...current, phase: 'complete' as const, lastEvent: 'All relics recovered — quest complete!', eventId: current.eventId + 1 };
          commitState(complete);
          await writeSave(createSave(complete));
          setToast(complete.lastEvent);
          return;
        }
        setLoadingLabel('Opening the next realm…');
        const level = await fetchLevel(manifest.levels[index + 1].id);
        const save = createSave(current);
        save.levelId = level.id;
        save.playerPosition = spawnPosition(level);
        save.playerStats.hp = Math.min(save.playerStats.maxHp, save.playerStats.hp + 2);
        await mountLevel(level, save, `Chapter ${level.chapter}: ${level.title}`);
        await writeSave(save);
      };

      const restartChapter = async () => {
        const current = stateRef.current;
        if (!current) return;
        setLoadingLabel('Reforming at the chapter entrance…');
        const level = await fetchLevel(current.levelId);
        const save = createSave(current);
        save.playerPosition = spawnPosition(level);
        save.playerStats.hp = save.playerStats.maxHp;
        save.unlockedGates = save.unlockedGates.filter((gate) => !current.gates.some((entry) => entry.id === gate));
        delete save.collectedItemsByLevel[current.levelId];
        delete save.defeatedEnemiesByLevel[current.levelId];
        await mountLevel(level, save, 'Chapter restarted');
        await writeSave(save);
      };

      const resetRun = async () => {
        setLoadingLabel('Beginning a new expedition…');
        await clearStoredSave();
        const manifest = await fetchManifest();
        const level = await fetchLevel(manifest.startLevelId);
        await mountLevel(level, null, 'New expedition started');
        setSaveAvailable(false);
      };

      const loadSaveSlot = async () => {
        const save = await readSave();
        if (!save) {
          setToast('No valid expedition save was found.');
          setSaveAvailable(false);
          return;
        }
        setLoadingLabel('Restoring the saved realm…');
        const level = await fetchLevel(save.levelId);
        await mountLevel(level, save, 'Saved expedition restored');
        setSaveAvailable(true);
      };

      loaderRef.current = { mountLevel, advanceChapter, restartChapter, resetRun, loadSaveSlot };
      const manifest = await fetchManifest();
      const save = await readSave();
      const validLevel = save && manifest.levels.some((entry) => entry.id === save.levelId) ? save.levelId : manifest.startLevelId;
      const level = await fetchLevel(validLevel);
      await mountLevel(level, save, save ? 'Saved expedition restored' : 'New expedition started');
      setSaveAvailable(Boolean(save));

      engine.runRenderLoop(() => {
        const current = stateRef.current;
        const runtime = sceneRef.current;
        if (!current || !runtime) return;
        const deltaMs = Math.min(engine.getDeltaTime(), 50);
        const next = tickGame(current, inputRef.current, deltaMs);
        stateRef.current = next;
        syncChapterScene(B, runtime, next);
        runtime.scene.render();
        uiAccumulator += deltaMs;
        autosaveAccumulator += deltaMs;
        if (uiAccumulator >= 100) {
          setUiState(next);
          uiAccumulator = 0;
        }
        if (next.eventId !== lastEventId) {
          lastEventId = next.eventId;
          setToast(next.lastEvent);
        }
        if (autosaveAccumulator >= 5000 && next.phase === 'playing') {
          autosaveAccumulator = 0;
          void writeSave(createSave(next));
          setSaveAvailable(true);
        }
      });

      const resize = () => {
        engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
        engine.resize();
      };
      window.addEventListener('resize', resize);
      engine.onDisposeObservable.addOnce(() => window.removeEventListener('resize', resize));
    };

    window.requestAnimationFrame(() => {
      void boot().catch((error) => {
        if (cancelled) return;
        setLoadingLabel('The 3D realm failed to load.');
        setToast(error instanceof Error ? error.message : String(error));
      });
    });

    return () => {
      cancelled = true;
      loaderRef.current = null;
      sceneRef.current?.scene.dispose();
      sceneRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
      babylonRef.current = null;
    };
  }, [commitState]);

  useEffect(() => {
    const movementKeys: Record<string, keyof GameInput> = {
      w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
      a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
    };
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('button, input, textarea, select')) return;
      const key = event.key.toLowerCase();
      const direction = movementKeys[key];
      if (direction) {
        event.preventDefault();
        inputRef.current[direction] = true;
      }
      if ((key === ' ' || key === 'enter') && !event.repeat) {
        event.preventDefault();
        attack();
      }
      if (key === 'e' && !event.repeat) interact();
      if (key === 'p' && !event.repeat) pause();
    };
    const keyUp = (event: KeyboardEvent) => {
      const direction = movementKeys[event.key.toLowerCase()];
      if (direction) inputRef.current[direction] = false;
    };
    const clearInput = () => { inputRef.current = { ...EMPTY_INPUT }; };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clearInput);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clearInput);
    };
  }, [attack, interact, pause]);

  useEffect(() => {
    window.render_game_to_text = () => stateRef.current ? renderGameToText(stateRef.current) : JSON.stringify({ phase: 'loading' });
    window.advanceTime = (ms: number) => {
      const current = stateRef.current;
      if (!current) return;
      let next = current;
      const steps = Math.max(1, Math.ceil(Math.min(ms, 10_000) / 50));
      for (let step = 0; step < steps; step += 1) next = tickGame(next, inputRef.current, 50);
      commitState(next);
    };
    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [commitState]);

  const setDirection = (direction: keyof GameInput, active: boolean) => {
    inputRef.current[direction] = active;
  };
  const bindDirection = (direction: keyof GameInput) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDirection(direction, true);
    },
    onPointerUp: () => setDirection(direction, false),
    onPointerCancel: () => setDirection(direction, false),
    onPointerLeave: () => setDirection(direction, false),
  });

  const objectiveComplete = uiState ? objectiveIsComplete(uiState) : false;
  const nearbyPrompt = uiState ? getNearbyPrompt(uiState) : null;
  const questTarget = uiState ? getQuestTarget(uiState) : null;
  const combatStatus = uiState ? getCombatStatus(uiState) : null;
  const healthPercent = uiState ? Math.max(0, (uiState.player.hp / uiState.player.maxHp) * 100) : 100;
  const activeEnemies = uiState?.enemies.filter((enemy) => enemy.alive).length ?? 0;
  const remainingChests = uiState?.chests.filter((chest) => !chest.collected).length ?? 0;
  const gateOpen = uiState?.gates.some((gate) => gate.open) ?? false;
  const isPlaying = uiState?.phase === 'playing';
  const canPause = uiState?.phase === 'playing' || uiState?.phase === 'paused';
  const targetLabel = questTarget ? `${TARGET_KIND_LABELS[questTarget.kind]} · ${formatItem(questTarget.id)}` : 'Realm secured';
  const attackLabel = !isPlaying
    ? uiState?.phase === 'paused' ? 'PAUSED' : 'LOCKED'
    : combatStatus?.attackReady
      ? 'READY'
      : combatStatus
        ? `${(combatStatus.attackCooldownMs / 1000).toFixed(1)}s`
        : '—';
  const threatTone = combatStatus ? THREAT_TONES[combatStatus.threat] : THREAT_TONES.clear;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-slate-900 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-500 text-2xl text-slate-950" aria-hidden="true">⚔</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black sm:text-base">{uiState?.title ?? 'Loading realm'}</p>
            <p className="truncate text-xs text-slate-400">Chapter {uiState?.chapter ?? '—'} · {uiState?.mode ?? 'booting'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Expedition controls">
          <ToolbarButton icon="i-ph-floppy-disk-back-duotone" label="Save" onClick={() => void saveProgress()} />
          <ToolbarButton icon="i-ph-download-simple-duotone" label="Load" onClick={() => void loaderRef.current?.loadSaveSlot()} disabled={!saveAvailable} />
          <ToolbarButton icon={uiState?.phase === 'paused' ? 'i-ph-play-fill' : 'i-ph-pause-fill'} label={uiState?.phase === 'paused' ? 'Resume' : 'Pause'} onClick={pause} disabled={!canPause} />
          <ToolbarButton icon="i-ph-arrow-counter-clockwise-bold" label="New Run" onClick={() => setConfirmReset(true)} tone="danger" />
        </div>
      </div>

      {confirmReset && (
        <div role="alertdialog" aria-labelledby="babylon-reset-title" className="flex flex-col gap-3 border-b border-rose-400/30 bg-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p id="babylon-reset-title" className="font-black text-rose-200">Erase the current expedition?</p>
            <p className="text-sm text-slate-400">All chapter, relic, and combat progress will be replaced.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmReset(false)} className="min-h-12 flex-1 rounded-xl bg-slate-700 px-4 font-bold sm:flex-none">Cancel</button>
            <button type="button" onClick={() => { setConfirmReset(false); void loaderRef.current?.resetRun(); }} className="min-h-12 flex-1 rounded-xl bg-red-600 px-4 font-bold text-white sm:flex-none">Erase & restart</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-0 lg:flex-row">
        <main className="min-w-0 flex-1">
          <div className="relative overflow-hidden bg-[#031019]">
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="application"
              aria-label={uiState ? `${uiState.title}, ${getObjective(uiState)}, player health ${uiState.player.hp} of ${uiState.player.maxHp}` : 'Babylon RPG loading'}
              className="block w-full touch-none focus-visible:outline-3 focus-visible:outline-cyan-300"
              style={{ height: 'clamp(500px, 72vh, 760px)' }}
            />

            <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
              <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="i-ph-heart-fill text-rose-400" aria-hidden="true" />
                  HP {uiState?.player.hp ?? 0}/{uiState?.player.maxHp ?? 0}
                </div>
                <div className="mt-1.5 h-2 w-32 overflow-hidden rounded-full bg-slate-700 sm:w-44">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-300 transition-all" style={{ width: `${healthPercent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span>Sword</span>
                  <span className={combatStatus?.attackReady ? 'text-emerald-300' : 'text-amber-200'}>{attackLabel}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Sword recharge"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={combatStatus?.attackChargePercent ?? 0}
                  className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-slate-700 sm:w-44"
                >
                  <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-100" style={{ width: `${combatStatus?.attackChargePercent ?? 0}%` }} />
                </div>
              </div>
              <div className="max-w-[13rem] rounded-xl border border-cyan-300/20 bg-slate-950/85 px-3 py-2 text-right backdrop-blur sm:max-w-64">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Quest</p>
                <p className="mt-0.5 max-w-56 text-xs font-semibold text-white sm:text-sm">{uiState ? getObjective(uiState) : 'Loading chapter…'}</p>
                {questTarget && (
                  <p className="mt-2 flex items-center justify-end gap-1.5 text-[11px] font-black text-cyan-200">
                    <span className="rounded bg-cyan-300 px-1.5 py-0.5 text-slate-950">{questTarget.direction}</span>
                    <span className="truncate">{targetLabel}</span>
                    <span className="shrink-0 text-slate-400">{questTarget.distance.toFixed(1)}m</span>
                  </p>
                )}
              </div>
            </div>

            {nearbyPrompt && uiState?.phase === 'playing' && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-12 rounded-full border border-cyan-300 bg-slate-950/90 px-4 py-2 text-sm font-black text-cyan-200 shadow-xl">
                <span className="mr-2 rounded bg-cyan-400 px-2 py-0.5 text-slate-950">E</span>{nearbyPrompt}
              </div>
            )}

            {loadingLabel && <GameOverlay title={loadingLabel} detail="Procedural meshes, lighting, and chapter rules are loading." />}
            {uiState?.phase === 'paused' && <GameOverlay title="Expedition paused" detail="Press P or use Resume when you are ready." action="Resume" onAction={pause} />}
            {uiState?.phase === 'defeated' && <GameOverlay title="The expedition has fallen" detail="Restart this chapter with full health and try a different route." action="Retry chapter" onAction={() => void loaderRef.current?.restartChapter()} danger />}
            {uiState?.phase === 'complete' && <GameOverlay title="Quest complete!" detail="All three realms are clear and the relic trail is restored." action="New expedition" onAction={() => setConfirmReset(true)} />}

            <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 lg:hidden">
              <div className="grid grid-cols-3 grid-rows-3 gap-1" aria-label="Movement controls">
                <span />
                <TouchButton label="Move up" icon="i-ph-caret-up-fill" disabled={!isPlaying} {...bindDirection('up')} />
                <span />
                <TouchButton label="Move left" icon="i-ph-caret-left-fill" disabled={!isPlaying} {...bindDirection('left')} />
                <button type="button" onClick={pause} disabled={!isPlaying} aria-label="Pause" className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-slate-900/85 text-lg text-white backdrop-blur disabled:opacity-40"><span className="i-ph-pause-fill" aria-hidden="true" /></button>
                <TouchButton label="Move right" icon="i-ph-caret-right-fill" disabled={!isPlaying} {...bindDirection('right')} />
                <span />
                <TouchButton label="Move down" icon="i-ph-caret-down-fill" disabled={!isPlaying} {...bindDirection('down')} />
                <span />
              </div>
              <div className="flex items-end gap-2">
                <button type="button" onClick={interact} disabled={!isPlaying} className="h-14 min-w-14 rounded-full border border-cyan-200 bg-cyan-500 px-3 text-xs font-black text-slate-950 shadow-xl shadow-cyan-950/30 disabled:opacity-40">ACT</button>
                <button type="button" onClick={attack} disabled={!combatStatus?.attackReady} aria-label={combatStatus?.attackReady ? 'Attack, sword ready' : isPlaying ? `Attack recharging, ${attackLabel}` : 'Attack unavailable'} className="h-20 min-w-20 rounded-full border border-amber-200 bg-amber-400 px-3 text-sm font-black text-slate-950 shadow-xl shadow-amber-950/30 disabled:border-slate-500 disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-80">
                  <span className="block">{combatStatus?.attackReady ? 'ATTACK' : isPlaying ? 'RECHARGE' : 'LOCKED'}</span>
                  {!combatStatus?.attackReady && <span className="mt-0.5 block text-[11px]">{attackLabel}</span>}
                </button>
              </div>
            </div>
          </div>

          <div aria-live="polite" className="flex min-h-12 items-center gap-2 border-t border-slate-700 bg-cyan-950/50 px-4 py-3 text-sm text-cyan-100">
            <span className="i-ph-sparkle-duotone text-xl text-cyan-300" aria-hidden="true" />{toast}
          </div>
        </main>

        <aside className="w-full border-t border-slate-700 bg-slate-900 p-4 lg:max-w-sm lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Live expedition</p>
              <h2 className="mt-1 text-2xl font-black">{uiState?.title ?? 'Loading'}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${uiState?.phase === 'playing' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'}`}>{uiState?.phase ?? 'loading'}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{uiState?.description}</p>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-950/30 p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Tracked objective</p>
              <p className="mt-1 truncate text-sm font-black text-white">{targetLabel}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {questTarget ? `${questTarget.distance.toFixed(1)}m away` : 'No remaining objective'}
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/30 bg-slate-950 text-xl font-black text-cyan-200" aria-label={questTarget ? `Direction ${questTarget.direction}` : 'No direction'}>
              {questTarget?.direction ?? '✓'}
            </div>
          </div>

          <div className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs font-bold ${threatTone}`}>
            <span className="flex items-center gap-2">
              <span className="i-ph-radar-duotone text-lg" aria-hidden="true" />
              {combatStatus?.threatLabel ?? 'Scanning realm'}
            </span>
            <span className="shrink-0 font-black">
              {combatStatus?.distance === null || combatStatus?.distance === undefined ? 'CLEAR' : `${combatStatus.distance.toFixed(1)}m`}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2">
            <StatusCard label="Guardians" value={String(activeEnemies)} icon="i-ph-skull-duotone" />
            <StatusCard label="Caches" value={String(remainingChests)} icon="i-ph-treasure-chest-duotone" />
            <StatusCard label="Relics" value={String(uiState?.inventory.length ?? 0)} icon="i-ph-diamond-duotone" />
            <StatusCard label="Gate" value={gateOpen ? 'OPEN' : objectiveComplete ? 'OPENING' : 'LOCKED'} icon="i-ph-door-open-duotone" ready={objectiveComplete} />
          </dl>

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Inventory</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {uiState?.inventory.length
                ? uiState.inventory.map((item) => <span key={item} className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-200">{formatItem(item)}</span>)
                : <span className="text-sm text-slate-500">No relics recovered</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loaderRef.current?.advanceChapter()}
            disabled={!objectiveComplete || uiState?.phase === 'defeated'}
            className="mt-4 min-h-12 w-full rounded-xl bg-cyan-500 px-4 font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {uiState?.chapter === 3 ? 'Complete Quest' : objectiveComplete ? 'Enter Next Chapter' : 'Chapter Objective Locked'}
          </button>

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
            <p className="font-black text-slate-200">Controls</p>
            <ul className="mt-2 space-y-1.5">
              <li><kbd>WASD</kbd> / arrows — move</li>
              <li><kbd>Space</kbd> / <kbd>Enter</kbd> — attack</li>
              <li><kbd>E</kbd> — interact or enter a gate</li>
              <li><kbd>P</kbd> — pause or resume</li>
              <li>Drag / pinch the 3D view to inspect the realm</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, disabled = false, tone = 'default' }: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'danger' ? 'border-rose-400/40 bg-red-600 text-white hover:bg-red-700' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'}`}
    >
      <span className={`${icon} mr-1.5 align-[-2px] text-lg`} aria-hidden="true" />{label}
    </button>
  );
}

function TouchButton({ label, icon, disabled, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave }: {
  label: string;
  icon: string;
  disabled: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      className="grid h-14 w-14 touch-none place-items-center rounded-full border border-white/15 bg-slate-900/85 text-xl text-white shadow-lg backdrop-blur active:bg-cyan-500 active:text-slate-950 disabled:opacity-40"
    >
      <span className={icon} aria-hidden="true" />
    </button>
  );
}

function GameOverlay({ title, detail, action, onAction, danger = false }: {
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
  danger?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/75 p-5 backdrop-blur-sm">
      <div className="max-w-sm rounded-3xl border border-white/15 bg-slate-900 p-6 text-center shadow-2xl">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl text-3xl ${danger ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'}`} aria-hidden="true">{danger ? '☠' : '✦'}</span>
        <h3 className="mt-4 text-2xl font-black">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
        {action && onAction && <button type="button" onClick={onAction} className={`mt-5 min-h-12 w-full rounded-xl px-5 font-black ${danger ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-950'}`}>{action}</button>}
      </div>
    </div>
  );
}

function StatusCard({ label, value, icon, ready = false }: { label: string; value: string; icon: string; ready?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><span className={`${icon} text-base`} aria-hidden="true" />{label}</p>
      <p className={`mt-1 font-black ${ready ? 'text-emerald-300' : 'text-slate-100'}`}>{value}</p>
    </div>
  );
}

function spawnPosition(level: LevelData) {
  return {
    x: level.playerSpawn.x,
    y: level.playerSpawn.y,
    z: level.playerSpawn.z,
    yaw: ((level.playerSpawn.yaw ?? 0) * Math.PI) / 180,
  };
}

function formatItem(item: string) {
  return item.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

const DB_NAME = 'web-games-babylon-rpg';
const DB_STORE = 'saves';
const DB_SLOT = 'main-v2';

async function openDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return null;
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readSave(): Promise<GameSave | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const transaction = database.transaction(DB_STORE, 'readonly');
    const request = transaction.objectStore(DB_STORE).get(DB_SLOT);
    request.onsuccess = () => resolve(parseGameSave(request.result));
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => database.close();
  });
}

async function writeSave(save: GameSave): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(DB_STORE, 'readwrite');
    transaction.objectStore(DB_STORE).put(save, DB_SLOT);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); resolve(); };
  });
}

async function clearStoredSave(): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(DB_STORE, 'readwrite');
    transaction.objectStore(DB_STORE).delete(DB_SLOT);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); resolve(); };
  });
}
