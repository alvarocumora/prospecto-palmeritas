import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CholquiHero } from "./components/CholquiHero";
import { CholquiMasterViewer } from "./components/CholquiMasterViewer";
import { CholquiTargetsSummary } from "./components/CholquiTargetsSummary";

import { CholquiScenariosPanel } from "./components/CholquiScenariosPanel";
import { CholquiMinePlanPanel } from "./components/CholquiMinePlanPanel";
import { CholquiEvidencePanel } from "./components/CholquiEvidencePanel";
import { CholquiRoundPanel } from "./components/CholquiRoundPanel";
import { PlatformPage, SectionNav } from "@/components/brand";
import { CHOLQUI } from "./data/cholqui";
import { downloadCholquiInvestmentPdf, downloadCholquiInvestmentTeaserPdf } from "./cholquiPdf";

/**
 * Live view público del Proyecto Cholqui. Toda la data proviene de
 * `data/cholqui.ts`, la misma fuente que alimenta el PDF de inversión y la
 * ficha /proyectos/ficha/cholqui.
 */
export function FrancoDashboard({ authenticated = false }: { authenticated?: boolean }) {
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
    <PlatformPage width="content" className="bg-surface">
      <div className="space-y-8">
        <div id="resumen" className="scroll-mt-24">
          <CholquiHero
            onDownload={handleDownload}
            downloading={downloading}
            onDownloadTeaser={handleDownloadTeaser}
            downloadingTeaser={downloadingTeaser}
          />
        </div>

        <SectionNav
          stickyOffset={authenticated ? "workspace" : "page"}
          items={[
            { href: "#resumen", label: "Resumen" },
            { href: "#inteligencia", label: "Inteligencia" },
            { href: "#economia", label: "Economía" },
            { href: "#operacion", label: "Operación" },
            { href: "#evidencia", label: "Evidencia" },
            { href: "#inversion", label: "Inversión" },
          ]}
        />

        <div id="inteligencia" className="scroll-mt-24 space-y-4">
          <CholquiMasterViewer />
          <CholquiTargetsSummary />
        </div>

        <div id="economia" className="scroll-mt-24">
          <CholquiScenariosPanel />
        </div>

        <div id="operacion" className="scroll-mt-24">
          <CholquiMinePlanPanel />
        </div>

        <div id="evidencia" className="scroll-mt-24">
          <CholquiEvidencePanel />
        </div>

        <div id="inversion" className="scroll-mt-24">
          <CholquiRoundPanel />
        </div>

        <footer className="border-t border-hairline pb-4 pt-5 text-[11px] text-content-subtle">
          {CHOLQUI.name} ({CHOLQUI.code}) · Operado por Geocapitals · Antes conocido como{" "}
          {CHOLQUI.formerName}. Documento informativo: no constituye oferta pública de valores.
        </footer>
      </div>
    </PlatformPage>
  );
}
