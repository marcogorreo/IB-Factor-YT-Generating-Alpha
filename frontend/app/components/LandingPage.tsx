import Image from "next/image";
import Link from "next/link";

import { DASHBOARD_PATH } from "../lib/routes";

export function LandingPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-14 sm:px-8 sm:py-20 lg:max-w-7xl lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 xl:gap-20">
        <div className="relative z-[1] min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/95">
            IB Factor
          </p>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12]">
            YouTube Alpha Generator
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            Trasforma i video del canale{" "}
            <span className="text-slate-100">Ingegneri in Borsa</span> in un flusso
            operativo: sincronizzi il{" "}
            <span className="font-medium text-cyan-200/90">Data Pool</span>, estrai
            i sottotitoli, avvii un&apos;analisi{" "}
            <abbr
              title="Market Reverse-Analysis"
              className="cursor-help underline decoration-amber-400/45 decoration-1 underline-offset-[5px]"
            >
              MRA
            </abbr>{" "}
            e ottieni un report strutturato con contesto di mercato, titoli citati e —
            per ogni ticker — il grafico (integrazione TradingView) affiancato a una
            sintesi di come il video{" "}
            <span className="text-slate-200">posiziona il soggetto</span> sul titolo.
          </p>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-[15px]">
Ricorda: Antonino si sbaglia sempre.
          </p>

          <ul className="mt-8 space-y-3 sm:space-y-4">
            <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm shadow-lg shadow-black/20">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/20 text-xs font-bold text-cyan-100"
                aria-hidden
              >
                1
              </span>
              <div>
                <p className="font-semibold text-cyan-200/95">Data Pool</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Elenco video aggiornabile dal canale: punto di partenza per
                  trascrivere e lanciare l&apos;analisi sul pezzo che ti interessa.
                </p>
              </div>
            </li>
            <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm shadow-lg shadow-black/20">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/35 to-fuchsia-500/25 text-xs font-bold text-violet-100"
                aria-hidden
              >
                2
              </span>
              <div>
                <p className="font-semibold text-violet-200/95">Archivio MRA</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Salva le analisi che vuoi tenere a portata di mano e riaprille quando
                  serve, con dettaglio per ticker e grafici.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={DASHBOARD_PATH}
              className="inline-flex h-14 min-w-[12.5rem] items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-violet-600 px-8 text-base font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Apri l&apos;app
            </Link>
            <p className="text-xs leading-relaxed text-slate-500 sm:max-w-xs">
              Nella dashboard sincronizzi il canale, esegui l&apos;MRA sul video
              scelto e, se vuoi, archivi il risultato.
            </p>
          </div>

          <p className="mt-8 border-l-2 border-amber-500/35 pl-4 text-[13px] leading-relaxed text-slate-500">
            I contenuti generati sono solo a scopo informativo e non costituiscono
            sollecitazione al pubblico risparmio, raccomandazione di investimento o
            consulenza in materia finanziaria.
          </p>
        </div>

        <div className="relative z-[1] min-w-0 lg:justify-self-end lg:pl-2">
          <div
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-600/25 via-fuchsia-500/15 to-cyan-500/20 blur-2xl sm:-inset-8"
            aria-hidden
          />
          <figure className="group relative overflow-hidden rounded-[1.35rem] border border-white/15 bg-slate-950/40 p-2 shadow-2xl shadow-violet-950/40 ring-1 ring-white/10 backdrop-blur-xl">
            <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
              <Image
                src="/landing/mra-dashboard-preview.png"
                alt="Esempio dall'app: schede ticker, grafico TradingView e riquadro «Orientamento del soggetto» da un'analisi MRA"
                width={1200}
                height={900}
                className="h-auto w-full object-cover object-top transition duration-500 group-hover:scale-[1.01]"
                sizes="(max-width: 1024px) 100vw, 42vw"
                priority
              />
            </div>
            <figcaption className="px-2 pb-1 pt-3 text-center text-xs leading-snug text-slate-500">
              Dal video al contesto operativo: ticker, prezzo e sintesi
              dell&apos;orientamento — così confronti la narrazione con il mercato.
            </figcaption>
          </figure>
        </div>
      </div>
    </main>
  );
}
