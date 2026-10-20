import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Search, Map, Bell, FileText, Layers, Building2, ArrowRight } from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { searchConcessions } from "@/lib/catastroPublic.functions";

export const Route = createFileRoute("/catastro/")({
  head: () => ({
    meta: [
      {
        title: "Catastro Minero Chile · Búsqueda, alertas y due-diligence · Geocapitals",
      },
      {
        name: "description",
        content:
          "Plataforma profesional de catastro minero chileno. Busca concesiones por titular, RUT o código. Monitorea cambios, traslapes y vencimientos. Datos SERNAGEOMIN actualizados.",
      },
      {
        property: "og:title",
        content: "Catastro Minero Chile · Geocapitals",
      },
      {
        property: "og:description",
        content:
          "Búsqueda nacional de concesiones mineras, alertas de cambio de titular, traslapes y reportes profesionales.",
      },
      { property: "og:type", content: "website" },
      { rel: "canonical", href: "/catastro" },
    ],
  }),
  component: CatastroLanding,
});

function CatastroLanding() {
  const [q, setQ] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const search = useServerFn(searchConcessions);
  const mutation = useMutation({
    mutationFn: (term: string) => search({ data: { q: term, limit: 8 } }),
  });

  return (
    <PublicCatastroShell>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-bg-secondary/20 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-bg-secondary/50 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Catastro nacional · datos SERNAGEOMIN
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 leading-[1.05]">
              Catastro minero de Chile,
              <span className="text-primary"> al alcance profesional.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Busca cualquier concesión por titular, RUT o código. Monitorea cambios y vencimientos.
              Genera reportes de due-diligence sobre tu AOI. Una herramienta construida por geólogos
              para operadores mineros.
            </p>

            {/* Buscador */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim().length >= 2) mutation.mutate(q.trim());
              }}
              className="flex gap-2 max-w-2xl"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Codelco, 96.511.760-2, RUT, código concesión, comuna…"
                  disabled={!hydrated}
                  className="w-full pl-10 pr-4 py-3 rounded-md border border-border bg-background font-mono text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={!hydrated || mutation.isPending || q.trim().length < 2}
                className="px-5 py-3 rounded-md bg-primary text-primary-foreground font-mono text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? "Buscando…" : "Buscar"}
              </button>
            </form>

            {/* Resultados rápidos */}
            {mutation.data && (
              <div className="mt-6 border border-border rounded-md overflow-hidden max-w-2xl bg-background">
                {mutation.data.results.length === 0 ? (
                  <div className="p-4 text-xs font-mono text-muted-foreground">
                    Sin resultados en cache local. Prueba con el código exacto en la{" "}
                    <Link to="/catastro/mapa" className="text-primary underline">
                      vista de mapa
                    </Link>{" "}
                    para consultar en vivo a SERNAGEOMIN.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {mutation.data.results.map((r) => (
                      <li key={r.code}>
                        <Link
                          to="/catastro/c/$code"
                          params={{ code: r.code }}
                          className="flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors text-xs font-mono"
                        >
                          <Building2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-foreground font-semibold truncate">
                              {r.name ?? r.code}
                            </div>
                            <div className="text-muted-foreground truncate">
                              {r.holder ?? "—"} · {r.commune ?? r.region ?? ""} ·{" "}
                              {r.area_ha ? `${r.area_ha.toLocaleString("es-CL")} ha` : "—"}
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3 text-xs font-mono">
              <Link
                to="/catastro/mapa"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border hover:border-primary hover:text-primary transition-colors"
              >
                <Map className="w-3.5 h-3.5" /> Abrir mapa nacional
              </Link>
              <Link
                to="/catastro/precios"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border hover:border-primary hover:text-primary transition-colors"
              >
                Ver planes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Herramientas para tomar decisiones mineras.
          </h2>
          <p className="text-sm text-muted-foreground mb-10 max-w-2xl">
            Todo lo que un geólogo, abogado minero o inversionista necesita para evaluar y
            monitorear concesiones en Chile.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Feature
              icon={Search}
              title="Búsqueda profesional"
              body="Por titular, RUT, código, comuna o región. Filtros por tipo y vigencia. Resultados instantáneos."
            />
            <Feature
              icon={Bell}
              title="Monitoreo y alertas"
              body="Watchlist por concesión. Alertas de cambio de titular, modificación de área, vencimiento próximo."
            />
            <Feature
              icon={Layers}
              title="Traslapes y vecinos"
              body="Dibuja tu AOI y obtén las concesiones que la cruzan, las áreas libres y los colindantes."
            />
            <Feature
              icon={FileText}
              title="Reportes y exportes"
              body="Ficha PDF profesional por concesión, exportes GeoJSON / Shapefile y reportes de due-diligence."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Empieza gratis. Sin tarjeta.
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
            Acceso completo al mapa nacional y la búsqueda. Funciones pro disponibles cuando las
            necesites.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/catastro/mapa"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-md bg-primary text-primary-foreground font-mono text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Explorar mapa
            </Link>
            <Link
              to="/catastro/precios"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-md border border-border font-mono text-sm font-medium hover:border-primary transition-colors"
            >
              Comparar planes
            </Link>
          </div>
        </div>
      </section>
    </PublicCatastroShell>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Search;
  title: string;
  body: string;
}) {
  return (
    <div className="border border-border rounded-md p-5 bg-bg-secondary/20">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <div className="font-semibold text-sm mb-1.5">{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">{body}</div>
    </div>
  );
}
