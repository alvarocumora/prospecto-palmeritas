/**
 * Menú global de documentos de proyecto: un único informe técnico institucional
 * (marco NI 43-101 o JORC) con evaluación y prioridades por IA.
 * Se usa en cualquier vista que disponga de un `ProjectDoc`.
 */
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DisclosureStandard } from "@/lib/reports/internationalStandards";
import type { ProjectDoc, ProjectDocKind } from "@/lib/pdf/model";

const FRAMEWORKS: Array<{ standard: DisclosureStandard; title: string; hint: string }> = [
  {
    standard: "NI_43_101",
    title: "Informe técnico del proyecto · marco NI 43-101",
    hint: "Formato global · evaluación y prioridades IA · revisión QP pendiente",
  },
  {
    standard: "JORC_2012",
    title: "Informe técnico del proyecto · marco JORC 2012",
    hint: "Mismo formato global · revisión CP pendiente",
  },
];

export function ProjectDocsMenu({
  build,
  disabled,
  className,
  variant = "default",
  label = "Descargar documentos",
}: {
  /** Construye el modelo en el momento de la descarga (permite datos asíncronos ya cargados). */
  build: () => ProjectDoc | null | undefined | Promise<ProjectDoc | null | undefined>;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const [busy, setBusy] = useState<ProjectDocKind | null>(null);
  const navigate = useNavigate();
  const inFlight = useRef(false);

  const run = async (kind: ProjectDocKind, standard?: DisclosureStandard) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    const id = toast.loading("Generando documento…");
    try {
      const model = await build();
      if (!model) {
        toast.error("Los antecedentes del proyecto aún no están disponibles", { id });
        return;
      }
      if (standard) model.disclosureStandard = standard;
      const { downloadProjectDoc } = await import("@/lib/pdf/generateProjectDoc");
      // Capture the real live GIS when available. A capture failure is non-fatal:
      // the document renderer keeps its analytical fallback instead of blanking.
      if (model.map) {
        const { captureElement, captureGeoScene } = await import("@/lib/pdf/captureMap");
        // Prefer the live 3D/2D GeoScene canvas (WebGL composite); fall back to DOM capture.
        const snapshot =
          (await captureGeoScene()) ??
          (model.map.captureSelector
            ? await captureElement(model.map.captureSelector, { scale: 2 })
            : null);
        if (snapshot) model.map.imageDataUrl = snapshot;
        if (model.map.capturePresets?.length && (kind === "technical" || kind === "deck")) {
          const captures = await Promise.all(
            model.map.capturePresets.map(
              (preset) =>
                new Promise<string | null>((resolve) => {
                  const timer = window.setTimeout(() => resolve(null), 12_000);
                  window.dispatchEvent(
                    new CustomEvent("geocapitals:report-map-preset", {
                      detail: {
                        mapId: model.map?.captureSelector?.match(/data-report-map="([^"]+)"/)?.[1],
                        preset,
                        resolve: (image: string | null) => {
                          window.clearTimeout(timer);
                          resolve(image);
                        },
                      },
                    }),
                  );
                }),
            ),
          );
          const descriptions = {
            remote_sensing: {
              title: "Teledetección · capas espectrales",
              caption:
                "Vista del visor Sentinel-2 y capas de anomalía derivadas. Es un producto de screening; no identifica minerales ni representa alteración medida en terreno.",
              source: "Sentinel-2 y capas derivadas del visor del proyecto",
            },
            geophysics: {
              title: "Geofísica · contexto y superficies",
              caption:
                "Vista de capas geofísicas disponibles. Distingue observaciones de campo, productos regionales y superficies interpoladas; no constituye una inversión geofísica.",
              source: "Datos de campo, EMAG2/WGM2012 y superficies IDW del visor",
            },
          } as const;
          model.map.capturePresets.forEach((preset, index) => {
            const imageDataUrl = captures[index];
            if (!imageDataUrl) return;
            const description = descriptions[preset];
            model.sections.push({
              eyebrow: "ANEXO CARTOGRÁFICO",
              title: description.title,
              blocks: [
                {
                  kind: "map",
                  title: description.title,
                  imageDataUrl,
                  caption: description.caption,
                  imagery: model.map?.imagery,
                  crs: model.map?.crs,
                  provenance: "DERIVED",
                  source: description.source,
                  confidence: "medium",
                },
              ],
              deck: true,
            });
          });
        }
      }
      if (kind === "technical") {
        toast.loading("Evaluando evidencia y prioridades con IA…", { id });
        try {
          const [{ assessProjectReport }, { buildReportDigest, assessmentSections }] =
            await Promise.all([
              import("@/lib/reports/reportAssessment.functions"),
              import("@/lib/reports/reportAssessment"),
            ]);
          const res = await assessProjectReport({
            data: {
              projectName: model.name,
              standard: model.disclosureStandard,
              digest: buildReportDigest(model),
            },
          });
          if (res.assessment) model.sections.unshift(...assessmentSections(res.assessment));
          else if (res.error) toast.message(`Informe sin evaluación IA: ${res.error}`);
        } catch (err) {
          console.warn("[ProjectDocsMenu] evaluación IA omitida", err);
        }
        toast.loading("Generando documento…", { id });
      }
      await downloadProjectDoc(model, kind);
      toast.success("Documento generado", { id });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo generar el documento", { id });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={className} disabled={disabled || busy !== null}>
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
          {busy ? "Generando documento…" : label}
          <ChevronDown className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Reporting Geocapitals</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void navigate({ to: "/dashboard/reports" });
          }}
          className="flex-col items-start gap-0.5 py-2.5"
        >
          <span className="text-sm font-medium">Abrir Reporting Hub</span>
          <span className="text-xs text-muted-foreground">
            Fuente única para informes, estándares, versiones y revisión
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Informe único del proyecto
        </DropdownMenuLabel>
        {FRAMEWORKS.map((opt) => (
          <DropdownMenuItem
            key={opt.standard}
            onSelect={() => {
              void run("technical", opt.standard);
            }}
            className="flex-col items-start gap-0.5 py-2.5"
          >
            <span className="text-sm font-medium">{opt.title}</span>
            <span className="text-xs text-muted-foreground">{opt.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
