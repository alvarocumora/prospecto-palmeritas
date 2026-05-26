import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import type { EconomicScenario } from "@/hooks/useEconomicScenarios";

type ModelLike = {
  id: string;
  name: string;
  commodity: string;
  method: string;
  block_size_x: number;
  block_size_y: number;
  block_size_z: number;
  composite_length: number;
  density_t_m3: number;
  search_radius: number;
  cutoff_grade: number | null;
  blocks_total: number | null;
  blocks_estimated: number | null;
  composites_count: number | null;
  tonnage_total: number | null;
  tonnage_above_cutoff: number | null;
  mean_grade: number | null;
  metal_content: number | null;
};

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}
function fmtT(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} Mt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kt`;
  return `${v.toFixed(0)} t`;
}

export function Ni43101ExportButton({
  model,
  scenarios,
  projectName,
}: {
  model: ModelLike;
  scenarios: EconomicScenario[];
  projectName: string;
}) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const completed = scenarios.filter((s) => s.status === "complete");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 56;

      const title = (t: string, size = 16) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.text(t, 56, y);
        y += size + 6;
      };
      const para = (t: string) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(t, pageW - 112);
        doc.text(lines, 56, y);
        y += lines.length * 12 + 6;
      };
      const kv = (k: string, v: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(k, 56, y);
        doc.setFont("helvetica", "normal");
        doc.text(v, 200, y);
        y += 14;
      };
      const ensure = (need = 80) => {
        if (y > doc.internal.pageSize.getHeight() - need) {
          doc.addPage();
          y = 56;
        }
      };

      // Header
      title("Resumen Técnico NI 43-101 / JORC 2012", 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `Proyecto: ${projectName}   ·   Generado: ${new Date().toLocaleDateString("es-CL")}`,
        56,
        y,
      );
      doc.setTextColor(0);
      y += 22;

      // 1. Modelo
      title("1. Modelo de Recursos", 13);
      kv("Nombre", model.name);
      kv("Commodity", model.commodity.toUpperCase());
      kv("Método", model.method.toUpperCase());
      kv(
        "Tamaño de bloque",
        `${model.block_size_x} × ${model.block_size_y} × ${model.block_size_z} m`,
      );
      kv("Compósito", `${model.composite_length} m`);
      kv("Radio de búsqueda", `${model.search_radius} m`);
      kv("Densidad", `${model.density_t_m3} t/m³`);
      kv("Cutoff", model.cutoff_grade != null ? `${model.cutoff_grade}` : "—");
      y += 6;

      ensure(120);
      title("2. Resultados de Estimación", 13);
      kv("Compósitos", String(model.composites_count ?? 0));
      kv(
        "Bloques estimados",
        `${model.blocks_estimated ?? 0} / ${model.blocks_total ?? 0}`,
      );
      kv("Tonelaje total", fmtT(model.tonnage_total));
      kv("Tonelaje > cutoff", fmtT(model.tonnage_above_cutoff));
      kv(
        "Ley media",
        `${(model.mean_grade ?? 0).toFixed(model.commodity === "au" || model.commodity === "ag" ? 2 : 3)}`,
      );
      kv("Contenido metálico", String(model.metal_content ?? 0));
      y += 6;

      // 3. Escenarios
      ensure(140);
      title("3. Escenarios Económicos", 13);
      if (completed.length === 0) {
        para("Sin escenarios económicos completados.");
      } else {
        // Table header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const cols = ["Escenario", "Precio", "NPV", "IRR", "Mineral", "Vida"];
        const xs = [56, 180, 250, 330, 380, 460];
        cols.forEach((c, i) => doc.text(c, xs[i], y));
        y += 12;
        doc.setLineWidth(0.5);
        doc.line(56, y - 8, pageW - 56, y - 8);
        doc.setFont("helvetica", "normal");
        for (const s of completed) {
          ensure(40);
          const cells = [
            s.name.slice(0, 28),
            `$${s.commodity_price_usd.toFixed(0)}`,
            fmtUsd(s.npv_usd),
            s.irr_pct != null ? `${s.irr_pct.toFixed(1)}%` : "—",
            fmtT(s.ore_tonnes),
            `${s.mine_life_years ?? "—"}a`,
          ];
          cells.forEach((c, i) => doc.text(c, xs[i], y));
          y += 12;
        }
      }
      y += 10;

      // 4. Disclaimer
      ensure(150);
      title("4. Calificaciones y Limitaciones", 13);
      para(
        "Este resumen automático ha sido generado por el motor de estimación de Geocapitals " +
          "(IDW + NN, pit-shell heurístico, NPV/IRR estándar). No reemplaza un informe NI 43-101 " +
          "auditado por Qualified Person (QP). Los resultados deben validarse contra software " +
          "dedicado (Vulcan, Leapfrog, Datamine, Whittle) y firmados por QP antes de uso público.",
      );
      para(
        "Clasificación de recursos: medido / indicado / inferido se asigna por distancia al " +
          "compósito más cercano y densidad muestral, no por variograma fitteado.",
      );

      // Footer on each page
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
          `Geocapitals · Resumen NI 43-101 · Página ${i}/${pages}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 28,
          { align: "center" },
        );
      }

      const fname = `NI43101_${projectName}_${model.name}`.replace(/[^a-z0-9-_]+/gi, "_");
      doc.save(`${fname}.pdf`);
      toast.success("Resumen NI 43-101 generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 text-[10px] px-2"
      onClick={generate}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      ) : (
        <FileDown className="w-3 h-3 mr-1" />
      )}
      NI 43-101 PDF
    </Button>
  );
}
