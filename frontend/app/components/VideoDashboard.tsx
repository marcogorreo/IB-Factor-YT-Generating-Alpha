"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { readApiJson } from "../lib/read-api-json";
import { MraArchiveSection, useMraArchive } from "./MraArchiveTable";
import { MraConfirmDialog } from "./MraConfirmDialog";

const API = "/api/backend";

const MRA_NAV_STORAGE = "mra_pending_nav";

/** Cosa fa il pulsante «Esegui MRA» sul video */
const MRA_TOOLTIP =
  "Apre il percorso per trascrivere il video e generare l’analisi MRA (contesto, titoli, idee in chiave inversa rispetto alle opinioni espresse). Solo uso informativo, non è consulenza finanziaria.";

export type VideoItem = {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  channel_id: string;
  channel_title: string | null;
  video_url: string;
  updated_at: string;
};

type MraNavPayload = {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  published_at: string;
  channel_title: string | null;
};

type Props = {
  initialVideos: VideoItem[];
};

type AppSection = "data-pool" | "mra";

/** Messaggi errore API resi leggibili */
function humanizeError(raw: string, context: "list" | "refresh"): string {
  const s = raw.toLowerCase();

  if (
    s.includes("502") ||
    s.includes("503") ||
    s.includes("upstream") ||
    s.includes("gateway") ||
    s.includes("upstream_unavailable")
  ) {
    return "Servizio temporaneamente non disponibile. Riprova tra un attimo.";
  }

  if (
    s.includes("database") ||
    s.includes("postgres") ||
    s.includes("28p01") ||
    s.includes("password") ||
    s.includes("connection refused")
  ) {
    return "Non riusciamo a leggere l’archivio. Controlla che tutto sia avviato (come da guida di installazione) e riprova.";
  }

  if (
    s.includes("failed to fetch") ||
    s.includes("network") ||
    s.includes("fetch") ||
    s.includes("loadfailed")
  ) {
    return "Connessione non riuscita. Controlla rete e indirizzo, poi ricarica la pagina.";
  }

  if (
    s.includes("youtube") ||
    s.includes("impossibile ottenere") ||
    s.includes("ytinitial")
  ) {
    return "YouTube non ha risposto. Riprova tra poco.";
  }

  if (s.includes("superato il filtro") || s.includes("nessun video")) {
    return "Nessun video in elenco dopo l’aggiornamento. Prova di nuovo «Sincronizza canale».";
  }

  if (
    context === "refresh" &&
    (s.includes("500") || s.includes("youtube_service_error"))
  ) {
    return "Sincronizzazione non completata. Riprova; se succede spesso, controlla la connessione.";
  }

  if (/\b\d{3}\b/.test(raw) && raw.length < 80) {
    return `Qualcosa è andato storto (codice ${raw.match(/\b\d{3}\b/)?.[0] ?? "?"}). Riprova più tardi.`;
  }

  if (raw.length > 200) {
    return "Si è verificato un errore. Riprova tra poco; se continua, segnala il messaggio ricevuto.";
  }

  return raw;
}

function MarketReverseAnalysisPanel() {
  const {
    items,
    loading,
    error,
    deleteArchive,
    deletingId,
  } = useMraArchive();

  return (
    <div className="space-y-8">
      <section
        className="relative overflow-hidden rounded-3xl border border-violet-500/25 p-8 shadow-2xl shadow-violet-500/10 sm:p-10"
        style={{
          background:
            "linear-gradient(145deg, rgba(76,29,149,0.35) 0%, rgba(15,23,42,0.92) 45%, rgba(8,47,73,0.55) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Market Reverse-Analysis
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Analisi del canale
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
            Qui trovi le analisi già salvate: apri una scheda per leggere contesto,
            previsioni ricavate dal video, titoli citati e le idee in senso inverso.
            Per crearne una nuova vai al tab{" "}
            <span className="font-medium text-cyan-200/90">Data Pool</span>, scegli
            un video e premi{" "}
            <span className="font-medium text-fuchsia-200/90">Esegui MRA</span>; a
            fine analisi usa «Salva nell&apos;archivio».
          </p>
        </div>
      </section>

      <MraArchiveSection
        headingId="dashboard-mra-archive"
        title="Analisi salvate"
        description="Apri una voce per il dettaglio: testo del video, riepilogo e grafici per titolo."
        emptyHint="Nessuna analisi ancora. Dal tab Data Pool avvia Esegui MRA su un video e salva in archivio al termine."
        items={items}
        loading={loading}
        error={error}
        onDeleteArchive={deleteArchive}
        deletingId={deletingId}
      />
    </div>
  );
}

export function VideoDashboard({ initialVideos }: Props) {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<AppSection>("data-pool");
  const [mraDialogOpen, setMraDialogOpen] = useState(false);
  const [mraTarget, setMraTarget] = useState<VideoItem | null>(null);
  const [mraTranscribing, setMraTranscribing] = useState(false);
  const [mraBanner, setMraBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [mraStep1Error, setMraStep1Error] = useState<string | null>(null);

  const closeMraDialog = useCallback(() => {
    setMraDialogOpen(false);
    setMraTarget(null);
    setMraTranscribing(false);
  }, []);

  const loadVideos = useCallback(async () => {
    setError(null);
    const res = await fetch(`${API}/youtube/videos`, { cache: "no-store" });
    if (!res.ok) {
      let detail = `Connessione non riuscita (codice ${res.status}).`;
      try {
        const j = await readApiJson<{ message?: string; error?: string }>(res);
        if (j.message) detail = j.message;
        else if (typeof j.error === "string") detail = j.error;
      } catch (e) {
        if (e instanceof Error) detail = e.message;
      }
      throw new Error(humanizeError(detail, "list"));
    }
    const data = await readApiJson<{ videos: VideoItem[] }>(res);
    setVideos(data.videos ?? []);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/youtube/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = await readApiJson<{
        videos?: VideoItem[];
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        const detail = data.message ?? data.error ?? `Errore ${res.status}`;
        throw new Error(humanizeError(String(detail), "refresh"));
      }
      if (data.videos) {
        setVideos(data.videos);
      } else {
        await loadVideos();
      }
    } catch (e: unknown) {
      const raw =
        e instanceof Error ? e.message : "Operazione non completata.";
      setError(
        raw.startsWith("Non ") ||
          raw.startsWith("Controlla") ||
          raw.startsWith("Si è verificato") ||
          raw.startsWith("L’archivio") ||
          raw.startsWith("YouTube") ||
          raw.startsWith("Risposta ") ||
          raw.startsWith("JSON non valido")
          ? raw
          : humanizeError(raw, "refresh"),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const formatter = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const openMraForVideo = (video: VideoItem) => {
    setMraBanner(null);
    setMraStep1Error(null);
    setMraTarget(video);
    setMraDialogOpen(true);
  };

  const runMraTranscribe = async () => {
    if (!mraTarget) return;
    setMraStep1Error(null);
    setMraTranscribing(true);
    try {
      const res = await fetch(`${API}/insights/mra/transcribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: mraTarget.video_id }),
      });
      const data = await readApiJson<{
        ok?: boolean;
        message?: string;
        characters?: number;
      }>(res);
      if (!res.ok) {
        const msg =
          typeof data.message === "string"
            ? data.message
            : "Trascrizione non riuscita.";
        throw new Error(msg);
      }
      if (mraTarget && typeof window !== "undefined") {
        sessionStorage.setItem(
          MRA_NAV_STORAGE,
          JSON.stringify({
            video_id: mraTarget.video_id,
            title: mraTarget.title,
            thumbnail_url: mraTarget.thumbnail_url,
            video_url: mraTarget.video_url,
            published_at: mraTarget.published_at,
            channel_title: mraTarget.channel_title,
          } satisfies MraNavPayload),
        );
        router.push(`/mra/${encodeURIComponent(mraTarget.video_id)}`);
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Operazione non completata.";
      setMraStep1Error(msg);
      throw e;
    } finally {
      setMraTranscribing(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col text-slate-100">
      <MraConfirmDialog
        open={mraDialogOpen}
        videoTitle={mraTarget?.title ?? null}
        videoId={mraTarget?.video_id ?? null}
        isConfirming={mraTranscribing}
        step1Error={mraStep1Error}
        onClose={closeMraDialog}
        onConfirm={runMraTranscribe}
      />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
              IB Factor
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
              YouTube Alpha Generator
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400">
              Video del canale Ingegneri in Borsa e analisi MRA.
            </p>
            <Link
              href="/"
              className="mt-2 inline-flex text-xs font-medium text-slate-500 transition hover:text-cyan-400/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              Presentazione
            </Link>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? (
              <span className="flex items-center gap-2">
                <span
                  className="size-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950"
                  aria-hidden
                />
                Sincronizzazione…
              </span>
            ) : (
              "Sincronizza canale"
            )}
          </button>
        </div>

        <div className="border-t border-white/5 bg-slate-950/55">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <nav
              aria-label="Sezioni applicazione"
              className="flex rounded-2xl border border-white/10 bg-slate-900/70 p-1 shadow-inner backdrop-blur-sm"
            >
              <button
                type="button"
                role="tab"
                aria-selected={section === "data-pool"}
                id="tab-data-pool"
                aria-controls="panel-data-pool"
                onClick={() => setSection("data-pool")}
                className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 sm:min-w-[8.5rem] ${
                  section === "data-pool"
                    ? "text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {section === "data-pool" && (
                  <span
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-md shadow-cyan-500/25"
                    aria-hidden
                  />
                )}
                <span className="relative z-10">Data Pool</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={section === "mra"}
                id="tab-mra"
                aria-controls="panel-mra"
                onClick={() => setSection("mra")}
                className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:min-w-[11rem] ${
                  section === "mra"
                    ? "text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {section === "mra" && (
                  <span
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 shadow-md shadow-violet-500/25"
                    aria-hidden
                  />
                )}
                <span className="relative z-10">Market Reverse-Analysis</span>
              </button>
            </nav>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              {section === "data-pool"
                ? "Elenco video: punto di partenza per MRA."
                : "Analisi già salvate e come crearne di nuove."}
            </p>
          </div>
        </div>
      </header>

      {mraBanner?.kind === "ok" && (
        <div
          className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/50 py-3 text-sm text-emerald-100 backdrop-blur-sm"
          role="status"
        >
          {mraBanner.text}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {section === "data-pool" ? (
          <>
            <section
              id="panel-data-pool"
              role="tabpanel"
              aria-labelledby="tab-data-pool"
              className="mb-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    Ingegneri in Borsa
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
Ricorda: Antonino si sbaglia sempre.
                  </p>
                </div>
                <a
                  className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                  href="https://www.youtube.com/@Ingegneriinborsa/videos"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apri su YouTube
                </a>
              </div>
            </section>

            {error && (
              <div
                className="mb-8 flex gap-4 rounded-2xl border border-rose-500/30 bg-rose-950/50 p-4 shadow-lg backdrop-blur-sm sm:p-5"
                role="alert"
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-lg"
                  aria-hidden
                >
                  !
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-rose-100">
                    Qualcosa non ha funzionato
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-rose-100/85">
                    {error}
                  </p>
                  <p className="mt-3 text-xs text-rose-200/70">
                    Ricarica la pagina o riprova tra un minuto.
                  </p>
                </div>
              </div>
            )}

            {videos.length === 0 && !error && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center backdrop-blur-sm">
                <p className="mx-auto max-w-md text-base font-medium text-slate-200">
                  Ancora nessun video da mostrare
                </p>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
                  Tocca{" "}
                  <strong className="text-slate-300">Sincronizza canale</strong>{" "}
                  per caricare l&apos;elenco dalla prima volta.
                </p>
                <p className="mx-auto mt-6 text-xs text-slate-500">
                  Se dopo la sincronizzazione non compare nulla, l&apos;archivio
                  potrebbe non essere disponibile.
                </p>
              </div>
            )}

            {videos.length > 0 && (
              <ul className="isolate flex flex-col gap-5">
                {videos.map((v) => {
                  const tipId = `mra-tip-${v.video_id}`;
                  return (
                    <li
                      key={v.video_id}
                      className="relative z-0 overflow-visible hover:z-10 focus-within:z-10"
                    >
                      <article className="group/card flex flex-col overflow-visible rounded-2xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/25 backdrop-blur-md transition hover:border-cyan-500/30 hover:bg-white/[0.09] lg:flex-row lg:items-stretch">
                        <a
                          href={v.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block aspect-video w-full shrink-0 overflow-hidden rounded-t-2xl bg-slate-900 outline-offset-2 ring-offset-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 lg:w-[min(340px,38%)] lg:max-w-md lg:rounded-l-2xl lg:rounded-tr-none lg:rounded-br-none"
                          aria-label={`Apri il video su YouTube: ${v.title}`}
                        >
                          {v.thumbnail_url ? (
                            <Image
                              src={v.thumbnail_url}
                              alt=""
                              fill
                              className="object-cover transition duration-300 group-hover/card:scale-[1.02]"
                              sizes="(max-width: 1024px) 100vw, 380px"
                            />
                          ) : (
                            <div className="flex h-full min-h-[200px] w-full items-center justify-center text-sm text-slate-500">
                              Anteprima non disponibile
                            </div>
                          )}
                        </a>
                        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 rounded-b-2xl p-5 sm:p-6 lg:rounded-bl-none lg:rounded-r-2xl lg:py-7 lg:pl-8 lg:pr-8">
                          <div className="space-y-4">
                            <a
                              href={v.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg outline-offset-2 ring-offset-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                            >
                              <h3 className="text-lg font-semibold leading-snug text-white transition group-hover/card:text-cyan-100 sm:text-xl sm:leading-snug">
                                {v.title}
                              </h3>
                            </a>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                title="Data e ora di pubblicazione"
                                className="inline-flex cursor-default items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-400/30 transition-all duration-200 ease-out will-change-transform hover:z-10 hover:-translate-y-px hover:scale-[1.04] hover:bg-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/15 hover:ring-2 hover:ring-emerald-300/45 active:scale-[0.98]"
                              >
                                {formatter.format(new Date(v.published_at))}
                              </span>
                              <span
                                title="Canale"
                                className="inline-flex cursor-default items-center rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-400/35 transition-all duration-200 ease-out will-change-transform hover:z-10 hover:-translate-y-px hover:scale-[1.04] hover:bg-violet-500/25 hover:shadow-lg hover:shadow-violet-500/20 hover:ring-2 hover:ring-violet-300/45 active:scale-[0.98]"
                              >
                                {v.channel_title ?? "Ingegneri in Borsa"}
                              </span>
                              <span
                                title="ID video YouTube"
                                className="inline-flex cursor-default items-center rounded-full bg-sky-500/10 px-3 py-1 font-mono text-[11px] text-sky-200/90 ring-1 ring-sky-400/25 transition-all duration-200 ease-out will-change-transform hover:z-10 hover:-translate-y-px hover:scale-[1.04] hover:bg-sky-500/22 hover:shadow-lg hover:shadow-sky-500/20 hover:ring-2 hover:ring-sky-300/45 active:scale-[0.98]"
                              >
                                {v.video_id}
                              </span>
                              <span
                                title="Piattaforma"
                                className="inline-flex cursor-default items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-400/25 transition-all duration-200 ease-out will-change-transform hover:z-10 hover:-translate-y-px hover:scale-[1.04] hover:bg-amber-500/22 hover:shadow-lg hover:shadow-amber-500/20 hover:ring-2 hover:ring-amber-300/45 active:scale-[0.98]"
                              >
                                YouTube
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
                              <span className="group/mra relative z-[120] inline-flex">
                                <button
                                  type="button"
                                  aria-describedby={tipId}
                                  onClick={() => openMraForVideo(v)}
                                  className="relative z-[121] inline-flex h-10 items-center justify-center rounded-xl border border-fuchsia-400/45 bg-gradient-to-r from-fuchsia-500/25 via-violet-500/20 to-cyan-500/15 px-4 text-sm font-semibold text-fuchsia-50 shadow-md shadow-fuchsia-500/15 transition-all duration-200 ease-out will-change-transform hover:-translate-y-0.5 hover:scale-[1.03] hover:border-fuchsia-300/55 hover:bg-gradient-to-r hover:from-fuchsia-500/35 hover:via-violet-500/28 hover:to-cyan-500/22 hover:shadow-lg hover:shadow-fuchsia-500/30 hover:brightness-105 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
                                >
                                  Esegui MRA
                                </button>
                                <span
                                  role="tooltip"
                                  id={tipId}
                                  className="pointer-events-none invisible absolute top-full left-1/2 z-[122] mt-3 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-white/25 bg-slate-950/70 px-4 py-3 text-left text-xs leading-relaxed text-slate-100 opacity-0 shadow-2xl shadow-black/50 backdrop-blur-xl transition duration-200 group-hover/mra:pointer-events-auto group-hover/mra:visible group-hover/mra:opacity-100 group-focus-within/mra:pointer-events-auto group-focus-within/mra:visible group-focus-within/mra:opacity-100"
                                >
                                  {MRA_TOOLTIP}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <section
            id="panel-mra"
            role="tabpanel"
            aria-labelledby="tab-mra"
          >
            <MarketReverseAnalysisPanel />
          </section>
        )}
      </main>
    </div>
  );
}
