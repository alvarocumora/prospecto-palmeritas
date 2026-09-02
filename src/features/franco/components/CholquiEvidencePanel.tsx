import {
  CHOLQUI_CAVEATS,
  CHOLQUI_FACTS,
  CHOLQUI_GEOLOGY,
  CHOLQUI_POINTS,
  LAS_MINITAS,
  type Procedencia,
} from "../data/cholqui";

const TONE: Record<Procedencia, string> = {
  Certificado: "bg-brand-success/12 text-brand-success border-brand-success/30",
  Declarado: "bg-accent-brand-subtle text-accent-brand border-accent-brand/30",
  "A verificar": "bg-brand-warn/12 text-brand-warn border-brand-warn/30",
};

export function CholquiEvidencePanel() {
  return (
    <div className="space-y-6">
      <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
        <header className="px-6 py-5 border-b border-hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
            Evidencia geológica
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">Qué hay en el terreno</h2>
          <p className="text-sm text-content-subtle mt-1">
            {CHOLQUI_GEOLOGY.observaciones} observaciones de terreno · {CHOLQUI_GEOLOGY.cuerpos}{" "}
            cuerpos mineralizados descritos · {CHOLQUI_GEOLOGY.muestrasLab} muestras a laboratorio
            certificado. Autores: {CHOLQUI_GEOLOGY.autores}.
          </p>
        </header>
        <dl className="px-6 py-5 grid md:grid-cols-2 gap-x-8">
          {(
            [
              ["Litología", CHOLQUI_GEOLOGY.litologia],
              ["Estilo de mineralización", CHOLQUI_GEOLOGY.estilo],
              ["Mineralogía observada", CHOLQUI_GEOLOGY.mineralogia],
              ["Faena vecina", `${LAS_MINITAS.name} · ${LAS_MINITAS.holder}`],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <div key={k} className="py-2 border-b border-hairline">
              <dt className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                {k}
              </dt>
              <dd className="text-sm text-content mt-1">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
        <header className="px-6 py-5 border-b border-hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
            Puntos de terreno
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">
            Observación y muestreo georreferenciado
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              <tr>
                <th className="text-left px-6 py-3">Punto</th>
                <th className="text-left px-4 py-3">Sector</th>
                <th className="text-right px-4 py-3">Este (PSAD'56)</th>
                <th className="text-right px-4 py-3">Norte</th>
                <th className="text-right px-6 py-3">WGS84</th>
              </tr>
            </thead>
            <tbody>
              {CHOLQUI_POINTS.map((p) => (
                <tr key={p.code} className="border-t border-hairline">
                  <td className="px-6 py-2.5 font-mono text-xs text-accent-brand">{p.code}</td>
                  <td className="px-4 py-2.5 text-content">{p.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-content-muted">
                    {p.utmE.toLocaleString("es-CL")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-content-muted">
                    {p.utmN.toLocaleString("es-CL")}
                  </td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-content-muted">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
        <header className="px-6 py-5 border-b border-hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
            Procedencia del dato
          </div>
          <h2 className="font-display text-2xl mt-1 text-content">
            Hecho, declarado y por verificar
          </h2>
        </header>
        <ul className="divide-y divide-hairline">
          {CHOLQUI_FACTS.map((f) => (
            <li key={`${f.section}-${f.label}`} className="px-6 py-3 flex flex-wrap gap-3">
              <div className="min-w-[190px]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                  {f.section}
                </div>
                <div className="text-sm text-content">{f.label}</div>
              </div>
              <div className="flex-1 min-w-[200px] text-sm text-content-muted">{f.value}</div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-wider ${TONE[f.provenance]}`}
                >
                  {f.provenance}
                </span>
                <span className="text-[11px] text-content-subtle">{f.source}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-hairline bg-surface-2 rounded-2xl px-6 py-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-brand-warn">
          Advertencias obligatorias
        </div>
        <ul className="mt-3 space-y-2">
          {CHOLQUI_CAVEATS.map((c) => (
            <li key={c} className="text-xs text-content-muted flex gap-2">
              <span className="text-brand-warn">—</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
