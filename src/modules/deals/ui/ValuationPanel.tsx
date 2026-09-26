import { useEffect, useState } from "react";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Info,
  ChevronDown,
  Scale,
  Database,
  LineChart,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { computeListingValuation } from "@/lib/valuation/valuation.functions";
import { fmtUSD } from "@/modules/deals/domain/format";

type Bundle = Awaited<ReturnType<typeof computeListingValuation>>;

const METHOD_META: Record<
  string,
  { label: string; icon: typeof Calculator; color: string; desc: string }
> = {
  replacement_cost: {
    label: "Costo de reemplazo",
    icon: Layers,
    color: "oklch(0.72 0.14 250)",
    desc: "US$/ha por etapa — cuánto costaría reconstituir el paquete de concesiones + trabajos verificables.",
  },
  market_comps: {
    label: "Comparables de mercado",
    icon: Database,
    color: "oklch(0.78 0.14 82)",
    desc: "Mediana US$/ha en transacciones y listados públicos (TSX-V, ASX, S&P, SERNAGEOMIN, MinersLink).",
  },
  insitu_value: {
    label: "In-situ metal value",
    icon: Scale,
    color: "oklch(0.7 0.15 180)",
    desc: "Recurso × precio spot × factor de descuento por confianza (Inferred 1%, Indicated 3%, Measured 6%).",
  },
  dcf: {
    label: "DCF / NPV",
    icon: LineChart,
    color: "oklch(0.72 0.16 30)",
    desc: "NPV descontado del escenario económico base cargado en la plataforma.",
  },
};

const VERDICT: Record<
  string,
  { label: string; icon: typeof TrendingUp; className: string; color: string }
> = {
  under: {
    label: "Precio bajo respecto a valuación",
    icon: TrendingUp,
    className: "text-emerald-600 border-emerald-500/40 bg-emerald-50",
    color: "oklch(0.65 0.18 145)",
  },
  fair: {
    label: "Precio alineado con valuación",
    icon: Minus,
    className: "text-amber-700 border-amber-500/40 bg-amber-50",
    color: "oklch(0.78 0.14 82)",
  },
  over: {
    label: "Precio sobre valuación",
    icon: TrendingDown,
    className: "text-rose-700 border-rose-500/40 bg-rose-50",
    color: "oklch(0.65 0.18 25)",
  },
  unknown: {
    label: "Sin asking price cargado",
    icon: Info,
    className: "text-slate-600 border-slate-300 bg-slate-50",
    color: "oklch(0.6 0.02 260)",
  },
};

export function ValuationPanel({ listingId }: { listingId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMethod, setOpenMethod] = useState<string | null>(null);
  const [showComps, setShowComps] = useState(false);
  const compute = useServerFn(computeListingValuation);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    compute({ data: { listingId } })
      .then((res) => {
        if (!alive) return;
        setBundle(res);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Error al calcular valuación";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [listingId, compute]);

  if (loading) {
    return (
      <div className="p-6 text-center text-xs font-mono text-muted-foreground">
        Calculando valuación con 4 metodologías…
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="p-4 rounded border border-rose-300 bg-rose-50 text-xs font-mono text-rose-700">
        {error ?? "No se pudo calcular"}
      </div>
    );
  }

  if (!bundle.methods.length) {
    return (
      <div className="p-4 rounded border border-border bg-bg-elevated text-xs font-mono text-muted-foreground">
        Este listing no tiene datos suficientes (superficie / etapa) para valuar. Completa área en
        hectáreas para habilitar la valuación automática.
      </div>
    );
  }

  const v = VERDICT[bundle.gap_vs_asking.verdict];
  const VIcon = v.icon;
  const asking = bundle.gap_vs_asking.asking_usd;
  const compsMethod = bundle.methods.find((m) => m.method === "market_comps");
  const compsUsed =
    compsMethod && "comps_used" in compsMethod.inputs
      ? (compsMethod.inputs.comps_used as Array<{
          id: string;
          source: string;
          source_url: string | null;
          project_name: string;
          commodity: string;
          stage: string;
          country: string;
          price_per_ha_usd: number;
          deal_date: string | null;
          score: number;
        }>)
      : [];

  return (
    <div className="space-y-4">
      {/* Rango consolidado */}
      <section className="rounded-xl border border-border bg-bg-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-gold" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider">
            Valuación consolidada (USD)
          </h3>
          <span className="ml-auto text-[9px] font-mono text-muted-foreground uppercase">
            {bundle.methods.length} metodologías
          </span>
        </div>

        {bundle.consolidated && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <RangeBox label="Low" value={bundle.consolidated.low} />
              <RangeBox label="Mid" value={bundle.consolidated.mid} highlight />
              <RangeBox label="High" value={bundle.consolidated.high} />
            </div>

            {/* Barra vs asking */}
            <div className="relative h-8 rounded bg-background border border-border overflow-hidden">
              <div
                className="absolute inset-y-0 opacity-25"
                style={{
                  left: "10%",
                  right: "10%",
                  background: `linear-gradient(90deg, oklch(0.72 0.14 250), ${v.color}, oklch(0.72 0.14 250))`,
                }}
              />
              {asking && bundle.consolidated.high > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                  style={{
                    left: `${Math.min(95, Math.max(5, (asking / bundle.consolidated.high) * 90))}%`,
                  }}
                  title={`Asking: ${fmtUSD(asking)}`}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px] font-mono text-foreground">
                <span>{fmtUSD(bundle.consolidated.low)}</span>
                <span>{fmtUSD(bundle.consolidated.high)}</span>
              </div>
            </div>
          </>
        )}

        <div
          className={`mt-3 flex items-center gap-2 rounded border px-3 py-2 text-[11px] font-mono ${v.className}`}
        >
          <VIcon className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">{v.label}</div>
            {asking != null && bundle.gap_vs_asking.delta_pct != null && (
              <div className="text-[10px] opacity-80 mt-0.5">
                Asking: {fmtUSD(asking)} · Δ vs mid:{" "}
                {bundle.gap_vs_asking.delta_mid_usd! >= 0 ? "+" : ""}
                {fmtUSD(bundle.gap_vs_asking.delta_mid_usd!)} (
                {bundle.gap_vs_asking.delta_pct.toFixed(1)}%)
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Metodologías */}
      <section>
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Desglose por metodología
        </h3>
        <div className="space-y-1.5">
          {bundle.methods.map((m) => {
            const meta = METHOD_META[m.method];
            const Icon = meta?.icon ?? Calculator;
            const open = openMethod === m.method;
            return (
              <div key={m.method} className="rounded border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setOpenMethod(open ? null : m.method)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-elevated transition"
                >
                  <span
                    className="grid place-items-center w-7 h-7 rounded shrink-0"
                    style={{ background: `${meta?.color}22`, color: meta?.color }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-semibold text-foreground">
                      {meta?.label ?? m.method}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {fmtUSD(m.low)} · <span className="text-gold">{fmtUSD(m.mid)}</span> ·{" "}
                      {fmtUSD(m.high)}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/60 bg-bg-elevated/50">
                    <p className="text-[11px] font-mono text-foreground/80 leading-relaxed">
                      {meta?.desc}
                    </p>
                    <p className="mt-2 text-[10px] font-mono text-muted-foreground leading-relaxed">
                      {m.rationale}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparables públicos */}
      {compsUsed.length > 0 && (
        <section className="rounded border border-border bg-background">
          <button
            type="button"
            onClick={() => setShowComps((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-elevated transition"
          >
            <Database className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-mono font-semibold">
              Comparables usados ({compsUsed.length})
            </span>
            <span className="ml-auto text-[9px] font-mono text-muted-foreground uppercase">
              TSX-V · ASX · S&P · SERNAGEOMIN · MinersLink
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition ${showComps ? "rotate-180" : ""}`}
            />
          </button>
          {showComps && (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-mono">
                <thead className="bg-bg-elevated/60 text-muted-foreground uppercase">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Proyecto</th>
                    <th className="px-2 py-1.5 text-left">País</th>
                    <th className="px-2 py-1.5 text-left">Etapa</th>
                    <th className="px-2 py-1.5 text-right">US$/ha</th>
                    <th className="px-2 py-1.5 text-left">Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {compsUsed.map((c) => (
                    <tr key={c.id} className="border-t border-border/50">
                      <td
                        className="px-2 py-1.5 text-foreground truncate max-w-[160px]"
                        title={c.project_name}
                      >
                        {c.project_name}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.country}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.stage}</td>
                      <td className="px-2 py-1.5 text-right text-gold font-semibold">
                        {c.price_per_ha_usd.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5">
                        {c.source_url ? (
                          <a
                            href={c.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-gold hover:underline"
                          >
                            {c.source} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{c.source}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Nota metodológica */}
      <div className="rounded border border-border bg-bg-elevated/60 p-3 text-[10px] font-mono text-muted-foreground leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 text-gold" />
        <strong>Valuación referencial no vinculante.</strong> Se calcula con datos públicos
        verificables (área concesionada, etapa, recurso NI 43-101 si existe, escenario económico
        cargado y comparables de mercado). Ponderación: DCF &gt; Comps &gt; In-situ &gt; Reemplazo.
        Un veredicto "precio bajo" no obliga al titular a subir precio; es un input para
        negociación.
      </div>
    </div>
  );
}

function RangeBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border px-2 py-1.5 text-center ${
        highlight ? "border-gold bg-gold/10" : "border-border bg-background"
      }`}
    >
      <div className="text-[9px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className={`text-xs font-mono font-bold ${highlight ? "text-gold" : "text-foreground"}`}>
        {fmtUSD(value)}
      </div>
    </div>
  );
}
