import { useMemo, useState } from "react";
import {
  Loader2,
  FileText,
  Download,
  Printer,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useNi43101Draft } from "@/hooks/useNi43101Draft";
import type { Ni43101Draft } from "@/lib/ni43101Draft.functions";
import { Ni43101GeoExport } from "./Ni43101GeoExport";

interface Props {
  projectId: string | null;
}

const fmt = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);
const fmtSign = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d);

function buildMarkdown(d: Ni43101Draft): string {
  const today = new Date().toISOString().slice(0, 10);
  const tableHyper = [
    "| Sensor | Mineral | Ensamblaje | Score medio | Score máx | Área (ha) | Celdas > umbral | Adquisición |",
    "|---|---|---|---|---|---|---|---|",
    ...d.hyperspectral.map(
      (h) =>
        `| ${h.source} | ${h.mineral} | ${h.assemblage ?? "—"} | ${fmt(h.meanScore)} | ${fmt(h.maxScore)} | ${fmt(h.areaHa, 1)} | ${h.cellsAboveThreshold ?? "—"} | ${h.acquisitionDate} |`,
    ),
  ].join("\n");
  const tableInsarTop = [
    "| Activo | Tipo | Severidad | Velocidad mm/a | Σ desp. mm | Coherencia | Periodo |",
    "|---|---|---|---|---|---|---|",
    ...d.insar
      .slice(0, 15)
      .map(
        (i) =>
          `| ${i.assetName} | ${i.assetType ?? "—"} | ${i.alertSeverity ?? "—"} | ${fmtSign(i.velocityMmYear)} | ${fmtSign(i.cumulativeMm, 1)} | ${fmt(i.coherence)} | ${i.referenceDate} → ${i.endDate} |`,
      ),
  ].join("\n");
  const tableTargets = [
    "| Código | Nombre | Tipo | Score | Prioridad | Lat | Lng |",
    "|---|---|---|---|---|---|---|",
    ...d.targets.map(
      (t) =>
        `| ${t.code} | ${t.name} | ${t.targetType} | ${t.score ?? "—"} | ${t.priority} | ${fmt(t.lat, 5)} | ${fmt(t.lng, 5)} |`,
    ),
  ].join("\n");
  const tableInsarFull = [
    "| Activo | Tipo | Fuente | Severidad | Velocidad mm/a | Σ desp. mm | Coherencia | Periodo |",
    "|---|---|---|---|---|---|---|---|",
    ...d.insar.map(
      (i) =>
        `| ${i.assetName} | ${i.assetType ?? "—"} | ${i.source} | ${i.alertSeverity ?? "—"} | ${fmtSign(i.velocityMmYear)} | ${fmtSign(i.cumulativeMm, 1)} | ${fmt(i.coherence)} | ${i.referenceDate} → ${i.endDate} |`,
    ),
  ].join("\n");

  return `---
title: "Borrador NI 43-101 — ${d.project.name}"
date: "${today}"
---

# Informe Técnico NI 43-101 (Borrador)

**Proyecto:** ${d.project.name} (${d.project.code})
**Commodity:** ${d.project.commodity ?? "—"}
**Ubicación:** ${d.project.region ?? "—"}, ${d.project.country ?? "—"}
**Centroide:** ${fmt(d.project.centerLat, 5)}°, ${fmt(d.project.centerLng, 5)}° (EPSG:${d.project.crsEpsg})
**Versión:** 0.1 · Borrador automático para revisión QP

> Documento generado automáticamente por Geocapitals a partir de los productos satelitales y geológicos cargados. Debe ser revisado y firmado por una Persona Calificada (QP) bajo NI 43-101 / CIM 2014 antes de su uso público.

## Item 1 — Resumen Ejecutivo

Cartera de **${d.stats.totalTargets} targets** · **${d.stats.totalHyperspectral} productos hiperespectrales** (${d.stats.minerals.length} minerales, ${d.stats.assemblages.length} ensamblajes) · **${d.stats.totalInsar} mediciones InSAR** (${d.stats.insarWarning} en warning).
Velocidad LOS: ${fmtSign(d.stats.velocityMin)} a ${fmtSign(d.stats.velocityMax)} mm/a (media ${fmtSign(d.stats.velocityAvg)}, coherencia media ${fmt(d.stats.coherenceAvg)}).

## Item 4 — Descripción y Ubicación

${d.project.description ?? ""}

## Item 9 — Hallazgos de Exploración Remota

### 9.1 Hiperspectral (EMIT + ASTER)

${tableHyper}

### 9.2 InSAR (OPERA DISP S1) — Top 15 por |velocidad|

${tableInsarTop}

## Item 10 — Targets Priorizados

${tableTargets}

## Item 11 — Metodología

- **EMIT L2B Mineralogy** · 60 m · SAM sobre USGS v7
- **ASTER L1T** · 15/30 m · SAM + ratios diagnósticos (Ninomiya 2003)
- **OPERA DISP-S1** · velocidad LOS lineal · umbrales |v|≥15 → warning, ≥25 → critical
- **DEM Copernicus GLO-30** + diferencial temporal · método edge-mean
- Backend: PostgreSQL + PostGIS 3.3.7 (Lovable Cloud) · Visor 3D Three.js + Leaflet 1.9

## Item 12 — QA/QC

- Trazabilidad: scene_id, stac_href, algorithm, spectral_library, metadata jsonb
- Validación cruzada EMIT↔ASTER por mineral
- InSAR filtrado por coherencia ≥ 0.4
- ${d.stats.insarWarning} sitios warning escalados al workflow geotécnico

## Item 23 — Recomendaciones (preliminares)

1. Fase II superficial sobre corredores con coincidencia hiperspectral (mapeo + geoquímica)
2. Geofísica IP/Mag sobre top targets
3. Monitoreo InSAR continuo sobre ${d.stats.insarWarning} sitios warning
4. Sondajes diamantinos exploratorios (Fase III) condicional a Fases I/II

## Anexo C — InSAR completo

${tableInsarFull}

---
*Generado por Geocapitals · ${today} · v0.1 · Borrador para revisión QP*
`;
}

function downloadMarkdown(draft: Ni43101Draft) {
  const md = buildMarkdown(draft);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NI43-101_${draft.project.code}_borrador.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Ni43101DraftPanel({ projectId }: Props) {
  const { data: draft, isLoading, error, refetch, isFetching } = useNi43101Draft(projectId);
  const [openSection, setOpenSection] = useState<string | null>("summary");

  const sections = useMemo(
    () => [
      { id: "summary", label: "Resumen ejecutivo" },
      { id: "hyper", label: "Hallazgos hiperespectrales" },
      { id: "insar", label: "InSAR & alertas" },
      { id: "targets", label: "Targets priorizados" },
      { id: "method", label: "Metodología" },
      { id: "annex", label: "Anexos" },
    ],
    [],
  );

  if (!projectId) {
    return (
      <div className="rounded border border-border bg-bg-secondary p-6 text-sm text-text-secondary font-mono">
        Selecciona un proyecto para generar el borrador.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded border border-border bg-bg-secondary p-6 flex items-center gap-2 text-sm font-mono text-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin" /> Compilando borrador desde los datos cargados…
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm font-mono text-destructive flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        No se pudo generar el borrador. {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  const s = draft.stats;

  return (
    <section className="rounded border border-gold/40 bg-bg-secondary overflow-hidden">
      {/* Header */}
      <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base md:text-lg font-mono font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-gold" />
            Borrador automático NI 43-101 — {draft.project.name}
          </h2>
          <p className="text-[11px] text-text-secondary font-mono mt-1">
            v0.1 · {s.totalTargets} targets · {s.totalHyperspectral} productos hiperespectrales ·{" "}
            {s.totalInsar} mediciones InSAR
            {s.insarWarning > 0 && (
              <span className="ml-2 text-warning">· {s.insarWarning} en warning</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[11px] font-mono px-2.5 py-1.5 rounded border border-border hover:border-gold/40 disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Recargar"}
          </button>
          <button
            onClick={() => downloadMarkdown(draft)}
            className="text-[11px] font-mono px-2.5 py-1.5 rounded border border-gold/50 text-gold hover:bg-gold/10 inline-flex items-center gap-1.5"
          >
            <Download className="w-3 h-3" /> .md
          </button>
          <button
            onClick={() => window.print()}
            className="text-[11px] font-mono px-2.5 py-1.5 rounded border border-gold/50 text-gold hover:bg-gold/10 inline-flex items-center gap-1.5"
          >
            <Printer className="w-3 h-3" /> Imprimir / PDF
          </button>
        </div>
      </header>

      <Ni43101GeoExport projectId={projectId} projectName={draft.project.name} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
        <KPI label="Targets" value={s.totalTargets} />
        <KPI
          label="Hiperspectrales"
          value={s.totalHyperspectral}
          sub={`${s.minerals.length} minerales`}
        />
        <KPI
          label="InSAR warnings"
          value={s.insarWarning}
          tone={s.insarWarning > 0 ? "warn" : "ok"}
          sub={`/ ${s.totalInsar} totales`}
        />
        <KPI
          label="Vel. máx |LOS|"
          value={`${fmt(Math.max(Math.abs(s.velocityMin ?? 0), Math.abs(s.velocityMax ?? 0)), 1)} mm/a`}
        />
        <KPI label="Coherencia media" value={fmt(s.coherenceAvg)} />
      </div>

      {/* Sections */}
      <div className="divide-y divide-border">
        {sections.map((sec) => {
          const open = openSection === sec.id;
          return (
            <div key={sec.id}>
              <button
                onClick={() => setOpenSection(open ? null : sec.id)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-bg-primary/40 transition-colors"
              >
                <span className="font-mono text-sm">{sec.label}</span>
                {open ? (
                  <ChevronDown className="w-4 h-4 text-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-text-secondary" />
                )}
              </button>
              {open && (
                <div className="px-5 pb-5">
                  {sec.id === "summary" && <SummarySection draft={draft} />}
                  {sec.id === "hyper" && <HyperSection draft={draft} />}
                  {sec.id === "insar" && <InsarSection draft={draft} />}
                  {sec.id === "targets" && <TargetsSection draft={draft} />}
                  {sec.id === "method" && <MethodSection />}
                  {sec.id === "annex" && <AnnexSection draft={draft} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KPI({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  const color =
    tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-text-primary";
  return (
    <div className="bg-bg-secondary px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-text-secondary">
        {label}
      </div>
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-text-secondary">{sub}</div>}
    </div>
  );
}

function SummarySection({ draft }: { draft: Ni43101Draft }) {
  const s = draft.stats;
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>
        Cartera de <strong>{s.totalTargets} targets</strong> distribuida sobre el AOI del prospecto{" "}
        <strong>{draft.project.name}</strong>, commodity principal {draft.project.commodity ?? "—"}.
        Los productos satelitales procesados incluyen{" "}
        <strong>{s.totalHyperspectral} escenas hiperespectrales</strong> cubriendo{" "}
        {s.minerals.length} minerales diagnósticos ({s.minerals.join(", ")}) y{" "}
        {s.assemblages.length} ensamblajes ({s.assemblages.join(", ")}).
      </p>
      <p>
        El monitoreo InSAR (OPERA DISP S1) reporta <strong>{s.totalInsar} mediciones</strong>, de
        las cuales <strong className="text-warning">{s.insarWarning} están en warning</strong>.
        Velocidades LOS observadas: rango {fmtSign(s.velocityMin)} a {fmtSign(s.velocityMax)} mm/año
        (media {fmtSign(s.velocityAvg)}, coherencia media {fmt(s.coherenceAvg)}).
      </p>
      <p className="text-text-secondary">
        <strong className="text-text-primary">Hallazgo clave:</strong> coexistencia espacial de
        ensamblajes silícico, fílico, argílico avanzado y gossan sobre el corredor principal sugiere
        un sistema epitermal de alta sulfuración con potencial pórfido subyacente. Se recomienda
        avanzar a Fase II.
      </p>
    </div>
  );
}

function HyperSection({ draft }: { draft: Ni43101Draft }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead className="text-text-secondary">
          <tr className="border-b border-border">
            <Th>Sensor</Th>
            <Th>Mineral</Th>
            <Th>Ensamblaje</Th>
            <Th right>Score medio</Th>
            <Th right>Score máx</Th>
            <Th right>Área (ha)</Th>
            <Th right>Celdas &gt; umbral</Th>
            <Th>Adquisición</Th>
          </tr>
        </thead>
        <tbody>
          {draft.hyperspectral.map((h, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-bg-primary/40">
              <Td>{h.source}</Td>
              <Td>{h.mineral}</Td>
              <Td>{h.assemblage ?? "—"}</Td>
              <Td right>{fmt(h.meanScore)}</Td>
              <Td right>{fmt(h.maxScore)}</Td>
              <Td right>{fmt(h.areaHa, 1)}</Td>
              <Td right>{h.cellsAboveThreshold ?? "—"}</Td>
              <Td>{h.acquisitionDate}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsarSection({ draft }: { draft: Ni43101Draft }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? draft.insar : draft.insar.slice(0, 15);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
        <span className="inline-flex items-center gap-1 text-warning">
          <AlertTriangle className="w-3 h-3" /> {draft.insarWarning.length} en warning
        </span>
        <span className="inline-flex items-center gap-1 text-success">
          <CheckCircle2 className="w-3 h-3" /> {draft.stats.insarInfo} informativos
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead className="text-text-secondary">
            <tr className="border-b border-border">
              <Th>Activo</Th>
              <Th>Tipo</Th>
              <Th>Severidad</Th>
              <Th right>Velocidad mm/a</Th>
              <Th right>Σ desp. mm</Th>
              <Th right>Coherencia</Th>
              <Th>Periodo</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i, idx) => (
              <tr key={idx} className="border-b border-border/40 hover:bg-bg-primary/40">
                <Td>{i.assetName}</Td>
                <Td>{i.assetType ?? "—"}</Td>
                <Td>
                  <span
                    className={
                      (i.alertSeverity ?? "").toLowerCase() === "warning"
                        ? "text-warning"
                        : "text-text-secondary"
                    }
                  >
                    {i.alertSeverity ?? "—"}
                  </span>
                </Td>
                <Td right>{fmtSign(i.velocityMmYear)}</Td>
                <Td right>{fmtSign(i.cumulativeMm, 1)}</Td>
                <Td right>{fmt(i.coherence)}</Td>
                <Td>
                  {i.referenceDate} → {i.endDate}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft.insar.length > 15 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[11px] font-mono text-gold hover:underline"
        >
          {showAll ? "Mostrar solo top 15" : `Ver los ${draft.insar.length} sitios completos`}
        </button>
      )}
    </div>
  );
}

function TargetsSection({ draft }: { draft: Ni43101Draft }) {
  return (
    <div className="overflow-x-auto max-h-[480px]">
      <table className="w-full text-xs font-mono">
        <thead className="text-text-secondary sticky top-0 bg-bg-secondary">
          <tr className="border-b border-border">
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th>Tipo</Th>
            <Th right>Score</Th>
            <Th>Prioridad</Th>
            <Th right>Lat</Th>
            <Th right>Lng</Th>
            <Th>Stage</Th>
          </tr>
        </thead>
        <tbody>
          {draft.targets.map((t, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-bg-primary/40">
              <Td>{t.code}</Td>
              <Td>{t.name}</Td>
              <Td>{t.targetType}</Td>
              <Td right>{t.score ?? "—"}</Td>
              <Td>{t.priority}</Td>
              <Td right>{fmt(t.lat, 5)}</Td>
              <Td right>{fmt(t.lng, 5)}</Td>
              <Td>{t.stage}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodSection() {
  const items = [
    {
      title: "EMIT L2B Mineralogy",
      body: "NASA EMIT · 60 m · Spectral Angle Mapper sobre librería USGS v7. Umbral de detección 0.5.",
    },
    {
      title: "ASTER L1T",
      body: "USGS/AIST · 15 m VNIR / 30 m SWIR · SAM + ratios diagnósticos (Ninomiya 2003) para silica, alunita, caolinita, clorita, hematita, jarosita.",
    },
    {
      title: "OPERA DISP-S1",
      body: "Sentinel-1 SLC time-series · ASF DAAC · velocidad LOS lineal mm/a · coherencia ≥ 0.4 · alertas |v| ≥ 15 → warning, ≥ 25 → critical.",
    },
    {
      title: "DEM-diff",
      body: "Copernicus GLO-30 (30 m) · diferencial tri-temporal · método edge-mean para cálculo volumétrico de stockpiles.",
    },
    {
      title: "Stack tecnológico",
      body: "PostgreSQL + PostGIS 3.3.7 (Lovable Cloud) · TanStack Start + Leaflet 1.9 · Three.js para visor 3D real con drape Sentinel sobre DEM Copernicus.",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((it) => (
        <div key={it.title} className="rounded border border-border bg-bg-primary p-3">
          <div className="text-xs font-mono font-bold mb-1">{it.title}</div>
          <div className="text-[11px] text-text-secondary leading-relaxed">{it.body}</div>
        </div>
      ))}
    </div>
  );
}

function AnnexSection({ draft }: { draft: Ni43101Draft }) {
  return (
    <ul className="space-y-2 text-sm">
      <li>
        <strong>Anexo A · Targets:</strong> {draft.targets.length} fichas (ver sección Targets
        priorizados).
      </li>
      <li>
        <strong>Anexo B · Hiperspectral:</strong> {draft.hyperspectral.length} productos EMIT/ASTER
        catalogados.
      </li>
      <li>
        <strong>Anexo C · InSAR:</strong> {draft.insar.length} mediciones OPERA DISP S1 con
        time-series.
      </li>
      <li>
        <strong>Anexo D · DEM-diff:</strong> {draft.stockpiles.length} polígonos volumétricos.
      </li>
      <li className="text-text-secondary text-xs pt-2">
        Glosario: AOI · Area of Interest · QP · Qualified Person · LOS · Line of Sight · SAM ·
        Spectral Angle Mapper · STAC · SpatioTemporal Asset Catalog
      </li>
    </ul>
  );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider ${right ? "text-right" : "text-left"}`}
  >
    {children}
  </th>
);
const Td = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-2 py-1.5 ${right ? "text-right tabular-nums" : ""}`}>{children}</td>
);
