import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Variation = {
  param: string;
  label: string;
  base_value: number;
  low_value: number;
  high_value: number;
  low_npv: number;
  high_npv: number;
  low_irr: number | null;
  high_irr: number | null;
  swing: number;
};

type Result = {
  base: { npv_usd: number; irr_pct: number | null; mine_life_years: number };
  variations: Variation[];
  delta_pct: number;
};

function fmtM(v: number): string {
  return `${(v / 1e6).toFixed(1)}M`;
}

export function SensitivityTornadoPanel({ scenarioId }: { scenarioId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [delta, setDelta] = useState(20);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("economics-sensitivity", {
        body: { scenario_id: scenarioId, delta_pct: delta },
      });
      if (error || !data?.ok) {
        toast.error(error?.message ?? data?.error ?? "Error en análisis");
        return;
      }
      setResult(data as Result);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result?.variations.map((v) => ({
    label: v.label,
    low: (v.low_npv - result.base.npv_usd) / 1e6,
    high: (v.high_npv - result.base.npv_usd) / 1e6,
  }));

  return (
    <div className="space-y-2 border border-border/60 rounded p-2 bg-background/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-dim uppercase">
          <Activity className="w-3 h-3" /> Sensibilidad NPV (tornado)
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-text-dim">±</label>
          <select
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5"
          >
            <option value={10}>10%</option>
            <option value={20}>20%</option>
            <option value={30}>30%</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
            disabled={loading}
            onClick={run}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Correr"}
          </Button>
        </div>
      </div>

      {result && chartData && (
        <>
          <div className="text-[10px] font-mono text-text-dim">
            Base NPV: <b className="text-foreground">${fmtM(result.base.npv_usd)}</b> · IRR:{" "}
            <b className="text-foreground">
              {result.base.irr_pct != null ? `${result.base.irr_pct.toFixed(1)}%` : "—"}
            </b>{" "}
            · Vida: {result.base.mine_life_years}a
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 90, right: 20, top: 4, bottom: 4 }}
                stackOffset="sign"
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "currentColor" }}
                  tickFormatter={(v) => `${v}M`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "currentColor" }}
                  width={88}
                />
                <ReferenceLine x={0} stroke="currentColor" />
                <Tooltip
                  contentStyle={{ fontSize: 10, fontFamily: "monospace" }}
                  formatter={(v: number) => `${v.toFixed(1)}M USD`}
                />
                <Bar dataKey="low" stackId="a">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--signal-red) / 0.7)" />
                  ))}
                </Bar>
                <Bar dataKey="high" stackId="a">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--signal-cyan) / 0.7)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[9px] font-mono text-text-dim">
            Variación NPV (M USD) vs base ante ±{result.delta_pct}% por parámetro · ordenado por
            impacto.
          </div>
        </>
      )}
    </div>
  );
}
