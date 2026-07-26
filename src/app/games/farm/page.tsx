"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import {
  AUTO_SAVE_INTERVAL,
  CROP_DEFS,
  FARM_HEIGHT,
  FARM_WIDTH,
  applyOfflineTick,
  calcLevel,
  canWater,
  createInitialState,
  farmStateToRows,
  formatCountdown,
  fulfillTradeRequest,
  getCurrentSeason,
  getUnlockLevelForPlot,
  handlePlotClick,
  loadFarmState,
  moveFarmFocus,
  msUntilNextWater,
  refreshTradeRequest,
  saveFarmState,
  sellCrop,
  tickWeather,
  xpToNextLevel,
} from "./utils";
import type {
  CropDef,
  FarmState,
  PlotState,
  Season,
  WeatherType,
} from "./utils";

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

const styles = `
  .farm-page {
    --farm-ink: #f8fafc;
    --farm-muted: #b9c9c1;
    --farm-night: #102b2a;
    --farm-panel: #173c35;
    --farm-panel-strong: #0d2826;
    --farm-line: rgba(226, 232, 240, .14);
    --farm-leaf: #79c267;
    --farm-gold: #f8d66d;
    min-height: calc(100vh - 64px);
    overflow: hidden;
    padding: 12px 0 40px;
    color: var(--farm-ink);
    background:
      radial-gradient(circle at 15% 5%, rgba(121, 194, 103, .18), transparent 28%),
      radial-gradient(circle at 90% 8%, rgba(248, 214, 109, .12), transparent 24%),
      linear-gradient(180deg, #102f2b 0%, #0d2423 100%);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  }

  .farm-page *, .farm-page *::before, .farm-page *::after { box-sizing: border-box; }
  .farm-page button { font: inherit; }
  .farm-page h1, .farm-page h2, .farm-page h3, .farm-page p { margin: 0; }

  .farm-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(420px, .85fr);
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .farm-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 0;
  }

  .farm-eyebrow {
    display: inline-flex;
    min-height: 28px;
    align-items: center;
    gap: 8px;
    color: var(--farm-gold);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .farm-title {
    margin-top: 2px !important;
    color: #fff4b7;
    font-size: clamp(36px, 3.5vw, 42px);
    font-weight: 950;
    line-height: .95;
    letter-spacing: -.05em;
    white-space: nowrap;
    text-shadow: 0 4px 0 #49351a, 0 8px 22px rgba(0, 0, 0, .25);
  }

  .farm-subtitle {
    margin-top: 8px !important;
    max-width: 620px;
    color: var(--farm-muted);
    font-family: system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.45;
  }

  .farm-save-badge {
    display: flex;
    min-height: 48px;
    flex: 0 0 auto;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--farm-line);
    border-radius: 14px;
    padding: 8px 14px;
    color: #dce9e2;
    background: rgba(13, 40, 38, .84);
    box-shadow: 0 12px 30px rgba(0, 0, 0, .18);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .farm-stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    margin-bottom: 0;
  }

  .farm-stat {
    min-width: 0;
    border: 1px solid var(--farm-line);
    border-radius: 14px;
    padding: 7px 10px;
    background: rgba(23, 60, 53, .9);
    box-shadow: 0 10px 24px rgba(0, 0, 0, .13);
  }

  .farm-stat-label {
    display: block;
    color: #83a79a;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .15em;
    text-transform: uppercase;
  }

  .farm-stat-value {
    display: block;
    overflow: hidden;
    margin-top: 4px;
    color: white;
    font-size: clamp(15px, 1.45vw, 18px);
    font-weight: 950;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .farm-dashboard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    align-items: start;
    gap: 14px;
  }

  .farm-card {
    border: 1px solid var(--farm-line);
    border-radius: 22px;
    background: rgba(15, 46, 42, .94);
    box-shadow: 0 22px 55px rgba(0, 0, 0, .24);
  }

  .farm-board-card { min-width: 0; padding: 14px; }

  .farm-card-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;
  }

  .farm-kicker {
    color: var(--farm-gold);
    font-size: 10px;
    font-weight: 950;
    letter-spacing: .17em;
    text-transform: uppercase;
  }

  .farm-status-message {
    margin-top: 4px !important;
    color: #d4e2db;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.35;
  }

  .farm-progress-chip {
    flex: 0 0 auto;
    border-radius: 999px;
    padding: 7px 10px;
    color: #c8e9bf;
    background: rgba(121, 194, 103, .12);
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .farm-grid-frame {
    width: max-content;
    max-width: 100%;
    margin: 0 auto;
    overflow: hidden;
    border: 4px solid #50331e;
    border-radius: 18px;
    padding: 9px;
    background:
      linear-gradient(rgba(255, 255, 255, .035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, .035) 1px, transparent 1px),
      #805630;
    background-size: 16px 16px;
    box-shadow: inset 0 0 0 3px #a97946, inset 0 0 22px rgba(0, 0, 0, .35);
  }

  .farm-grid {
    display: grid;
    width: max-content;
    max-width: 100%;
    margin: 0 auto;
    grid-template-columns: repeat(6, 1fr);
    gap: 3px;
    padding: 4px;
    border: 3px solid #3c2718;
    background: #3c2718;
  }

  .farm-plot {
    position: relative;
    display: grid;
    width: clamp(46px, 12.5vw, 56px);
    aspect-ratio: 1;
    place-items: center;
    overflow: hidden;
    border: 2px solid #432714;
    border-radius: 5px;
    padding: 0;
    color: white;
    cursor: pointer;
    image-rendering: pixelated;
    transition: transform .12s ease, filter .12s ease, border-color .12s ease;
  }

  .farm-plot:hover { z-index: 2; filter: brightness(1.1); transform: translateY(-2px); }
  .farm-plot:active { transform: translateY(1px); }
  .farm-plot:focus-visible { z-index: 3; outline: 3px solid #fff3a1; outline-offset: 2px; }
  .farm-plot[aria-disabled="true"] { cursor: default; filter: grayscale(.35); opacity: .62; }
  .farm-plot[aria-disabled="true"]:hover { transform: none; }

  .farm-plot-empty {
    background:
      radial-gradient(circle at 22% 24%, rgba(80, 52, 30, .22) 0 3px, transparent 4px),
      #a97648;
  }
  .farm-plot-tilled { background: repeating-linear-gradient(0deg, #5b351f 0 5px, #6d4024 5px 9px); }
  .farm-plot-watered { background: repeating-linear-gradient(0deg, #2f241d 0 5px, #3d2c20 5px 9px); }
  .farm-plot-ready { border-color: #f8d66d; background: #49311f; box-shadow: inset 0 0 14px rgba(248, 214, 109, .24); }
  .farm-plot-wilted { background: #4c382b; }
  .farm-plot-locked {
    border-color: #273735;
    background: repeating-linear-gradient(45deg, #263d39 0 8px, #1e3431 8px 16px);
  }

  .farm-crop { font-size: clamp(24px, 7vw, 36px); filter: drop-shadow(0 3px 2px rgba(0, 0, 0, .35)); }
  .farm-crop-growing { transform: scale(.76); }
  .farm-crop-ready { animation: farmCropBounce .9s ease-in-out infinite alternate; }
  .farm-lock { color: #8ba49d; font-size: 18px; font-weight: 950; }

  .farm-water-track {
    position: absolute;
    right: 4px;
    bottom: 4px;
    left: 4px;
    height: 6px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, .55);
    border-radius: 4px;
    background: #17201e;
  }
  .farm-water-fill { height: 100%; background: linear-gradient(90deg, #4ea3e5, #79d5e8); }
  .farm-water-fill-ready { background: linear-gradient(90deg, #e6ba43, #fff29b); }
  .farm-wait-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #65c7ec;
    box-shadow: 0 0 0 2px rgba(15, 46, 42, .75);
  }

  .farm-side { display: grid; gap: 10px; }
  .farm-mobile-seeds { display: none; }
  .farm-side-section { padding: 14px; }
  .farm-section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px !important;
    color: var(--farm-gold);
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .farm-seed-list, .farm-market-list { display: grid; gap: 7px; }
  .farm-seed {
    display: grid;
    min-height: 58px;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 1px solid rgba(226, 232, 240, .14);
    border-radius: 13px;
    padding: 7px 9px;
    color: white;
    background: #204d42;
    cursor: pointer;
    text-align: left;
    transition: transform .12s ease, border-color .12s ease, background-color .12s ease;
  }
  .farm-seed:hover:not(:disabled) { transform: translateY(-1px); border-color: rgba(248, 214, 109, .5); }
  .farm-seed:focus-visible, .farm-sell:focus-visible { outline: 3px solid #fff3a1; outline-offset: 2px; }
  .farm-seed[aria-pressed="true"] { border-color: #f8d66d; color: #14231f; background: #f8d66d; }
  .farm-seed:disabled { cursor: not-allowed; filter: grayscale(.5); opacity: .48; }
  .farm-seed-emoji { font-size: 28px; text-align: center; }
  .farm-seed-name { display: block; font-size: 12px; font-weight: 950; }
  .farm-seed-meta { display: block; margin-top: 3px; font-family: system-ui, sans-serif; font-size: 11px; opacity: .76; }
  .farm-seed-price { font-size: 11px; font-weight: 950; white-space: nowrap; }

  .farm-market-row {
    display: grid;
    min-height: 52px;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    border-radius: 12px;
    padding: 7px 8px;
    background: rgba(5, 25, 23, .62);
  }
  .farm-market-name { display: block; font-size: 11px; font-weight: 950; }
  .farm-market-meta { display: block; margin-top: 2px; color: #9cb8ad; font-family: system-ui, sans-serif; font-size: 11px; }
  .farm-sell {
    min-height: 40px;
    border: 0;
    border-radius: 10px;
    padding: 0 10px;
    color: #183029;
    background: #9cdb7f;
    cursor: pointer;
    font-size: 10px;
    font-weight: 950;
  }
  .farm-sell:disabled { cursor: not-allowed; filter: grayscale(.55); opacity: .46; }

  .farm-empty-market {
    border: 1px dashed rgba(226, 232, 240, .16);
    border-radius: 12px;
    padding: 12px;
    color: #8da99e;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    text-align: center;
  }

  .farm-guide {
    color: #b9cdc4;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.48;
  }
  .farm-guide strong { color: #f4e2a4; }
  .farm-guide p + p { margin-top: 6px !important; }

  .farm-xp-track {
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(0, 0, 0, .34);
  }
  .farm-xp-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #79c267, #d7ed82); }

  .farm-loading {
    display: grid;
    min-height: calc(100vh - 64px);
    place-items: center;
    color: #f8d66d;
    background: #102b2a;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  @keyframes farmCropBounce {
    from { transform: translateY(0); }
    to { transform: translateY(-5px); }
  }

  @media (max-width: 960px) {
    .farm-page { padding-top: 10px; }
    .farm-overview { display: block; margin-bottom: 12px; }
    .farm-header { align-items: flex-start; margin-bottom: 8px; }
    .farm-title { white-space: normal; }
    .farm-eyebrow, .farm-subtitle { display: none; }
    .farm-save-badge { min-height: 40px; padding: 6px 9px; font-size: 9px; }
    .farm-save-badge span:last-child { display: none; }
    .farm-subtitle { font-size: 13px; }
    .farm-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .farm-stat { padding: 8px 10px; }
    .farm-dashboard { grid-template-columns: minmax(0, 1fr); }
    .farm-board-card { padding: 10px; }
    .farm-card-heading { align-items: flex-start; }
    .farm-grid-frame { padding: 6px; }
    .farm-side-section { padding: 12px; }
    .farm-mobile-seeds {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 9px;
    }
    .farm-mobile-seed {
      display: flex;
      min-width: 0;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border: 1px solid var(--farm-line);
      border-radius: 11px;
      padding: 5px;
      color: #f5f0d0;
      background: rgba(255, 255, 255, .055);
      font-size: 10px;
      font-weight: 900;
    }
    .farm-mobile-seed[aria-pressed="true"] { border-color: #f8d66d; background: rgba(248, 214, 109, .16); }
    .farm-mobile-seed:disabled { opacity: .42; }
    .farm-mobile-seed:focus-visible { outline: 3px solid #fff3a1; outline-offset: 2px; }
    .farm-seed-panel { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .farm-crop-ready { animation: none; }
    .farm-plot, .farm-seed { transition: none; }
  }
`;

const WEATHER: Record<WeatherType, { icon: string; label: string }> = {
  sunny: { icon: "☀️", label: "Sunny" },
  cloudy: { icon: "☁️", label: "Cloudy" },
  rainy: { icon: "🌧️", label: "Rainy" },
  stormy: { icon: "⛈️", label: "Stormy" },
};

const SEASONS: Record<Season, { icon: string; label: string }> = {
  spring: { icon: "🌸", label: "Spring" },
  summer: { icon: "🌞", label: "Summer" },
  autumn: { icon: "🍂", label: "Autumn" },
  winter: { icon: "❄️", label: "Winter" },
};

function describePlotAction(
  before: FarmState,
  after: FarmState,
  plotId: number,
  now: number,
): string {
  const previous = before.plots[plotId];
  const next = after.plots[plotId];
  const position = `Plot ${Math.floor(plotId / FARM_WIDTH) + 1}, ${plotId % FARM_WIDTH + 1}`;

  if (before === after) {
    if (!previous.isUnlocked) {
      return `${position} unlocks at level ${getUnlockLevelForPlot(plotId)}.`;
    }
    if (previous.status === "tilled" && !before.selectedSeedId) {
      return "Choose an in-season seed, then tap tilled soil to plant it.";
    }
    if (previous.cropId && (previous.status === "seeded" || previous.status === "growing")) {
      const crop = CROP_DEFS[previous.cropId];
      return `${crop.name} needs another drink in ${formatCountdown(msUntilNextWater(previous, crop, now))}.`;
    }
    if (previous.status === "tilled" && before.selectedSeedId) {
      const crop = CROP_DEFS[before.selectedSeedId];
      const season = getCurrentSeason(new Date(now));
      if (!crop.seasons.includes(season)) return `${crop.name} is out of season right now.`;
      if (before.player.coins < crop.buyPrice) return `You need ${crop.buyPrice} gold to plant ${crop.name}.`;
    }
    return `${position} is resting.`;
  }

  if (previous.status === "empty" && next.status === "tilled") return `${position} tilled. Pick a seed for this soil.`;
  if (previous.status === "tilled" && next.status === "seeded" && next.cropId) {
    return `${CROP_DEFS[next.cropId].name} planted for ${CROP_DEFS[next.cropId].buyPrice} gold. Tap once more to water.`;
  }
  if (next.waterCount > previous.waterCount && next.cropId) {
    const crop = CROP_DEFS[next.cropId];
    return next.status === "ready"
      ? `${crop.name} is ready — tap it to harvest.`
      : `${crop.name} watered ${next.waterCount} of ${crop.waterNeeded} times.`;
  }
  if (previous.status === "ready" && next.status === "empty" && previous.cropId) {
    return `${CROP_DEFS[previous.cropId].name} harvested into the market crate.`;
  }
  if (previous.status === "wilted" && next.status === "empty") return `${position} cleared and ready to till again.`;
  return `${position} updated.`;
}

export default function FarmPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [now, setNow] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Preparing the field journal…");
  const stateRef = useRef<FarmState | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const currentTime = Date.now();
      const restored = refreshTradeRequest(
        applyOfflineTick(loadFarmState() ?? createInitialState(currentTime), currentTime),
        currentTime,
      );
      stateRef.current = restored;
      setState(restored);
      setNow(currentTime);
      setStatusMessage("Tap an open field to till the soil and begin.");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const saveCurrent = () => {
      if (stateRef.current) saveFarmState(stateRef.current);
    };
    const timer = window.setInterval(saveCurrent, AUTO_SAVE_INTERVAL);
    window.addEventListener("beforeunload", saveCurrent);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", saveCurrent);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      setState((current) => {
        if (!current) return current;
        const next = refreshTradeRequest(tickWeather(current, currentTime), currentTime);
        stateRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.render_game_to_text = () => {
      const current = stateRef.current;
      if (!current) return JSON.stringify({ phase: "loading" });
      return JSON.stringify({
        phase: "playing",
        level: current.player.level,
        coins: current.player.coins,
        xp: current.player.xp,
        harvests: current.player.totalHarvests,
        season: getCurrentSeason(new Date()),
        weather: current.weather.current,
        selectedSeed: current.selectedSeedId,
        inventory: current.inventory,
        marketOrder: current.activeTradeRequest,
        field: farmStateToRows(current),
      });
    };
    return () => {
      delete window.render_game_to_text;
    };
  }, []);

  const onPlotClick = useCallback((plotId: number) => {
    const currentTime = Date.now();
    const current = stateRef.current;
    if (!current) return;
    const next = handlePlotClick(current, plotId, currentTime);
    setStatusMessage(describePlotAction(current, next, plotId, currentTime));
    if (next !== current) {
      stateRef.current = next;
      setState(next);
      saveFarmState(next);
    }
  }, []);

  const onSelectSeed = useCallback((cropId: string) => {
    const current = stateRef.current;
    if (!current) return;
    const selectedSeedId = current.selectedSeedId === cropId ? null : cropId;
    const next = { ...current, selectedSeedId };
    stateRef.current = next;
    setState(next);
    setStatusMessage(selectedSeedId ? `${CROP_DEFS[cropId].name} selected. Tap tilled soil to plant.` : "Seed selection cleared.");
    saveFarmState(next);
  }, []);

  const onSellCrop = useCallback((cropId: string) => {
    const current = stateRef.current;
    if (!current) return;
    const next = sellCrop(current, cropId, 1);
    if (next === current) return;
    stateRef.current = next;
    setState(next);
    setStatusMessage(`${CROP_DEFS[cropId].name} sold for ${CROP_DEFS[cropId].sellPrice} gold.`);
    saveFarmState(next);
  }, []);

  const onFulfillTrade = useCallback(() => {
    const current = stateRef.current;
    if (!current?.activeTradeRequest) return;
    const request = current.activeTradeRequest;
    const next = fulfillTradeRequest(current, Date.now());
    if (next === current) {
      const remaining = Math.max(0, request.quantity - (current.inventory[request.cropId] ?? 0));
      setStatusMessage(`The market order still needs ${remaining} more ${CROP_DEFS[request.cropId].name}.`);
      return;
    }
    stateRef.current = next;
    setState(next);
    setStatusMessage(`Market order delivered for ${request.reward} gold.`);
    saveFarmState(next);
  }, []);

  if (!state) {
    return (
      <>
        <style>{styles}</style>
        <div className="farm-loading">Loading field journal…</div>
      </>
    );
  }

  const currentSeason = getCurrentSeason(new Date(now));
  const level = calcLevel(state.player.xp);
  const unlockedPlots = state.plots.filter((plot) => plot.isUnlocked).length;
  const xpProgress = state.player.xp % 100;

  return (
    <div className="farm-page">
      <style>{styles}</style>
      <Container size="lg">
        <div className="farm-overview">
          <header className="farm-header">
            <div>
              <div className="farm-eyebrow"><span aria-hidden="true">✦</span> Cozy systems, pixel soil</div>
              <h1 className="farm-title">Super Pixel Farm</h1>
              <p className="farm-subtitle">Till, plant, water and bring each harvest to market. Every level grows the field.</p>
            </div>
            <div className="farm-save-badge" aria-label="Progress saves automatically">
              <span aria-hidden="true">💾</span><span>Auto-save on</span>
            </div>
          </header>

          <section className="farm-stat-grid" aria-label="Farm status">
            <StatCard label="Gold" value={`◉ ${state.player.coins}`} />
            <StatCard label="Level" value={`${level} · ${xpToNextLevel(state.player.xp)} XP left`} />
            <StatCard label="Season" value={`${SEASONS[currentSeason].icon} ${SEASONS[currentSeason].label}`} />
            <StatCard label="Weather" value={`${WEATHER[state.weather.current].icon} ${WEATHER[state.weather.current].label}`} />
          </section>
        </div>

        <div className="farm-dashboard">
          <section className="farm-card farm-board-card" aria-labelledby="field-heading">
            <div className="farm-card-heading">
              <div>
                <h2 id="field-heading" className="farm-kicker">Field journal</h2>
                <p className="farm-status-message">{statusMessage}</p>
              </div>
              <span className="farm-progress-chip">{unlockedPlots}/36 plots</span>
            </div>

            <MobileSeedTray
              state={state}
              currentSeason={currentSeason}
              onSelectSeed={onSelectSeed}
            />

            <div className="farm-grid-frame">
              <FarmGrid state={state} now={now} onPlotClick={onPlotClick} />
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="farm-xp-track" aria-label={`Level progress ${xpProgress}%`}>
                <div className="farm-xp-fill" style={{ width: `${xpProgress}%` }} />
              </div>
              <p className="farm-guide" style={{ marginTop: 7 }}>
                {level < 4 ? `Reach level ${level + 1} to expand the field again.` : "The full 6 × 6 field is unlocked."}
              </p>
            </div>
          </section>

          <aside className="farm-side" aria-label="Farm tools">
            <ActionPanel
              state={state}
              currentSeason={currentSeason}
              now={now}
              onSelectSeed={onSelectSeed}
              onSellCrop={onSellCrop}
              onFulfillTrade={onFulfillTrade}
            />
          </aside>
        </div>

        <p className="sr-only" aria-live="polite">{statusMessage}</p>
      </Container>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="farm-stat">
      <span className="farm-stat-label">{label}</span>
      <span className="farm-stat-value">{value}</span>
    </div>
  );
}

function FarmGrid({
  state,
  now,
  onPlotClick,
}: {
  state: FarmState;
  now: number;
  onPlotClick: (plotId: number) => void;
}) {
  const [activePlotId, setActivePlotId] = useState(0);
  const plotRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusPlot = useCallback((plotId: number) => {
    setActivePlotId(plotId);
    window.requestAnimationFrame(() => plotRefs.current[plotId]?.focus());
  }, []);

  return (
    <div
      className="farm-grid"
      role="grid"
      aria-label={`${FARM_WIDTH} by ${FARM_HEIGHT} farm field`}
      aria-rowcount={FARM_HEIGHT}
      aria-colcount={FARM_WIDTH}
    >
      {state.plots.map((plot) => (
        <PlotCell
          key={plot.id}
          plot={plot}
          state={state}
          now={now}
          onPlotClick={onPlotClick}
          isTabStop={activePlotId === plot.id}
          buttonRef={(node) => { plotRefs.current[plot.id] = node; }}
          onFocus={() => setActivePlotId(plot.id)}
          onNavigate={(key) => focusPlot(moveFarmFocus(plot.id, key))}
        />
      ))}
    </div>
  );
}

function getPlotPresentation(plot: PlotState, now: number) {
  const crop = plot.cropId ? CROP_DEFS[plot.cropId] : null;
  const row = Math.floor(plot.id / FARM_WIDTH) + 1;
  const column = plot.id % FARM_WIDTH + 1;
  let className = "farm-plot-empty";
  let content: ReactNode = null;
  let label = `Plot ${row}, ${column}: open soil, till plot`;
  let waterProgress = 0;
  let waiting = false;

  if (!plot.isUnlocked) {
    className = "farm-plot-locked";
    content = <span className="farm-lock" aria-hidden="true">L{getUnlockLevelForPlot(plot.id)}</span>;
    label = `Plot ${row}, ${column}: locked until level ${getUnlockLevelForPlot(plot.id)}`;
  } else if (plot.status === "tilled") {
    className = "farm-plot-tilled";
    label = `Plot ${row}, ${column}: tilled soil, choose a seed to plant`;
  } else if (plot.status === "wilted") {
    className = "farm-plot-wilted";
    content = <span className="farm-crop" aria-hidden="true">🍂</span>;
    label = `Plot ${row}, ${column}: wilted crop, clear plot`;
  } else if (crop && (plot.status === "seeded" || plot.status === "growing")) {
    const available = canWater(plot, crop, now);
    className = available ? "farm-plot-tilled" : "farm-plot-watered";
    content = (
      <span className={`farm-crop ${plot.status === "growing" ? "farm-crop-growing" : ""}`} aria-hidden="true">
        {plot.status === "seeded" ? "🌱" : crop.emoji}
      </span>
    );
    waterProgress = (plot.waterCount / crop.waterNeeded) * 100;
    waiting = !available;
    label = available
      ? `Plot ${row}, ${column}: ${crop.name}, water ${plot.waterCount} of ${crop.waterNeeded}`
      : `Plot ${row}, ${column}: ${crop.name}, next water in ${formatCountdown(msUntilNextWater(plot, crop, now))}`;
  } else if (crop && plot.status === "ready") {
    className = "farm-plot-ready";
    content = <span className="farm-crop farm-crop-ready" aria-hidden="true">{crop.emoji}</span>;
    waterProgress = 100;
    label = `Plot ${row}, ${column}: ${crop.name} ready to harvest`;
  }

  return { className, content, label, waterProgress, waiting, crop };
}

function PlotCell({
  plot,
  state,
  now,
  onPlotClick,
  isTabStop,
  buttonRef,
  onFocus,
  onNavigate,
}: {
  plot: PlotState;
  state: FarmState;
  now: number;
  onPlotClick: (plotId: number) => void;
  isTabStop: boolean;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onNavigate: (key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End') => void;
}) {
  const view = getPlotPresentation(plot, now);
  const selectedCrop = state.selectedSeedId ? CROP_DEFS[state.selectedSeedId] : null;
  const label = plot.status === "tilled" && selectedCrop
    ? `${view.label}; plant ${selectedCrop.name} for ${selectedCrop.buyPrice} gold`
    : view.label;

  return (
    <button
      ref={buttonRef}
      type="button"
      role="gridcell"
      className={`farm-plot ${view.className}`}
      aria-label={label}
      aria-disabled={!plot.isUnlocked}
      aria-rowindex={Math.floor(plot.id / FARM_WIDTH) + 1}
      aria-colindex={(plot.id % FARM_WIDTH) + 1}
      tabIndex={isTabStop ? 0 : -1}
      onFocus={onFocus}
      onClick={() => onPlotClick(plot.id)}
      onKeyDown={(event) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          onNavigate(event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End');
        }
      }}
    >
      {view.content}
      {view.crop && (
        <span className="farm-water-track" aria-hidden="true">
          <span
            className={`farm-water-fill ${view.waterProgress >= 100 ? "farm-water-fill-ready" : ""}`}
            style={{ width: `${Math.min(view.waterProgress, 100)}%` }}
          />
        </span>
      )}
      {view.waiting && <span className="farm-wait-dot" aria-hidden="true" />}
    </button>
  );
}

function MobileSeedTray({
  state,
  currentSeason,
  onSelectSeed,
}: {
  state: FarmState;
  currentSeason: Season;
  onSelectSeed: (cropId: string) => void;
}) {
  return (
    <div className="farm-mobile-seeds" aria-label="Quick seed selection">
      {Object.values(CROP_DEFS).map((crop) => {
        const inSeason = crop.seasons.includes(currentSeason);
        const levelReady = state.player.level >= crop.levelRequired;
        const affordable = state.player.coins >= crop.buyPrice;
        const disabled = !inSeason || !levelReady || !affordable;
        const reason = !levelReady ? `level ${crop.levelRequired} required` : !inSeason ? "out of season" : !affordable ? "not enough gold" : `${crop.buyPrice} gold`;
        return (
          <button
            key={crop.id}
            type="button"
            className="farm-mobile-seed"
            aria-pressed={state.selectedSeedId === crop.id}
            aria-label={`${crop.name} seed, ${reason}`}
            disabled={disabled}
            onClick={() => onSelectSeed(crop.id)}
          >
            <span aria-hidden="true">{crop.emoji}</span>
            <span>{crop.buyPrice}g</span>
          </button>
        );
      })}
    </div>
  );
}

function ActionPanel({
  state,
  currentSeason,
  now,
  onSelectSeed,
  onSellCrop,
  onFulfillTrade,
}: {
  state: FarmState;
  currentSeason: Season;
  now: number;
  onSelectSeed: (cropId: string) => void;
  onSellCrop: (cropId: string) => void;
  onFulfillTrade: () => void;
}) {
  const crops = Object.values(CROP_DEFS);
  const produce = Object.entries(state.inventory).filter(([, count]) => count > 0);
  const request = state.activeTradeRequest;
  const requestCrop = request ? CROP_DEFS[request.cropId] : null;
  const requestInventory = request ? state.inventory[request.cropId] ?? 0 : 0;

  return (
    <>
      <section className="farm-card farm-side-section farm-seed-panel" aria-labelledby="seed-heading">
        <h2 id="seed-heading" className="farm-section-title"><span>Seed satchel</span><span>{SEASONS[currentSeason].icon}</span></h2>
        <div className="farm-seed-list">
          {crops.map((crop) => {
            const inSeason = crop.seasons.includes(currentSeason);
            const levelReady = state.player.level >= crop.levelRequired;
            const affordable = state.player.coins >= crop.buyPrice;
            const disabled = !inSeason || !levelReady || !affordable;
            return (
              <SeedButton
                key={crop.id}
                crop={crop}
                selected={state.selectedSeedId === crop.id}
                disabled={disabled}
                reason={!levelReady ? `Level ${crop.levelRequired}` : !inSeason ? "Out of season" : !affordable ? "Need gold" : `${crop.buyPrice} gold`}
                onClick={onSelectSeed}
              />
            );
          })}
        </div>
      </section>

      <section className="farm-card farm-side-section" aria-labelledby="order-heading">
        <h2 id="order-heading" className="farm-section-title"><span>Market order</span><span aria-hidden="true">📜</span></h2>
        {request && requestCrop ? (
          <div className="farm-market-row">
            <span className="farm-seed-emoji" aria-hidden="true">{requestCrop.emoji}</span>
            <span>
              <span className="farm-market-name">{requestCrop.name} × {request.quantity}</span>
              <span className="farm-market-meta">
                {Math.min(requestInventory, request.quantity)}/{request.quantity} ready · {request.reward} gold · {formatCountdown(request.expiresAt - now)}
              </span>
            </span>
            <button
              type="button"
              className="farm-sell"
              disabled={requestInventory < request.quantity}
              onClick={onFulfillTrade}
              aria-label={`Deliver ${request.quantity} ${requestCrop.name} for ${request.reward} gold`}
            >
              Deliver
            </button>
          </div>
        ) : (
          <div className="farm-empty-market">Order complete. A new request arrives with the next market bell.</div>
        )}
      </section>

      <section className="farm-card farm-side-section" aria-labelledby="market-heading">
        <h2 id="market-heading" className="farm-section-title"><span>Market crate</span><span aria-hidden="true">🧺</span></h2>
        {produce.length === 0 ? (
          <div className="farm-empty-market">Harvested produce lands here. Sell it when you are ready.</div>
        ) : (
          <div className="farm-market-list">
            {produce.map(([cropId, count]) => {
              const crop = CROP_DEFS[cropId];
              if (!crop) return null;
              return (
                <div className="farm-market-row" key={cropId}>
                  <span className="farm-seed-emoji" aria-hidden="true">{crop.emoji}</span>
                  <span>
                    <span className="farm-market-name">{crop.name} × {count}</span>
                    <span className="farm-market-meta">{crop.sellPrice} gold each</span>
                  </span>
                  <button type="button" className="farm-sell" onClick={() => onSellCrop(cropId)} aria-label={`Sell one ${crop.name} for ${crop.sellPrice} gold`}>
                    Sell 1
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="farm-card farm-side-section farm-guide" aria-labelledby="guide-heading">
        <h2 id="guide-heading" className="farm-section-title">Field notes</h2>
        <p><strong>1.</strong> Tap open soil to till it.</p>
        <p><strong>2.</strong> Choose an in-season seed, then plant and water.</p>
        <p><strong>3.</strong> Return after the cooldown; harvests earn XP and go to market.</p>
        <p><strong>Weather:</strong> rain gives corn two watering steps at once.</p>
      </section>
    </>
  );
}

function SeedButton({
  crop,
  selected,
  disabled,
  reason,
  onClick,
}: {
  crop: CropDef;
  selected: boolean;
  disabled: boolean;
  reason: string;
  onClick: (cropId: string) => void;
}) {
  return (
    <button
      type="button"
      className="farm-seed"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onClick(crop.id)}
      aria-label={`${crop.name} seed; costs ${crop.buyPrice} gold; sells for ${crop.sellPrice}; ${reason}`}
    >
      <span className="farm-seed-emoji" aria-hidden="true">{crop.emoji}</span>
      <span>
        <span className="farm-seed-name">{crop.name}</span>
        <span className="farm-seed-meta">Sell {crop.sellPrice} · {crop.waterNeeded} waters</span>
      </span>
      <span className="farm-seed-price">{reason}</span>
    </button>
  );
}
