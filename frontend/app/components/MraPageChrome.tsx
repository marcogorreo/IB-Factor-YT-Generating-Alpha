import Link from "next/link";
import type { ReactNode } from "react";

/** Sfondo e header coerenti con le viste MRA. */
export function MraPageChrome({
  children,
  headerAside,
}: {
  children: ReactNode;
  /** Testo a destra nell’header (es. «YouTube Alpha · MRA»). */
  headerAside?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-slate-950 app-surface-grain"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_50%_-15%,rgba(34,211,238,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_100%_20%,rgba(139,92,246,0.1),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_0%_80%,rgba(16,185,129,0.06),transparent_45%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-40 shrink-0 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-400/90 transition hover:text-cyan-300"
          >
            IB Factor
          </Link>
          {headerAside ?? (
            <span className="text-xs text-slate-500">Analisi MRA</span>
          )}
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col">{children}</main>
    </div>
  );
}
