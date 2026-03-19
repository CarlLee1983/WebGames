"use client";

import { useState, useEffect, useCallback } from "react";
import Container from "@/components/common/Container";
import { generateDeck, Card } from "./utils";

type Difficulty = 6 | 8 | 12; // number of pairs

export default function MemoryMatchGame() {
  const [pairsCount, setPairsCount] = useState<Difficulty>(8);
  const [deck, setDeck] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const isSolved = matches === pairsCount && deck.length > 0;

  const initGame = useCallback((pairs: number) => {
    setDeck(generateDeck(pairs));
    setFlippedIndices([]);
    setMoves(0);
    setMatches(0);
    setIsLocked(false);
  }, []);

  useEffect(() => {
    initGame(pairsCount);
  }, [initGame, pairsCount]);

  const handleCardClick = (index: number) => {
    if (isLocked || isSolved) return;
    if (deck[index].isFlipped || deck[index].isMatched) return;

    // Flip the clicked card
    const newDeck = [...deck];
    newDeck[index].isFlipped = true;
    setDeck(newDeck);

    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);

    // If two cards are flipped, check for match
    if (newFlippedIndices.length === 2) {
      setIsLocked(true);
      setMoves(m => m + 1);

      const [firstIndex, secondIndex] = newFlippedIndices;
      const firstCard = newDeck[firstIndex];
      const secondCard = newDeck[secondIndex];

      if (firstCard.icon === secondCard.icon) {
        // Match!
        setTimeout(() => {
          setDeck(prevDeck => {
            const updated = [...prevDeck];
            updated[firstIndex].isMatched = true;
            updated[secondIndex].isMatched = true;
            return updated;
          });
          setMatches(m => m + 1);
          setFlippedIndices([]);
          setIsLocked(false);
        }, 500);
      } else {
        // No match, flip back after delay
        setTimeout(() => {
          setDeck(prevDeck => {
            const updated = [...prevDeck];
            updated[firstIndex].isFlipped = false;
            updated[secondIndex].isFlipped = false;
            return updated;
          });
          setFlippedIndices([]);
          setIsLocked(false);
        }, 1000);
      }
    }
  };

  const handleDifficultyChange = (newPairs: Difficulty) => {
    setPairsCount(newPairs);
  };

  if (deck.length === 0) return null;

  return (
    <div className="py-12 sm:py-16 bg-pink-50 min-h-[calc(100vh-64px)] text-gray-900">
      <Container size="md">
        <div className="mb-10 flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
          <div className="text-center sm:text-left">
            <h1 className="mb-2 flex items-center justify-center sm:justify-start gap-3 text-4xl font-extrabold text-pink-600 sm:text-5xl">
              <span className="i-ph-cards-duotone" /> Memory Match
            </h1>
            <p className="text-gray-600 font-medium">Find all the matching pairs of cards.</p>
          </div>
          
          <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-pink-100 shadow-sm">
            {([6, 8, 12] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => handleDifficultyChange(d)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  pairsCount === d 
                    ? 'bg-pink-500 text-white shadow-md scale-105' 
                    : 'text-gray-500 hover:text-pink-600 hover:bg-pink-50'
                }`}
              >
                {d * 2} Cards
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full flex-col items-center">
          
          {/* Stats Bar */}
          <div className="w-full max-w-2xl flex justify-between items-center mb-8 px-4">
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Moves</span>
                <span className="text-3xl font-black text-gray-800 leading-none">{moves}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Matches</span>
                <span className="text-3xl font-black text-gray-800 leading-none">{matches} / {pairsCount}</span>
              </div>
            </div>
            
            <button
              onClick={() => initGame(pairsCount)}
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-bold text-gray-700 shadow-sm border border-gray-200 transition hover:bg-gray-50 active:scale-95"
            >
              <span className="i-ph-arrows-clockwise-bold h-5 w-5" />
              Restart
            </button>
          </div>

          {/* Game Board */}
          <div 
            className="w-full max-w-3xl grid gap-3 sm:gap-4 justify-center"
            style={{
              // Adjust grid columns based on difficulty to keep it looking nice
              gridTemplateColumns: `repeat(auto-fit, minmax(${pairsCount === 12 ? '80px' : '100px'}, 1fr))`,
              width: '100%'
            }}
          >
            {deck.map((card, index) => {
              const isRevealed = card.isFlipped || card.isMatched;

              return (
                <div 
                  key={card.id}
                  className="relative group perspective-1000"
                  style={{ aspectRatio: '3/4' }}
                >
                  <button
                    onClick={() => handleCardClick(index)}
                    disabled={isRevealed || isLocked}
                    className={`
                      w-full h-full relative preserve-3d transition-transform duration-500
                      ${isRevealed ? 'rotate-y-180' : ''}
                      ${!isRevealed && !isLocked ? 'hover:-translate-y-2 hover:shadow-xl' : ''}
                    `}
                  >
                    {/* Card Back */}
                    <div className="absolute inset-0 backface-hidden w-full h-full rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-md border-2 border-white/20 flex flex-col items-center justify-center overflow-hidden">
                       <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" style={{ backgroundSize: '10px 10px' }} />
                       <div className="i-ph-question-duotone text-white/50 w-8 h-8" />
                    </div>

                    {/* Card Front */}
                    <div className={`
                      absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-xl bg-white shadow-md border-2 flex items-center justify-center
                      ${card.isMatched ? 'border-green-200 bg-green-50/30' : 'border-pink-100'}
                    `}>
                      <div className={`${card.icon} w-1/2 h-1/2 ${card.isMatched ? 'text-green-500' : 'text-gray-800'}`} />
                      
                      {card.isMatched && (
                        <div className="absolute top-2 right-2">
                          <div className="i-ph-check-circle-fill text-green-500 w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Victory Overlay */}
          {isSolved && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm animate-in fade-in duration-500">
              <div className="i-ph-confetti-duotone mb-6 h-32 w-32 text-pink-500 animate-bounce" />
              <h2 className="mb-2 text-5xl font-black text-gray-900 tracking-tight">You Did It!</h2>
              <p className="mb-8 text-xl font-medium text-gray-500">
                You matched {pairsCount} pairs in <span className="text-pink-500 font-bold">{moves}</span> moves.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => initGame(pairsCount)}
                  className="rounded-xl bg-pink-500 px-8 py-4 font-bold text-white shadow-xl shadow-pink-500/30 transition hover:-translate-y-1 hover:bg-pink-600 active:scale-95 text-lg"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}

        </div>
      </Container>
    </div>
  );
}