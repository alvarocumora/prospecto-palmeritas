import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  MapPin,
  Gauge,
  AlertTriangle,
  Layers,
  Send,
  Loader2,
  ArrowUpRight,
  RefreshCw,
  Brain,
  Map as MapIcon,
  Table as TableIcon,
} from "lucide-react";
import {
  listOpportunities,
  scoreCadastreOpportunities,
} from "@/lib/cadastreOpportunities.functions";
import { askOpportunityCopilot } from "@/lib/opportunityCopilot.functions";
import { OpportunitiesMap } from "@/features/opportunities/OpportunitiesMap";

export const Route = createFileRoute("/_authenticated/dashboard/opportunities")({
  head: () => ({ meta: [{ title: "Oportunidades IA — Geocapitals" }] }),
  component: OpportunitiesPage,
});

const REGIONS = [
  "",
  "Atacama",
  "Antofagasta",
  "Coquimbo",
  "Valparaíso",
  "Tarapacá",
  "Arica y Parinacota",
  "O'Higgins",
];
const COMMODITIES = ["", "cu", "au", "ag", "li", "fe", "mo", "zn"];
const RISKS = ["", "alto", "medio", "bajo"];

function OpportunitiesPage() {
  const list = useServerFn(listOpportunities);
  const score = useServerFn(scoreCadastreOpportunities);
  const ask = useServerFn(askOpportunityCopilot);

  const [region, setRegion] = useState("");
  const [commodity, setCommodity] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [expiryRisk, setExpiryRisk] = useState("");
  const [maxDist, setMaxDist] = useState<number | "">("");
  const [question, setQuestion] = useState("");
  const [view, setView] = useState<"map" | "table">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queryKey = ["opportunities", { region, commodity, minScore, expiryRisk, maxDist }];

  const opps = useQuery({
    queryKey,
    queryFn: () =>
      list({
        data: {
          region: region || undefined,
          commodity: commodity || undefined,
          minScore,
          expiryRisk: (expiryRisk || undefined) as "bajo" | "medio" | "alto" | undefined,
          maxDistanceKm: typeof maxDist === "number" ? maxDist : undefined,
        },
      }),
  });

  const runScore = useMutation({
    mutationFn: () => score({ data: { limit: 200, withAiExplanation: true } }),
    onSuccess: () => opps.refetch(),
  });

  const copilot = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q } }),
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-yellow-500" />
            Oportunidades IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Ranking en vivo de concesiones del catastro nacional. Cruzamos PostGIS (yacimientos +
            anomalías satelitales) con un explainer de Lovable AI para que veas, por cada concesión,
            la tesis de inversión y la acción sugerida.
          </p>
        </div>
        <button
          onClick={() => runScore.mutate()}
          disabled={runScore.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {runScore.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Recomputar ranking
        </button>
      </header>

      {runScore.data && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          Procesadas <b>{runScore.data.processed}</b> · explicadas por IA{" "}
          <b>{runScore.data.aiExplained}</b> · top score <b>{runScore.data.topScore}</b>
        </div>
      )}
      {runScore.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">
          {(runScore.error as Error).message}
        </div>
      )}

      {/* Geo Copilot */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-5 w-5 text-purple-500" />
          <h2 className="font-semibold">Geo Copilot</h2>
          <span className="text-xs text-muted-foreground">Pregúntale en español</span>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) copilot.mutate(question.trim());
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ej: muéstrame concesiones de cobre en Atacama cerca de yacimientos con anomalía satelital"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={copilot.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {copilot.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Preguntar
          </button>
        </form>
        {copilot.data && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 text-sm whitespace-pre-wrap">
              {copilot.data.narrative}
            </div>
            <div className="text-xs text-muted-foreground">
              Filtros detectados: <code>{JSON.stringify(copilot.data.filters)}</code> ·{" "}
              {copilot.data.results.length} resultados
            </div>
          </div>
        )}
      </section>

      {/* Filtros */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r || "Todas las regiones"}
            </option>
          ))}
        </select>
        <select
          value={commodity}
          onChange={(e) => setCommodity(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {COMMODITIES.map((c) => (
            <option key={c} value={c}>
              {c ? c.toUpperCase() : "Todos los commodities"}
            </option>
          ))}
        </select>
        <select
          value={expiryRisk}
          onChange={(e) => setExpiryRisk(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {r ? `Riesgo ${r}` : "Cualquier riesgo"}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          placeholder="Score mínimo"
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          value={maxDist === "" ? "" : maxDist}
          onChange={(e) => setMaxDist(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Dist. max yacimiento (km)"
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </section>

      {/* View tabs */}
      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setView("map")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === "map"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" /> Mapa
            </button>
            <button
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === "table"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" /> Tabla
            </button>
          </div>
          <h2 className="font-semibold flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4" /> Ranking de oportunidades
          </h2>
          <span className="text-xs text-muted-foreground">
            {opps.data?.items.length ?? 0} resultados
          </span>
        </div>

        {view === "map" ? (
          <div className="p-3">
            <OpportunitiesMap
              region={region}
              minScore={minScore}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selectedId &&
              opps.data?.items &&
              (() => {
                const sel = opps.data.items.find((o) => o.concession_id === selectedId);
                if (!sel) return null;
                return (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {sel.holder_name ?? "Concesión"} · score {sel.score}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sel.region ?? ""}
                          {sel.commune ? ` · ${sel.commune}` : ""} ·{" "}
                          {sel.area_ha ? `${Number(sel.area_ha).toFixed(0)} ha` : ""}
                        </div>
                        {sel.ai_thesis && <p className="text-xs mt-2 max-w-2xl">{sel.ai_thesis}</p>}
                        {sel.ai_action && (
                          <p className="text-xs mt-1 text-blue-700 inline-flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" /> {sel.ai_action}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        ) : opps.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Cargando…
          </div>
        ) : !opps.data?.items.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay oportunidades scoreadas todavía. Pulsa <b>Recomputar ranking</b> para iniciar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Score</th>
                  <th className="text-left px-3 py-2">Concesión</th>
                  <th className="text-left px-3 py-2">Región</th>
                  <th className="text-left px-3 py-2">Commodity</th>
                  <th className="text-right px-3 py-2">Dist. yacimiento</th>
                  <th className="text-right px-3 py-2">Anomalías</th>
                  <th className="text-left px-3 py-2">Riesgo patente</th>
                  <th className="text-left px-3 py-2">Tesis IA</th>
                  <th className="text-left px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {opps.data.items.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => {
                      setSelectedId(o.concession_id);
                      setView("map");
                    }}
                    className={`border-t cursor-pointer transition ${
                      selectedId === o.concession_id ? "bg-amber-500/10" : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          o.score >= 70
                            ? "bg-emerald-500/15 text-emerald-700"
                            : o.score >= 50
                              ? "bg-amber-500/15 text-amber-700"
                              : "bg-slate-500/15 text-slate-600"
                        }`}
                      >
                        <Gauge className="h-3 w-3" /> {o.score}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.holder_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.area_ha ? `${Number(o.area_ha).toFixed(0)} ha` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3" /> {o.region ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">{o.commune ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {(o.commodity_hint ?? []).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {o.deposit_proximity_km != null
                        ? `${Number(o.deposit_proximity_km).toFixed(1)} km`
                        : "—"}
                      {o.nearest_deposit_name && (
                        <div className="text-[10px] text-muted-foreground">
                          {o.nearest_deposit_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{o.anomaly_overlap_count}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs rounded px-1.5 py-0.5 ${
                          o.expiry_risk === "alto"
                            ? "bg-red-500/15 text-red-700"
                            : o.expiry_risk === "medio"
                              ? "bg-amber-500/15 text-amber-700"
                              : "bg-emerald-500/15 text-emerald-700"
                        }`}
                      >
                        {o.expiry_risk ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-sm">
                      {o.ai_thesis ?? (
                        <span className="text-muted-foreground italic">
                          Sin tesis (score &lt; 35)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {o.ai_action ? (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          {o.ai_action} <ArrowUpRight className="h-3 w-3" />
                        </span>
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
      </section>

      <p className="text-xs text-muted-foreground text-center">
        <AlertTriangle className="h-3 w-3 inline mr-1" />
        El scoring combina heurística (proximidad, anomalías, tamaño, riesgo de caducidad) y una
        explicación generada por Lovable AI. Verifica siempre con due diligence.
      </p>

      <div className="text-center">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Volver al dashboard
        </Link>
      </div>
    </div>
  );
}
