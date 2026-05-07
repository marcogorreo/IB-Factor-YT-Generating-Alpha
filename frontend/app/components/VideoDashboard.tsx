"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { MraConfirmDialog } from "./MraConfirmDialog";

const API = "/api/backend";

const MRA_NAV_STORAGE = "mra_pending_nav";

/** Tooltip sul pulsante: MRA + Soggetto Cramer */
const MRA_TOOLTIP =
  "Market Reverse-Analysis (MRA): si valuta il sentiment di un soggetto (il «Soggetto Cramer») e si impostano idee di operatività speculative il cui esito positivo sta in rapporto inverso al verificarsi delle sue previsioni — più le sue aspettative si sbagliano, più il setup può tendere a funzionare, secondo le regole che definirà il motore.";

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

/** Traduce messaggi tecnici in linguaggio chiaro per chi non sviluppa software */
function humanizeError(raw: string, context: "list" | "refresh"): string {
  const s = raw.toLowerCase();

  if (
    s.includes("502") ||
    s.includes("503") ||
    s.includes("upstream") ||
    s.includes("gateway") ||
    s.includes("upstream_unavailable")
  ) {
    return "Non riusciamo a collegarci al servizio che prepara i video. Di solito basta riavviare l’app o aspettare un minuto e riprovare. Se il problema resta, chi ha installato il programma sul PC può verificare che sia tutto avviato.";
  }

  if (
    s.includes("database") ||
    s.includes("postgres") ||
    s.includes("28p01") ||
    s.includes("password") ||
    s.includes("connection refused")
  ) {
    return "L’archivio dati non è raggiungibile (come un “magazzino” chiuso). Chi gestisce l’installazione deve avviare il database: di solito si usa il comando documentato nel progetto (Docker). Poi aggiorna di nuovo questa pagina.";
  }

  if (
    s.includes("failed to fetch") ||
    s.includes("network") ||
    s.includes("fetch") ||
    s.includes("loadfailed")
  ) {
    return "Controlla la connessione a Internet e che questa pagina sia aperta dall’indirizzo corretto. Poi prova a ricaricare.";
  }

  if (
    s.includes("youtube") ||
    s.includes("impossibile ottenere") ||
    s.includes("ytinitial")
  ) {
    return "YouTube non ha risposto come previsto. Riprova tra poco: a volte i servizi esterni sono temporaneamente occupati.";
  }

  if (s.includes("superato il filtro") || s.includes("nessun video")) {
    return "Non abbiamo trovato video che rispettano i criteri del canale dopo l’analisi. Prova di nuovo «Sincronizza» o controlla la configurazione del canale YouTube.";
  }

  if (
    context === "refresh" &&
    (s.includes("500") || s.includes("youtube_service_error"))
  ) {
    return "La sincronizzazione non è andata a buon fine. Riprova; se succede spesso, potrebbe essere un ostacolo temporaneo lato YouTube o connessione.";
  }

  if (/\b\d{3}\b/.test(raw) && raw.length < 80) {
    return `Il server ha risposto con un errore (${raw.match(/\b\d{3}\b/)?.[0] ?? "?"}). Riprova più tardi o ricarica la pagina.`;
  }

  if (raw.length > 200) {
    return "Si è verificato un errore tecnico. Riprova tra poco; spesso si risolve da solo. Se continua, segnala il messaggio a chi gestisce l’installazione.";
  }

  return raw;
}

function MarketReverseAnalysisPanel() {
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
            In breve
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Cos&apos;è la MRA?
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
            <strong className="font-semibold text-slate-100">
              Market Reverse-Analysis (MRA)
            </strong>{" "}
            è un modo di ragionare sul mercato partendo da un personaggio o da
            una voce che interpretiamo in modo ironico come{" "}
            <span className="text-violet-200/95">«Soggetto Cramer»</span>: in
            pratica osserviamo il suo umore sul mercato (sentiment) e costruiamo
            ipotesi di operatività che tendono a guadagnare{" "}
            <em className="text-cyan-200/90 not-italic">
              quando le sue previsioni non si realizzano
            </em>
            , in misura legata a quanto i risultati si discostano da ciò che
            diceva. Qui, quando sarà attivo il motore, ritroverai l&apos;esito
            delle analisi avviate dal{" "}
            <span className="font-medium text-cyan-200/90">Data Pool</span>.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center backdrop-blur-sm">
        <p className="text-base font-medium text-slate-200">
          Nessuna MRA in esecuzione
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          Quando il motore sarà collegato, qui vedrai stato, passi principali ed
          esiti. Per avviare una MRA vai al{" "}
          <span className="text-slate-400">Data Pool</span> e usa{" "}
          <span className="font-medium text-fuchsia-300/90">Esegui MRA</span>{" "}
          su un video.
        </p>
      </section>
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
        const j = (await res.json()) as { message?: string; error?: string };
        if (j.message) detail = j.message;
        else if (typeof j.error === "string") detail = j.error;
      } catch {
        /* ignora */
      }
      throw new Error(humanizeError(detail, "list"));
    }
    const data = (await res.json()) as { videos: VideoItem[] };
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
      const data = (await res.json().catch(() => ({}))) as {
        videos?: VideoItem[];
        message?: string;
        error?: string;
      };
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
          raw.startsWith("YouTube")
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
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        characters?: number;
      };
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
              Esplora e sincronizza rapidamente gli ultimi contenuti dal canale
              YouTube configurato.
            </p>
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
                ? "Elenco storico e sincronizzazione dei video — punto di partenza per le MRA."
                : "Vista dedicata al flusso Market Reverse-Analysis (MRA) e agli esiti (in arrivo)."}
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
                    Qui trovi gli ultimi video salvati nel tuo archivio
                    (<span className="text-slate-300">Data Pool</span>). Il
                    pulsante in alto aggiorna l&apos;elenco con le novità dal
                    canale YouTube (esclusi i contenuti del brand Ingegneria
                    Italia).
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
                    Suggerimento: prova a ricaricare la pagina o riprova tra un
                    minuto. Se l&apos;errore compare spesso, avvisa chi ha
                    predisposto l&apos;installazione sul computer.
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
                  Usa il pulsante{" "}
                  <strong className="text-slate-300">Sincronizza canale</strong>{" "}
                  in alto per scaricare gli ultimi video dal canale. La prima
                  volta può richiedere alcuni secondi.
                </p>
                <p className="mx-auto mt-6 text-xs text-slate-500">
                  Se dopo la sincronizzazione non compare nulla, potrebbe mancare
                  l&apos;archivio dati sul PC: in quel caso serve l&apos;aiuto
                  di chi ha installato l&apos;applicazione.
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
                            <p className="text-xs text-slate-500">
                              Titolo e anteprima aprono il video su YouTube.
                            </p>
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
