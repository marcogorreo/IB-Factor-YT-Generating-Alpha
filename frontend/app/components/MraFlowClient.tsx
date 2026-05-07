"use client";

import Image from "next/image";
import Link from "next/link";

import { DASHBOARD_PATH } from "../lib/routes";
import { readApiJson } from "../lib/read-api-json";
import {
  MraArchiveSection,
  useMraArchive,
} from "./MraArchiveTable";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const API = "/api/backend";

const STORAGE_KEY = "mra_pending_nav";

export type MraNavMeta = {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  published_at: string;
  channel_title: string | null;
};

/** Output JSON dell'agent MRA (allineato al backend) */
export type MraTickerRow = {
  ticker: string;
  orientamento_del_soggetto: string;
  operazioni_suggerite: string;
  motivazione: string;
};

export type MraAgentReport = {
  video_id?: string;
  generato_il?: string;
  contesto_generale: string;
  previsioni_principali: string[];
  titoli_coinvolti: string[];
  per_ticker: MraTickerRow[];
};

type TranscriptResponse = {
  ok?: boolean;
  transcript?: string;
  language?: string | null;
  char_count?: number;
  updated_at?: string;
  message?: string;
  error?: string;
};

type TranscriptFetchResult =
  | { ok: true }
  | { ok: false; message: string };

/** Badge vetro / trasparente coerente con il tema */
function GlassBadge({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "cyan" | "amber";
}) {
  const tones = {
    neutral:
      "border-white/12 bg-white/[0.06] text-slate-300/95 shadow-sm shadow-black/20",
    cyan: "border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-100/90 shadow-sm shadow-cyan-950/30",
    amber:
      "border-amber-400/18 bg-amber-500/[0.07] text-amber-100/85 shadow-sm shadow-amber-950/25",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md ${tones[tone]}`}
    >
      {icon ? <span className="opacity-80">{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * Scompone la trascrizione in frasi/paragrafi ordinati per lettura.
 * Usa Intl.Segmenter quando disponibile, altrimenti split su . ! ?
 */
function transcriptToDisplayBlocks(text: string): string[] {
  const flattened = text.replace(/\s+/g, " ").trim();
  if (!flattened) return [];

  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const Seg = (
        Intl as unknown as {
          Segmenter: new (
            locales: string,
            options: { granularity: "sentence" },
          ) => { segment: (s: string) => Iterable<{ segment: string }> };
        }
      ).Segmenter;
      const seg = new Seg("it", { granularity: "sentence" });
      const parts: string[] = [];
      for (const { segment } of seg.segment(flattened)) {
        const t = segment.trim();
        if (t) parts.push(t);
      }
      if (parts.length > 1) return parts;
    }
  } catch {
    /* fallback sotto */
  }

  const rough = flattened
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (rough.length > 1) return rough;

  /* Ultimo resort: blocchi per lunghezza senza spezzare parole */
  const max = 420;
  const words = flattened.split(/\s+/);
  const blocks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const w of words) {
    const add = w.length + (cur.length ? 1 : 0);
    if (len + add > max && cur.length) {
      blocks.push(cur.join(" "));
      cur = [w];
      len = w.length;
    } else {
      cur.push(w);
      len += add;
    }
  }
  if (cur.length) blocks.push(cur.join(" "));
  return blocks;
}

function formatIsoDateBadge(iso: string | undefined, style: "short" | "medium") {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (style === "short") {
    return d.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return d.toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Testo completo per colonna archivio DB (previsioni come elenco numerato). */
function formatPrevisioniForArchive(report: MraAgentReport): string {
  const arr = report.previsioni_principali ?? [];
  if (!arr.length) return "";
  return arr.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
}

function formatTitoliForArchive(report: MraAgentReport): string {
  return (report.titoli_coinvolti ?? []).join("\n");
}

const ARCHIVE_TICKER_SEP = "\n\n────────────────\n\n";

/** Tutti i blocchi per ticker, testo integrale come in UI. */
function formatOperazioniInverseForArchive(report: MraAgentReport): string {
  const rows = report.per_ticker ?? [];
  if (!rows.length) return "";
  return rows
    .map(
      (row) =>
        `${row.ticker}\n` +
        `Orientamento del soggetto: ${row.orientamento_del_soggetto}\n` +
        `Operazioni suggerite (inverso MRA): ${row.operazioni_suggerite}\n` +
        `Motivazione: ${row.motivazione}`,
    )
    .join(ARCHIVE_TICKER_SEP);
}

type Props = {
  videoId: string;
};

export function MraFlowClient({ videoId }: Props) {
  const [meta, setMeta] = useState<MraNavMeta | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [chars, setChars] = useState<number | null>(null);
  const [transcriptUpdatedAt, setTranscriptUpdatedAt] = useState<string | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingT, setLoadingT] = useState(true);

  const [mraReport, setMraReport] = useState<MraAgentReport | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    model: string;
    truncated: boolean;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /** Workflow agent: da click fino a fine (include attesa trascrizione) */
  const [runWorkflowBusy, setRunWorkflowBusy] = useState(false);

  const [saveArchiveBusy, setSaveArchiveBusy] = useState(false);
  const [saveArchiveMsg, setSaveArchiveMsg] = useState<string | null>(null);

  const {
    items: archiveItems,
    loading: archiveLoading,
    error: archiveError,
    reload: reloadArchive,
    deleteArchive,
    deletingId: archiveDeletingId,
  } = useMraArchive();

  /** Step 1: chiuso di default */
  const [step1Open, setStep1Open] = useState(false);
  const transcriptFetchRef = useRef<Promise<TranscriptFetchResult> | null>(null);
  const transcriptRef = useRef(transcript);
  const loadingTRef = useRef(loadingT);
  transcriptRef.current = transcript;
  loadingTRef.current = loadingT;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MraNavMeta;
        if (parsed.video_id === videoId) {
          setMeta(parsed);
        }
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignora */
    }
  }, [videoId]);

  const fetchTranscript = useCallback(async (): Promise<TranscriptFetchResult> => {
    if (transcriptRef.current && !loadingTRef.current) {
      return { ok: true };
    }
    if (transcriptFetchRef.current) {
      return transcriptFetchRef.current;
    }

    const p = (async (): Promise<TranscriptFetchResult> => {
      setLoadingT(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `${API}/insights/mra/transcript/${encodeURIComponent(videoId)}`,
          { cache: "no-store" },
        );
        const data = await readApiJson<TranscriptResponse>(res);
        if (!res.ok || !data.transcript) {
          if (!res.ok && typeof data.message === "string") {
            const msg = data.message;
            setLoadError(msg);
            return { ok: false, message: msg };
          }
          const fallback =
            res.status === 404
            ? "Trascrizione non trovata. Torna all'app, scegli il video dal Data Pool e usa Esegui MRA."
              : "Impossibile caricare la trascrizione.";
          setLoadError(fallback);
          return { ok: false, message: fallback };
        }
        setTranscript(data.transcript);
        setLang(data.language ?? null);
        setTranscriptUpdatedAt(
          typeof data.updated_at === "string" ? data.updated_at : null,
        );
        setChars(
          typeof data.char_count === "number"
            ? data.char_count
            : [...data.transcript].length,
        );
        return { ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Errore caricamento";
        setLoadError(msg);
        return { ok: false, message: msg };
      } finally {
        setLoadingT(false);
      }
    })().finally(() => {
      transcriptFetchRef.current = null;
    });

    transcriptFetchRef.current = p;
    return p;
  }, [videoId]);

  useEffect(() => {
    void fetchTranscript();
  }, [videoId, fetchTranscript]);

  const saveToArchive = async () => {
    if (!mraReport || transcript == null) return;
    setSaveArchiveBusy(true);
    setSaveArchiveMsg(null);
    try {
      const res = await fetch(`${API}/insights/mra/archive`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          video_id: videoId,
          video_title: meta?.title ?? `Video ${videoId}`,
          transcript,
          contesto_generale: mraReport.contesto_generale,
          previsioni_opinioni: formatPrevisioniForArchive(mraReport),
          titoli_coinvolti: formatTitoliForArchive(mraReport),
          operazioni_inverse: formatOperazioniInverseForArchive(mraReport),
        }),
      });
      const data = await readApiJson<{
        ok?: boolean;
        id?: number;
        message?: string;
      }>(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Salvataggio non riuscito.");
      }
      setSaveArchiveMsg(
        typeof data.id === "number"
          ? `Salvato come riga #${data.id}.`
          : "Salvato nell'archivio.",
      );
      await reloadArchive();
    } catch (e: unknown) {
      setSaveArchiveMsg(
        e instanceof Error ? e.message : "Errore durante il salvataggio.",
      );
    } finally {
      setSaveArchiveBusy(false);
    }
  };

  const runAnalysis = async () => {
    setStep1Open(true);
    setAnalyzeError(null);
    setMraReport(null);
    setAnalysisMeta(null);
    setRunWorkflowBusy(true);
    setAnalyzing(false);
    try {
      const tx = await fetchTranscript();
      if (!tx.ok) {
        setAnalyzeError(tx.message);
        return;
      }
      setAnalyzing(true);
      const res = await fetch(`${API}/insights/mra/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: videoId }),
      });
      const data = await readApiJson<{
        ok?: boolean;
        mra_report?: MraAgentReport;
        model?: string;
        transcript_truncated?: boolean;
        message?: string;
      }>(res);
      if (!res.ok || !data.mra_report) {
        throw new Error(data.message ?? "Analisi non disponibile.");
      }
      setMraReport(data.mra_report);
      setAnalysisMeta({
        model: data.model ?? "",
        truncated: Boolean(data.transcript_truncated),
      });
    } catch (e: unknown) {
      setAnalyzeError(
        e instanceof Error ? e.message : "Errore durante l'analisi.",
      );
    } finally {
      setAnalyzing(false);
      setRunWorkflowBusy(false);
    }
  };

  const downloadMraJson = () => {
    if (!mraReport) return;
    const blob = new Blob([JSON.stringify(mraReport, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mra-${videoId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const title = meta?.title ?? `Video ${videoId}`;

  const transcriptBlocks = useMemo(
    () => (transcript ? transcriptToDisplayBlocks(transcript) : []),
    [transcript],
  );

  const publishedLabel = formatIsoDateBadge(meta?.published_at, "short");
  const updatedLabel = formatIsoDateBadge(
    transcriptUpdatedAt ?? undefined,
    "medium",
  );

  const step1Summary = useMemo(() => {
    if (loadingT) return "Caricamento in corso…";
    if (loadError)
      return loadError.length > 72 ? `${loadError.slice(0, 72)}…` : loadError;
    if (transcript && chars != null) {
      return `Trascrizione pronta · ${chars.toLocaleString("it-IT")} caratteri${
        lang ? ` · ${lang.toUpperCase()}` : ""
      }`;
    }
    return "In attesa dei dati…";
  }, [loadingT, loadError, transcript, chars, lang]);

  const transcriptStepDone =
    !loadingT && Boolean(transcript) && loadError == null;
  const analysisStepDone = Boolean(mraReport);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <nav className="mb-8">
        <Link
          href={DASHBOARD_PATH}
          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400/90 transition hover:text-cyan-300"
        >
          ← Torna all&apos;app
        </Link>
      </nav>

      <section
        className="mb-8 overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/35 via-slate-950/40 to-slate-950/90 shadow-xl backdrop-blur-sm"
        aria-labelledby="cramer-subject-heading"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
          <div className="relative mx-auto size-28 shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-slate-900 shadow-lg sm:mx-0 sm:size-32">
            <Image
              src="/images/ib_profilepic.jpg"
              alt="Due giovani in camicia blu e nera, schiena contro schiena, su sfondo arancione"
              fill
              className="object-cover"
              sizes="128px"
              priority
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300/90">
              Di cosa parliamo
            </p>
            <h2
              id="cramer-subject-heading"
              className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl"
            >
              Ingegneri in Borsa · Antonino e Mattia
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300/95">
              Le analisi si riferiscono a ciò che dicono in video sui mercati e
              sui titoli. La MRA propone idee in <em className="not-italic text-slate-200">senso inverso</em> rispetto a
              quelle opinioni: materiale{" "}
              <span className="text-slate-200">solo informativo e didattico</span>
              , non consulenza finanziaria.
            </p>
          </div>
        </div>
      </section>

      <header className="mb-8 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-400/90">
          Market Reverse-Analysis
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          La tua analisi
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Prima serve il testo del video; poi puoi generare il riepilogo (contesto,
          titoli citati, idee in senso inverso).
        </p>
      </header>

      <ol className="mb-10 flex flex-wrap gap-3 text-sm" aria-label="Stato del flusso">
        <li
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium ${
            transcriptStepDone
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
              : "border-white/12 bg-white/[0.04] text-slate-400"
          }`}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs ${
              transcriptStepDone
                ? "bg-emerald-500/30 text-emerald-50"
                : loadingT
                  ? "bg-white/10"
                  : "bg-white/10 text-slate-300"
            }`}
            aria-hidden
          >
            {transcriptStepDone ? (
              "✓"
            ) : loadingT ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-400" />
            ) : (
              "1"
            )}
          </span>
          Trascrizione
        </li>
        <li
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium ${
            analysisStepDone
              ? "border-violet-500/35 bg-violet-500/10 text-violet-100"
              : analyzing
                ? "border-violet-500/25 bg-violet-500/[0.06] text-violet-200/80"
                : "border-white/12 bg-white/[0.04] text-slate-400"
          }`}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs ${
              analysisStepDone
                ? "bg-violet-500/30 text-violet-50"
                : analyzing
                  ? "bg-violet-500/20"
                  : "bg-white/10 text-slate-300"
            }`}
            aria-hidden
          >
            {analysisStepDone ? (
              "✓"
            ) : analyzing ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-300" />
            ) : (
              "2"
            )}
          </span>
          Analisi
        </li>
      </ol>

      <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
          {meta?.thumbnail_url ? (
            <div className="relative mx-auto aspect-video w-full max-w-[200px] shrink-0 overflow-hidden rounded-xl bg-slate-900 sm:mx-0">
              <Image
                src={meta.thumbnail_url}
                alt=""
                fill
                className="object-cover"
                sizes="200px"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug text-white sm:text-xl">
              {title}
            </h2>
            {meta?.channel_title && (
              <p className="mt-1 text-sm text-slate-400">{meta.channel_title}</p>
            )}
            <p className="mt-2 font-mono text-[11px] text-slate-500">{videoId}</p>
            {meta?.video_url && (
              <a
                href={meta.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-sm text-cyan-400 hover:text-cyan-300"
              >
                Apri su YouTube
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="mb-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setStep1Open((o) => !o)}
          aria-expanded={step1Open}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] sm:px-5"
        >
          <span
            className={`mt-0.5 shrink-0 text-slate-500 transition-transform ${
              step1Open ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Passo 1 — Trascrizione
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500 sm:whitespace-normal sm:leading-snug">
              {step1Summary}
            </p>
          </div>
          {loadingT ? (
            <span
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400"
              aria-hidden
            />
          ) : null}
        </button>

        {step1Open ? (
          <div className="space-y-4 border-t border-white/10 px-4 pb-5 pt-3 sm:px-5">
            <p className="text-xs text-slate-600">
              Dal video (sottotitoli), suddiviso in paragrafi
            </p>
            {loadingT && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span
                  className="size-4 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400"
                  aria-hidden
                />
                Caricamento trascrizione…
              </div>
            )}
            {loadError && (
              <p
                className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
                role="alert"
              >
                {loadError}
              </p>
            )}
            {!loadingT && transcript && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] via-slate-950/40 to-slate-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
                <div className="border-b border-white/[0.08] bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-transparent px-5 py-4 sm:px-6">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Info
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {publishedLabel ? (
                      <GlassBadge
                        tone="cyan"
                        icon={
                          <svg
                            className="size-3.5 text-cyan-300/80"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        }
                      >
                        Video · {publishedLabel}
                      </GlassBadge>
                    ) : null}
                    {updatedLabel ? (
                      <GlassBadge
                        tone="amber"
                        icon={
                          <svg
                            className="size-3.5 text-amber-200/70"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        }
                      >
                        Trascrizione salvata · {updatedLabel}
                      </GlassBadge>
                    ) : null}
                    {lang ? (
                      <GlassBadge
                        tone="neutral"
                        icon={
                          <span className="text-[10px] opacity-90" aria-hidden>
                            Aa
                          </span>
                        }
                      >
                        Lingua {lang.toUpperCase()}
                      </GlassBadge>
                    ) : null}
                    {chars != null ? (
                      <GlassBadge tone="neutral">
                        {chars.toLocaleString("it-IT")} caratteri
                      </GlassBadge>
                    ) : null}
                  </div>
                </div>

                <div
                  className="max-h-[min(58vh,560px)] overflow-y-auto px-5 py-6 sm:px-7 sm:py-7 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/12 [&::-webkit-scrollbar-thumb]:hover:bg-white/18 [&::-webkit-scrollbar-track]:bg-transparent"
                  tabIndex={0}
                >
                  <article
                    className="mx-auto max-w-prose space-y-5 border-l-2 border-cyan-400/15 pl-5 sm:border-cyan-400/25 sm:pl-6"
                    aria-label="Testo della trascrizione"
                  >
                    {transcriptBlocks.map((block, i) => (
                      <p
                        key={i}
                        className="text-[15px] leading-[1.78] tracking-[0.01em] text-slate-200/95"
                      >
                        {block}
                      </p>
                    ))}
                  </article>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-6 shadow-lg backdrop-blur-sm">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-violet-300/90">
          Passo 2 — Analisi
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-slate-400">
          Genera il riepilogo a partire dalla trascrizione: contesto, punti citati nel
          video, titoli e idee formulate «al contrario» rispetto a quelle opinioni.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={runWorkflowBusy}
            onClick={() => void runAnalysis()}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 min-[380px]:flex-initial"
          >
            {runWorkflowBusy ? (
              <span className="flex items-center gap-2">
                <span
                  className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                {loadingT
                  ? "Caricamento trascrizione…"
                  : analyzing
                    ? "Generazione analisi…"
                    : "Avvio…"}
              </span>
            ) : (
              "Genera analisi"
            )}
          </button>
          {mraReport ? (
            <>
              <button
                type="button"
                disabled={saveArchiveBusy || transcript == null}
                onClick={() => void saveToArchive()}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-100 backdrop-blur-sm transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saveArchiveBusy ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-200"
                      aria-hidden
                    />
                    Salvataggio…
                  </span>
                ) : (
                  "Salva nell'archivio"
                )}
              </button>
              <button
                type="button"
                onClick={downloadMraJson}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-slate-100 backdrop-blur-sm transition hover:bg-white/[0.1]"
              >
                Scarica risultato (JSON)
              </button>
            </>
          ) : null}
        </div>
        {analyzeError && (
          <p
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100"
            role="alert"
          >
            {analyzeError}
          </p>
        )}
        {saveArchiveMsg && (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              saveArchiveMsg.startsWith("Salvato")
                ? "border-emerald-500/30 bg-emerald-950/35 text-emerald-100"
                : "border-rose-500/30 bg-rose-950/40 text-rose-100"
            }`}
            role="status"
          >
            {saveArchiveMsg}
          </p>
        )}
        {mraReport && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              {mraReport.video_id && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono">
                  {mraReport.video_id}
                </span>
              )}
              {mraReport.generato_il && (
                <span className="rounded-full bg-white/10 px-2 py-0.5">
                  {new Date(mraReport.generato_il).toLocaleString("it-IT")}
                </span>
              )}
              {analysisMeta?.truncated && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200/90">
                  Usati i primi minuti di trascrizione (testo molto lungo)
                </span>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Contesto generale
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/95">
                {mraReport.contesto_generale}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Punti citati nel video
              </p>
              <ul className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-200/95 marker:text-fuchsia-400/80">
                {mraReport.previsioni_principali?.length ? (
                  mraReport.previsioni_principali.map((p, i) => <li key={i}>{p}</li>)
                ) : (
                  <li className="list-none pl-0 text-slate-500">
                    Nessuna previsione ricavata chiaramente dal testo.
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Titoli coinvolti
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mraReport.titoli_coinvolti?.length ? (
                  mraReport.titoli_coinvolti.map((t) => (
                    <span
                      key={t}
                      className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-mono text-xs font-medium text-cyan-100/90"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Nessun ticker indicato.</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Titolo per titolo
              </p>
              {mraReport.per_ticker?.length ? (
                mraReport.per_ticker.map((row) => (
                  <div
                    key={row.ticker}
                    className="overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-slate-950/90 to-violet-950/30"
                  >
                    <div className="border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
                      <span className="font-mono text-sm font-semibold text-fuchsia-200/95">
                        {row.ticker}
                      </span>
                    </div>
                    <div className="space-y-3 p-4 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Orientamento del soggetto
                        </p>
                        <p className="mt-1 leading-relaxed text-slate-300/95">
                          {row.orientamento_del_soggetto}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Operazioni suggerite (inverso MRA)
                        </p>
                        <p className="mt-1 leading-relaxed text-emerald-100/90">
                          {row.operazioni_suggerite}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Motivazione
                        </p>
                        <p className="mt-1 leading-relaxed text-slate-300/95">
                          {row.motivazione}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-500">
                  Nessun titolo con analisi per sezioni.
                </p>
              )}
            </div>

          </div>
        )}
      </section>

      <MraArchiveSection
        className="mt-10"
        headingId="mra-archive-heading"
        title="Le tue analisi salvate"
        description="Apri una voce per rivedere tutto. Puoi eliminare quelle che non servono."
        emptyHint="Ancora nulla qui. Dopo «Genera analisi», usa il pulsante Salva nell'archivio."
        items={archiveItems}
        loading={archiveLoading}
        error={archiveError}
        onDeleteArchive={deleteArchive}
        deletingId={archiveDeletingId}
      />
    </div>
  );
}
