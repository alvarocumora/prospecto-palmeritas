import { Download, ExternalLink, MapPin, Loader2 } from "lucide-react";
import { CHOLQUI, LAS_MINITAS } from "../data/cholqui";

type Props = { onDownload: () => void; downloading: boolean };

export function CholquiHero({ onDownload, downloading }: Props) {
  const kpis: Array<[string, string]> = [
    ["Superficie", `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`],
    ["Propiedad", `${CHOLQUI.pedimentos} pedimentos · ${CHOLQUI.pertenencias} pertenencias`],
    ["Commodity", CHOLQUI.commodity],
    ["Vecino en producción", `${LAS_MINITAS.throughputTMonth.toLocaleString("es-CL")} t/mes`],
  ];

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <div className="bg-surface-inverse px-6 md:px-10 py-10">
        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent-brand-subtle">
          Geocapitals · Live map público · {CHOLQUI.code}
        </div>
        <h1 className="font-display text-4xl md:text-5xl mt-3 text-white">{CHOLQUI.name}</h1>
        <p className="mt-3 text-sm text-white/70 max-w-3xl">
          {CHOLQUI.commodity} · {CHOLQUI.stage} · Titular {CHOLQUI.operator}
        </p>
        <p className="mt-1 text-sm text-white/60 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" />
          {CHOLQUI.location}
        </p>
        <p className="mt-1 text-[12px] font-mono text-white/45">
          {CHOLQUI.center.lat}, {CHOLQUI.center.lng} · {CHOLQUI.crs}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent-brand text-accent-brand-contrast text-sm font-medium disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Descargar PDF de inversión
          </button>
          <a
            href={`mailto:${CHOLQUI.contact.email}?subject=${encodeURIComponent(`${CHOLQUI.name} — interés de inversión`)}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/25 text-white text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Contactar mesa de inversión
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-t border-hairline bg-surface-2">
        {kpis.map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              {k}
            </div>
            <div className="mt-1 text-sm font-medium text-content">{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
