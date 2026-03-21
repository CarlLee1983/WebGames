"use client";

import { useEffect, useRef, useState } from "react";
import Container from "@/components/common/Container";
import { initGame, destroyGame } from "./game";

export default function DeepSeaPenguinPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [depth, setDepth] = useState(0);
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [fishCount, setFishCount] = useState(0);
  const [speedLevel, setSpeedLevel] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanupFn: (() => void) | null = null;

    initGame(containerRef.current, {
      onUpdate: (data) => {
        setDepth(Math.floor(data.depth));
        setLives(data.lives);
        setFishCount(data.fishCount);
        
        // Track speed levels for UI feedback
        const newSpeedLevel = data.depth > 2000 ? 4 : data.depth > 1000 ? 3 : data.depth > 500 ? 2 : 1;
        setSpeedLevel(newSpeedLevel);

        if (data.isGameOver) {
          setIsGameOver(true);
        }
      }
    }).then(cleanup => {
      cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) cleanupFn();
      destroyGame();
    };
  }, []);

  return (
    <Container className="py-8">
      <div className="flex flex-col items-center max-w-2xl mx-auto w-full">
        {/* Header Section */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-blue-400 drop-shadow-lg tracking-tight mb-2 flex items-center justify-center gap-3">
             <div className="i-ph-penguin-duotone text-5xl"></div>
             DEEP SEA PENGUIN
          </h1>
          <p className="text-blue-300/70 font-medium">Dive deep, dodge danger!</p>
        </div>

        {/* Enhanced HUD */}
        <div className="w-full grid grid-cols-3 gap-4 mb-6 px-6 py-4 bg-blue-900/40 backdrop-blur-md rounded-2xl border-2 border-blue-400/30 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          {/* Depth / Score */}
          <div className="flex flex-col items-center justify-center border-r border-blue-400/20">
            <div className="flex items-center gap-2 text-blue-300 text-sm font-bold uppercase tracking-wider mb-1">
              <div className="i-ph-ruler-duotone"></div>
              <span>Depth</span>
            </div>
            <div className="text-3xl font-black text-white font-mono leading-none">
              {depth}<span className="text-sm text-blue-400 ml-1">m</span>
            </div>
          </div>

          {/* Fish Collected */}
          <div className="flex flex-col items-center justify-center border-r border-blue-400/20">
            <div className="flex items-center gap-2 text-yellow-400/80 text-sm font-bold uppercase tracking-wider mb-1">
              <div className="i-ph-fish-duotone"></div>
              <span>Fish</span>
            </div>
            <div className="text-3xl font-black text-yellow-100 font-mono leading-none">
              {fishCount}
            </div>
          </div>

          {/* Lives / Health */}
          <div className="flex flex-col items-center justify-center">
             <div className="text-blue-300 text-sm font-bold uppercase tracking-wider mb-2">Health</div>
             <div className="flex gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={`text-2xl transition-all duration-300 ${
                    i < lives 
                      ? "i-ph-heart-fill text-red-500 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                      : "i-ph-heart-break text-blue-900/40 scale-90"
                  }`}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Game Area Container */}
        <div className="relative w-full aspect-[3/4] max-h-[70vh] bg-blue-950 rounded-3xl overflow-hidden border-8 border-blue-900 shadow-2xl group transition-transform duration-500 hover:scale-[1.01]">
          {/* Pixi Canvas Mount */}
          <div ref={containerRef} className="w-full h-full cursor-crosshair" />
          
          {/* Speed Notification Overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-500 overflow-hidden">
             <div className={`px-4 py-1.5 rounded-full bg-blue-400/20 backdrop-blur-sm border border-blue-400/40 text-blue-100 text-xs font-black tracking-widest uppercase flex items-center gap-2 ${speedLevel > 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
                <div className="i-ph-lightning-fill text-yellow-400"></div>
                LEVEL {speedLevel}
             </div>
          </div>

          {/* Game Over Screen - Reimagined */}
          {isGameOver && (
            <div className="absolute inset-0 bg-blue-950/90 flex flex-col items-center justify-center backdrop-blur-md z-50 animate-in fade-in duration-500">
              {/* Decorative background circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
              
              <div className="i-ph-skull-duotone text-7xl text-blue-400/50 mb-4"></div>
              <h2 className="text-5xl font-black text-white mb-2 tracking-tighter italic">FINISH DIVE</h2>
              
              <div className="w-full max-w-xs space-y-4 my-8">
                <div className="bg-blue-900/40 p-4 rounded-2xl border border-blue-400/20 flex justify-between items-center">
                  <span className="text-blue-300 font-bold uppercase tracking-widest text-sm">Max Depth</span>
                  <span className="text-3xl font-black text-white">{depth}m</span>
                </div>
                <div className="bg-yellow-900/20 p-4 rounded-2xl border border-yellow-400/20 flex justify-between items-center">
                  <span className="text-yellow-400 font-bold uppercase tracking-widest text-sm">Fish Bounty</span>
                  <span className="text-3xl font-black text-yellow-100">{fishCount}</span>
                </div>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="group relative flex items-center gap-3 px-10 py-5 bg-blue-500 rounded-full text-white font-black text-2xl overflow-hidden transition-all hover:bg-blue-400 hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(59,130,246,0.4)]"
              >
                <div className="i-ph-play-fill"></div>
                DIVE AGAIN
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]"></div>
              </button>
            </div>
          )}
        </div>
        
        {/* Help / Footer */}
        <div className="mt-8 px-6 py-4 bg-blue-900/20 rounded-2xl w-full border border-blue-400/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-blue-300/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-400/10 flex items-center justify-center border border-blue-400/20">
                  <div className="i-ph-hand-swipe-left-duotone"></div>
                </div>
                <span className="text-sm font-medium">Swipe to Move</span>
              </div>
              <div className="w-px h-4 bg-blue-400/20 hidden md:block"></div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
                <div className="i-ph-keyboard-duotone text-lg"></div>
                <span>Arrows/AD for PC</span>
              </div>
            </div>
            
            <div className="flex gap-4">
               <div className="flex items-center gap-2 text-xs text-blue-300/60 font-bold">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                  DANGER
               </div>
               <div className="flex items-center gap-2 text-xs text-blue-300/60 font-bold">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
                  POINTS
               </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}