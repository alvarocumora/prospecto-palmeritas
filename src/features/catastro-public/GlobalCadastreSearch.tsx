import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ExternalLink, Database, Loader2 } from "lucide-react";
import { searchGlobalCadastre } from "@/lib/cadastre.functions";
import { useLocale, fill, type StringKey } from "@/features/marketing/i18n";
import type { CadastreCountry, NormalizedStatus } from "@/lib/cadastre/types";

const COUNTRY_TABS: Array<{
  code: CadastreCountry;
  label: string;
  flag: string;
  inst: string;
}> = [
  { code: "CL", label: "Chile", flag: "🇨🇱", inst: "SERNAGEOMIN" },
  { code: "PE", label: "Perú", flag: "🇵🇪", inst: "INGEMMET" },
  { code: "BR", label: "Brasil", flag: "🇧🇷", inst: "ANM" },
  { code: "ZM", label: "Zambia", flag: "🇿🇲", inst: "Landfolio" },
  { code: "MW", label: "Malawi", flag: "🇲🇼", inst: "Landfolio" },
];

const STATUS_KEY: Record<NormalizedStatus, StringKey> = {
  active: "cad_status_active",
  pending: "cad_status_pending",
  extinct: "cad_status_extinct",
  unknown: "cad_status_unknown",
};

const STATUS_CLASS: Record<NormalizedStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-600",
  pending: "bg-sky-500/15 text-sky-600",
  extinct: "bg-red-500/15 text-red-600",
  unknown: "bg-muted text-muted-foreground",
};

const PLACEHOLDER_KEY: Record<CadastreCountry, StringKey> = {
  CL: "cad_ph_cl",
  PE: "cad_ph_pe",
  BR: "cad_ph_br",
  ZM: "cad_ph_zm",
  MW: "cad_ph_zm",
};

/**
 * Buscador multi-país de la Capa Catastral Universal. Compartido entre
 * /catastro/global, las fichas SEO por país (/catastro/pais/$country) y la
 * landing internacional (/en). Textos vía i18n (ES/EN/PT).
 */
export function GlobalCadastreSearch({
  initialCountry = "CL",
}: {
  initialCountry?: CadastreCountry;
}) {
  const { t } = useLocale();
  const [country, setCountry] = useState<CadastreCountry>(initialCountry);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const searchFn = useServerFn(searchGlobalCadastre);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["global-cadastre", country, term],
    queryFn: () => searchFn({ data: { country, q: term } }),
    enabled: term.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = input.trim();
    if (next === term) void refetch();
    else setTerm(next);
  };

  const countryLabel = COUNTRY_TABS.find((c) => c.code === country)?.label ?? country;

  return (
    <div>
      {/* Selector de país */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {COUNTRY_TABS.map((c) => (
          <button
            key={c.code}
            type="button"
            aria-pressed={country === c.code}
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
          🇦🇷 Argentina · {t("cad_soon")}
        </span>
      </div>

      {/* Búsqueda */}
      <form onSubmit={onSubmit} className="flex gap-2 max-w-xl mx-auto mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label={t("cad_search_button")}
            maxLength={64}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(PLACEHOLDER_KEY[country])}
            className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={input.trim().length < 2 || isFetching}
          className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : t("cad_search_button")}
        </button>
      </form>

      {isError && !isFetching && (
        <div
          role="alert"
          className="rounded-md border border-hairline bg-surface p-4 text-sm text-content"
        >
          <p>{t("cad_source_unavailable")}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-accent-brand hover:underline"
          >
            {t("cad_retry")}
          </button>
        </div>
      )}
      {isFetching && (
        <p role="status" className="text-center text-sm text-content-subtle">
          {t("cad_loading")}
        </p>
      )}
      {/* Resultados */}
      {term.length >= 2 && !isFetching && !isError && data && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-2">
            <Database className="w-3 h-3" />
            {data.total} {fill(t("cad_results_live"), { inst: data.institution })}
          </div>
          {data.results.length === 0 ? (
            <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
              {fill(t("cad_no_results"), { term, country: countryLabel })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground uppercase tracking-wider text-[10px] bg-bg-secondary/40 border-b border-border">
                  <tr>
                    <th className="py-2 px-3">{t("cad_col_concession")}</th>
                    <th className="py-2 px-2">{t("cad_col_holder")}</th>
                    <th className="py-2 px-2 text-right">{t("cad_col_hectares")}</th>
                    <th className="py-2 px-2">{t("cad_col_status")}</th>
                    <th className="py-2 px-2">{t("cad_col_location")}</th>
                    <th className="py-2 px-3 text-right">{t("cad_col_record")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <tr
                      key={`${r.country}-${r.code}`}
                      className="border-b border-border last:border-0 hover:bg-accent/30"
                    >
                      <td className="py-2 px-3">
                        <div className="font-medium">{r.name ?? r.code}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {r.name ? r.code : (r.commodity ?? "")}
                          {r.name && r.commodity ? ` · ${r.commodity}` : ""}
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
                          className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${STATUS_CLASS[r.statusNormalized]}`}
                          title={r.status ?? undefined}
                        >
                          {t(STATUS_KEY[r.statusNormalized])}
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
                            {t("cad_view_record")}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
