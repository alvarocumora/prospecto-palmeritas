import { CheckCircle2, CircleDashed, Clock, FileBadge } from "lucide-react";
import type { CertRow, MetricRow, StageRow } from "@/lib/spv.functions";

const STAGE_ICON = {
  done: CheckCircle2,
  in_progress: Clock,
  pending: CircleDashed,
} as const;

const STAGE_LABEL: Record<string, string> = {
  done: "Completado",
  in_progress: "En curso",
  pending: "Pendiente",
};

const CERT_LABEL: Record<string, string> = {
  vigente: "Vigente",
  en_tramite: "En trámite",
  vencido: "Vencido",
};

export function CholquiStagePanel({
  stages,
  metrics,
  certifications,
}: {
  stages: StageRow[];
  metrics: MetricRow[];
  certifications: CertRow[];
}) {
  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <header className="px-6 py-5 border-b border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent-brand">
          Estado del activo
        </div>
        <h2 className="font-display text-2xl mt-1 text-content">
          Etapa, faena y certificaciones
        </h2>
      </header>

      <ol className="px-6 py-5 space-y-3">
        {stages.length === 0 && (
          <li className="text-sm text-content-subtle">Sin etapas registradas.</li>
        )}
        {stages.map((s) => {
          const Icon = STAGE_ICON[(s.status as keyof typeof STAGE_ICON) ?? "pending"] ?? CircleDashed;
          return (
            <li key={s.id} className="flex gap-3 items-start">
              <Icon
                className={`w-4 h-4 mt-0.5 ${
                  s.status === "done" ? "text-accent-brand" : "text-content-subtle"
                }`}
              />
              <div className="flex-1 border-b border-hairline pb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-content">{s.label}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                    {STAGE_LABEL[s.status] ?? s.status} · {s.provenance}
                  </span>
                </div>
                {s.evidence && (
                  <div className="text-xs text-content-subtle mt-1">{s.evidence}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="px-6 py-5 border-t border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
          Indicadores de faena
        </div>
        {metrics.length === 0 ? (
          <p className="text-sm text-content-subtle">
            Sin datos operacionales registrados: el proyecto no reporta producción propia. La
            producción de la faena vecina (Las Minitas) es de un tercero y no se contabiliza aquí.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.id} className="border border-hairline rounded-xl px-4 py-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                  {m.label}
                </div>
                <div className="text-lg font-display text-content mt-1">
                  {m.value != null ? m.value.toLocaleString("es-CL") : "s/d"}{" "}
                  <span className="text-xs text-content-subtle">{m.unit ?? ""}</span>
                </div>
                <div className="text-[10px] text-content-subtle mt-1">
                  {m.period} · {m.provenance}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-5 border-t border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3 flex items-center gap-2">
          <FileBadge className="w-3.5 h-3.5" />
          Certificaciones y permisos
        </div>
        {certifications.length === 0 ? (
          <p className="text-sm text-content-subtle">
            Sin certificaciones cargadas. Los permisos de habilitación de faena están por acreditar.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-content-subtle border-b border-hairline">
                <th className="py-2 pr-3 font-mono font-normal">Tipo</th>
                <th className="py-2 pr-3 font-mono font-normal">Emisor</th>
                <th className="py-2 pr-3 font-mono font-normal">N°</th>
                <th className="py-2 pr-3 font-mono font-normal">Vigencia</th>
                <th className="py-2 font-mono font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {certifications.map((c) => (
                <tr key={c.id} className="border-b border-hairline/60">
                  <td className="py-2 pr-3 text-content">{c.kind}</td>
                  <td className="py-2 pr-3 text-content-subtle">{c.issuer ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-content-subtle">{c.number ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-content-subtle">
                    {c.expires_on ?? "—"}
                  </td>
                  <td className="py-2 text-content">{CERT_LABEL[c.status] ?? c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
