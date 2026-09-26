// Panel de inteligencia de mercado para una commodity:
// - precio de referencia más reciente + sparkline del histórico corto,
// - calculadora CIF/FOB (flete + seguro) con tarifas de la tabla freight_rates,
// - comparables de mercado (deal_date, precio, ley, país).
// Datos leídos desde el servidor (RLS aplica). Solo presentación y cálculo.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Calculator, Ship, TrendingDown, TrendingUp } from "lucide-react";
import { getCommodityIntel, type IntelResult } from "@/lib/commodityIntel.functions";
import { listFreightRates, type FreightRate } from "@/lib/freight.functions";

function fmtUsd(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `US$ ${n.toLocaleString("es-CL", { maximumFractionDigits: digits })}`;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2)
    return <div className="text-[10px] text-muted-foreground">Sin histórico</div>;
  const w = 200;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - ((p - min) / range) * h}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path
        d={d}
        fill="none"
        stroke={up ? "hsl(var(--accent-brand))" : "hsl(var(--destructive))"}
        strokeWidth={1.5}
      />
    </svg>
  );
}

export type CommodityIntelPanelProps = {
  commodity: string;
  quantityT?: number | null;
};

export function CommodityIntelPanel({ commodity, quantityT }: CommodityIntelPanelProps) {
  const intelFn = useServerFn(getCommodityIntel);
  const freightFn = useServerFn(listFreightRates);
  const { data: intel, isLoading } = useQuery<IntelResult>({
    queryKey: ["commodity-intel", commodity],
    queryFn: () => intelFn({ data: { commodity } }),
    enabled: !!commodity,
    staleTime: 60_000,
  });
  const { data: rates } = useQuery<FreightRate[]>({
    queryKey: ["freight-rates"],
    queryFn: () => freightFn(),
    staleTime: 5 * 60_000,
  });

  const routes = rates ?? [];
  const origins = useMemo(() => [...new Set(routes.map((r) => r.port_origin))].sort(), [routes]);
  const [origin, setOrigin] = useState<string>("");
  const [dest, setDest] = useState<string>("");
  const [container, setContainer] = useState<"20ft" | "40ft" | "bulk_mt">("bulk_mt");
  const [insurancePct, setInsurancePct] = useState<number>(0.5);

  const dests = useMemo(
    () =>
      [
        ...new Set(
          routes.filter((r) => !origin || r.port_origin === origin).map((r) => r.port_destination),
        ),
      ].sort(),
    [routes, origin],
  );

  const rate = useMemo(() => {
    if (!origin || !dest) return null;
    const matches = routes.filter(
      (r) =>
        r.port_origin === origin && r.port_destination === dest && r.container_type === container,
    );
    return matches.sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0] ?? null;
  }, [routes, origin, dest, container]);

  const fobValue = (intel?.latest?.price ?? 0) * (quantityT ?? 0);
  const freightCost = useMemo(() => {
    if (!rate) return 0;
    if (container === "bulk_mt") return rate.usd_rate * (quantityT ?? 0);
    // Contenedor: estimamos ~25 MT por 20ft y ~28 MT por 40ft
    const perContainer = container === "20ft" ? 25 : 28;
    const containers = Math.max(1, Math.ceil((quantityT ?? 0) / perContainer));
    return rate.usd_rate * containers;
  }, [rate, container, quantityT]);
  const insurance = (fobValue + freightCost) * (insurancePct / 100);
  const cifValue = fobValue + freightCost + insurance;

  const change = intel?.latest?.change_pct ?? 0;
  const changeIcon = change >= 0 ? TrendingUp : TrendingDown;
  const ChangeIcon = changeIcon;

  return (
    <div className="rounded-md border border-hairline bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-accent-brand" />
        <h3 className="text-sm font-semibold">Inteligencia · {commodity}</h3>
      </div>

      {/* Precio + sparkline */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-hairline p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Precio de referencia
          </div>
          {isLoading ? (
            <div className="h-8 mt-1 bg-muted/30 animate-pulse rounded" />
          ) : intel?.latest ? (
            <>
              <div className="text-xl font-semibold font-mono mt-0.5">
                {fmtUsd(intel.latest.price, 2)}{" "}
                <span className="text-[10px] text-muted-foreground">/ {intel.latest.unit}</span>
              </div>
              <div
                className={`flex items-center gap-1 text-[11px] font-mono mt-0.5 ${
                  change >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                <ChangeIcon className="w-3 h-3" />
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
                <span className="text-muted-foreground ml-1">· {intel.latest.source ?? "n/d"}</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">
              Sin datos. Ingresa una lectura en <em>Precios</em>.
            </div>
          )}
        </div>
        <div className="rounded-md border border-hairline p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Histórico ({intel?.history?.length ?? 0} pts)
          </div>
          <Sparkline points={(intel?.history ?? []).map((h) => h.price)} />
        </div>
      </div>

      {/* Calculadora CIF/FOB */}
      <div className="rounded-md border border-hairline p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Calculator className="w-3.5 h-3.5 text-accent-brand" />
          Calculadora CIF/FOB · {(quantityT ?? 0).toLocaleString("es-CL")} MT
        </div>
        <div className="grid gap-2 md:grid-cols-4 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Origen</span>
            <select
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
              value={origin}
              onChange={(e) => {
                setOrigin(e.target.value);
                setDest("");
              }}
            >
              <option value="">—</option>
              {origins.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Destino</span>
            <select
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              disabled={!origin}
            >
              <option value="">—</option>
              {dests.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Modo</span>
            <select
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
              value={container}
              onChange={(e) => setContainer(e.target.value as "20ft" | "40ft" | "bulk_mt")}
            >
              <option value="bulk_mt">Bulk (USD/MT)</option>
              <option value="20ft">Contenedor 20ft</option>
              <option value="40ft">Contenedor 40ft</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono">Seguro %</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={insurancePct}
              onChange={(e) => setInsurancePct(Number(e.target.value) || 0)}
              className="rounded border border-hairline bg-transparent px-2 py-1 text-xs"
            />
          </label>
        </div>
        {rate ? (
          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Ship className="w-3 h-3" />
            {rate.port_origin} → {rate.port_destination} · {fmtUsd(rate.usd_rate, 0)}/
            {rate.container_type === "bulk_mt" ? "MT" : rate.container_type} · ETA{" "}
            {rate.transit_days ?? "?"} d · {rate.source ?? "tarifa base"}
          </div>
        ) : origin && dest ? (
          <div className="text-[10px] text-destructive">Sin tarifa para esta combinación.</div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <Kpi label="FOB" value={fmtUsd(fobValue)} />
          <Kpi label="Flete" value={fmtUsd(freightCost)} />
          <Kpi label="Seguro" value={fmtUsd(insurance)} />
          <Kpi label="CIF" value={fmtUsd(cifValue)} accent />
        </div>
      </div>

      {/* Comparables */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          Comparables recientes
        </div>
        {intel?.comparables && intel.comparables.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b border-hairline">
                  <th className="py-1 pr-2 font-mono font-normal">Fecha</th>
                  <th className="py-1 pr-2 font-mono font-normal">Proyecto</th>
                  <th className="py-1 pr-2 font-mono font-normal">País</th>
                  <th className="py-1 pr-2 font-mono font-normal">Etapa</th>
                  <th className="py-1 pr-2 font-mono font-normal">Ley</th>
                  <th className="py-1 pr-2 font-mono font-normal text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {intel.comparables.map((c) => (
                  <tr key={c.id} className="border-b border-hairline/50">
                    <td className="py-1 pr-2 font-mono">{c.deal_date ?? "—"}</td>
                    <td className="py-1 pr-2 truncate max-w-[180px]">{c.project_name}</td>
                    <td className="py-1 pr-2">{c.country}</td>
                    <td className="py-1 pr-2 text-muted-foreground">{c.stage}</td>
                    <td className="py-1 pr-2 font-mono">
                      {c.resource_grade != null
                        ? `${c.resource_grade}${c.resource_grade_unit ?? ""}`
                        : "—"}
                    </td>
                    <td className="py-1 pr-2 font-mono text-right">{fmtUsd(c.price_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Sin comparables para {commodity}.</div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded border p-2 ${accent ? "border-accent-brand bg-accent-brand/5" : "border-hairline"}`}
    >
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`text-sm font-semibold font-mono ${accent ? "text-accent-brand" : ""}`}>
        {value}
      </div>
    </div>
  );
}
