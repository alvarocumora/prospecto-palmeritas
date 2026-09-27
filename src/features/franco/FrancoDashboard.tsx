import { useCallback, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ProjectReadinessStrip,
  ProjectWorkspaceSection,
  ProjectWorkspaceShell,
} from "@/components/project-workspace/ProjectWorkspaceShell";
import { CholquiMasterViewer } from "./components/CholquiMasterViewer";
import { CholquiScenariosPanel } from "./components/CholquiScenariosPanel";
import { CholquiMinePlanPanel } from "./components/CholquiMinePlanPanel";
import { CholquiEvidencePanel } from "./components/CholquiEvidencePanel";
import { CholquiRoundPanel } from "./components/CholquiRoundPanel";
import { FrancoPertenenciasPanel } from "./components/FrancoPertenenciasPanel";
import { CHOLQUI, CHOLQUI_ASSAYS } from "./data/cholqui";
import { downloadCholquiInvestmentPdf, downloadCholquiInvestmentTeaserPdf } from "./cholquiPdf";

const TABS = [
  { id: "overview", label: "Resumen" },
  { id: "exploration", label: "Exploración" },
  { id: "mine-plan", label: "Explotación" },
  { id: "economics", label: "Economía" },
  { id: "validation", label: "Validación" },
  { id: "investment", label: "Inversión" },
];

/**
 * Workspace público del Proyecto Cholqui.
 *
 * La página usa el mismo shell que el resto de proyectos: una cabecera compacta,
 * navegación por flujo minero y superficies de datos. El mapa es una excepción
 * canvas, no un segundo theme.
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
    <ProjectWorkspaceShell
      code={CHOLQUI.code}
      name={CHOLQUI.name}
      subtitle="Workspace técnico, económico y de inversión"
      stage={CHOLQUI.stage}
      commodity={CHOLQUI.commodity}
      location={CHOLQUI.region}
      tabs={TABS}
      metrics={[
        {
          label: "Tenencia",
          value: `${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`,
          detail: `${CHOLQUI.pedimentos} pedimentos · ${CHOLQUI.pertenencias} pertenencias`,
          status: "verified",
        },
        {
          label: "Muestreo",
          value: `${CHOLQUI_ASSAYS.length} ensayos`,
          detail: "Muestras puntuales de superficie",
          status: "verified",
        },
        {
          label: "Modelo geológico",
          value: "Interpretativo",
          detail: "Sin recurso/reserva reconocida",
          status: "derived",
        },
        {
          label: "Comercial",
          value: "DD abierta",
          detail: "Ruta, metalurgia y liquidación por validar",
          status: "pending",
        },
      ]}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleDownloadTeaser} disabled={downloadingTeaser}>
            {downloadingTeaser ? <Loader2 className="animate-spin" /> : <FileDown />}
            Teaser
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="animate-spin" /> : <FileDown />}
            Investment memo
          </Button>
        </>
      }
    >
      <div id="overview">
        <ProjectReadinessStrip
          catastro="Oficial + DD de dominio"
          exploration="Muestreo certificado + capas derivadas"
          economics="Escenarios preliminares"
          validation="Brechas explícitas"
        />
      </div>

      <ProjectWorkspaceSection
        id="exploration"
        eyebrow="Exploración"
        title="Territorio, evidencia y targets"
        description="Una sola superficie geoespacial para catastro, teledetección, geofísica, muestreo y sondajes propuestos. Cada capa conserva procedencia y escala."
        canvas
      >
        <CholquiMasterViewer />
      </ProjectWorkspaceSection>

      <ProjectWorkspaceSection
        id="mine-plan"
        eyebrow="Explotación"
        title="Plan minero y logística"
        description="Escala operacional, flota, transporte y restricciones comerciales. Los supuestos no validados permanecen separados de la evidencia técnica."
      >
        <div className="p-4 md:p-5">
          <CholquiMinePlanPanel />
        </div>
      </ProjectWorkspaceSection>

      <ProjectWorkspaceSection
        id="economics"
        eyebrow="Economía"
        title="Escenarios económicos"
        description="Sensibilidades y escenarios preliminares; no sustituyen una evaluación económica respaldada por recursos y metalurgia."
      >
        <div className="p-4 md:p-5">
          <CholquiScenariosPanel />
        </div>
      </ProjectWorkspaceSection>

      <ProjectWorkspaceSection
        id="validation"
        eyebrow="Validación"
        title="Evidencia, catastro y brechas"
        description="Trazabilidad documental, pertenencias y pendientes de due diligence antes de elevar el nivel de confianza del proyecto."
      >
        <div className="grid gap-5 p-4 md:p-5 xl:grid-cols-2">
          <CholquiEvidencePanel />
          <div className="overflow-hidden rounded-xl border border-hairline">
            <FrancoPertenenciasPanel />
          </div>
        </div>
      </ProjectWorkspaceSection>

      <ProjectWorkspaceSection
        id="investment"
        eyebrow="Inversión"
        title="Estructura de inversión"
        description="Ronda, hitos y uso de fondos separados del contenido técnico del proyecto."
      >
        <div className="p-4 md:p-5">
          <CholquiRoundPanel />
        </div>
      </ProjectWorkspaceSection>

      <footer className="pb-8 text-[11px] text-content-subtle">
        {CHOLQUI.name} ({CHOLQUI.code}) · Operado por Geocapitals · Antes conocido como{" "}
        {CHOLQUI.formerName}. Documento informativo: no constituye oferta pública de valores.
      </footer>
    </ProjectWorkspaceShell>
  );
}
