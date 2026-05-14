import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { Card } from "@/features/palmeras/components/primitives/Card";
import { SectionTitle } from "@/features/palmeras/components/primitives/SectionTitle";
import { Badge } from "@/features/palmeras/components/primitives/Badge";
import { getFrancoCadastreCross, type FrancoCadastreCross, type FrancoPertenenciaMatch } from "@/lib/franco-cadastre.functions";

const PROJECT_TITLE = "Prospecto Franco (Gianfranco)";
const REGION = "Valparaíso, Chile";

function buildHtml(d: FrancoCadastreCross): string {
  const exact = d.rows.filter((r) => r.matchKind === "EXACT");
  const rowsHtml = d.rows
    .map(
      (r) => `<tr>
        <td>${r.kmlName}</td>
        <td>${r.concessionCode ?? "—"}</td>
        <td>${r.concessionName ?? "—"}</td>
        <td>${r.holder ?? "—"}</td>
        <td style="text-align:right">${r.areaHaDb?.toFixed(2) ?? "—"}</td>
        <td style="text-align:right">${r.overlapHa.toFixed(2)}</td>
        <td style="text-align:right">${r.pctOfKml.toFixed(1)}%</td>
        <td>${r.matchKind}</td>
        <td>${r.status ?? "—"}</td>
      </tr>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Borrador NI 43-101 · ${PROJECT_TITLE}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:980px;margin:32px auto;padding:0 24px;line-height:1.55}
  h1{font-size:22px;border-bottom:2px solid #d4af37;padding-bottom:6px}
  h2{font-size:16px;margin-top:28px;color:#7a5b00}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
  th,td{border:1px solid #ddd;padding:4px 6px}
  th{background:#f6f1e0;text-align:left}
  .meta{font-size:11px;color:#666}
  .kpi{display:inline-block;border:1px solid #d4af37;border-radius:4px;padding:6px 10px;margin:4px 6px 0 0}
</style></head><body>
<h1>Borrador NI 43-101 · ${PROJECT_TITLE}</h1>
<div class="meta">Generado ${new Date(d.generatedAt).toLocaleString("es-CL")} · Fuente: KMZ "FINAL_GIANFRANCO" × catastro real (mining_concessions)</div>

<h2>Sec. 3 — Property Description and Location</h2>
<p>El prospecto <b>${PROJECT_TITLE}</b> se ubica en la Región de ${REGION}. La propiedad minera está
constituida por <b>${exact.length} pertenencias confirmadas</b> en el catastro nacional, totalizando
<b>${d.totalAreaHa.toLocaleString("es-CL")} ha</b> bajo control del titular. El KMZ aportado por el
operador contiene <b>${d.totalKmlPolygons} polígonos</b>, de los cuales <b>${d.matchedKmlPolygons}</b>
fueron cruzados espacial y/o nominativamente contra <b>${d.uniqueConcessions} concesiones</b> en la
base de datos.</p>
<div>
  <span class="kpi">Polígonos KMZ: <b>${d.totalKmlPolygons}</b></span>
  <span class="kpi">Match catastro: <b>${d.matchedKmlPolygons}/${d.totalKmlPolygons}</b></span>
  <span class="kpi">Concesiones únicas: <b>${d.uniqueConcessions}</b></span>
  <span class="kpi">Superficie: <b>${d.totalAreaHa.toLocaleString("es-CL")} ha</b></span>
</div>
<p><b>Estado de titulación.</b> Las pertenencias confirmadas figuran en el rol catastral con código
<code>GF-CONC-*</code> y status SERNAGEOMIN reportado en la tabla del Anexo A. Las geometrías sin
match (${d.rows.filter((r) => r.matchKind === "NONE").length}) corresponden a polígonos auxiliares
del KMZ y deben revisarse en QGIS antes de la auditoría QP.</p>

<h2>Anexo A — Pertenencias KMZ × Catastro real</h2>
<table>
  <thead><tr>
    <th>KMZ</th><th>Código</th><th>Concesión DB</th><th>Titular</th>
    <th>Área DB (ha)</th><th>Overlap (ha)</th><th>% KML</th><th>Match</th><th>Status</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<p class="meta">Match: EXACT = mismo nombre y geometría · GEOM = solapamiento espacial · NAME~ = coincidencia
nominal aproximada · NONE = sin contraparte en DB.</p>
</body></html>`;
}

export function FrancoNI43101DraftPanel() {
  const fn = useServerFn(getFrancoCadastreCross);
  const { data, isLoading, error } = useQuery({
    queryKey: ["franco-cadastre-cross"],
    queryFn: () => fn({ data: {} as never }),
    staleTime: 60_000,
  });

  const handleExportHtml = useCallback(() => {
    if (!data) return;
    const html = buildHtml(data);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "franco_ni43101_borrador.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const handlePrintPdf = useCallback(() => {
    if (!data) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(buildHtml(data));
    w.document.close();
    setTimeout(() => w.print(), 300);
  }, [data]);

  if (isLoading) {
    return (
      <Card className="p-6" accent="gold">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Compilando borrador NI 43-101…
        </div>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card className="p-6" accent="copper">
        <SectionTitle icon={FileText}>Borrador NI 43-101 — error</SectionTitle>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Sin datos para generar el borrador."}
        </p>
      </Card>
    );
  }

  const exact = data.rows.filter((r) => r.matchKind === "EXACT");
  const noMatch = data.rows.filter((r) => r.matchKind === "NONE");
  const previewRows = data.rows.slice(0, 8);

  return (
    <Card className="p-6" accent="gold">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <SectionTitle
          icon={FileText}
          sub={`Pre NI 43-101 · Sec. 3 Property + Anexo A · generado ${new Date(data.generatedAt).toLocaleString("es-CL")}`}
        >
          Borrador NI 43-101 · {PROJECT_TITLE}
        </SectionTitle>
        <div className="flex gap-2">
          <button
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 font-mono text-[11px] uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" /> Imprimir PDF
          </button>
          <button
            onClick={handleExportHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground font-mono text-[11px] uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" /> HTML
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <DraftSection title="Sec. 3 — Property Description and Location">
          <p>
            El prospecto <b>{PROJECT_TITLE}</b> se ubica en la Región de {REGION}. La propiedad minera
            está constituida por <b>{exact.length} pertenencias confirmadas</b> en el catastro nacional,
            totalizando <b>{data.totalAreaHa.toLocaleString("es-CL")} ha</b> bajo control del titular.
            El KMZ aportado por el operador contiene <b>{data.totalKmlPolygons} polígonos</b>, de los
            cuales <b>{data.matchedKmlPolygons}</b> fueron cruzados espacial y/o nominativamente contra{" "}
            <b>{data.uniqueConcessions} concesiones</b> en la base de datos.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {[
              { l: "Polígonos KMZ", v: String(data.totalKmlPolygons) },
              { l: "Match catastro", v: `${data.matchedKmlPolygons}/${data.totalKmlPolygons}` },
              { l: "Concesiones", v: String(data.uniqueConcessions) },
              { l: "Superficie (ha)", v: data.totalAreaHa.toLocaleString("es-CL") },
            ].map((k) => (
              <div key={k.l} className="rounded border border-gold/30 bg-gold/5 p-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-hint">{k.l}</div>
                <div className="font-mono text-base text-foreground">{k.v}</div>
              </div>
            ))}
          </div>
          <p className="mt-3">
            <b>Estado de titulación.</b> Las pertenencias confirmadas figuran en el rol catastral con
            código <code>GF-CONC-*</code> y status SERNAGEOMIN reportado en el Anexo A. Las{" "}
            <b>{noMatch.length}</b> geometrías sin match corresponden a polígonos auxiliares del KMZ y
            deben revisarse en QGIS antes de la auditoría QP.
          </p>
        </DraftSection>

        <DraftSection title={`Anexo A — Pertenencias KMZ × Catastro (preview ${previewRows.length}/${data.rows.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-hint uppercase tracking-wider border-b border-border">
                  <th className="py-2 pr-3">KMZ</th>
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Concesión DB</th>
                  <th className="py-2 pr-3 text-right">Área (ha)</th>
                  <th className="py-2 pr-3 text-right">Overlap</th>
                  <th className="py-2 pr-3">Match</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r: FrancoPertenenciaMatch, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 text-foreground">{r.kmlName}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{r.concessionCode ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{r.concessionName ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{r.areaHaDb?.toFixed(2) ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right text-foreground">{r.overlapHa.toFixed(2)}</td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={r.matchKind === "EXACT" ? "teal" : r.matchKind === "GEOM" ? "gold" : r.matchKind === "NAME~" ? "muted" : "alert"}>
                        {r.matchKind}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11px] font-mono uppercase tracking-wider text-hint">
            Tabla completa ({data.rows.length} filas) en el HTML/PDF exportado.
          </div>
        </DraftSection>
      </div>
    </Card>
  );
}

function DraftSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-l-2 border-gold/40 pl-4">
      <div className="font-mono text-[11px] uppercase tracking-widest text-gold mb-2">{title}</div>
      <div className="text-sm text-foreground/90 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
