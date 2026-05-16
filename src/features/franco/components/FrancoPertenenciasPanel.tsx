import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, MapPin } from "lucide-react";
import { Card } from "@/features/palmeras/components/primitives/Card";
import { Badge } from "@/features/palmeras/components/primitives/Badge";
import { SectionTitle } from "@/features/palmeras/components/primitives/SectionTitle";
import {
  getFrancoCadastreCross,
  type FrancoPertenenciaMatch,
} from "@/lib/franco-cadastre.functions";

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(name: string, rows: FrancoPertenenciaMatch[]) {
  const keys: (keyof FrancoPertenenciaMatch)[] = [
    "kmlName",
    "concessionCode",
    "concessionName",
    "holder",
    "type",
    "status",
    "areaHaDb",
    "commune",
    "region",
    "overlapHa",
    "pctOfKml",
    "pctOfConcession",
    "matchKind",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function FrancoPertenenciasPanel() {
  const fn = useServerFn(getFrancoCadastreCross);
  const { data, isLoading, error } = useQuery({
    queryKey: ["franco-cadastre-cross"],
    queryFn: () => fn({ data: {} as never }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="p-6" accent="gold">
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs uppercase tracking-wider">
          <Loader2 className="w-4 h-4 animate-spin" /> Cruzando KMZ × catastro real…
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6" accent="copper">
        <SectionTitle icon={MapPin}>Error en cruce KMZ × catastro</SectionTitle>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Sin datos"}
        </p>
      </Card>
    );
  }

  const exact = data.rows.filter((r) => r.matchKind === "EXACT");
  const overlaps = data.rows.filter((r) => r.matchKind === "GEOM" && r.overlapHa > 0.5);
  const noMatch = data.rows.filter((r) => r.matchKind === "NONE");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Pertenencias KMZ",
            value: String(data.totalKmlPolygons),
            sub: "polígonos importados",
          },
          {
            label: "Match en catastro",
            value: `${data.matchedKmlPolygons}/${data.totalKmlPolygons}`,
            sub: "con concesión real",
          },
          {
            label: "Concesiones únicas",
            value: String(data.uniqueConcessions),
            sub: "GF-CONC-* en DB",
          },
          {
            label: "Superficie total",
            value: `${data.totalAreaHa.toLocaleString("es-CL")} ha`,
            sub: "matches exactos",
          },
        ].map((m, i) => (
          <Card key={m.label} delay={i * 80} className="p-4" accent="gold">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-2">
              {m.label}
            </div>
            <div className="font-mono text-2xl text-foreground font-semibold">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <SectionTitle
              icon={MapPin}
              sub={`Proyecto: ${data.projectName ?? "—"} · ${new Date(data.generatedAt).toLocaleString("es-CL")}`}
            >
              Pertenencias KMZ × Catastro real
            </SectionTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadCsv("franco_kmz_x_catastro.csv", data.rows)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 font-mono text-[11px] uppercase tracking-wider"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => downloadJson("franco_kmz_x_catastro.json", data)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground font-mono text-[11px] uppercase tracking-wider"
            >
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left text-hint uppercase tracking-wider border-b border-border">
                <th className="py-2 pr-3">KMZ</th>
                <th className="py-2 pr-3">Concesión DB</th>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Titular</th>
                <th className="py-2 pr-3 text-right">Área DB (ha)</th>
                <th className="py-2 pr-3 text-right">Overlap (ha)</th>
                <th className="py-2 pr-3 text-right">% KML</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-bg-secondary/50">
                  <td className="py-1.5 pr-3 text-foreground">{r.kmlName}</td>
                  <td className="py-1.5 pr-3 text-foreground">{r.concessionName ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.concessionCode ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[180px]">
                    {r.holder ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-muted-foreground">
                    {r.areaHaDb?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-foreground">
                    {r.overlapHa.toFixed(2)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-muted-foreground">
                    {r.pctOfKml.toFixed(1)}%
                  </td>
                  <td className="py-1.5 pr-3">
                    <Badge
                      tone={
                        r.matchKind === "EXACT"
                          ? "teal"
                          : r.matchKind === "GEOM"
                            ? "gold"
                            : r.matchKind === "NAME~"
                              ? "muted"
                              : "alert"
                      }
                    >
                      {r.matchKind}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {overlaps.length > 0 && (
          <div className="mt-4 p-3 rounded border border-gold/30 bg-gold/5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold mb-1">
              ⚠ Superposiciones internas
            </div>
            <div className="text-xs text-muted-foreground">
              {overlaps.length} cruces espaciales secundarios &gt;0.5 ha entre pertenencias
              contiguas (revisar en QGIS).
            </div>
          </div>
        )}
        {noMatch.length > 0 && (
          <div className="mt-2 p-3 rounded border border-alert/30 bg-alert/5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-alert mb-1">
              Sin match
            </div>
            <div className="text-xs text-muted-foreground">
              {noMatch.length} polígonos del KMZ sin contraparte en catastro DB (probables
              geometrías auxiliares).
            </div>
          </div>
        )}

        <div className="mt-4 text-[11px] font-mono uppercase tracking-wider text-hint">
          Resumen para informe pre NI 43-101 · Sec. 3 (Property Description) y Anexo A (Catastro) ·{" "}
          {exact.length} pertenencias confirmadas · {data.totalAreaHa.toLocaleString("es-CL")} ha
          totales.
        </div>
      </Card>
    </div>
  );
}
