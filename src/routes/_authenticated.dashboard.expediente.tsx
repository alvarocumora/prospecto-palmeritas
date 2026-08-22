import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, FolderKanban, ArrowRight } from "lucide-react";
import { getProjectMasterRecords } from "@/lib/projectMaster.functions";
import { DEAL_STAGE_LABEL, type DealStage } from "@/lib/dealFlow.functions";
import { DueDiligencePanel } from "@/features/projects/DueDiligencePanel";

export const Route = createFileRoute("/_authenticated/dashboard/expediente")({
  head: () => ({
    meta: [
      { title: "Expediente maestro de proyectos — Geocapitals" },
      {
        name: "description",
        content:
          "Registro único por proyecto: ficha comercial, data room, deals activos y readiness de transacción.",
      },
      { property: "og:title", content: "Expediente maestro de proyectos — Geocapitals" },
      {
        property: "og:description",
        content: "Un solo registro por proyecto: comercial, data room, deals y valorización.",
      },
    ],
  }),
  component: ExpedientePage,
});

const fmtUsd = (n: number | null) =>
  n == null
    ? "—"
    : n >= 1_000_000
      ? `US$ ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`
      : `US$ ${Math.round(n).toLocaleString("es-CL")}`;

function ExpedientePage() {
  const fn = useServerFn(getProjectMasterRecords);
  const { data, isLoading } = useQuery({
    queryKey: ["project-master-records"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  return (
    <div data-theme="im-light" className="min-h-full bg-background text-foreground">
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-5 pb-20 md:pb-8">
        <header>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Capital & Deals
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Expediente maestro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Un registro por proyecto. La ficha comercial, el data room y los deals leen de aquí — no
            se duplican datos.
          </p>
        </header>

        {isLoading && <div className="text-sm text-muted-foreground">Cargando expedientes…</div>}

        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">
            Aún no tienes proyectos asignados.{" "}
            <Link to="/dashboard/projects" className="underline">
              Crear proyecto
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {(data ?? []).map((r) => (
            <article key={r.projectId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{r.name}</h2>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {r.code}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[r.commodity, r.region, r.country].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-mono text-muted-foreground">
                    Readiness
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{r.readiness.score}%</div>
                </div>
              </div>

              <div className="mt-3 h-1.5 w-full rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${r.readiness.score}%` }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                <Metric
                  label="Ficha comercial"
                  value={
                    r.listing ? (r.listing.published ? "Publicada" : "Borrador") : "Sin ficha"
                  }
                />
                <Metric label="Precio pedido" value={fmtUsd(r.listing?.askingPriceUsd ?? null)} />
                <Metric
                  label="Data room"
                  value={r.dataRoom ? `${r.dataRoom.files} docs` : "No creado"}
                />
                <Metric label="Valorización (NPV)" value={fmtUsd(r.npvUsd)} />
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground mb-2">
                    Pipeline de deals ({r.deals.active} activos / {r.deals.total})
                  </div>
                  {r.deals.total === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin interesados todavía.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(r.deals.byStage).map(([stage, n]) => (
                        <span
                          key={stage}
                          className="text-[11px] px-2 py-0.5 rounded border border-border"
                        >
                          {DEAL_STAGE_LABEL[stage as DealStage] ?? stage}: {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground mb-2">
                    Qué falta
                  </div>
                  <ul className="space-y-1">
                    {r.readiness.checks.map((c) => (
                      <li key={c.key} className="flex items-start gap-2 text-xs">
                        {c.ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={c.ok ? "text-muted-foreground" : ""}>
                          {c.label}
                          {!c.ok && (
                            <span className="text-muted-foreground"> — {c.hint}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <DueDiligencePanel projectId={r.projectId} />

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/dashboard/listings"
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                >
                  Vitrina <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  to="/dashboard/deals"
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                >
                  Deal flow <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  to="/dashboard/project-report"
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                >
                  Reporte técnico <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border p-2.5">
      <div className="text-[10px] uppercase font-mono text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
