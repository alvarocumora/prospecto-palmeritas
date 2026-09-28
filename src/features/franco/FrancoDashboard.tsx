import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CholquiHero } from "./components/CholquiHero";
import { CholquiMasterViewer } from "./components/CholquiMasterViewer";
import { CholquiTargetsSummary } from "./components/CholquiTargetsSummary";

import { CholquiScenariosPanel } from "./components/CholquiScenariosPanel";
import { CholquiMinePlanPanel } from "./components/CholquiMinePlanPanel";
import { CholquiEvidencePanel } from "./components/CholquiEvidencePanel";
import { CholquiRoundPanel } from "./components/CholquiRoundPanel";

import { CHOLQUI } from "./data/cholqui";
import { downloadCholquiInvestmentPdf, downloadCholquiInvestmentTeaserPdf } from "./cholquiPdf";

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

        {/* Visor maestro unificado: única vista cartográfica (territorio,
            teledetección, geofísica y exploración) con inspector de procedencia. */}
        <CholquiMasterViewer />

        {/* Tabla técnica de la malla propuesta + descarga del informe de targets. */}
        <CholquiTargetsSummary />

        <CholquiScenariosPanel />
        <CholquiMinePlanPanel />

        <CholquiEvidencePanel />
        <CholquiRoundPanel />


        <footer className="text-[11px] text-content-subtle pb-8">
          {CHOLQUI.name} ({CHOLQUI.code}) · Operado por Geocapitals · Antes conocido como{" "}
          {CHOLQUI.formerName}. Documento informativo: no constituye oferta pública de valores.
        </footer>
      </main>
    </div>
  );
}
