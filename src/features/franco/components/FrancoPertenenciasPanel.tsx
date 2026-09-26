import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, MapPin } from "lucide-react";
import { Card } from "@/features/palmeras/components/primitives/Card";
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

function canonicalRows(rows: FrancoPertenenciaMatch[]) {
  const rank = { EXACT: 4, GEOM: 3, "NAME~": 2, NONE: 1 } as const;
  const byId = new Map<string, FrancoPertenenciaMatch>();
  for (const row of rows) {
    if (!row.concessionId || !row.concessionCode) continue;
    const prev = byId.get(row.concessionId);
    if (!prev || rank[row.matchKind] > rank[prev.matchKind]) byId.set(row.concessionId, row);
  }
  return [...byId.values()].sort((a, b) =>
    String(a.concessionName ?? "").localeCompare(String(b.concessionName ?? ""), "es"),
  );
}

function downloadCsv(name: string, rows: FrancoPertenenciaMatch[]) {
  const keys: (keyof FrancoPertenenciaMatch)[] = [
    "concessionCode",
    "concessionName",
    "holder",
    "type",
    "status",
    "areaHaDb",
    "commune",
    "region",
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
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando catastro Cholqui…
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6" accent="copper">
        <SectionTitle icon={MapPin}>Error cargando catastro Cholqui</SectionTitle>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Sin datos"}
        </p>
      </Card>
    );
  }

  const concessions = canonicalRows(data.rows);
  const canonicalAreaHa = concessions.reduce((sum, row) => sum + (row.areaHaDb ?? 0), 0);
  const uniqueHolders = new Set(concessions.map((row) => row.holder).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Concesiones catastro",
            value: String(concessions.length),
            sub: "registros únicos",
          },
          {
            label: "Superficie catastro",
            value: `${canonicalAreaHa.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ha`,
            sub: "suma de registros únicos",
          },
          {
            label: "Titulares",
            value: String(uniqueHolders),
            sub: "titulares únicos en catastro",
          },
          {
            label: "Fuente",
            value: "DB",
            sub: "catastro canónico del proyecto",
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
              Catastro minero · Cholqui
            </SectionTitle>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadCsv("cholqui_catastro.csv", concessions)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 font-mono text-[11px] uppercase tracking-wider"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() =>
                downloadJson("cholqui_catastro.json", {
                  projectId: data.projectId,
                  projectName: data.projectName,
                  generatedAt: data.generatedAt,
                  concessions,
                })
              }
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
                <th className="py-2 pr-3">Concesión</th>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Titular</th>
                <th className="py-2 pr-3 text-right">Área DB (ha)</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {concessions.map((r) => (
                <tr
                  key={r.concessionId ?? r.concessionCode ?? r.concessionName}
                  className="border-b border-border/50 hover:bg-bg-secondary/50"
                >
                  <td className="py-1.5 pr-3 text-foreground">{r.concessionName ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.concessionCode ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[180px]">
                    {r.holder ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-muted-foreground">
                    {r.areaHaDb?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-[11px] font-mono uppercase tracking-wider text-hint">
          Resumen para informe pre NI 43-101 · Sec. 3 (Property Description) y Anexo A (Catastro) ·{" "}
          {concessions.length} concesiones únicas ·{" "}
          {canonicalAreaHa.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ha totales.
        </div>
      </Card>
    </div>
  );
}
