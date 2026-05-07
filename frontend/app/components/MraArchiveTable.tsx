"use client";

import Link from "next/link";
import { readApiJson } from "../lib/read-api-json";
import { useCallback, useEffect, useState } from "react";

import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const API = "/api/backend";

/** Record completo da DB / dettaglio. */
export type MraArchiveRow = {
  id: number;
  video_id: string;
  video_title: string;
  transcript: string;
  contesto_generale: string;
  previsioni_opinioni: string;
  titoli_coinvolti: string;
  operazioni_inverse: string;
  created_at: string;
};

/** Voce elenco (campi brevi + anteprime). */
export type MraArchiveSummary = {
  id: number;
  video_id: string;
  video_title: string;
  created_at: string;
  contesto_preview: string;
  titoli_preview: string;
  previsioni_preview: string;
};

function archiveCreatedLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useMraArchive() {
  const [items, setItems] = useState<MraArchiveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/insights/mra/archive`, {
        cache: "no-store",
      });
      const data = await readApiJson<{
        ok?: boolean;
        items?: MraArchiveSummary[];
        message?: string;
      }>(res);
      if (!res.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "Impossibile caricare l'archivio.");
      }
      setItems(
        data.items.map((r) => ({
          ...r,
          id: Number(r.id),
        })),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore archivio");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteArchive = useCallback(
    async (id: number) => {
      setDeletingId(id);
      setError(null);
      try {
        const res = await fetch(`${API}/insights/mra/archive/${id}`, {
          method: "DELETE",
        });
        const data = await readApiJson<{
          ok?: boolean;
          message?: string;
        }>(res);
        if (!res.ok || !data.ok) {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Eliminazione non riuscita.",
          );
        }
        await reload();
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Eliminazione non riuscita.";
        setError(msg);
        throw e instanceof Error ? e : new Error(msg);
      } finally {
        setDeletingId(null);
      }
    },
    [reload],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload, deleteArchive, deletingId };
}

export type MraArchiveSectionProps = {
  headingId: string;
  title: string;
  description: string;
  emptyHint: string;
  items: MraArchiveSummary[];
  loading: boolean;
  error: string | null;
  className?: string;
  contentClassName?: string;
  /** Se valorizzati, ogni scheda mostra «Elimina» con conferma. */
  onDeleteArchive?: (id: number) => void | Promise<void>;
  deletingId?: number | null;
};

export function MraArchiveSection({
  headingId,
  title,
  description,
  emptyHint,
  items,
  loading,
  error,
  className = "",
  contentClassName = "",
  onDeleteArchive,
  deletingId = null,
}: MraArchiveSectionProps) {
  const [deleteTarget, setDeleteTarget] =
    useState<MraArchiveSummary | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-xl backdrop-blur-sm ${className}`}
      aria-labelledby={headingId}
    >
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <h3
          id={headingId}
          className="text-sm font-semibold uppercase tracking-wider text-slate-300"
        >
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <div className={`p-4 sm:p-5 ${contentClassName}`}>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <span
              className="size-4 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400"
              aria-hidden
            />
            Caricamento…
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyHint}</p>
        ) : null}
        {items.length > 0 ? (
          <ul className="space-y-4">
            {items.map((row) => (
              <li key={row.id}>
                <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-slate-950/50 to-slate-950/90 p-5 shadow-lg shadow-black/30 transition duration-200 hover:border-cyan-500/30 hover:shadow-cyan-950/20 sm:p-6">
                  <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl transition-opacity group-hover:opacity-80" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <span className="text-fuchsia-300/80">#{row.id}</span>
                        <span aria-hidden className="text-slate-600">
                          ·
                        </span>
                        <time dateTime={row.created_at}>
                          {archiveCreatedLabel(row.created_at) ?? row.created_at}
                        </time>
                      </div>
                      <h4 className="text-lg font-semibold leading-snug text-white sm:text-xl">
                        {row.video_title}
                      </h4>
                      <p className="font-mono text-[11px] text-slate-500">
                        {row.video_id}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {onDeleteArchive ? (
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={() => {
                            setDialogError(null);
                            setDeleteTarget(row);
                          }}
                          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === row.id ? "Eliminazione…" : "Elimina"}
                        </button>
                      ) : null}
                      <Link
                        href={`/mra/archive/${row.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-md shadow-cyan-950/40 transition hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                      >
                        Apri analisi
                        <svg
                          className="size-4 transition-transform group-hover:translate-x-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                  <div className="relative mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Contesto (anteprima)
                      </p>
                      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-400">
                        {row.contesto_preview.trim() || "—"}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Previsioni (anteprima)
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {row.previsioni_preview.trim() || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Titoli (anteprima)
                        </p>
                        <p className="mt-1 line-clamp-2 font-mono text-xs text-cyan-100/75">
                          {row.titoli_preview.trim() || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {onDeleteArchive ? (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onClose={() => {
            setDeleteTarget(null);
            setDialogError(null);
          }}
          title="Eliminare questa analisi?"
          description="Non potrai più recuperarla dall’archivio."
          itemTitle={deleteTarget?.video_title ?? null}
          itemMeta={
            deleteTarget
              ? `#${deleteTarget.id} · ${deleteTarget.video_id}`
              : null
          }
          error={dialogError}
          isBusy={
            deleteTarget != null && deletingId === deleteTarget.id
          }
          onConfirm={async () => {
            if (!deleteTarget || !onDeleteArchive) return;
            setDialogError(null);
            try {
              await onDeleteArchive(deleteTarget.id);
            } catch (e: unknown) {
              setDialogError(
                e instanceof Error
                  ? e.message
                  : "Eliminazione non riuscita.",
              );
              throw e;
            }
          }}
        />
      ) : null}
    </section>
  );
}
