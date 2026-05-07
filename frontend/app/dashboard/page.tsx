import { VideoDashboard, type VideoItem } from "../components/VideoDashboard";
import { readApiJson } from "../lib/read-api-json";

async function getInitialVideos(): Promise<VideoItem[]> {
  const base =
    process.env.API_GATEWAY_INTERNAL_URL ?? "http://127.0.0.1:4000";
  try {
    const res = await fetch(`${base}/youtube/videos`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await readApiJson<{ videos?: VideoItem[] }>(res);
    return data.videos ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const initialVideos = await getInitialVideos();
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

      <VideoDashboard initialVideos={initialVideos} />
    </div>
  );
}
