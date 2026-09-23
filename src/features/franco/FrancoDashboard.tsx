import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CholquiHero } from "./components/CholquiHero";
import { CholquiSatellitePanel } from "./components/CholquiSatellitePanel";

import { CholquiScenariosPanel } from "./components/CholquiScenariosPanel";
import { CholquiMinePlanPanel } from "./components/CholquiMinePlanPanel";
import { CholquiEvidencePanel } from "./components/CholquiEvidencePanel";
import { CholquiRoundPanel } from "./components/CholquiRoundPanel";
import { FrancoPertenenciasMap } from "./components/FrancoPertenenciasMap";
import { FrancoPertenenciasPanel } from "./components/FrancoPertenenciasPanel";
import { CHOLQUI } from "./data/cholqui";

/**
 * Live view público del Proyecto Cholqui. Toda la data proviene de
 * `data/cholqui.ts`, la misma fuente que alimenta el PDF de inversión y la
 * ficha /proyectos/ficha/cholqui.
 */
export function FrancoDashboard() {
  const [downloading, setDownloading] = useState(false);
  const [downloadingTeaser, setDownloadingTeaser] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { downloadCholquiInvestmentPdf } = await import("./cholquiPdf");
      await downloadCholquiInvestmentPdf();
      toast.success("PDF de inversión generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleDownloadTeaser = useCallback(async () => {
    setDownloadingTeaser(true);
    try {
      const { downloadCholquiInvestmentTeaserPdf } = await import("./cholquiPdf");
      await downloadCholquiInvestmentTeaserPdf();
      toast.success("Teaser de inversión generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el teaser");
    } finally {
      setDownloadingTeaser(false);
    }
  }, []);

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <CholquiHero
          onDownload={handleDownload}
          downloading={downloading}
          onDownloadTeaser={handleDownloadTeaser}
          downloadingTeaser={downloadingTeaser}
        />

        <div data-surface="canvas" className="rounded-2xl overflow-hidden">
          <FrancoPertenenciasMap />
        </div>

        <CholquiScenariosPanel />
        <CholquiMinePlanPanel />
        <CholquiSatellitePanel />
        <CholquiEvidencePanel />
        <CholquiRoundPanel />


        <div data-surface="canvas" className="rounded-2xl overflow-hidden">
          <FrancoPertenenciasPanel />
        </div>

        <footer className="text-[11px] text-content-subtle pb-8">
          {CHOLQUI.name} ({CHOLQUI.code}) · Operado por Geocapitals · Antes conocido como{" "}
          {CHOLQUI.formerName}. Documento informativo: no constituye oferta pública de valores.
        </footer>
      </main>
    </div>
  );
}
