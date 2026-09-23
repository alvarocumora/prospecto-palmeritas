/**
 * Menú global de documentos de proyecto. Ofrece las tres plantillas de marca
 * (deck 16:9, resumen de una página y dossier técnico) desde un único botón.
 * Se usa en cualquier vista que disponga de un `ProjectDoc`.
 */
import { useState } from "react";
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
import type { ProjectDoc, ProjectDocKind } from "@/lib/pdf/model";
import { captureElement } from "@/lib/pdf/captureMap";
import { downloadProjectDoc } from "@/lib/pdf/generateProjectDoc";

const OPTIONS: Array<{ kind: ProjectDocKind; title: string; hint: string }> = [
  { kind: "deck", title: "Deck de inversión (16:9)", hint: "Presentación para comités y family offices" },
  { kind: "onepager", title: "Resumen de una página", hint: "Para enviar por correo o WhatsApp" },
  { kind: "technical", title: "Dossier técnico", hint: "Antecedentes completos para revisión" },
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

  const run = async (kind: ProjectDocKind) => {
    const model = build();
    if (!model) {
      toast.error("Los antecedentes del proyecto aún se están cargando");
      return;
    }
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
        <DropdownMenuLabel>Plantillas Geocapitals</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
