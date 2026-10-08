import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Satellite } from "lucide-react";
import { getNahuelbutaScenes } from "@/lib/nahuelbuta/satellite.functions";
import { NAHUELBUTA, PANOS_ARCILLAS } from "./data/nahuelbuta";

const fmt = (n: number) => n.toLocaleString("es-CL");

export function NahuelbutaSatellitePanel() {
  const fn = useServerFn(getNahuelbutaScenes);
  const [maxCloud, setMaxCloud] = useState(25);
  const { data, isLoading } = useQuery({
    queryKey: ["nahuelbuta-scenes", maxCloud],
    queryFn: () => fn({ data: { monthsBack: 12, maxCloud } }),
    staleTime: 10 * 60_000,
  });
  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand flex items-center gap-2">
          <Satellite className="w-3.5 h-3.5" /> Análisis satelital · arcillas
        </div>
        <h2 className="font-display text-2xl mt-1 text-content">Sentinel-2 sobre los paños Arcillas</h2>
        <p className="text-sm text-content-subtle mt-1 max-w-3xl">
          Escenas reales del catálogo público Sentinel-2 L2A sobre el área de los 34 paños. El informe
          técnico describe anomalías de minerales de arcilla (índice CMI, Landsat-9) en zonas de 800 a
          1.200 ha. Es interpretación remota: indica arcillas, no mide tierras raras.
        </p>
      </header>
      <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-hairline bg-surface-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">Nubosidad máxima</span>
        {[10, 25, 60].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setMaxCloud(c)}
            className={`px-3 py-1 rounded-full text-[11px] font-mono border ${
              maxCloud === c ? "bg-accent-brand text-white border-accent-brand" : "border-hairline text-content-subtle"
            }`}
          >
            ≤ {c}%
          </button>
        ))}
        <span className="ml-auto text-[11px] font-mono text-content-subtle">
          {isLoading ? "Consultando…" : `${data?.scenes.length ?? 0} escenas · 12 meses`}
        </span>
      </div>
      <div className="px-6 py-4">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-accent-brand" />
        ) : data && !data.ok ? (
          <p className="text-sm text-content-subtle">No se pudo consultar el catálogo satelital ahora. Intenta más tarde.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="text-content-subtle font-mono uppercase text-[10px]">
              <tr><th className="text-left py-1">Fecha</th><th className="text-left">Sensor</th><th className="text-right">Nubes</th></tr>
            </thead>
            <tbody>
              {data?.scenes.slice(0, 10).map((s) => (
                <tr key={s.id} className="border-t border-hairline">
                  <td className="py-1.5 font-mono">{s.datetime.slice(0, 10)}</td>
                  <td>{s.platform ?? "Sentinel-2"}</td>
                  <td className="text-right font-mono">{s.cloudPct != null ? `${s.cloudPct.toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export function NahuelbutaTenurePanel() {
  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">Pertenencias · solicitud</div>
        <h2 className="font-display text-2xl mt-1 text-content">
          {NAHUELBUTA.panos} paños Arcillas · {fmt(NAHUELBUTA.haPanos)} ha
        </h2>
        <p className="text-sm text-content-subtle mt-1">
          Propuesta preliminar en {NAHUELBUTA.datumEscrito}, {NAHUELBUTA.haPorPano} ha por paño. Puntos
          medios y tribunal competente para el escrito. Estado: en trámite, no constituidas.
        </p>
      </header>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-surface-2 text-content-subtle font-mono uppercase text-[10px]">
            <tr>
              <th className="text-left px-4 py-2">Paño</th><th className="text-right">PM Norte</th><th className="text-right">PM Este</th>
              <th className="text-left pl-4">Comuna</th><th className="text-left">Tribunal</th>
            </tr>
          </thead>
          <tbody>
            {PANOS_ARCILLAS.map((p) => (
              <tr key={p.n} className="border-t border-hairline">
                <td className="px-4 py-1.5">Arcillas {p.n}</td>
                <td className="text-right font-mono">{fmt(p.pmNorte)}</td>
                <td className="text-right font-mono">{fmt(p.pmEste)}</td>
                <td className="pl-4">{p.comuna}</td>
                <td className="text-content-subtle">{p.tribunal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function NahuelbutaThesisPanel() {
  return (
    <section className="border border-hairline bg-white rounded-2xl p-6 grid md:grid-cols-2 gap-8">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">Geología · informe {NAHUELBUTA.reportRef}</div>
        <ul className="mt-3 space-y-2 text-[13px]">
          {NAHUELBUTA.geology.map((g) => <li key={g}>· {g}</li>)}
        </ul>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">Brechas antes de invertir</div>
        <ul className="mt-3 space-y-2 text-[13px] text-content-subtle">
          {NAHUELBUTA.gaps.map((g) => <li key={g}>· {g}</li>)}
        </ul>
      </div>
    </section>
  );
}
