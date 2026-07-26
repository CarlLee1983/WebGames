import Container from "@/components/common/Container";
import BabylonGame from "./BabylonGame";

export default function BabylonRpgPage() {
  return (
    <div className="py-8 sm:py-10">
      <Container size="full">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 px-5 py-5 text-white shadow-2xl shadow-slate-300/30 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Three-realm 3D quest
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Babylon RPG: Skybound Relics</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
                Fight through the Forest Shrine, recover the Sunken Treasury relic, and cross the moving Sky Bridge in a procedural Babylon.js adventure.
              </p>
            </div>
            <div className="max-w-md rounded-2xl border border-cyan-300/15 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-300">
              Every realm has a real objective gate. Enemies pursue and strike back, relics persist in IndexedDB, and the full quest works with keyboard or touch.
            </div>
          </div>
        </div>

        <BabylonGame />
      </Container>
    </div>
  );
}
