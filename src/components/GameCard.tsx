import Link from 'next/link';

interface GameCardProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
}

export default function GameCard({ title, description, icon, href, color }: GameCardProps) {
  return (
    <Link 
      href={href}
      className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95"
    >
      <div className={`absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full ${color} opacity-10 transition-transform duration-500 group-hover:scale-150`} />
      
      <div className="relative z-10">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${color} shadow-lg`}>
          <div className={`${icon} h-7 w-7 text-white`} />
        </div>
        
        <h3 className="mb-2 text-xl font-bold text-gray-800 group-hover:text-gray-900">
          {title}
        </h3>
        
        <p className="text-sm text-gray-500 line-clamp-2">
          {description}
        </p>
      </div>
      
      <div className="mt-4 flex items-center text-sm font-semibold text-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        Play Now 
        <span className="ml-1 transition-transform duration-300 group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}