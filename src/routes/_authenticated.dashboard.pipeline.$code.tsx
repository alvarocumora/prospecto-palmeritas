import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { getPipelineDeal, PIPELINE_LABEL } from "@/lib/dealPipeline.functions";

export const Route = createFileRoute("/_authenticated/dashboard/pipeline/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Deal ${params.code} — Geocapitals` },
      { name: "description", content: `Ficha interna del deal ${params.code}: pedimentos, geoquímica, alertas y data room.` },
      { property: "og:title", content: `Deal ${params.code} — Geocapitals` },
      { property: "og:description", content: "Ficha interna del deal." },
    ],
  }),
  component: DealDetail,
});

const TABS = ["Resumen", "Pedimentos", "Geoquímica", "Alertas", "Data Room"] as const;
type Tab = (typeof TABS)[number];
const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("es-CL"));

function DealDetail() {
  const { code } = Route.useParams();
  const fn = useServerFn(getPipelineDeal);
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-deal", code],
    queryFn: () => fn({ data: { code } }),
  });
  const [tab, setTab] = useState<Tab>("Resumen");

  if (isLoading) return <div className="p-6 text-sm text-content-subtle">Cargando…</div>;
  if (!data) return <div className="p-6 text-sm text-content-subtle">Deal no encontrado o sin acceso.</div>;
  const { deal, pedimentos } = data;
  const p = deal.profile;

  return (
    <div data-theme="im-light" className="min-h-full bg-surface p-4 md:p-6 max-w-6xl mx-auto">
      <Link to="/dashboard/pipeline" className="inline-flex items-center gap-1 text-xs text-content-subtle hover:text-accent-brand">
        <ArrowLeft className="w-3.5 h-3.5" /> Pipeline
      </Link>
      <header className="mt-2 mb-4">
        <div className="text-xs font-mono text-content-subtle">{deal.code}</div>
        <h1 className="font-display text-3xl text-content">{deal.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded border border-accent-brand/40 text-accent-brand uppercase">
            {PIPELINE_LABEL[deal.pipeline_stage] ?? deal.pipeline_stage}
          </span>
          {deal.commodity && <span className="px-2 py-0.5 rounded bg-accent-brand/10 text-accent-brand">{deal.commodity}</span>}
          {p.aoi_ha != null && <span className="px-2 py-0.5 rounded border border-hairline text-content-subtle">{n(p.aoi_ha)} ha</span>}
          {p.status && <span className="px-2 py-0.5 rounded border border-hairline text-content-subtle">{p.status}</span>}
        </div>
      </header>

      <nav className="flex gap-1 border-b border-hairline mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${
              tab === t ? "border-accent-brand text-accent-brand" : "border-transparent text-content-subtle hover:text-content"
            }`}
          >
            {t}
            {t === "Alertas" && deal.alerts.filter((a) => !a.resolved).length > 0 && (
              <span className="ml-1 text-[10px] font-mono">({deal.alerts.filter((a) => !a.resolved).length})</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "Resumen" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Box title="Activo">
            <Row k="Subtipo" v={p.subtype} />
            <Row k="Región" v={deal.region} />
            <Row k="Área de interés" v={p.aoi_ha != null ? `${n(p.aoi_ha)} ha` : undefined} />
            <Row k="Pedimentos" v={p.pedimentos != null ? `${p.pedimentos} × ${n(p.ha_per_pedimento)} ha` : undefined} />
            <Row k="Datum" v={p.datum} />
            <Row k="Centro" v={p.center_lat != null ? `${p.center_lat}, ${p.center_lon}` : undefined} />
            <Row k="Cota" v={p.elevation_m != null ? `${n(p.elevation_m)} m` : undefined} />
            <Row k="Titular" v={p.owner} />
            <Row k="Estándar objetivo" v={p.target_standard} />
          </Box>
          <Box title="Persona Calificada (QP)">
            {p.qp?.name ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-content font-medium">{p.qp.name}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">{p.qp.status}</span>
                </div>
                <Row k="Estándar" v={p.qp.standard} />
                <Row k="Teléfono" v={p.qp.phone} />
                <Row k="Email" v={p.qp.email} />
              </>
            ) : (
              <div className="text-sm text-content-subtle">Sin QP asignado.</div>
            )}
          </Box>
          {p.comparable?.name && (
            <Box title="Comparable de referencia">
              <div className="text-content">{p.comparable.name} <span className="font-mono text-xs text-content-subtle">{p.comparable.ticker}</span></div>
              <div className="text-sm text-content-subtle mt-1">{p.comparable.event}</div>
            </Box>
          )}
          {!!p.exit_options?.length && (
            <Box title="Opciones de salida">
              <ul className="text-sm text-content list-disc pl-4 space-y-0.5">{p.exit_options.map((o) => <li key={o}>{o}</li>)}</ul>
            </Box>
          )}
          <p className="md:col-span-2 text-[11px] text-content-subtle">
            Proyecto en etapa de pedimento. No existen recursos ni reservas declarados bajo NI 43-101, JORC ni CH 20235.
          </p>
        </div>
      )}

      {tab === "Pedimentos" && (
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface-3">
          <table className="w-full text-sm">
            <thead className="text-[11px] font-mono uppercase text-content-subtle border-b border-hairline">
              <tr>
                <th className="text-left p-2">Nombre</th>
                <th className="text-right p-2">Área</th>
                <th className="text-left p-2">Juzgado</th>
                <th className="text-left p-2">Estado</th>
                <th className="text-left p-2">Coordenadas UTM</th>
              </tr>
            </thead>
            <tbody>
              {pedimentos.map((r) => (
                <tr key={r.id} className="border-b border-hairline last:border-0">
                  <td className="p-2 text-content">{r.name}</td>
                  <td className="p-2 text-right font-mono">{n(r.ha)} ha</td>
                  <td className="p-2">{r.court}</td>
                  <td className="p-2"><span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">{r.status}</span></td>
                  <td className="p-2 font-mono text-[11px] text-content-subtle">
                    N {n(r.n_from)}–{n(r.n_to)} · E {n(r.e_from)}–{n(r.e_to)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 text-[11px] text-content-subtle border-t border-hairline">
            Datum {pedimentos[0]?.datum ?? p.datum}. Coordenadas preliminares, sujetas a verificación en SIGEX.
          </div>
        </div>
      )}

      {tab === "Geoquímica" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Box title="Antecedentes geoquímicos">
            {p.geochem?.provenance === "REFERENCIA_BIBLIOGRAFICA" && (
              <div className="mb-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 inline-block">
                Referencia bibliográfica · no medido en el proyecto
              </div>
            )}
            <Row k="REE máx. regional" v={p.geochem?.ree_max_ppm != null ? `${n(p.geochem.ree_max_ppm)} ppm` : undefined} />
            <Row k="Tipo" v={p.geochem?.ree_type} />
            <Row k="Profundidad regolito" v={p.geochem?.regolith_depth_m != null ? `${p.geochem.regolith_depth_m} m` : undefined} />
            <Row k="Roca huésped" v={p.geochem?.host_rock} />
            <Row k="Portador REE" v={p.geochem?.ree_carrier} />
          </Box>
          <Box title="Índices espectrales (pipeline satelital)">
            <div className="flex flex-wrap gap-1">
              {(p.spectral_indices ?? []).map((s) => (
                <span key={s} className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-hairline">{s}</span>
              ))}
            </div>
          </Box>
          <Box title="Referencias científicas">
            <ul className="text-sm list-disc pl-4 space-y-0.5">{(p.scientific_refs ?? []).map((r) => <li key={r}>{r}</li>)}</ul>
          </Box>
        </div>
      )}

      {tab === "Alertas" && (
        <div className="space-y-2">
          {deal.alerts.map((a) => {
            const high = a.priority === "ALTA";
            return (
              <div key={a.id} className={`rounded-md border p-3 bg-surface-3 ${high ? "border-destructive/40" : "border-amber-500/40"}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${high ? "text-destructive" : "text-amber-600"}`} />
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${high ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>{a.priority}</span>
                  <span className="text-[10px] font-mono text-content-subtle">{a.alert_type}</span>
                  {a.resolved && <span className="ml-auto text-[10px] font-mono text-content-subtle">Resuelta</span>}
                </div>
                <div className="mt-1 font-medium text-content">{a.title}</div>
                {a.description && <p className="text-sm text-content-subtle mt-0.5">{a.description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "Data Room" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {p.datasheet_url ? (
            <a href={p.datasheet_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md border border-hairline bg-surface-3 p-4 hover:border-accent-brand">
              <FileText className="w-6 h-6 text-accent-brand" />
              <div className="flex-1">
                <div className="text-content font-medium">Datasheet del deal</div>
                <div className="text-[11px] text-content-subtle">Documento externo</div>
              </div>
              <ExternalLink className="w-4 h-4 text-content-subtle" />
            </a>
          ) : (
            <div className="text-sm text-content-subtle">Sin documentos.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-3 p-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-2">{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="w-36 shrink-0 text-content-subtle">{k}</span>
      <span className="text-content">{v}</span>
    </div>
  );
}
