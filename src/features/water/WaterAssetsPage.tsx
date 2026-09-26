/**
 * GEOCAPITALS WATER ASSETS — LIVE MAP.
 * Terminal de activos hídricos: hero + mapa, KPIs, filtros, portafolios,
 * comparación y asset card. Dos modos: público / investor data room.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Droplets, Layers3, Lock, Search, Table2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import {
  EXERCISE_LABEL,
  VALUATION_DISCLAIMER,
  fmtCLP,
  fmtFlow,
  useWaterAssets,
  useWaterDocuments,
  useWaterHydrology,
  useWaterLegal,
  useWaterPortfolios,
  useWaterQuality,
  type WaterAsset,
} from "./data";
import { WaterLiveMap } from "./WaterLiveMap";
import { WaterAssetCard } from "./WaterAssetCard";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
      <div className="text-[9px] uppercase tracking-[0.18em] text-sky-300/80">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

export function WaterAssetsPage({ mode }: { mode: "public" | "investor" }) {
  const { data: assets = [], isLoading } = useWaterAssets();
  const { data: portfolios = [] } = useWaterPortfolios();
  const { data: legal = [] } = useWaterLegal();
  const { data: documents = [] } = useWaterDocuments();
  const { data: quality = [] } = useWaterQuality();
  const { data: hydrology = [] } = useWaterHydrology();

  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [q, setQ] = useState("");
  const [commune, setCommune] = useState("all");
  const [exercise, setExercise] = useState("all");
  const [minFlow, setMinFlow] = useState(0);
  const [activePortfolios, setActivePortfolios] = useState<string[]>([]);

  const portfolioIds = portfolios.map((p) => p.id);
  const activePf = activePortfolios.length ? activePortfolios : portfolioIds;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (
        needle &&
        !`${a.asset_id} ${a.name} ${a.river} ${a.commune}`.toLowerCase().includes(needle)
      )
        return false;
      if (commune !== "all" && a.commune !== commune) return false;
      if (exercise !== "all" && a.exercise !== exercise) return false;
      if (a.flow_permanent_ls < minFlow) return false;
      const pf = portfolios.find((p) => p.assetUuids.includes(a.id));
      if (pf && !activePf.includes(pf.id)) return false;
      return true;
    });
  }, [assets, q, commune, exercise, minFlow, portfolios, activePf]);

  const totals = useMemo(() => {
    const flow = assets.reduce((s, a) => s + a.flow_permanent_ls, 0);
    const value = assets.reduce((s, a) => s + (a.reference_value_clp ?? 0), 0);
    const communes = new Set(assets.map((a) => a.commune)).size;
    const resolutions = assets.filter((a) => a.dga_resolution).length;
    return { flow, value, communes, resolutions };
  }, [assets]);

  const current = assets.find((a) => a.id === selected) ?? null;
  const communes = Array.from(new Set(assets.map((a) => a.commune)));
  const compareAssets = assets.filter((a) => compare.includes(a.id));

  const toggleCompare = (id: string) =>
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {/* HERO */}
      <section className="relative bg-[#04122a] pb-6">
        <div className="mx-auto max-w-[1500px] px-5 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size={18} textClassName="text-[13px] text-white" />
              <span className="hidden h-4 w-px bg-white/20 sm:block" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-sky-300">
                Water Assets — Live Map
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-2.5 py-1",
                  mode === "investor"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/15 bg-white/5 text-sky-100",
                )}
              >
                <Lock className="h-3 w-3" />
                {mode === "investor" ? "Investor Data Room" : "Public Mode"}
              </span>
              {mode === "public" && (
                <Link
                  to="/auth"
                  className="rounded border border-sky-400/50 bg-sky-500/15 px-2.5 py-1 text-sky-100 hover:bg-sky-500/25"
                >
                  Acceder al data room
                </Link>
              )}
            </div>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Water Assets Intelligence
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-sky-100/80">
                Explore, analyze and evaluate strategic water rights through geospatial
                intelligence.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Total Water Assets" value={String(assets.length)} />
                <Kpi label="Permanent Flow" value={fmtFlow(totals.flow)} />
                <Kpi label="Reference Value" value={fmtCLP(totals.value)} />
                <Kpi
                  label="Communes / DGA Res."
                  value={`${totals.communes} / ${totals.resolutions}`}
                />
              </div>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-sky-300/70">
                Provincia de Osorno · Los Lagos · Chile
              </div>
            </div>

            {/* Portafolios */}
            <div className="rounded-md border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-sky-300/80">
                <Layers3 className="h-3.5 w-3.5" /> Portfolio layers
              </div>
              <div className="mt-3 space-y-2">
                {portfolios.map((p) => {
                  const pAssets = assets.filter((a) => p.assetUuids.includes(a.id));
                  const flow = pAssets.reduce((s, a) => s + a.flow_permanent_ls, 0);
                  const value = pAssets.reduce((s, a) => s + (a.reference_value_clp ?? 0), 0);
                  const on = activePf.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setActivePortfolios((prev) => {
                          const base = prev.length ? prev : portfolioIds;
                          return base.includes(p.id)
                            ? base.filter((x) => x !== p.id)
                            : [...base, p.id];
                        })
                      }
                      className={cn(
                        "flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors",
                        on
                          ? "border-sky-400/50 bg-sky-500/10"
                          : "border-white/10 bg-transparent opacity-55",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="text-[12px] font-medium text-white">{p.name}</span>
                      </span>
                      <span className="text-right text-[10px] text-sky-100/70">
                        {fmtFlow(flow)}
                        <br />
                        {fmtCLP(value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAPA + PANEL */}
      <section className="mx-auto max-w-[1500px] px-5 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-3">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por asset ID, río o comuna…"
                  className="w-full rounded border border-slate-200 py-2 pl-8 pr-3 text-[12px] outline-none focus:border-sky-500"
                />
              </div>
              <select
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="rounded border border-slate-200 px-2 py-2 text-[12px]"
              >
                <option value="all">Todas las comunas</option>
                {communes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="rounded border border-slate-200 px-2 py-2 text-[12px]"
              >
                <option value="all">Todo ejercicio</option>
                {Object.entries(EXERCISE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                Caudal ≥ {minFlow} L/s
                <input
                  type="range"
                  min={0}
                  max={1500}
                  step={100}
                  value={minFlow}
                  onChange={(e) => setMinFlow(Number(e.target.value))}
                  className="accent-sky-600"
                />
              </label>
              <button
                type="button"
                disabled={compare.length < 2}
                onClick={() => setShowCompare(true)}
                className="inline-flex items-center gap-1.5 rounded bg-[#04122a] px-3 py-2 text-[11px] font-medium text-white disabled:opacity-40"
              >
                <Table2 className="h-3.5 w-3.5" /> Compare Assets ({compare.length})
              </button>
            </div>

            <WaterLiveMap
              assets={filtered}
              portfolios={portfolios}
              activePortfolios={activePf}
              selectedId={selected}
              onSelect={setSelected}
              mode={mode}
              className="w-full overflow-hidden rounded-md border border-slate-200"
              height="620px"
            />

            {/* Listado */}
            <div className="grid gap-3 sm:grid-cols-2">
              {isLoading && <div className="text-[12px] text-slate-500">Cargando activos…</div>}
              {filtered.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  active={selected === a.id}
                  checked={compare.includes(a.id)}
                  onToggleCompare={() => toggleCompare(a.id)}
                  onSelect={() => setSelected(a.id)}
                />
              ))}
            </div>

            <p className="pt-1 text-[11px] italic text-slate-500">{VALUATION_DISCLAIMER}</p>
          </div>

          {/* Asset card */}
          <div className="lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
            <div className="h-full overflow-hidden rounded-md border border-slate-200 bg-white">
              {current ? (
                <WaterAssetCard
                  asset={current}
                  legal={legal.filter((l) => l.asset_uuid === current.id)}
                  documents={documents.filter((d) => d.asset_uuid === current.id)}
                  quality={quality.find((qq) => qq.asset_uuid === current.id) ?? null}
                  hydrology={hydrology.find((h) => h.asset_uuid === current.id) ?? null}
                  mode={mode}
                  onClose={() => setSelected(null)}
                  onRequestInfo={() => {
                    window.location.href =
                      mode === "investor"
                        ? "/dashboard/agua"
                        : `/contacto?asunto=${encodeURIComponent(`Water asset ${current.asset_id}`)}`;
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <Droplets className="h-8 w-8 text-sky-500" />
                  <p className="text-[13px] text-slate-600">
                    Selecciona un activo en el mapa o en el listado para abrir su ficha técnica,
                    jurídica y de valorización.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showCompare && compareAssets.length > 1 && (
        <CompareModal assets={compareAssets} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}

function AssetRow({
  asset,
  active,
  checked,
  onSelect,
  onToggleCompare,
}: {
  asset: WaterAsset;
  active: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCompare: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-3 transition-colors",
        active ? "border-sky-500 shadow-sm" : "border-slate-200 hover:border-sky-300",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 text-left">
          <div className="font-mono text-[9.5px] tracking-[0.16em] text-sky-700">
            {asset.asset_id}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">
            {asset.river}
          </div>
          <div className="text-[11px] text-slate-500">
            {asset.commune} · {asset.province}
          </div>
        </button>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500">
          <input
            type="checkbox"
            className="accent-sky-600"
            checked={checked}
            onChange={onToggleCompare}
          />
          Comparar
        </label>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
        <span className="font-medium text-slate-900">{fmtFlow(asset.flow_permanent_ls)}</span>
        <span className="text-slate-600">{fmtCLP(asset.reference_value_clp)}</span>
      </div>
    </div>
  );
}

function CompareModal({ assets, onClose }: { assets: WaterAsset[]; onClose: () => void }) {
  const rows: Array<[string, (a: WaterAsset) => string]> = [
    ["Asset ID", (a) => a.asset_id],
    ["River", (a) => a.river],
    ["Location", (a) => `${a.commune} · ${a.province}`],
    ["Permanent Flow", (a) => fmtFlow(a.flow_permanent_ls)],
    ["Eventual Flow", (a) => (a.flow_eventual_ls ? fmtFlow(a.flow_eventual_ls) : "—")],
    ["Right Type", (a) => (a.nature === "consuntivo" ? "Consumptive" : "Non-consumptive")],
    ["Exercise", (a) => EXERCISE_LABEL[a.exercise] ?? a.exercise],
    ["DGA Resolution", (a) => `${a.dga_resolution ?? "—"} (${a.dga_resolution_date ?? "s/f"})`],
    [
      "Registry Status",
      (a) => (a.verification_status === "documented" ? "Documented" : "Declared"),
    ],
    ["Reference Value", (a) => fmtCLP(a.reference_value_clp)],
  ];
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/70 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-md bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-[14px] font-semibold">Compare Assets</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <table className="w-full text-[12px]">
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-b border-slate-100">
                <th className="w-44 bg-slate-50 px-4 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-slate-500">
                  {label}
                </th>
                {assets.map((a) => (
                  <td key={a.id} className="px-4 py-2 text-slate-900">
                    {fn(a)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
