"use client";

import { useState, useEffect, useRef } from "react";
import Container from "@/components/common/Container";
import Link from "next/link";
import { generateRandomHoles, MoleState, BASE_SPAWN_RATE, BASE_UP_TIME, HELMET_MOLE_CHANCE, LEVEL_GOALS } from "./utils";

export default function WhackAMolePage() {
  const [gameState, setGameState] = useState<"start" | "intro" | "playing" | "gameover" | "win">("start");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [holes, setHoles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [moles, setMoles] = useState<{ [id: number]: MoleState }>({});
  const [combo, setCombo] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const spawnerRef = useRef<NodeJS.Timeout | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!gameContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      gameContainerRef.current.requestFullscreen().catch((err: any) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Audio refs
  const hitSoundRef = useRef<HTMLAudioElement | null>(null);
  const clankSoundRef = useRef<HTMLAudioElement | null>(null);
  const missSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    hitSoundRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU..."); // Placeholder for actual sound
    clankSoundRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU..."); 
    missSoundRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...");
  }, []);

  const playSound = (_type: 'hit' | 'clank' | 'miss') => { void _type;
    // Basic implementation, will need real sound files or synth
    // For now, we rely on visual feedback if audio is not fully implemented
  };

  const startGame = (startLevel = 1) => {
    setLevel(startLevel);
    if (startLevel === 1) setScore(0);
    setGameState("intro");
    setTimeout(() => {
      setGameState("playing");
      setTimeLeft(30);
      setCombo(0);
      setHoles(generateRandomHoles());
      setMoles({});
    }, 1500);
  };

  // Game Loop: Spawning Moles
  useEffect(() => {
    if (gameState !== "playing") return;

    const currentSpawnRate = Math.max(400, BASE_SPAWN_RATE - (level * 150));
    const currentUpTime = Math.max(600, BASE_UP_TIME - (level * 200));
    const currentHelmetChance = Math.min(0.6, HELMET_MOLE_CHANCE + (level * 0.1));
    const maxMoles = Math.min(4, 1 + Math.floor(level / 2));

    spawnerRef.current = setInterval(() => {
      setMoles(prevMoles => {
        const activeMoles = Object.values(prevMoles).filter(m => m.status !== "hiding").length;
        if (activeMoles >= maxMoles) return prevMoles;

        const availableHoles = holes.filter(h => !prevMoles[h.id] || prevMoles[h.id].status === "hiding");
        if (availableHoles.length === 0) return prevMoles;

        const randomHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];
        const isHelmet = Math.random() < currentHelmetChance;

        const newMole: MoleState = {
          id: randomHole.id,
          type: isHelmet ? "helmet" : "normal",
          status: "up",
          health: isHelmet ? 2 : 1,
          createdAt: Date.now()
        };

        // Auto hide after upTime
        setTimeout(() => {
          setMoles(current => {
            const mole = current[newMole.id];
            if (mole && mole.status === "up" && mole.createdAt === newMole.createdAt) {
              setCombo(0); // Break combo on miss
              playSound('miss');
              return { ...current, [newMole.id]: { ...mole, status: "escaped" } };
            }
            return current;
          });

          // Reset to hiding after escape animation
          setTimeout(() => {
             setMoles(current => {
                const mole = current[newMole.id];
                if (mole && mole.status === "escaped") {
                  return { ...current, [newMole.id]: { ...mole, status: "hiding" } };
                }
                return current;
             });
          }, 800);

        }, currentUpTime);

        return { ...prevMoles, [newMole.id]: newMole };
      });
    }, currentSpawnRate);

    return () => {
      if (spawnerRef.current) clearInterval(spawnerRef.current);
    };
  }, [gameState, level, holes]);

  // Timer Loop
  useEffect(() => {
    if (gameState !== "playing") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState("gameover");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  const handleWhack = (id: number) => {
    if (gameState !== "playing") return;

    setMoles(prevMoles => {
      const mole = prevMoles[id];
      if (!mole || mole.status !== "up") return prevMoles;

      if (mole.type === "helmet" && mole.health === 2) {
        // Hit helmet
        playSound('clank');
        return { ...prevMoles, [id]: { ...mole, health: 1 } };
      } else {
        // Hit mole (or final hit on helmet)
        playSound('hit');
        const points = mole.type === "helmet" ? 20 : 10;
        
        let newScore = score;
        setScore(s => {
          newScore = s + points + Math.min(combo * 2, 20);
          
          // Check win condition synchronously during the state update
          if (newScore >= LEVEL_GOALS[level - 1]) {
            setTimeout(() => {
              setGameState("win");
              if (spawnerRef.current) clearInterval(spawnerRef.current);
              if (timerRef.current) clearInterval(timerRef.current);
            }, 0);
          }
          return newScore;
        });

        setCombo(c => c + 1);
        
        const hitMole = { ...mole, status: "hit" as const };
        
        // Hide after hit animation
        setTimeout(() => {
            setMoles(current => {
                const m = current[id];
                if(m && m.status === "hit" && m.createdAt === hitMole.createdAt) {
                    return { ...current, [id]: { ...m, status: "hiding" } };
                }
                return current;
            })
        }, 500);

        return { ...prevMoles, [id]: hitMole };
      }
    });
  };

  return (
    <Container size="md" className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <div className="i-ph-arrow-left" />
            Back to Hub
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="i-ph-hammer-duotone text-lime-600" />
            Whack-A-Mole
          </h1>
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
          title="Toggle Fullscreen"
        >
          <div className={isFullscreen ? "i-ph-corners-in-bold" : "i-ph-corners-out-bold"} />
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>

      <div 
        ref={gameContainerRef}
        className={`relative mx-auto max-w-[600px] overflow-hidden rounded-2xl bg-sky-200 shadow-xl border-4 border-lime-700 ${isFullscreen ? 'w-screen h-screen max-w-none rounded-none border-0 flex items-center justify-center bg-sky-300' : ''}`}
      >
        {/* Game UI Header */}
        <div className={`absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-black/30 px-4 py-2 text-white backdrop-blur-sm ${isFullscreen ? 'top-2 mx-4 rounded-full' : ''}`}>
          <div className="flex gap-4">
            <div className="font-bold text-xl drop-shadow-md">Level {level}</div>
            <div className="font-bold text-xl drop-shadow-md">Score: {score} / {LEVEL_GOALS[level-1] || '???'}</div>
          </div>
          <div className={`font-bold text-xl drop-shadow-md ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : ''}`}>
            Time: {timeLeft}s
          </div>
        </div>

        {/* Combo Counter */}
        {combo > 1 && gameState === "playing" && (
          <div className={`absolute right-4 top-14 z-10 text-2xl font-black text-yellow-400 italic drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] animate-bounce ${isFullscreen ? 'top-16' : ''}`}>
            {combo}x Combo!
          </div>
        )}

        {/* Play Area */}
        <div 
          className={`relative h-[600px] w-full bg-lime-500 overflow-hidden select-none ${isFullscreen ? 'aspect-[2/3] max-h-full h-auto shadow-2xl rounded-2xl border-4 border-lime-700' : ''}`}
          style={{ backgroundImage: 'radial-gradient(circle, #84cc16 20%, #65a30d 100%)' }}
        >
          {/* Decorative Grass/Dirt could go here */}

          {gameState === "playing" && holes.map(hole => {
            const mole = moles[hole.id] || { status: "hiding" };
            return (
              <div 
                key={hole.id}
                className="absolute"
                style={{ 
                  left: `${hole.x}%`, 
                  top: `${hole.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '80px',
                  height: '80px'
                }}
              >
                {/* Hole Graphic */}
                <div className="absolute bottom-0 h-1/2 w-full rounded-full bg-amber-900 shadow-inner" />
                
                {/* Mole */}
                <div 
                  className={`absolute bottom-4 w-full h-[70px] cursor-pointer transition-transform duration-150 ease-out origin-bottom ${
                    mole.status === "hiding" ? "translate-y-[100%] scale-0 opacity-0" : 
                    mole.status === "up" ? "translate-y-0 scale-100 opacity-100" :
                    mole.status === "hit" ? "translate-y-2 scale-95 opacity-100" :
                    mole.status === "escaped" ? "translate-y-0 scale-100 opacity-100" : ""
                  }`}
                  onPointerDown={() => handleWhack(hole.id)}
                >
                  <div className="relative w-full h-full">
                    {/* Mole Body */}
                    <div className="absolute inset-0 bg-amber-700 rounded-t-[40px] border-2 border-amber-900" />
                    
                    {/* Face / Expressions */}
                    <div className="absolute top-2 left-0 right-0 flex flex-col items-center">
                      {mole.status === "up" && (
                        <>
                          <div className="flex gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-black" />
                            <div className="w-2 h-2 rounded-full bg-black" />
                          </div>
                          <div className="w-3 h-2 rounded-full bg-pink-300" />
                        </>
                      )}
                      {mole.status === "hit" && (
                        <>
                           <div className="text-xl leading-none">😵</div>
                        </>
                      )}
                      {mole.status === "escaped" && (
                        <>
                           <div className="text-xl leading-none">😜</div>
                        </>
                      )}
                    </div>

                    {/* Helmet */}
                    {mole.type === "helmet" && (
                      <div className={`absolute -top-3 -left-1 -right-1 h-8 bg-yellow-400 rounded-t-full border-2 border-yellow-600 transition-all duration-200 ${mole.health === 1 ? '-translate-y-10 opacity-0 rotate-45' : ''}`}>
                        <div className="absolute bottom-0 w-full h-2 bg-yellow-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Front Grass Cover (to hide bottom of mole) */}
                <div className="absolute bottom-[-10px] h-6 w-[120%] -left-[10%] rounded-[50%] bg-lime-600/80 blur-[2px]" />
              </div>
            );
          })}

          {/* Overlays */}
          {gameState === "start" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="i-ph-hammer-duotone text-8xl text-lime-400 mb-6 drop-shadow-lg" />
              <button
                onClick={() => startGame(1)}
                className="rounded-full bg-lime-500 px-8 py-4 text-2xl font-bold text-white shadow-[0_6px_0_#4d7c0f] transition-transform hover:-translate-y-1 hover:shadow-[0_8px_0_#4d7c0f] active:translate-y-2 active:shadow-none"
              >
                Start Game
              </button>
            </div>
          )}

          {gameState === "intro" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
              <h2 className="text-6xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] animate-bounce">
                Level {level}
              </h2>
              <p className="mt-4 text-2xl font-bold text-yellow-300 drop-shadow-md">
                Target: {LEVEL_GOALS[level-1]} pts
              </p>
            </div>
          )}

          {gameState === "win" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-lime-900/80 backdrop-blur-sm">
              <h2 className="text-5xl font-black text-white drop-shadow-lg mb-2">Level Cleared!</h2>
              <p className="text-2xl text-lime-200 mb-8 font-bold">Score: {score}</p>
              {level < LEVEL_GOALS.length ? (
                <button
                  onClick={() => startGame(level + 1)}
                  className="rounded-full bg-yellow-400 px-8 py-4 text-xl font-bold text-amber-900 shadow-[0_6px_0_#b45309] transition-transform hover:-translate-y-1 active:translate-y-2 active:shadow-none"
                >
                  Next Level
                </button>
              ) : (
                <div className="text-3xl font-bold text-yellow-300 animate-pulse">You beat all levels!</div>
              )}
            </div>
          )}

          {gameState === "gameover" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-sm">
              <h2 className="text-5xl font-black text-white drop-shadow-lg mb-2">Time&apos;s Up!</h2>
              <p className="text-2xl text-red-200 mb-8 font-bold">Final Score: {score}</p>
              <button
                onClick={() => startGame(1)}
                className="rounded-full bg-white px-8 py-4 text-xl font-bold text-red-600 shadow-[0_6px_0_#cbd5e1] transition-transform hover:-translate-y-1 active:translate-y-2 active:shadow-none"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Rules/Info */}
      <div className="mx-auto mt-6 max-w-[600px] rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-2">How to Play</h3>
        <ul className="list-disc pl-5 space-y-1 text-gray-600">
          <li>Tap the moles as fast as you can before they escape.</li>
          <li><strong>Normal Moles:</strong> 1 tap (10 pts)</li>
          <li><strong>Helmet Moles:</strong> 2 taps (20 pts)</li>
          <li>Build up your combo by not missing any moles to earn bonus points.</li>
          <li>Reach the target score before time runs out to advance to the next level.</li>
        </ul>
      </div>
    </Container>
  );
}
