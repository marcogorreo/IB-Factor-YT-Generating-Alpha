import { MraArchiveDetailClient } from "../../../components/MraArchiveDetailClient";
import { MraPageChrome } from "../../../components/MraPageChrome";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MraArchiveDetailPage({ params }: PageProps) {
  const { id: raw } = await params;
  const id = Number(raw);

  if (!raw || !Number.isInteger(id) || id < 1) {
    return (
      <MraPageChrome headerAside={<span className="text-xs text-slate-500">Archivio</span>}>
        <div className="mx-auto max-w-4xl px-4 py-12">
          <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            Questo indirizzo non corrisponde a un&apos;analisi salvata.
          </p>
        </div>
      </MraPageChrome>
    );
  }

  return (
    <MraPageChrome
      headerAside={<span className="text-xs text-slate-500">Dettaglio analisi</span>}
    >
      <MraArchiveDetailClient archiveId={id} />
    </MraPageChrome>
  );
}
