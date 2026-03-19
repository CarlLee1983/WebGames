import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="i-ph-game-controller-duotone h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold tracking-tight text-gray-900">
                Web Games Hub
              </span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/carl/web-games" 
              target="_blank" 
              rel="noopener noreferrer"
              className="i-ph-github-logo-duotone h-6 w-6 text-gray-500 transition-colors hover:text-gray-900"
              title="GitHub Repository"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}