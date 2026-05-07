"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { DASHBOARD_PATH } from "../lib/routes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readApiJson } from "../lib/read-api-json";
import {
  parseMraInverseDetail,
  type ParsedInverseBlocks,
} from "../lib/parse-mra-inverse-detail";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import type { MraArchiveRow } from "./MraArchiveTable";
import { TradingViewChartEmbed } from "./TradingViewChartEmbed";

const API = "/api/backend";

/** Motivazione fissa MRA (Antonino), oltre alla motivazione testuale dall’analisi JSON. */
const MOTIVAZIONE_STATISTICA =
  "Antonino si sbaglia sempre";

/** Stesso separatore usato in salvataggio (MraFlowClient). */
const OP_BLOCK_SEP = /\n\n─+\n\n/;

export type ParsedInverseOp = {
  ticker: string;
  detail: string;
};

/** Spezza il testo archiviato in blocchi per ticker (prima riga = ticker). */
export function parseOperazioniInverseText(raw: string): ParsedInverseOp[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];

  const chunks = trimmed.split(OP_BLOCK_SEP).map((c) => c.trim()).filter(Boolean);
  return chunks.map((chunk, i) => {
    const nl = chunk.indexOf("\n");
    if (nl === -1) {
      return { ticker: chunk || `·${i + 1}`, detail: "" };
    }
    const ticker = chunk.slice(0, nl).trim() || `Ticker ${i + 1}`;
    const detail = chunk.slice(nl + 1).trim();
    return { ticker, detail };
  });
}

function formatSavedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-2.5 sm:px-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {children}
      </h2>
    </div>
  );
}

type PanelAccent = "slate" | "emerald" | "amber" | "fuchsia";

const ACCENT_WRAP: Record<
  PanelAccent,
  { section: string; header: string }
> = {
  slate: {
    section:
      "border-white/10 bg-white/[0.03] shadow-lg ring-1 ring-white/5",
    header: "bg-white/[0.04]",
  },
  emerald: {
    section:
      "border border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 via-slate-950/90 to-slate-950/80 shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-500/25",
    header:
      "border-b border-emerald-500/25 bg-gradient-to-r from-emerald-500/15 to-transparent",
  },
  amber: {
    section:
      "border border-amber-500/35 bg-gradient-to-br from-amber-950/45 via-slate-950/90 to-slate-950/80 shadow-xl shadow-amber-950/25 ring-1 ring-amber-500/20",
    header:
      "border-b border-amber-500/25 bg-gradient-to-r from-amber-500/15 to-transparent",
  },
  fuchsia: {
    section:
      "border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/40 via-slate-950/90 to-slate-950/80 shadow-xl shadow-fuchsia-950/25 ring-1 ring-fuchsia-500/20",
    header:
      "border-b border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-500/15 to-transparent",
  },
};

function ScrollPanel({
  title,
  children,
  className = "",
  accent = "slate",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  accent?: PanelAccent;
}) {
  const a = ACCENT_WRAP[accent];
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl backdrop-blur-sm ${a.section} ${className}`}
    >
      <div className={`shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-5 ${a.header}`}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
          {title}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/12">
        {children}
      </div>
    </section>
  );
}

function MotivazioneDualSelect({
  motivazioneGenerale,
}: {
  motivazioneGenerale: string;
}) {
  const [mode, setMode] = useState<"generale" | "statistica">("generale");
  const gen = motivazioneGenerale.trim();

  return (
    <section className="rounded-xl border-l-[5px] border-violet-400 bg-gradient-to-r from-violet-950/55 to-slate-950/40 px-4 py-4 shadow-inner ring-1 ring-violet-500/20">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">
          <span className="inline-block size-2 rounded-full bg-violet-400 shadow shadow-violet-400/50" />
          Motivazione
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Tipo di motivazione"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "generale"}
            onClick={() => setMode("generale")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
              mode === "generale"
                ? "border-violet-400/60 bg-violet-500/25 text-violet-50 shadow-md shadow-violet-950/40"
                : "border-white/12 bg-white/[0.06] text-slate-300 hover:border-white/20"
            }`}
          >
            Motivazione generale
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "statistica"}
            onClick={() => setMode("statistica")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
              mode === "statistica"
                ? "border-violet-400/60 bg-violet-500/25 text-violet-50 shadow-md shadow-violet-950/40"
                : "border-white/12 bg-white/[0.06] text-slate-300 hover:border-white/20"
            }`}
          >
            Motivazione statistica
          </button>
        </div>
      </div>
      <p
        className="whitespace-pre-wrap text-sm leading-relaxed text-violet-50/95"
        role="tabpanel"
      >
        {mode === "generale"
          ? gen || "—"
          : MOTIVAZIONE_STATISTICA}
      </p>
    </section>
  );
}

function InverseDetailBlocks({
  blocks,
  rawFallback,
}: {
  blocks: ParsedInverseBlocks;
  rawFallback: string;
}) {
  const hasAny =
    blocks.orientamento.trim() ||
    blocks.operazioni.trim() ||
    blocks.motivazione.trim();
  if (!hasAny) {
    return rawFallback.trim() ? (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200/95">
        {rawFallback}
      </p>
    ) : (
      <p className="text-slate-500">Nessun dettaglio testuale per questo ticker.</p>
    );
  }
  return (
    <div className="space-y-4">
      <section className="rounded-xl border-l-[5px] border-amber-400 bg-gradient-to-r from-amber-950/55 to-slate-950/40 px-4 py-4 shadow-inner ring-1 ring-amber-500/20">
        <p className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
          <span className="inline-block size-2 rounded-full bg-amber-400 shadow shadow-amber-400/50" />
          Orientamento del soggetto
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-50/95">
          {blocks.orientamento.trim() || "—"}
        </p>
      </section>
      <section className="rounded-xl border-l-[5px] border-emerald-400 bg-gradient-to-r from-emerald-950/55 to-slate-950/40 px-4 py-4 shadow-inner ring-1 ring-emerald-500/20">
        <p className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
          <span className="inline-block size-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />
          Operazioni suggerite (inverso MRA)
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-50/95">
          {blocks.operazioni.trim() || "—"}
        </p>
      </section>
      <MotivazioneDualSelect motivazioneGenerale={blocks.motivazione} />
    </div>
  );
}

const TRANSCRIPT_PREVIEW_LINES = 8;
const TRANSCRIPT_PREVIEW_MAX_CHARS = 1400;

function getTranscriptPreview(text: string): {
  preview: string;
  truncated: boolean;
} {
  const t = text?.trim() ? text : "";
  if (!t) return { preview: "", truncated: false };

  const lines = t.split(/\r?\n/);
  let truncated = lines.length > TRANSCRIPT_PREVIEW_LINES;
  let preview = truncated
    ? lines.slice(0, TRANSCRIPT_PREVIEW_LINES).join("\n")
    : t;

  if (preview.length > TRANSCRIPT_PREVIEW_MAX_CHARS) {
    preview = `${preview.slice(0, TRANSCRIPT_PREVIEW_MAX_CHARS)}…`;
    truncated = true;
  }

  return { preview, truncated };
}

function TranscriptPreviewCard({
  transcript,
}: {
  transcript: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { preview, truncated } = useMemo(
    () => getTranscriptPreview(transcript?.trim() ? transcript : ""),
    [transcript],
  );
  return (
    <>
      <section className="flex min-h-[10rem] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg backdrop-blur-sm lg:min-h-0">
        <PanelHeader>Trascrizione</PanelHeader>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-7">
          <p className="line-clamp-[8] whitespace-pre-wrap text-sm leading-relaxed text-slate-200/95 lg:text-[15px] lg:leading-[1.75]">
            {preview || "—"}
          </p>
          {truncated && transcript.trim() ? (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="shrink-0 self-start rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-md shadow-cyan-950/40 transition hover:border-cyan-400/50 hover:bg-cyan-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
              Espandi trascrizione
            </button>
          ) : null}
        </div>
      </section>

      <TranscriptFullDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        transcript={transcript}
      />
    </>
  );
}

function TranscriptFullDialog({
  open,
  onClose,
  transcript,
}: {
  open: boolean;
  onClose: () => void;
  transcript: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md sm:p-6 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transcript-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92dvh,940px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl ring-1 ring-white/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
          <h2
            id="transcript-dialog-title"
            className="text-base font-semibold tracking-tight text-white sm:text-lg"
          >
            Trascrizione completa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Chiudi
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 text-sm leading-[1.75] text-slate-200/95 sm:px-7 sm:text-[15px] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15"
          tabIndex={0}
        >
          <p className="whitespace-pre-wrap">{transcript || "—"}</p>
        </div>
      </div>
    </div>
  );
}

function OperazioniInverseInteractive({
  raw,
}: {
  raw: string;
}) {
  const ops = useMemo(() => parseOperazioniInverseText(raw), [raw]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [raw]);

  useEffect(() => {
    if (ops.length === 0) return;
    if (active >= ops.length) setActive(0);
  }, [active, ops.length]);

  if (ops.length === 0) {
    return (
      <section className="flex h-full min-h-[12rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg backdrop-blur-sm">
        <PanelHeader>Operazioni inverse</PanelHeader>
        <p className="px-5 py-6 text-sm text-slate-500">—</p>
      </section>
    );
  }

  const current = ops[active] ?? ops[0];
  const blocks = useMemo(
    () => parseMraInverseDetail(current.detail ?? ""),
    [current.detail],
  );

  return (
    <section className="flex h-full min-h-[12rem] flex-col overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/25 to-slate-950/80 shadow-xl backdrop-blur-sm lg:min-h-0">
      <PanelHeader>Operazioni inverse</PanelHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Seleziona operazione per ticker"
        >
          {ops.map((op, i) => {
            const selected = i === active;
            return (
              <button
                key={`${op.ticker}-${i}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="op-inverse-panel"
                id={`op-tab-${i}`}
                onClick={() => setActive(i)}
                className={`rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  selected
                    ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-50 shadow-md shadow-cyan-950/50"
                    : "border-white/12 bg-white/[0.05] text-slate-300 hover:border-white/25 hover:bg-white/[0.08]"
                }`}
              >
                {op.ticker}
              </button>
            );
          })}
        </div>

        <div
          id="op-inverse-panel"
          role="tabpanel"
          aria-labelledby={`op-tab-${active}`}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/12"
        >
          <article className="space-y-4 rounded-xl border border-white/12 bg-slate-950/50 p-4 shadow-inner ring-1 ring-white/5 sm:p-5">
            <div className="border-b border-white/10 pb-4">
              <h3 className="font-mono text-base font-bold tracking-wide text-fuchsia-200">
                {current.ticker}
              </h3>
            </div>

            <TradingViewChartEmbed
              key={`tv-${active}`}
              ticker={current.ticker}
              height={520}
            />

            <InverseDetailBlocks
              key={`detail-${active}`}
              blocks={blocks}
              rawFallback={current.detail ?? ""}
            />
          </article>
        </div>
      </div>
    </section>
  );
}

export function MraArchiveDetailClient({ archiveId }: { archiveId: number }) {
  const router = useRouter();
  const [row, setRow] = useState<MraArchiveRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${API}/insights/mra/archive/${encodeURIComponent(String(archiveId))}`,
        { cache: "no-store" },
      );
      const data = await readApiJson<{
        ok?: boolean;
        item?: MraArchiveRow;
        message?: string;
      }>(res);
      if (res.status === 404 || !data.item) {
        throw new Error(data.message ?? "Analisi non trovata o rimossa.");
      }
      if (!res.ok || !data.ok || !data.item) {
        throw new Error(data.message ?? "Impossibile caricare l'analisi.");
      }
      setRow({
        ...data.item,
        id: Number(data.item.id),
      });
    } catch (e: unknown) {
      setRow(null);
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [archiveId]);

  useEffect(() => {
    void load();
  }, [load]);

  const titoliBadges = useMemo(() => {
    if (!row?.titoli_coinvolti?.trim()) return [];
    return row.titoli_coinvolti
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [row?.titoli_coinvolti]);

  const previsioniBlocks = useMemo(() => {
    const raw = row?.previsioni_opinioni?.trim();
    if (!raw) return [];
    return raw
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [row?.previsioni_opinioni]);

  const performDeleteArchive = useCallback(async () => {
    if (!row) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${API}/insights/mra/archive/${encodeURIComponent(String(row.id))}`,
        { method: "DELETE" },
      );
      const data = await readApiJson<{ ok?: boolean; message?: string }>(res);
      if (!res.ok || !data.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Eliminazione non riuscita.",
        );
      }
      router.push(DASHBOARD_PATH);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Eliminazione non riuscita.";
      setDeleteError(msg);
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      setDeleteBusy(false);
    }
  }, [row, router]);

  if (loading) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-4 py-16 lg:px-10">
        <p className="flex items-center gap-3 text-sm text-slate-400">
          <span
            className="size-5 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400"
            aria-hidden
          />
          Caricamento analisi…
        </p>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col px-4 py-12 sm:px-8 lg:px-12">
        <p
          className="rounded-xl border border-rose-500/35 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error ?? "Dati non disponibili."}
        </p>
        <Link
          href={DASHBOARD_PATH}
          className="mt-6 inline-flex text-sm font-medium text-cyan-400/90 hover:text-cyan-300"
        >
          ← Torna all&apos;app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full max-w-none flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6 xl:px-14">
      <nav className="mb-3 flex shrink-0 flex-wrap items-center gap-3 sm:mb-4">
        <Link
          href={DASHBOARD_PATH}
          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400/90 transition hover:text-cyan-300"
        >
          ← Torna all&apos;app
        </Link>
        <span className="text-slate-600" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setDeleteDialogOpen(true);
          }}
          disabled={deleteBusy}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/35 px-3 py-1.5 text-sm font-medium text-rose-100 transition hover:border-rose-400/55 hover:bg-rose-900/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteBusy ? "Eliminazione…" : "Elimina dall'archivio"}
        </button>
        <span className="text-slate-600" aria-hidden>
          ·
        </span>
        <span className="text-xs text-slate-500">
          Altre analisi: tab «Market Reverse-Analysis» nell&apos;app.
        </span>
      </nav>

      <header className="mb-4 shrink-0 space-y-3 sm:mb-5 lg:mb-6 xl:space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-400/90">
          Analisi salvata
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl xl:pr-8">
          {row.video_title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 lg:text-sm">
          <span className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 font-mono text-slate-300">
            #{row.id}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Salvata · {formatSavedAt(row.created_at)}
          </span>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 font-mono text-cyan-100/85">
            {row.video_id}
          </span>
        </div>
        {titoliBadges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Titoli coinvolti
            </span>
            {titoliBadges.map((t) => (
              <span
                key={t}
                className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-cyan-100/90"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {/* Due colonne 50% | 50%: sinistra = Contesto, Previsioni, Trascrizione (anteprima) */}
      <div className="flex min-h-[50vh] flex-1 flex-col gap-4 sm:min-h-[55vh] lg:min-h-0 lg:flex-row lg:gap-5 lg:overflow-hidden xl:gap-6 2xl:gap-8">
        <div className="flex min-h-[min(60vh,32rem)] w-full flex-1 flex-col gap-4 lg:min-h-0 lg:w-1/2 lg:min-w-0">
          <ScrollPanel
            title="Contesto generale"
            accent="emerald"
            className="min-h-0 flex-1 basis-0"
          >
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-emerald-50/95 lg:text-[15px] lg:leading-relaxed">
              {row.contesto_generale}
            </p>
          </ScrollPanel>
          <ScrollPanel
            title="Previsioni dal video"
            accent="amber"
            className="min-h-0 flex-1 basis-0"
          >
            {previsioniBlocks.length > 0 ? (
              <ol className="space-y-3">
                {previsioniBlocks.map((block, i) => (
                  <li
                    key={i}
                    className="relative rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-950/60 to-slate-950/40 px-4 py-3.5 pl-11 shadow-inner ring-1 ring-amber-500/15"
                  >
                    <span
                      className="absolute left-3 top-3 flex size-6 items-center justify-center rounded-lg bg-amber-500/40 font-mono text-[11px] font-black text-amber-50"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-amber-50/95 lg:text-[15px]">
                      {block.replace(/^\d+\.\s*/, "").trim()}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-amber-200/50">—</p>
            )}
          </ScrollPanel>
          <TranscriptPreviewCard transcript={row.transcript} />
        </div>

        <div className="flex min-h-[min(72vh,48rem)] w-full flex-1 flex-col lg:min-h-0 lg:w-1/2 lg:min-w-0">
          <OperazioniInverseInteractive raw={row.operazioni_inverse} />
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteDialogOpen(false);
            setDeleteError(null);
          }
        }}
        title="Eliminare questa analisi?"
        description="Non potrai più aprirla da qui. Tornerai alla home."
        itemTitle={row.video_title}
        itemMeta={`#${row.id} · ${row.video_id}`}
        error={deleteError}
        isBusy={deleteBusy}
        onConfirm={performDeleteArchive}
      />
    </div>
  );
}
