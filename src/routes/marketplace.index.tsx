import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ArrowRight,
  ShieldCheck,
  Globe2,
  Package,
  Award,
  Anchor,
  Filter as FilterIcon,
} from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { Reveal } from "@/features/marketing/Reveal";
import { CommodityCover } from "@/features/marketing/CommodityCover";
import { getMetalPrices } from "@/lib/commodityPrices.functions";
import { BrandButton, Eyebrow } from "@/components/brand";
import {
  listPublishedCommodityLots,
  listCommodityCertifications,
  type CommodityLotRow,
} from "@/lib/marketplace.functions";
import {
  COUNTRIES,
  COMMODITIES,
  INCOTERMS,
  commodityLabel,
  countryFlag,
  countryName,
  formLabel,
  formatTonnes,
} from "@/lib/commodityLabels";
import { QueryError } from "@/components/ui/QueryError";

const searchSchema = z.object({
  commodity: z.string().optional(),
  country: z.string().optional(),
  incoterm: z.string().optional(),
  cert: z.string().optional(),
});

export const Route = createFileRoute("/marketplace/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Marketplace de commodities certificados — Geocapitals" },
      {
        name: "description",
        content:
          "Concentrados de cobre, cátodos, doré Au/Ag, tierras raras, litio y cobalto con trazabilidad, certificación LBMA/RJC/Fairmined/ICMM/ISO y origen verificado en LatAm y África.",
      },
      {
        property: "og:title",
        content: "Marketplace minero certificado · Geocapitals",
      },
      {
        property: "og:description",
        content:
          "Deal-flow físico verificado: concentrados, cátodos y doré desde Chile, Perú, Brasil, Colombia, Venezuela y África.",
      },
      { property: "og:url", content: "https://geocapitals.com/marketplace" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://geocapitals.com/marketplace" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "OnlineStore",
          name: "Geocapitals Marketplace",
          url: "https://geocapitals.com/marketplace",
          description:
            "Marketplace institucional de commodities mineros certificados desde LatAm y África.",
        }),
      },
    ],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const search = Route.useSearch();
  const listFn = useServerFn(listPublishedCommodityLots);
  const certsFn = useServerFn(listCommodityCertifications);

  const [filters, setFilters] = useState({
    commodity: search.commodity ?? "",
    country: search.country ?? "",
    incoterm: search.incoterm ?? "",
    certification: search.cert ?? "",
  });

  const {
    data: lots = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["marketplace-lots", filters],
    queryFn: () =>
      listFn({
        data: {
          commodity: filters.commodity || undefined,
          country: filters.country || undefined,
          incoterm: filters.incoterm || undefined,
          certification: filters.certification || undefined,
        },
      }),
    staleTime: 60_000,
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["commodity-certs"],
    queryFn: () => certsFn(),
    staleTime: 5 * 60_000,
  });

  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lots) m.set(l.country, (m.get(l.country) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lots]);

  return (
    <MarketingPage
      eyebrow="Marketplace"
      title="Commodities mineros certificados, listos para transar"
      intro="Concentrados, cátodos, doré, bullion, tierras raras y litio con trazabilidad de origen y certificación LBMA, RJC, Fairmined, ICMM, IRMA e ISO — desde Chile, Perú, Brasil, Colombia, Venezuela y África."
    >
      {/* Cotizaciones spot en vivo */}
      <MetalQuotesStrip />

      {/* Filtros */}
      <div className="rounded-2xl border border-hairline bg-white p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FilterIcon className="w-4 h-4 text-accent-brand" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
            Filtrar lotes
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            label="Commodity"
            value={filters.commodity}
            onChange={(v) => setFilters((f) => ({ ...f, commodity: v }))}
            options={[
              { v: "", l: "Todos" },
              ...Object.entries(COMMODITIES).map(([v, m]) => ({ v, l: m.label })),
            ]}
          />
          <Select
            label="País"
            value={filters.country}
            onChange={(v) => setFilters((f) => ({ ...f, country: v }))}
            options={[
              { v: "", l: "Todos" },
              ...Object.entries(COUNTRIES).map(([v, m]) => ({ v, l: `${m.flag} ${m.name}` })),
            ]}
          />
          <Select
            label="Incoterm"
            value={filters.incoterm}
            onChange={(v) => setFilters((f) => ({ ...f, incoterm: v }))}
            options={[{ v: "", l: "Cualquiera" }, ...INCOTERMS.map((i) => ({ v: i, l: i }))]}
          />
          <Select
            label="Certificación"
            value={filters.certification}
            onChange={(v) => setFilters((f) => ({ ...f, certification: v }))}
            options={[{ v: "", l: "Cualquiera" }, ...certs.map((c) => ({ v: c.code, l: c.name }))]}
          />
        </div>
      </div>

      {/* Grid + sidebar */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        <div>
          {isError && (
            <QueryError message="No pudimos cargar los lotes." onRetry={() => void refetch()} />
          )}
          {!isError && isLoading && (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-hairline bg-white p-5 animate-pulse space-y-3"
                >
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-5 bg-slate-100 rounded w-4/5" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-12 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          )}
          {!isError && !isLoading && lots.length === 0 && (
            <div className="rounded-2xl border border-dashed border-hairline p-10 text-center">
              <Package className="w-8 h-8 text-accent-brand mx-auto mb-3" strokeWidth={1.5} />
              <div className="font-display text-lg text-content">
                Sin lotes que coincidan con tus filtros
              </div>
              <p className="text-sm text-content-subtle mt-2">
                Ajusta los filtros o registra tu interés para recibir avisos cuando aparezcan.
              </p>
              <BrandButton asChild className="mt-5">
                <Link to="/contacto">Registrar interés</Link>
              </BrandButton>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {lots.map((lot, idx) => (
              <Reveal key={lot.id} delay={Math.min(idx, 5) * 60}>
                <LotCard lot={lot} />
              </Reveal>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-hairline bg-white p-5">
            <Eyebrow className="mb-3">Geografías</Eyebrow>
            <ul className="space-y-2 text-sm">
              {byCountry.map(([code, count]) => (
                <li key={code} className="flex items-center justify-between">
                  <span className="text-content">
                    {countryFlag(code)} {countryName(code)}
                  </span>
                  <span className="font-mono text-xs text-content-subtle">{count}</span>
                </li>
              ))}
              {byCountry.length === 0 && (
                <li className="text-xs text-content-subtle font-mono">Sin datos</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-hairline bg-accent-brand-subtle p-5">
            <Eyebrow className="mb-2">Publica tu lote</Eyebrow>
            <p className="text-sm text-content-subtle">
              Productor o comercializador? Publica producción con trazabilidad y certificación
              verificada.
            </p>
            <BrandButton asChild className="mt-4 w-full">
              <Link to="/dashboard/commodity-lots">Publicar mi lote</Link>
            </BrandButton>
            <p className="mt-2 text-[11px] font-mono text-content-subtle text-center">
              Requiere cuenta · verificación antes de publicar
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-inverse text-white p-5">
            <Eyebrow className="mb-2 text-white/60">KYC comprador</Eyebrow>
            <p className="text-sm text-white/70">
              Trader, refinería o industrial? Solicita acceso institucional con onboarding KYC/AML.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex items-center justify-center w-full gap-2 border border-white/30 text-white px-4 py-2.5 rounded-md text-sm hover:bg-white/10"
            >
              Registrarme como buyer
            </Link>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-5">
            <Eyebrow className="mb-3">Estándares reconocidos</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {certs.slice(0, 12).map((c) => (
                <span
                  key={c.code}
                  title={c.name}
                  className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-hairline text-content-subtle"
                >
                  {c.code.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Callouts inferiores */}
      <section className="mt-16 grid md:grid-cols-3 gap-4">
        {[
          {
            i: ShieldCheck,
            t: "Certificación verificada",
            d: "Cadenas de custodia auditadas, LBMA / RJC / Fairmined / ICMM / IRMA / ISO.",
          },
          {
            i: Globe2,
            t: "Origen trazable",
            d: "Del yacimiento al puerto: región, faena, holder, patentes y compliance.",
          },
          {
            i: Anchor,
            t: "Incoterms institucionales",
            d: "FOB, CIF, CFR, EXW, DAP — condiciones publicadas y contratos con audit-trail.",
          },
        ].map(({ i: Icon, t: title, d }) => (
          <div key={title} className="rounded-2xl border border-hairline bg-white p-6">
            <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand mb-4">
              <Icon className="w-5 h-5" strokeWidth={1.75} />
            </span>
            <div className="font-display text-lg text-content">{title}</div>
            <p className="text-sm text-content-subtle mt-2 leading-relaxed">{d}</p>
          </div>
        ))}
      </section>
    </MarketingPage>
  );
}

function LotCard({ lot }: { lot: CommodityLotRow }) {
  const certs = lot.certifications_json ?? [];
  return (
    <Link
      to="/marketplace/$lotId"
      params={{ lotId: lot.id }}
      className="group rounded-2xl border border-hairline bg-white h-full overflow-hidden hover-lift hover:border-accent-brand hover:shadow-[0_18px_36px_-24px_rgba(11,42,91,0.35)] transition block"
    >
      {/* Portada: imagen real si existe, si no patrón generativo */}
      <div className="relative h-32 overflow-hidden bg-slate-100">
        {lot.cover_image_url ? (
          <img
            src={lot.cover_image_url}
            alt={lot.title}
            loading="lazy"
            className="cover-zoom absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="cover-zoom absolute inset-0">
            <CommodityCover
              seed={lot.id}
              commodity={lot.commodity}
              form={lot.form}
              className="w-full h-full"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        <span className="absolute top-2.5 right-2.5 text-[11px] font-mono text-white/90 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
          {countryFlag(lot.country)} {countryName(lot.country)}
        </span>
        {lot.is_verified && (
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-emerald-300 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-2.5 h-2.5" /> Verificado
          </span>
        )}
      </div>

      <div className="p-5 pt-4">
        <div className="font-display text-[17px] text-content leading-snug line-clamp-2">
          {lot.title}
        </div>
        <div className="mt-1 text-xs text-content-subtle">
          {formLabel(lot.form)}
          {lot.grade_pct != null && ` · ${Number(lot.grade_pct)}%`}
          {lot.port_of_loading && ` · ${lot.port_of_loading}`}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <div className="text-content-subtle font-mono uppercase tracking-wider">Disponible</div>
            <div className="text-content font-mono">{formatTonnes(lot.tonnage_available_t)}</div>
          </div>
          <div>
            <div className="text-content-subtle font-mono uppercase tracking-wider">Incoterm</div>
            <div className="text-content font-mono">{lot.incoterm ?? "—"}</div>
          </div>
        </div>

        {certs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {certs.slice(0, 4).map((c) => (
              <span
                key={c}
                className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-brand-subtle text-accent-brand inline-flex items-center gap-1"
              >
                <Award className="w-2.5 h-2.5" />
                {c.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between pt-4 border-t border-hairline">
          <span className="text-[11px] font-mono text-content-subtle">Ver ficha</span>
          <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </Link>
  );
}

/** Franja de cotizaciones spot en vivo (gold-api + USD/CLP). */
function MetalQuotesStrip() {
  const pricesFn = useServerFn(getMetalPrices);
  const { data } = useQuery({
    queryKey: ["metal-prices"],
    queryFn: () => pricesFn(),
    staleTime: 5 * 60_000,
  });
  if (!data?.quotes?.length) return null;
  return (
    <div className="rounded-xl border border-hairline bg-surface-inverse text-white px-4 py-2.5 mb-6 flex items-center gap-x-6 gap-y-1 flex-wrap">
      <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
        Spot en vivo
      </span>
      {data.quotes.map((q) => (
        <span key={q.code} className="inline-flex items-baseline gap-1.5">
          <span className="text-[10px] font-mono font-bold tracking-widest text-white/80">
            {q.code}
          </span>
          <span className="text-[13px] font-mono font-semibold">{q.price}</span>
          <span className="text-[9px] font-mono text-white/35">{q.unit}</span>
        </span>
      ))}
      {data.fx.usdClp != null && (
        <span className="inline-flex items-baseline gap-1.5 ml-auto">
          <span className="text-[10px] font-mono font-bold tracking-widest text-white/80">
            USD/CLP
          </span>
          <span className="text-[13px] font-mono font-semibold">{data.fx.usdClp.toFixed(0)}</span>
        </span>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-hairline rounded-md px-2 py-2 text-sm bg-white text-content focus:outline-none focus:border-accent-brand"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
