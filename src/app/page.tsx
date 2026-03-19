import GameCard from "@/components/GameCard";
import Container from "@/components/common/Container";
import { getPublishedGames } from "@/games/registry";

export default function Home() {
  const publishedGames = getPublishedGames();

  return (
    <div className="py-12 sm:py-16">
      <Container>
        <header className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Pick Your Game
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            A minimalist collection of browser-based games.
            No ads, no tracking, just fun.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {publishedGames.map((game) => (
            <GameCard key={game.id} {...game} />
          ))}
        </div>
      </Container>
    </div>
  );
}