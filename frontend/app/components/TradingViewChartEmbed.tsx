"use client";

import { useEffect, useMemo, useState } from "react";

import {
  shouldResolveTradingViewSymbol,
  toTradingViewSymbol,
} from "../lib/tradingview-symbol";

/**
 * Grafico TradingView tramite widget embed ufficiale (iframe).
 * Documentazione: https://www.tradingview.com/widget-docs/widgets/charts/charts/
 */
type Props = {
  ticker: string;
  /** Altezza pixel area grafico */
  height?: number;
  className?: string;
};

type ResolvePayload = {
  symbol?: string;
  source?: "mic" | "search" | "fallback" | "index_alias";
};

export function TradingViewChartEmbed({
  ticker,
  height = 320,
  className = "",
}: Props) {
  const syncSymbol = useMemo(
    () => toTradingViewSymbol(ticker),
    [ticker],
  );

  const [tvSymbol, setTvSymbol] = useState<string | null>(
    shouldResolveTradingViewSymbol(ticker) ? null : syncSymbol,
  );

  useEffect(() => {
    if (!shouldResolveTradingViewSymbol(ticker)) {
      setTvSymbol(syncSymbol);
      return;
    }

    const ac = new AbortController();
    setTvSymbol(null);

    (async () => {
      try {
        const r = await fetch(
          `/api/tradingview/resolve?q=${encodeURIComponent(ticker)}`,
          { signal: ac.signal },
        );
        if (ac.signal.aborted) return;
        const j = (await r.json()) as ResolvePayload;
        if (ac.signal.aborted) return;
        if (j?.symbol) {
          setTvSymbol(j.symbol);
          return;
        }
      } catch {
        if (ac.signal.aborted) return;
        /* fallback sotto */
      }
      if (!ac.signal.aborted) setTvSymbol(syncSymbol);
    })();

    return () => ac.abort();
  }, [ticker, syncSymbol]);

  const src = useMemo(() => {
    const sym = tvSymbol ?? syncSymbol;
    const p = new URLSearchParams({
      symbol: sym,
      interval: "D",
      symboledit: "1",
      saveimage: "0",
      studies: "[]",
      theme: "dark",
      style: "1",
      timezone: "Europe/Rome",
      withdateranges: "1",
      hidevolume: "0",
      locale: "it",
    });
    return `https://www.tradingview.com/widgetembed/?${p.toString()}`;
  }, [tvSymbol, syncSymbol]);

  const displaySym = tvSymbol ?? syncSymbol;

  if (tvSymbol === null) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div
          className="flex items-center justify-center rounded-xl border border-white/10 bg-slate-950/80 text-sm text-slate-400 shadow-inner ring-1 ring-white/5"
          style={{ height }}
        >
          Caricamento grafico…
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 shadow-inner ring-1 ring-white/5"
        style={{ height }}
      >
        <iframe
          key={src}
          title={`Grafico TradingView ${displaySym}`}
          src={src}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="clipboard-write"
        />
      </div>
      <p className="text-[10px] text-slate-500">
        <span className="font-mono text-slate-400">{displaySym}</span>
        {" · "}
        Grafico{" "}
        <a
          href="https://it.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-500/80 underline decoration-white/15 underline-offset-2 hover:text-cyan-400"
        >
          TradingView
        </a>
        . Se il titolo non è quello giusto, regola il simbolo nella barra sopra il grafico.
      </p>
    </div>
  );
}
