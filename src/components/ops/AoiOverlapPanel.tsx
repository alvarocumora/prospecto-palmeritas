import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Calculator } from "lucide-react";
import { computeOverlaps, aoiAreaHa, type OverlapResult } from "@/lib/catastro/overlapAnalysis";
import type { MiningConcession } from "@/hooks/useMiningConcessions";

export function AoiOverlapPanel({
  aoi,
  concessions,
  onSelectConcession,
}: {
  aoi: unknown;
  concessions: MiningConcession[];
  onSelectConcession?: (id: string) => void;
}) {
  const [computed, setComputed] = useState<OverlapResult[] | null>(null);
  const [computing, setComputing] = useState(false);

  const aoiHa = useMemo(() => (aoi ? aoiAreaHa(aoi) : 0), [aoi]);

  function handleCompute() {
    if (!aoi) return;
    setComputing(true);
    // Defer to next tick so spinner shows
    setTimeout(() => {
      const r = computeOverlaps(
        aoi,
        concessions.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          holder: c.holder,
          area_ha: c.area_ha,
          geometry_geojson: c.geometry_geojson,
        })),
      );
      setComputed(r);
      setComputing(false);
    }, 50);
  }

  const totalOverlapHa = (computed ?? []).reduce((s, r) => s + r.overlapHa, 0);
  const conflictPct = aoiHa > 0 ? (totalOverlapHa / aoiHa) * 100 : 0;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Intersección AOI ↔ catastro
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cálculo geométrico exacto vía turf.js sobre la geometría oficial.
          </p>
        </div>
        <Button size="sm" onClick={handleCompute} disabled={!aoi || computing}>
          <Calculator className={`h-3.5 w-3.5 mr-1 ${computing ? "animate-pulse" : ""}`} />
          {computing ? "Calculando..." : "Calcular"}
        </Button>
      </div>

      {!aoi && (
        <p className="text-xs text-amber-600">
          Define un AOI en el mapa o en la campaña activa para habilitar el cálculo.
        </p>
      )}

      {computed && (
        <>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">AOI total</div>
              <div className="font-mono font-semibold">{aoiHa.toFixed(1)} ha</div>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">En conflicto</div>
              <div className="font-mono font-semibold">{totalOverlapHa.toFixed(1)} ha</div>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">% AOI</div>
              <div className="font-mono font-semibold">{conflictPct.toFixed(1)}%</div>
            </div>
          </div>

          <ScrollArea className="h-[260px] pr-2">
            {computed.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Sin solapamientos detectados con las concesiones registradas.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {computed.map((r) => (
                  <li
                    key={r.concessionId}
                    className="p-2 rounded border text-xs flex items-center gap-2 hover:bg-muted/40 cursor-pointer"
                    onClick={() => onSelectConcession?.(r.concessionId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {r.concessionCode} — {r.concessionName}
                      </div>
                      <div className="text-muted-foreground truncate">{r.holder ?? "Sin titular"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold">{r.overlapHa.toFixed(1)} ha</div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 ${
                          r.pctOverlap > 50
                            ? "bg-red-500/15 text-red-600 border-red-500/30"
                            : r.pctOverlap > 20
                            ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                            : "bg-blue-500/15 text-blue-600 border-blue-500/30"
                        }`}
                      >
                        {r.pctOverlap.toFixed(1)}% concesión
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </>
      )}
    </Card>
  );
}
