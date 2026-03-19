export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <div className="flex justify-center gap-4 mb-6 text-gray-400">
          <div className="i-ph-device-mobile-duotone h-6 w-6" title="Mobile Friendly" />
          <div className="i-ph-lightning-duotone h-6 w-6" title="Fast Performance" />
          <div className="i-ph-code-duotone h-6 w-6" title="Clean Code" />
        </div>
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Web Games Hub. 
          Built with <span className="text-blue-500 font-semibold">React</span>, 
          <span className="text-orange-500 font-semibold"> Next.js</span> & 
          <span className="text-teal-500 font-semibold"> UnoCSS</span>.
        </p>
      </div>
    </footer>
  );
}