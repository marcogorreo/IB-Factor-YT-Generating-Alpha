"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  videoTitle: string | null;
  videoId: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function MraConfirmDialog({
  open,
  videoTitle,
  videoId,
  onClose,
  onConfirm,
}: Props) {
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

  const handleConfirm = () => {
    onConfirm();
    ref.current?.close();
  };

  const btnBase =
    "inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <dialog
      ref={ref}
      className="app-dialog fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-4 shadow-none open:flex open:items-center open:justify-center"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 p-px shadow-2xl shadow-violet-500/20"
        style={{
          background:
            "linear-gradient(135deg, rgba(34,211,238,0.5), rgba(139,92,246,0.45), rgba(16,185,129,0.4))",
        }}
      >
        <div className="relative rounded-[calc(1.5rem-1px)] bg-slate-950/96 px-6 py-8 backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(34,211,238,0.28), transparent 55%), radial-gradient(ellipse 65% 45% at 100% 105%, rgba(139,92,246,0.22), transparent 52%)",
            }}
            aria-hidden
          />

          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/90">
              Market Reverse-Analysis (MRA)
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
              Confermi l&apos;avvio?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Stai per avviare una MRA sul video selezionato. Il motore di
              analisi sarà disponibile nelle prossime versioni.
            </p>
            {videoTitle && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Video
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-slate-200">
                  {videoTitle}
                </p>
                {videoId && (
                  <p className="mt-2 font-mono text-[11px] text-slate-500">
                    {videoId}
                  </p>
                )}
              </div>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                onClick={handleConfirm}
                className={`${btnBase} min-w-[160px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-5 text-white shadow-lg shadow-violet-500/30 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-xl hover:shadow-fuchsia-500/35 hover:brightness-110 active:scale-[0.98] focus-visible:outline-cyan-400`}
              >
                Conferma avvio MRA
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = ref.current;
                  if (d?.open) d.close();
                }}
                className={`${btnBase} border border-white/15 bg-white/5 px-5 font-medium text-slate-300 hover:-translate-y-px hover:scale-[1.01] hover:border-white/28 hover:bg-white/12 active:scale-[0.99] focus-visible:outline-slate-500`}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
