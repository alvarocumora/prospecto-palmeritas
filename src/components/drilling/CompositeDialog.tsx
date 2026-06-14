import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { compositeHole } from "@/lib/miningEngine.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DrillHole } from "@/hooks/useDrilling";
import { Loader2 } from "lucide-react";

type Props = { hole: DrillHole; onClose: () => void };

export function CompositeDialog({ hole, onClose }: Props) {
  const [length, setLength] = useState(1);
  const [minRecovery, setMinRecovery] = useState(0.5);
  const fn = useServerFn(compositeHole);
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["composite", hole.id, length, minRecovery],
    queryFn: () => fn({ data: { holeId: hole.id, length, minRecovery } }),
    enabled: false,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compositar — {hole.hole_id}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <div className="text-text-secondary mb-1">Longitud (m)</div>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={length}
              onChange={(e) => setLength(Number(e.target.value) || 1)}
              className="w-24 px-2 py-1 rounded border bg-background"
            />
          </label>
          <label className="text-sm">
            <div className="text-text-secondary mb-1">Recovery mín.</div>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={minRecovery}
              onChange={(e) => setMinRecovery(Number(e.target.value) || 0)}
              className="w-24 px-2 py-1 rounded border bg-background"
            />
          </label>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-2"
          >
            {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            Calcular compuestos
          </button>
        </div>

        {error && <div className="text-destructive text-sm">{String(error)}</div>}

        {data && (
          <div className="space-y-2">
            <div className="text-sm text-text-secondary">
              {data.count} compuestos generados desde {data.source_intervals} intervalos
            </div>
            <div className="max-h-80 overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">From</th>
                    <th className="px-2 py-1 text-left">To</th>
                    <th className="px-2 py-1 text-right">Rec.</th>
                    <th className="px-2 py-1 text-right">Au g/t</th>
                    <th className="px-2 py-1 text-right">Ag g/t</th>
                    <th className="px-2 py-1 text-right">Cu %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.composites.map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{c.from.toFixed(2)}</td>
                      <td className="px-2 py-1">{c.to.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{(c.recovery * 100).toFixed(0)}%</td>
                      <td className="px-2 py-1 text-right">{fmt(c.values.au_gpt)}</td>
                      <td className="px-2 py-1 text-right">{fmt(c.values.ag_gpt)}</td>
                      <td className="px-2 py-1 text-right">{fmt(c.values.cu_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function fmt(v: number | null | undefined) {
  return v == null ? "—" : v.toFixed(2);
}
