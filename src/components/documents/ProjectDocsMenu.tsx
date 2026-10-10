/**
 * Menú global de documentos de proyecto. Ofrece las tres plantillas de marca
 * (deck 16:9, resumen de una página y dossier técnico) desde un único botón.
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

const OPTIONS: Array<{ kind: ProjectDocKind; title: string; hint: string }> = [
  {
    kind: "deck",
    title: "Deck de inversión (16:9)",
    hint: "Presentación para comités y family offices",
  },
  { kind: "onepager", title: "Resumen de una página", hint: "Para enviar por correo o WhatsApp" },
  {
    kind: "technical",
    title: "Informe técnico · NI 43-101",
    hint: "Preliminar · revisión QP pendiente",
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
      if (model.map?.captureSelector) {
        const { captureElement } = await import("@/lib/pdf/captureMap");
        const snapshot = await captureElement(model.map.captureSelector, { scale: 2 });
        if (snapshot) model.map.imageDataUrl = snapshot;
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
          Exportación rápida · compatibilidad
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => {
            void run("technical", "JORC_2012");
          }}
          className="flex-col items-start gap-0.5 py-2.5"
        >
          <span className="text-sm font-medium">Informe técnico · JORC 2012</span>
          <span className="text-xs text-muted-foreground">Preliminar · revisión CP pendiente</span>
        </DropdownMenuItem>
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.kind}
            onSelect={() => {
              void run(opt.kind, opt.kind === "technical" ? "NI_43_101" : undefined);
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
