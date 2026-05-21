import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { WatchlistButton } from "@/features/catastro-public/WatchlistButton";
import { getConcessionByCode } from "@/lib/catastroPublic.functions";
import { Building2, MapPin, Ruler, Calendar, Database, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/catastro/c/$code")({
  loader: async ({ params }) => {
    const data = await getConcessionByCode({ data: { code: params.code } });
    if (!data) throw notFound();
    return { concession: data };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.concession;
    const title = c
      ? `${c.name ?? c.code} · ${c.holder ?? "Sin titular"} · Catastro Chile`
      : "Ficha de concesión · Catastro Chile";
    const desc = c
      ? `Concesión minera ${c.code} (${c.concession_type}) en ${c.commune ?? c.region ?? "Chile"}. Titular ${c.holder ?? "—"}, ${c.area_ha ?? "—"} ha. Datos SERNAGEOMIN.`
      : "Ficha pública de concesión minera en Chile, datos SERNAGEOMIN.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: ConcessionPage,
  notFoundComponent: () => (
    <PublicCatastroShell>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">Concesión no encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6">
          No hay registros para este código en cache ni en SERNAGEOMIN.
        </p>
        <Link to="/catastro/mapa" className="text-primary underline text-sm">
          Volver al mapa
        </Link>
      </div>
    </PublicCatastroShell>
  ),
  errorComponent: ({ error }) => (
    <PublicCatastroShell>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-2">Error al cargar la ficha</h1>
        <p className="text-xs font-mono text-muted-foreground">{error.message}</p>
      </div>
    </PublicCatastroShell>
  ),
});

function ConcessionPage() {
  const { concession: c } = Route.useLoaderData();
  return (
    <PublicCatastroShell>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/catastro/mapa"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al mapa
        </Link>
        <div className="border border-border rounded-md bg-bg-secondary/20 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Concesión {c.concession_type}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                {c.name ?? c.code}
              </h1>
              <div className="text-xs font-mono text-muted-foreground mt-1">{c.code}</div>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-1 rounded ${
                c.status?.toLowerCase().includes("vigente")
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {c.status ?? "—"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <Field icon={Building2} label="Titular" value={c.holder} sub={c.rut ?? undefined} />
            <Field
              icon={Ruler}
              label="Superficie"
              value={c.area_ha ? `${c.area_ha.toLocaleString("es-CL")} ha` : null}
            />
            <Field
              icon={MapPin}
              label="Ubicación"
              value={c.commune}
              sub={[c.province, c.region].filter(Boolean).join(" · ") || undefined}
            />
            <Field
              icon={Calendar}
              label="Vencimiento"
              value={c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-CL") : null}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <Database className="w-3 h-3" />
            Fuente: {c.source === "cache" ? "Cache Geocapitals" : "SERNAGEOMIN en vivo"}
            {c.last_synced_at &&
              ` · sincronizado ${new Date(c.last_synced_at).toLocaleString("es-CL")}`}
          </div>
        </div>

        <div className="mt-6 p-4 border border-dashed border-border rounded-md text-xs font-mono text-muted-foreground">
          Las herramientas pro (monitoreo, traslapes, exportes PDF/GeoJSON) estarán disponibles
          próximamente con el plan Pro.{" "}
          <Link to="/catastro/precios" className="text-primary underline">
            Ver planes
          </Link>
          .
        </div>
      </article>
    </PublicCatastroShell>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Building2;
  label: string;
  value: string | null;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded border border-border bg-background">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-semibold text-foreground truncate">{value ?? "—"}</div>
        {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
