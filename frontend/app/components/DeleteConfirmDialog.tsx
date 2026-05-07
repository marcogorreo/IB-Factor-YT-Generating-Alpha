"use client";

import { useEffect, useId, useRef } from "react";

export type DeleteConfirmDialogProps = {
  open: boolean;
  /** Intestazione principale (es. «Eliminare questa analisi?»). */
  title: string;
  /** Testo esplicativo sotto il titolo. */
  description?: string;
  /** Titolo dell’elemento (es. nome video). */
  itemTitle?: string | null;
  /** Riga secondaria (es. #id · video_id). */
  itemMeta?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  /** Errore ultimo tentativo (sotto il testo, sopra i pulsanti). */
  error?: string | null;
  onClose: () => void;
  /** In caso di errore, può lanciare: il dialog resta aperto. */
  onConfirm: () => void | Promise<void>;
};

const btnBase =
  "inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function DeleteConfirmDialog({
  open,
  title,
  description,
  itemTitle,
  itemMeta,
  confirmLabel = "Elimina",
  cancelLabel = "Annulla",
  isBusy = false,
  error = null,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onDialogClose = () => {
      onClose();
    };
    d.addEventListener("close", onDialogClose);
    return () => d.removeEventListener("close", onDialogClose);
  }, [onClose]);

  const handleConfirm = async () => {
    try {
      await onConfirm();
      ref.current?.close();
    } catch {
      /* errore: parent mostra messaggio; dialog resta aperto */
    }
  };

  return (
    <dialog
      ref={ref}
      className="app-dialog fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-4 shadow-none open:flex open:items-center open:justify-center"
      aria-labelledby={titleId}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-rose-500/25 p-px shadow-2xl shadow-rose-950/50"
        style={{
          background:
            "linear-gradient(135deg, rgba(244,63,94,0.45), rgba(190,18,60,0.35), rgba(15,23,42,0.9))",
        }}
      >
        <div className="relative rounded-[calc(1.5rem-1px)] bg-slate-950/96 px-6 py-8 backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(244,63,94,0.2), transparent 55%)",
            }}
            aria-hidden
          />

          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-400/90">
              Eliminazione
            </p>
            <h2
              id={titleId}
              className="mt-3 text-xl font-semibold tracking-tight text-white"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {description}
              </p>
            ) : null}

            {(itemTitle || itemMeta) && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                {itemTitle ? (
                  <p className="text-sm leading-snug text-slate-200 line-clamp-3">
                    {itemTitle}
                  </p>
                ) : null}
                {itemMeta ? (
                  <p className="mt-2 font-mono text-[11px] text-slate-500">
                    {itemMeta}
                  </p>
                ) : null}
              </div>
            )}

            {error ? (
              <p
                className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/50 px-3 py-2 text-sm leading-relaxed text-rose-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleConfirm()}
                className={`${btnBase} border border-rose-500/50 bg-gradient-to-r from-rose-600 to-rose-700 px-5 text-white shadow-lg shadow-rose-950/40 hover:brightness-110 focus-visible:outline-rose-400 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isBusy ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                    Eliminazione…
                  </span>
                ) : (
                  confirmLabel
                )}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  const d = ref.current;
                  if (d?.open) d.close();
                }}
                className={`${btnBase} border border-white/15 bg-white/5 px-5 font-medium text-slate-300 hover:border-white/25 hover:bg-white/10 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
