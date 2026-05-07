import Link from "next/link";

import { MraFlowClient } from "../../components/MraFlowClient";

type PageProps = {
  params: Promise<{ videoId: string }>;
};

export default async function MraVideoPage({ params }: PageProps) {
  const { videoId } = await params;
  const decoded = decodeURIComponent(videoId);

  return (
    <div className="relative flex min-h-full flex-col">
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

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-400/90"
          >
            IB Factor
          </Link>
          <span className="text-xs text-slate-500">YouTube Alpha · MRA</span>
        </div>
      </header>

      <MraFlowClient videoId={decoded} />
    </div>
  );
}
