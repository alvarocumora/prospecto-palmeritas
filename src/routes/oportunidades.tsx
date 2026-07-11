import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, MapPin, TrendingUp, Layers, Coins, Calculator } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow } from "@/components/brand";
import { getPublicListings, type PublicListing } from "@/lib/publicListings.functions";
import { fmtUSD } from "@/modules/deals/domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { QueryError } from "@/components/ui/QueryError";

export const Route = createFileRoute("/oportunidades")({
  head: () => ({
    meta: [
      { title: "Oportunidades de inversión por región — Geocapitals" },
      {
        name: "description",
        content:
          "Explora proyectos mineros publicados agrupados por región y simula el retorno esperado por geografía: equity, royalties y joint ventures.",
      },
      { property: "og:title", content: "Oportunidades de inversión minera por región" },
      {
        property: "og:description",
        content: "Deal-flow verificado agrupado por región + simulador de retorno por geografía.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://geocapitals.com/oportunidades" },
    ],
    links: [{ rel: "canonical", href: "https://geocapitals.com/oportunidades" }],
  }),
  component: OportunidadesPage,
});

// IRR base esperado por país/región (referencial, editable por el usuario)
const BASE_IRR_BY_COUNTRY: Record<string, number> = {
  Chile: 22,
  Perú: 24,
  Peru: 24,
  Brasil: 20,
  Brazil: 20,
  Colombia: 26,
  Venezuela: 30,
  Argentina: 25,
  México: 21,
  Mexico: 21,
};

const STAGE_RISK: Record<string, number> = {
  greenfield: 1.35,
  scoping: 1.2,
  brownfield: 0.95,
  prefeasibility: 0.85,
  feasibility: 0.7,
  production: 0.55,
};

type RegionGroup = {
  key: string;
  region: string;
  country: string;
  listings: PublicListing[];
  avgTicket: number | null;
  totalAreaHa: number;
  commodities: string[];
  modalities: Record<string, number>;
  suggestedIRR: number;
};

function groupListings(all: PublicListing[]): RegionGroup[] {
  const map = new Map<string, RegionGroup>();
  for (const l of all) {
    const region = l.region ?? "Sin región";
    const country = l.country ?? "—";
    const key = `${country}::${region}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        region,
        country,
        listings: [],
        avgTicket: null,
        totalAreaHa: 0,
        commodities: [],
        modalities: {},
        suggestedIRR: BASE_IRR_BY_COUNTRY[country] ?? 20,
      };
      map.set(key, g);
    }
    g.listings.push(l);
    if (l.area_ha) g.totalAreaHa += l.area_ha;
    if (l.commodity && !g.commodities.includes(l.commodity)) g.commodities.push(l.commodity);
    if (l.modality) g.modalities[l.modality] = (g.modalities[l.modality] ?? 0) + 1;
  }
  for (const g of map.values()) {
    const prices = g.listings.map((l) => l.asking_price_usd).filter((v): v is number => v != null);
    g.avgTicket = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
    // Ajuste por mix de etapas
    const stages = g.listings.map((l) => l.stage ?? "greenfield");
    const avgRisk =
      stages.reduce((a, s) => a + (STAGE_RISK[s] ?? 1), 0) / Math.max(1, stages.length);
    g.suggestedIRR = Math.round((BASE_IRR_BY_COUNTRY[g.country] ?? 20) / avgRisk);
  }
  return Array.from(map.values()).sort((a, b) => b.listings.length - a.listings.length);
}

function OportunidadesPage() {
  const fetchListings = useServerFn(getPublicListings);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
  });
  const groups = useMemo(() => groupListings(data?.listings ?? []), [data?.listings]);
  const countries = useMemo(
    () => Array.from(new Set(groups.map((g) => g.country))).sort(),
    [groups],
  );
  const [countryFilter, setCountryFilter] = useState<string>("");
  const filtered = countryFilter ? groups.filter((g) => g.country === countryFilter) : groups;

  return (
    <MarketingPage
      eyebrow="Oportunidades"
      title="Proyectos mineros y retorno esperado por región"
      intro="Deal-flow verificado agrupado por geografía. Ajusta ticket, plazo y TIR esperada para simular el retorno según la región y la mezcla de etapas de cada distrito."
    >
      {/* Filtro país */}
      <div className="mb-8 flex flex-wrap gap-2 items-center">
        <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle mr-1">
          País:
        </span>
        <button
          onClick={() => setCountryFilter("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            countryFilter === ""
              ? "bg-accent-brand text-white border-accent-brand"
              : "bg-white text-content border-hairline hover:border-accent-brand"
          }`}
        >
          Todos ({groups.length})
        </button>
        {countries.map((c) => (
          <button
            key={c}
            onClick={() => setCountryFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              countryFilter === c
                ? "bg-accent-brand text-white border-accent-brand"
                : "bg-white text-content border-hairline hover:border-accent-brand"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isError ? (
        <QueryError message="No pudimos cargar las oportunidades." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-hairline bg-white h-[360px] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-white p-10 text-center">
          <MapPin className="w-10 h-10 mx-auto text-accent-brand/40" />
          <div className="mt-3 font-display text-lg text-content">
            Sin regiones con oportunidades publicadas
          </div>
          <p className="text-sm text-content-subtle mt-1">
            Solicita acceso institucional para recibir deal-flow en privado.
          </p>
          <Link
            to="/inversionistas"
            className="mt-4 inline-flex items-center gap-1.5 text-accent-brand font-medium text-sm hover:underline"
          >
            Ir al deal flow <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((g) => (
            <RegionCard key={g.key} group={g} />
          ))}
        </div>
      )}

      <section className="mt-16 rounded-2xl bg-surface-inverse text-white p-8 md:p-10 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <Eyebrow className="mb-2 text-white/60">Deal-flow institucional</Eyebrow>
          <h2 className="brand-display text-2xl md:text-3xl">
            ¿Buscas oportunidades por invitación?
          </h2>
          <p className="mt-3 text-white/70 max-w-xl">
            Crea tu cuenta de inversionista para acceder a data rooms cifrados, modelos NPV/IRR por
            proyecto y proyectos aún no listados públicamente.
          </p>
        </div>
        <BrandButton asChild>
          <Link to="/auth" search={{ intent: "investor" } as never}>
            Acceso institucional <ArrowRight className="w-4 h-4" />
          </Link>
        </BrandButton>
      </section>
    </MarketingPage>
  );
}

function RegionCard({ group }: { group: RegionGroup }) {
  const [ticket, setTicket] = useState<number>(() =>
    Math.max(250_000, Math.round((group.avgTicket ?? 500_000) / 1000) * 1000),
  );
  const [years, setYears] = useState<number>(5);
  const [irr, setIrr] = useState<number>(group.suggestedIRR);

  const projected = ticket * Math.pow(1 + irr / 100, years);
  const multiple = projected / ticket;
  const profit = projected - ticket;

  return (
    <article className="rounded-2xl border border-hairline bg-white overflow-hidden flex flex-col">
      <header className="p-5 border-b border-hairline bg-accent-brand-subtle">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-accent-brand">
              {group.country}
            </div>
            <div className="font-display text-lg text-content mt-1 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-accent-brand" /> {group.region}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl text-content leading-none">
              {group.listings.length}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              proyectos
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-mono">
          <Stat icon={<Coins />} label="Ticket medio" value={fmtUSD(group.avgTicket)} />
          <Stat
            icon={<Layers />}
            label="Superficie"
            value={
              group.totalAreaHa > 0
                ? `${Math.round(group.totalAreaHa).toLocaleString("es-CL")} ha`
                : "—"
            }
          />
          <Stat icon={<TrendingUp />} label="TIR sugerida" value={`${group.suggestedIRR}%`} />
        </div>
      </header>

      <div className="p-5 flex-1 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {group.commodities.slice(0, 6).map((c) => (
            <span
              key={c}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-brand-subtle text-accent-brand"
            >
              {c}
            </span>
          ))}
          {Object.entries(group.modalities).map(([m, n]) => (
            <span
              key={m}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-hairline text-content-subtle"
            >
              {MODALITY_LABEL[m] ?? m} · {n}
            </span>
          ))}
        </div>

        {/* Simulador */}
        <div className="rounded-lg border border-hairline p-3 bg-white">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-content-subtle mb-3">
            <Calculator className="w-3.5 h-3.5 text-accent-brand" /> Simulador de retorno
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Capital (USD)"
              value={ticket}
              step={50_000}
              min={50_000}
              max={10_000_000}
              onChange={setTicket}
            />
            <Field label="Años" value={years} step={1} min={1} max={15} onChange={setYears} />
            <Field label="TIR %" value={irr} step={1} min={5} max={60} onChange={setIrr} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-hairline text-center">
            <Cell label="Valor final" value={fmtUSD(projected)} highlight />
            <Cell label="Ganancia" value={fmtUSD(profit)} />
            <Cell label="Múltiplo" value={`${multiple.toFixed(2)}x`} />
          </div>
        </div>

        {/* Top 3 proyectos de la región */}
        <ul className="space-y-1.5">
          {group.listings.slice(0, 3).map((l) => (
            <li key={l.id}>
              <Link
                to="/proyectos/$listingId"
                params={{ listingId: l.id }}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent-brand-subtle group text-sm"
              >
                <span className="truncate text-content">
                  {l.title}
                  {l.stage && (
                    <span className="ml-1.5 text-[10px] font-mono uppercase text-content-subtle">
                      · {STAGE_LABEL[l.stage] ?? l.stage}
                    </span>
                  )}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-content-subtle group-hover:text-accent-brand shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <footer className="p-4 border-t border-hairline">
        <Link
          to="/inversionistas"
          className="text-sm text-accent-brand font-medium inline-flex items-center gap-1.5 hover:gap-2 transition-all"
        >
          Ver los {group.listings.length} proyectos <ArrowRight className="w-4 h-4" />
        </Link>
      </footer>
    </article>
  );
}

function Field({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="brand-input mt-1 text-sm font-mono"
      />
    </label>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-white border border-hairline p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-content-subtle [&_svg]:w-3 [&_svg]:h-3 text-accent-brand/70">
        {icon} <span className="text-content-subtle">{label}</span>
      </div>
      <div className="text-content font-semibold mt-0.5 text-[13px]">{value}</div>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </div>
      <div
        className={`font-mono text-sm mt-0.5 ${
          highlight ? "text-accent-brand font-semibold" : "text-content"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
