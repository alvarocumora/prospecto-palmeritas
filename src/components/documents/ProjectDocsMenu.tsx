/**
 * Menú global de documentos de proyecto. Ofrece las tres plantillas de marca
 * (deck 16:9, resumen de una página y dossier técnico) desde un único botón.
 * Se usa en cualquier vista que disponga de un `ProjectDoc`.
 */
import { useState } from "react";
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
import { captureElement } from "@/lib/pdf/captureMap";
import { downloadProjectDoc } from "@/lib/pdf/generateProjectDoc";

const OPTIONS: Array<{ kind: ProjectDocKind; title: string; hint: string }> = [
  {
    kind: "deck",
    title: "Deck de inversión (16:9)",
    hint: "Presentación para comités y family offices",
  },
  { kind: "onepager", title: "Resumen de una página", hint: "Para enviar por correo o WhatsApp" },
  { kind: "technical", title: "Informe técnico · NI 43-101", hint: "Preliminar · revisión QP pendiente" },
];

export function ProjectDocsMenu({
  build,
  disabled,
  className,
  variant = "default",
  label = "Descargar documentos",
}: {
  /** Construye el modelo en el momento de la descarga (permite datos asíncronos ya cargados). */
  build: () => ProjectDoc | null | undefined;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const [busy, setBusy] = useState<ProjectDocKind | null>(null);
  const navigate = useNavigate();

  const run = async (kind: ProjectDocKind, standard?: DisclosureStandard) => {
    const model = build();
    if (!model) {
      toast.error("Los antecedentes del proyecto aún se están cargando");
      return;
    }
    if (standard) model.disclosureStandard = standard;
    setBusy(kind);
    const id = toast.loading("Generando documento…");
    try {
      // Capture the real live GIS when available. A capture failure is non-fatal:
      // the document renderer keeps its analytical fallback instead of blanking.
      if (model.map?.captureSelector) {
        const snapshot = await captureElement(model.map.captureSelector, { scale: 2 });
        if (snapshot) model.map.imageDataUrl = snapshot;
      }
      await downloadProjectDoc(model, kind);
      toast.success("Documento generado", { id });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo generar el documento", { id });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={className} disabled={disabled || busy !== null}>
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
          {label}
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
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void run("technical", "JORC_2012"); }} className="flex-col items-start gap-0.5 py-2.5">
          <span className="text-sm font-medium">Informe técnico · JORC 2012</span>
          <span className="text-xs text-muted-foreground">Preliminar · revisión CP pendiente</span>
        </DropdownMenuItem>
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.kind}
            onSelect={(e) => {
              e.preventDefault();
              void run(opt.kind);
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
