import { Link } from "@tanstack/react-router";
import { Check, Minus, ArrowRight } from "lucide-react";

type Cell = { kind: "yes"; note?: string } | { kind: "no" } | { kind: "partial"; note?: string } | { kind: "text"; value: string };

const OPERATORS = [
  { key: "geo", name: "Geocapitals", tag: "Plataforma completa", highlight: true },
  { key: "pmd", name: "PropiedadMineraDigital", tag: "Catastro CL", highlight: false },
  { key: "sng", name: "Sernageomin", tag: "Portal público", highlight: false },
  { key: "otr", name: "Otros SaaS mineros", tag: "Genéricos", highlight: false },
] as const;

type OpKey = (typeof OPERATORS)[number]["key"];

const ROWS: Array<{ label: string; cells: Record<OpKey, Cell> }> = [
  {
    label: "Cobertura Chile",
    cells: {
      geo: { kind: "text", value: "11.7k live" },
      pmd: { kind: "text", value: "Nacional" },
      sng: { kind: "text", value: "Nacional" },
      otr: { kind: "partial", note: "Parcial" },
    },
  },
  {
    label: "Multi-país",
    cells: {
      geo: { kind: "text", value: "CL · PE · BR · ZM · MW" },
      pmd: { kind: "no" },
      sng: { kind: "no" },
      otr: { kind: "partial", note: "Limitado" },
    },
  },
  {
    label: "Mapa 3D + geología",
    cells: { geo: { kind: "yes" }, pmd: { kind: "no" }, sng: { kind: "no" }, otr: { kind: "no" } },
  },
  {
    label: "Alertas de boletín / patente",
    cells: {
      geo: { kind: "yes" },
      pmd: { kind: "partial", note: "Básico" },
      sng: { kind: "no" },
      otr: { kind: "partial" },
    },
  },
  {
    label: "Cruce con juicios y remates",
    cells: { geo: { kind: "yes" }, pmd: { kind: "no" }, sng: { kind: "no" }, otr: { kind: "no" } },
  },
  {
    label: "Reportes NI 43-101",
    cells: { geo: { kind: "yes" }, pmd: { kind: "no" }, sng: { kind: "no" }, otr: { kind: "no" } },
  },
  {
    label: "Trade + data-room",
    cells: { geo: { kind: "yes" }, pmd: { kind: "no" }, sng: { kind: "no" }, otr: { kind: "no" } },
  },
  {
    label: "API y exports",
    cells: {
      geo: { kind: "text", value: "GeoJSON · CSV · PDF" },
      pmd: { kind: "text", value: "PDF" },
      sng: { kind: "text", value: "Descarga masiva" },
      otr: { kind: "partial", note: "Varía" },
    },
  },
  {
    label: "Precio entrada",
    cells: {
      geo: { kind: "text", value: "Gratis" },
      pmd: { kind: "text", value: "Pago" },
      sng: { kind: "text", value: "Gratis (sin tools)" },
      otr: { kind: "text", value: "Pago" },
    },
  },
];

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "yes")
    return (
      <span className="inline-flex items-center gap-1 text-accent-brand">
        <Check className="w-3.5 h-3.5" />
        <span className="text-[11px] font-mono uppercase tracking-wider">Sí</span>
      </span>
    );
  if (cell.kind === "no")
    return (
      <span className="inline-flex items-center gap-1 text-content-muted">
        <Minus className="w-3.5 h-3.5" />
        <span className="text-[11px] font-mono uppercase tracking-wider">No</span>
      </span>
    );
  if (cell.kind === "partial")
    return (
      <span className="text-[11px] font-mono text-content-muted">{cell.note ?? "Parcial"}</span>
    );
  return <span className="text-[11px] font-mono text-content">{cell.value}</span>;
}

export function CatastroComparison() {
  const today = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div data-theme="im-light" className="border border-hairline rounded-sm bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-hairline flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-content-muted">
            Comparativa de operadores
          </div>
          <div className="brand-display text-xl md:text-2xl text-content leading-tight">
            Cómo se compara Geocapitals con otros catastros
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/catastro/mapa"
            className="inline-flex items-center gap-1.5 h-10 px-4 border border-hairline text-content text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:border-accent-brand hover:text-accent-brand transition-colors"
          >
            Ver mapa live
          </Link>
          <Link
            to="/catastro/precios"
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-content text-white text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
          >
            Comparar planes
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="bg-surface border-b border-hairline">
              <th className="text-left px-5 py-3 text-[10px] font-mono uppercase tracking-[0.22em] text-content-muted w-[26%]">
                Capacidad
              </th>
              {OPERATORS.map((op) => (
                <th
                  key={op.key}
                  className={`text-left px-4 py-3 align-top ${op.highlight ? "bg-white" : ""}`}
                >
                  <div
                    className={`brand-display text-sm ${op.highlight ? "text-accent-brand" : "text-content"}`}
                  >
                    {op.name}
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-content-muted mt-0.5">
                    {op.tag}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={i % 2 === 1 ? "bg-surface/40 border-b border-hairline" : "border-b border-hairline"}
              >
                <td className="px-5 py-3 text-[12px] text-content">{row.label}</td>
                {OPERATORS.map((op) => (
                  <td key={op.key} className={`px-4 py-3 ${op.highlight ? "bg-white" : ""}`}>
                    <CellView cell={row.cells[op.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 text-[10px] font-mono text-content-muted border-t border-hairline">
        Comparativa basada en información pública de los sitios oficiales al {today}. No incluye
        planes empresariales personalizados de cada operador.
      </div>
    </div>
  );
}
