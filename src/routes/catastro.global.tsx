import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe2, Search, ExternalLink, Database, Loader2 } from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { searchGlobalCadastre } from "@/lib/cadastre.functions";
import type { CadastreCountry, NormalizedStatus } from "@/lib/cadastre/types";

export const Route = createFileRoute("/catastro/global")({
  head: () => ({
    meta: [
      { title: "Catastro minero multi-país · Chile y Perú — Geocapitals" },
      {
        name: "description",
        content:
          "Busca concesiones mineras de Chile (SERNAGEOMIN) y Perú (INGEMMET GEOCATMIN) en un solo lugar. Titulares, estados y hectáreas desde las fuentes oficiales, en vivo.",
      },
      { property: "og:title", content: "Catastro minero multi-país — Geocapitals" },
      {
        property: "og:description",
        content: "Un solo buscador para los catastros mineros oficiales de LatAm.",
      },
    ],
  }),
  component: GlobalCadastrePage,
});

const COUNTRY_TABS: Array<{ code: CadastreCountry; label: string; flag: string; inst: string }> = [
  { code: "CL", label: "Chile", flag: "🇨🇱", inst: "SERNAGEOMIN" },
  { code: "PE", label: "Perú", flag: "🇵🇪", inst: "INGEMMET" },
];

const STATUS_STYLE: Record<NormalizedStatus, { label: string; className: string }> = {
  active: { label: "Vigente", className: "bg-emerald-500/15 text-emerald-600" },
  pending: { label: "En trámite", className: "bg-sky-500/15 text-sky-600" },
  extinct: { label: "Extinta", className: "bg-red-500/15 text-red-600" },
  unknown: { label: "Sin clasificar", className: "bg-muted text-muted-foreground" },
};

function GlobalCadastrePage() {
  const [country, setCountry] = useState<CadastreCountry>("CL");
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const searchFn = useServerFn(searchGlobalCadastre);

  const { data, isFetching } = useQuery({
    queryKey: ["global-cadastre", country, term],
    queryFn: () => searchFn({ data: { country, q: term } }),
    enabled: term.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTerm(input);
  };

  return (
    <PublicCatastroShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <Globe2 className="w-3.5 h-3.5" /> Capa Catastral Universal
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Un buscador. Todos los catastros.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Concesiones mineras de Chile y Perú consultadas en vivo desde las fuentes oficiales.
            Brasil y más países, próximamente.
          </p>
        </div>

        {/* Selector de país */}
        <div className="flex justify-center gap-2 mb-4">
          {COUNTRY_TABS.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCountry(c.code)}
              className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                country === c.code
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.flag} {c.label}
              <span className="ml-1.5 text-[10px] font-mono uppercase opacity-60">{c.inst}</span>
            </button>
          ))}
          <span className="px-3 py-1.5 rounded-md border border-dashed border-border text-sm text-muted-foreground/60">
            🇧🇷 Brasil · pronto
          </span>
        </div>

        {/* Búsqueda */}
        <form onSubmit={onSubmit} className="flex gap-2 max-w-xl mx-auto mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                country === "CL"
                  ? "Titular, nombre de concesión o rol…"
                  : "Titular, nombre de concesión o código único…"
              }
              className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={input.trim().length < 2 || isFetching}
            className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
          </button>
        </form>

        {/* Resultados */}
        {term.length >= 2 && !isFetching && data && (
          <>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-2">
              <Database className="w-3 h-3" />
              {data.total} resultado(s) · fuente {data.institution} en vivo
            </div>
            {data.results.length === 0 ? (
              <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
                Sin resultados para «{term}» en {country === "CL" ? "Chile" : "Perú"}. Prueba con
                otro término u otro país.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground uppercase tracking-wider text-[10px] bg-bg-secondary/40 border-b border-border">
                    <tr>
                      <th className="py-2 px-3">Concesión</th>
                      <th className="py-2 px-2">Titular</th>
                      <th className="py-2 px-2 text-right">Hectáreas</th>
                      <th className="py-2 px-2">Estado</th>
                      <th className="py-2 px-2">Ubicación</th>
                      <th className="py-2 px-3 text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => {
                      const st = STATUS_STYLE[r.statusNormalized];
                      return (
                        <tr
                          key={`${r.country}-${r.code}`}
                          className="border-b border-border last:border-0 hover:bg-accent/30"
                        >
                          <td className="py-2 px-3">
                            <div className="font-medium">{r.name ?? "—"}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {r.code}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="max-w-[220px] truncate">{r.holder ?? "—"}</div>
                            {r.holderTaxId && (
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {r.holderTaxId}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {r.areaHa != null ? r.areaHa.toLocaleString("es-CL") : "—"}
                          </td>
                          <td className="py-2 px-2">
                            <span
                              className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${st.className}`}
                              title={r.status ?? undefined}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">{r.location ?? "—"}</td>
                          <td className="py-2 px-3 text-right">
                            {r.country === "CL" ? (
                              <Link
                                to="/catastro/c/$code"
                                params={{ code: r.code }}
                                className="text-primary hover:underline"
                              >
                                Ver ficha
                              </Link>
                            ) : r.sourceUrl ? (
                              <a
                                href={r.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                {r.source.split(" ")[0]} <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[10px] font-mono text-muted-foreground max-w-lg mx-auto">
          Datos públicos oficiales consultados en vivo: SERNAGEOMIN (Chile) e INGEMMET GEOCATMIN
          (Perú, ~65.000 derechos mineros). Geocapitals normaliza los esquemas de cada país a una
          vista única.
        </p>
      </div>
    </PublicCatastroShell>
  );
}
