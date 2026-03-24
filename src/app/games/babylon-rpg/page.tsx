import Container from "@/components/common/Container";

export default function BabylonRpgPage() {
  return (
    <div className="py-8 sm:py-10">
      <Container size="full">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-6 py-5 text-white shadow-2xl shadow-slate-300/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                Babylon.js chapter hub
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Babylon RPG Foundation</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
                A lightweight chapter prototype with JSON-driven progression, save/load, objective gates, and browser-safe controls.
              </p>
            </div>
            <div className="max-w-md text-sm leading-6 text-slate-200">
              Use the in-game controls for save/load/reset/next level. The embedded build keeps the route stable under Next 16 dev mode while preserving the chapter flow.
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <iframe
            src="/games/babylon-rpg/app.html"
            title="Babylon RPG"
            className="block h-[82vh] min-h-[720px] w-full border-0"
            allow="fullscreen"
          />
        </div>
      </Container>
    </div>
  );
}
