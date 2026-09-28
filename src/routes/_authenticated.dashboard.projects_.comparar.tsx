import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { compareProjects, type ProjectComparison } from "@/lib/projectCompare.functions";

export const Route = createFileRoute("/_authenticated/dashboard/projects_/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar fichas de proyecto — Geocapitals" },
      {
        name: "description",
        content:
          "Comparación lado a lado de los antecedentes cargados de Cholqui y Los Verdes – Tilama.",
      },
      { property: "og:title", content: "Comparar fichas de proyecto — Geocapitals" },
      {
        property: "og:description",
        content: "Antecedentes, muestreo y ronda de dos proyectos reales, lado a lado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompararPage,
});

const usd = (n: number | null | undefined) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";
const val = (n: number | null | undefined, suffix = "") =>
  n != null ? `${n.toLocaleString("es-CL")}${suffix}` : "—";

function Row({
  label,
  items,
  render,
}: {
  label: string;
  items: ProjectComparison[];
  render: (p: ProjectComparison) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(140px,1fr)_repeat(auto-fit,minmax(0,1fr))] md:grid-cols-3 border-b border-border/60">
      <div className="px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {items.map((p) => (
        <div key={p.projectId} className="px-3 py-2 text-sm">
          {render(p)}
        </div>
      ))}
    </div>
  );
}

function CompararPage() {
  const fn = useServerFn(compareProjects);
  const { data, isLoading, error } = useQuery({
    queryKey: ["project-compare", "CHOLQUI", "LV-TIL-001"],
    queryFn: () => fn({ data: { codes: ["CHOLQUI", "LV-TIL-001"] } }),
  });

  const items = data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 md:pb-8">
      <Link
        to="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Proyectos
      </Link>
      <h1 className="text-2xl font-bold">Comparar fichas de proyecto</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Sólo antecedentes cargados en la plataforma. Sin recursos ni reservas certificados; las
        cifras de ronda son referenciales y no auditadas.
      </p>

      {isLoading && <Loader2 className="w-5 h-5 animate-spin text-gold" />}
      {error && <p className="text-sm text-destructive">No se pudo cargar la comparación.</p>}

      {items.length > 0 && (
        <div className="rounded border border-border bg-bg-secondary overflow-hidden">
          <div className="grid md:grid-cols-3 border-b border-border bg-background/40">
            <div className="px-3 py-3 text-[11px] font-mono uppercase text-muted-foreground">
              Ficha
            </div>
            {items.map((p) => (
              <div key={p.projectId} className="px-3 py-3">
                <div className="font-mono font-semibold">{p.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{p.code}</div>
              </div>
            ))}
          </div>

          <Row
            label="Ubicación"
            items={items}
            render={(p) => [p.region, p.country].filter(Boolean).join(", ") || "—"}
          />
          <Row label="Mineral" items={items} render={(p) => p.commodity ?? "—"} />
          <Row label="Estado" items={items} render={(p) => p.status} />
          <Row
            label="Coordenadas"
            items={items}
            render={(p) =>
              p.centroid ? `${p.centroid[1].toFixed(4)}, ${p.centroid[0].toFixed(4)}` : "—"
            }
          />
          <Row
            label="Pertenencias"
            items={items}
            render={(p) => `${p.concessions.count} · ${val(p.concessions.areaHa, " ha")}`}
          />
          <Row label="Muestras" items={items} render={(p) => val(p.samples.count)} />
          <Row
            label="Cu (prom / máx)"
            items={items}
            render={(p) => `${val(p.samples.cuAvgPct, " %")} / ${val(p.samples.cuMaxPct, " %")}`}
          />
          <Row
            label="Au máx / Ag máx"
            items={items}
            render={(p) =>
              `${val(p.samples.auMaxGpt, " g/t")} / ${val(p.samples.agMaxGpt, " g/t")}`
            }
          />
          <Row
            label="Informe geológico"
            items={items}
            render={(p) =>
              p.brief ? (
                <span className="text-xs">{p.brief.conclusion ?? "Cargado"}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Pendiente</span>
              )
            }
          />
          <Row
            label="Ronda"
            items={items}
            render={(p) =>
              p.round ? (
                <div className="text-xs space-y-0.5">
                  <div>
                    {usd(p.round.roundSizeUsd)} · {p.round.instrument ?? "—"}
                  </div>
                  <div className="text-muted-foreground">
                    Ticket mín. {usd(p.round.minTicketUsd)} · {val(p.round.equityOfferedPct, " %")}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Sin ronda cargada</span>
              )
            }
          />
          <Row
            label="Valorización referencial"
            items={items}
            render={(p) =>
              p.round?.valuationLowUsd != null ? (
                <div className="text-xs space-y-0.5">
                  <div>
                    {usd(p.round.valuationLowUsd)} – {usd(p.round.valuationHighUsd)}
                  </div>
                  <div className="text-muted-foreground">{p.round.valuationMethod ?? "—"}</div>
                </div>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Riesgos declarados"
            items={items}
            render={(p) =>
              p.brief?.risks.length ? (
                <ul className="text-xs list-disc pl-4 space-y-0.5">
                  {p.brief.risks.slice(0, 4).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Completitud"
            items={items}
            render={(p) => (
              <div className="text-xs">
                <span className="font-mono text-gold">{p.completeness.score}%</span>
                {p.completeness.missing.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · falta {p.completeness.missing.join(", ")}
                  </span>
                )}
              </div>
            )}
          />
          <div className="grid md:grid-cols-3">
            <div className="px-3 py-3" />
            {items.map((p) => (
              <div key={p.projectId} className="px-3 py-3">
                <Link
                  to="/dashboard/projects/$projectId"
                  params={{ projectId: p.projectId }}
                  className="inline-flex text-[11px] font-mono px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10"
                >
                  Abrir ficha
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
