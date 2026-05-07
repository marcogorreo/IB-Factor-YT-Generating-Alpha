import { LandingPage } from "./components/LandingPage";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col">
      {/* Base: deep slate → indigo tint */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#0b1020] via-[#0f172a] to-[#1a1035]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-slate-950 app-surface-grain opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(34,211,238,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_100%_15%,rgba(139,92,246,0.16),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_0%_85%,rgba(245,158,11,0.06),transparent_48%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_50%_110%,rgba(16,185,129,0.05),transparent_50%)]"
        aria-hidden
      />

      <LandingPage />
    </div>
  );
}
