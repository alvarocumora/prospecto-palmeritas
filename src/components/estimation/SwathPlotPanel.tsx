// Swath plot: compositos vs bloques estimados por bandas X/Y/Z.
// Validación visual de la estimación (Sprint 1).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { swathPlotForModel } from "@/lib/miningEngine.functions";
import { Button } from "@/components/ui/button";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Loader2, BarChart2 } from "lucide-react";

type Axis = "x" | "y" | "z";
const AXES: { v: Axis; l: string }[] = [
  { v: "z", l: "Z (elevación)" },
  { v: "x", l: "X (este)" },
  { v: "y", l: "Y (norte)" },
];

export function SwathPlotPanel({ modelId, unit }: { modelId: string; unit: string }) {
  const [axis, setAxis] = useState<Axis>("z");
  const swathFn = useServerFn(swathPlotForModel);
  const query = useQuery({
    queryKey: ["swath", modelId, axis],
    queryFn: () => swathFn({ data: { modelId, axis, n_bands: 20 } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-text-dim">
          <BarChart2 className="w-3 h-3 text-signal-cyan" />
          Swath plot · {AXES.find((a) => a.v === axis)?.l}
        </div>
        <div className="flex items-center gap-1">
          {AXES.map((a) => (
            <Button
              key={a.v}
              size="sm"
              variant={axis === a.v ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setAxis(a.v)}
            >
              {a.v.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading && (
        <div className="h-40 flex items-center justify-center text-text-dim text-xs font-mono">
          <Loader2 className="w-3 h-3 mr-2 animate-spin" /> Calculando bandas…
        </div>
      )}

      {query.error instanceof Error && (
        <div className="text-[10px] font-mono text-signal-red">{query.error.message}</div>
      )}

      {query.data && query.data.bands.length === 0 && (
        <div className="text-[10px] font-mono text-text-dim">
          Sin datos suficientes — re-estima el modelo o verifica que existan compósitos
          georreferenciados.
        </div>
      )}

      {query.data && query.data.bands.length > 0 && (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={query.data.bands.map((b) => ({
                center: Number(b.center.toFixed(0)),
                comp: b.mean_composites,
                est: b.mean_blocks,
                nC: b.n_composites,
                nB: b.n_blocks,
              }))}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
              <XAxis
                dataKey="center"
                fontSize={10}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                label={{
                  value: `${axis.toUpperCase()} (m)`,
                  position: "insideBottom",
                  offset: -2,
                  fontSize: 9,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <YAxis
                fontSize={10}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                label={{
                  value: `Ley (${unit})`,
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 9,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                }}
                formatter={(v, k) => {
                  if (v == null) return "—";
                  const n = typeof v === "number" ? v : Number(v);
                  return k === "comp" || k === "est" ? n.toFixed(3) : n;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="nC" name="# compósitos" fill="hsl(var(--muted))" yAxisId={0} hide />
              <Line
                type="monotone"
                dataKey="comp"
                name="Compósitos (media)"
                stroke="#3ed5ff"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="est"
                name="Bloques estimados (media)"
                stroke="#facc15"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
