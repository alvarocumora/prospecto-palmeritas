// Shell del informe Pre-NI 43-101. TOC sticky + secciones IA + visor 3D embebido.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPre43101Data } from "../data/pre43101Data.functions";
import { generateSectionNarrative, type SectionNarrative } from "../ai/generateNarrative.functions";
import { SECTIONS } from "../sectionsCatalog";
import { SectionRenderer } from "./SectionRenderer";
import { exportReportToPDF } from "../export/pdfExport";
import { LosVerdes3D } from "@/features/losverdes/LosVerdes3D";

function hashContext(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function Pre43101Shell({ projectId }: { projectId: string }) {
  const getData = useServerFn(getPre43101Data);
  const { data, isLoading } = useQuery({
    queryKey: ["pre43101-data", projectId],
    queryFn: () => getData({ data: { projectId } }),
  });

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!data?.project) return;
    setExporting(true);
    try {
      await exportReportToPDF({
        rootElementId: "pre43101-root",
        filename: `Pre-NI43101-${data.project.code ?? data.project.id}.pdf`,
        projectName: data.project.name ?? "Proyecto",
      });
      toast.success("PDF generado");
    } catch (e) {
      toast.error("Error al generar PDF: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Informe Técnico Pre-NI 43-101 / JORC
              </div>
              <h1 className="text-lg font-semibold leading-tight">{data.project?.name}</h1>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Descargar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* TOC */}
        <nav className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Índice
          </div>
          <ul className="space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#sec-${s.number}`}
                  className="block py-1 px-2 rounded hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                >
                  <span className="text-muted-foreground mr-1.5">{s.number}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Body */}
        <main id="pre43101-root" className="space-y-12 bg-card rounded-lg p-8 border border-border">
          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 border-b border-border">
            {[
              ["Concesiones", data.counts.concessions],
              ["Anomalías sat", data.counts.satAnomalies],
              ["Vetas", data.counts.veins],
              ["Targets", data.counts.targets],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-2xl font-semibold tabular-nums">{n}</div>
              </div>
            ))}
          </section>

          {SECTIONS.map((s) =>
            s.id === "viewer3d" ? (
              <Viewer3DSection key={s.id} projectId={projectId} sectionNumber={s.number} />
            ) : s.id === "qp" ? (
              <QPSection key={s.id} sectionNumber={s.number} />
            ) : (
              <AISection
                key={s.id}
                projectId={projectId}
                sectionId={s.id}
                sectionTitle={s.title}
                sectionNumber={s.number}
                context={s.contextForAI(data)}
                preliminary={s.preliminaryWhen(data)}
              />
            ),
          )}

          <footer className="pt-8 border-t border-border text-xs text-muted-foreground space-y-2">
            <p>
              <strong>Aviso legal:</strong> Este documento es un informe preliminar generado por la
              plataforma Geocapitals con apoyo de inteligencia artificial. NO constituye un informe
              NI 43-101 / JORC público. Toda decisión de inversión o divulgación pública requiere
              validación independiente por un Qualified Person (QP).
            </p>
            <p>
              Generado el {new Date().toLocaleString("es-CL")} · Project ID: {projectId}
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function AISection({
  projectId,
  sectionId,
  sectionTitle,
  sectionNumber,
  context,
  preliminary,
}: {
  projectId: string;
  sectionId: string;
  sectionTitle: string;
  sectionNumber: string;
  context: string;
  preliminary: boolean;
}) {
  const gen = useServerFn(generateSectionNarrative);
  const dataHash = useMemo(() => hashContext(context), [context]);
  const [force, setForce] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["pre43101-section", projectId, sectionId, dataHash, force],
    queryFn: () =>
      gen({ data: { projectId, sectionId, sectionTitle, context, dataHash, preliminary, force } }),
    staleTime: 1000 * 60 * 60,
  });

  return (
    <SectionRenderer
      sectionNumber={sectionNumber}
      fallbackTitle={sectionTitle}
      narrative={(data?.narrative as SectionNarrative | null) ?? null}
      loading={isFetching}
      preliminary={preliminary}
      cached={data?.cached}
      onRegenerate={() => {
        setForce(true);
        refetch();
      }}
    />
  );
}

function Viewer3DSection({
  projectId,
  sectionNumber,
}: {
  projectId: string;
  sectionNumber: string;
}) {
  return (
    <section className="space-y-3 scroll-mt-20" id={`sec-${sectionNumber}`}>
      <header className="border-b border-border pb-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          <span className="text-muted-foreground mr-2">§{sectionNumber}</span>
          Relieve y evidencia del proyecto
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          DEM Copernicus GLO-30, tenencia declarada y señales de superficie derivadas. Las señales
          no acreditan cuerpos mineralizados en profundidad.
        </p>
      </header>
      <div className="rounded-md overflow-hidden border border-border bg-surface">
        <LosVerdes3D projectId={projectId} />
      </div>
      <p className="text-xs text-muted-foreground italic">
        La escena interactiva se consulta en la aplicación; el PDF conserva las secciones del
        informe.
      </p>
    </section>
  );
}

function QPSection({ sectionNumber }: { sectionNumber: string }) {
  return (
    <section className="space-y-3 scroll-mt-20" id={`sec-${sectionNumber}`}>
      <header className="border-b border-border pb-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          <span className="text-muted-foreground mr-2">§{sectionNumber}</span>
          Declaración del Qualified Person
        </h2>
      </header>
      <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground space-y-2">
        <p>
          [Placeholder editable] El Qualified Person (QP) responsable de este informe debe completar
          y firmar esta sección antes de cualquier divulgación pública, indicando:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nombre, afiliación profesional (AusIMM, CIM, SME, etc.) y certificación.</li>
          <li>Fecha de visita al sitio y secciones del informe bajo su responsabilidad.</li>
          <li>Declaración de independencia y conflictos de interés.</li>
          <li>Firma digital o manuscrita.</li>
        </ul>
      </div>
    </section>
  );
}
