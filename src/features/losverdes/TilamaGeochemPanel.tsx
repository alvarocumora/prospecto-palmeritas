import { useMemo } from "react";
import {
  TILAMA_SAMPLES,
  TILAMA_SOURCE,
  cuThresholdCounts,
  median,
  qaFlags,
  topBy,
} from "@/lib/tilama/geochem";

const fmt = (v: number | null, d = 0) =>
  v == null ? "—" : v.toLocaleString("es-CL", { maximumFractionDigits: d });

export function TilamaGeochemPanel() {
  const stats = useMemo(() => {
    const cu = TILAMA_SAMPLES.map((s) => s.Cu_ppm ?? NaN);
    return {
      thresholds: cuThresholdCounts(),
      medianCu: median(cu),
      topCu: topBy("Cu_ppm", 10),
      topMo: topBy("Mo_ppm", 5),
      flagged: TILAMA_SAMPLES.filter((s) => qaFlags(s).some((f) => f.startsWith("RE-"))),
    };
  }, []);

  return (
    <section className="rounded-lg border border-hairline bg-surface p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-content-subtle">
            Geoquímica de superficie · MEDIDO (ensayes puntuales)
          </p>
          <h3 className="font-serif text-xl text-content">Tilama — 190 muestras CORE</h3>
        </div>
        <p className="text-xs text-content-subtle">Mediana Cu: {fmt(stats.medianCu)} ppm</p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.thresholds.map((t) => (
          <div key={t.threshold} className="rounded border border-hairline p-3">
            <p className="text-xs text-content-subtle">Muestras ≥ {fmt(t.threshold, 1)} % Cu</p>
            <p className="font-serif text-2xl text-content">{t.count}</p>
          </div>
        ))}
      </div>

      {stats.flagged.length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded border border-accent-brand/40 bg-accent-brand/5 p-3 text-sm text-content"
        >
          <strong>QA/QC:</strong>{" "}
          {stats.flagged
            .map((s) => `${s.Muestra} (${fmt((s.Cu_ppm ?? 0) / 10_000, 2)} % Cu)`)
            .join(", ")}{" "}
          supera 5 % Cu: re-ensayar y validar tipo de muestra antes de interpretar. Fe sin unidad
          verificada; Au (ppb) no se mezcla con campañas históricas.
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs font-medium text-content">Top 10 Cu</p>
          <table className="w-full text-xs">
            <thead className="text-content-subtle">
              <tr className="text-left">
                <th className="py-1">Muestra</th>
                <th className="text-right">Cu %</th>
                <th className="text-right">Mo ppm</th>
                <th className="text-right">Ag g/t</th>
                <th className="text-right">As ppm</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCu.map((s) => (
                <tr key={s.Muestra} className="border-t border-hairline">
                  <td className="py-1">{s.Muestra}</td>
                  <td className="text-right tabular-nums">{fmt((s.Cu_ppm ?? 0) / 10_000, 2)}</td>
                  <td className="text-right tabular-nums">{fmt(s.Mo_ppm)}</td>
                  <td className="text-right tabular-nums">{fmt(s.Ag_ppm, 2)}</td>
                  <td className="text-right tabular-nums">{fmt(s.As_ppm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-content">Pathfinder Mo (top 5)</p>
          <ul className="space-y-1 text-xs">
            {stats.topMo.map((s) => (
              <li key={s.Muestra} className="flex justify-between border-t border-hairline py-1">
                <span>{s.Muestra}</span>
                <span className="tabular-nums">{fmt(s.Mo_ppm)} ppm Mo</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-content-subtle">
        Fuente: {TILAMA_SOURCE}. Valores máximos son puntuales y selectivos; no representan ley
        media, recurso ni reserva (NI 43-101/JORC).
      </p>
    </section>
  );
}
