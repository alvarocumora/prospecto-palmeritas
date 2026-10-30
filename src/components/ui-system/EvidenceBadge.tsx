import { cn } from "@/lib/utils";

/**
 * Badge de procedencia — el sello transversal de GeoCapitals: toda cifra o capa
 * declara de dónde viene. Reemplaza los mapas de color inline dispersos (visor,
 * inspector, etc.) por una sola fuente de verdad.
 *
 *  OFICIAL       — fuente oficial (SERNAGEOMIN, catastro, franjas, DEM).
 *  MEDIDO        — dato medido en terreno/laboratorio (geoquímica, estaciones).
 *  CERTIFICADO   — ensaye/análisis certificado.
 *  DERIVADO      — derivado de sensores (satélite, geofísica regional).
 *  INTERPRETADO  — interpolado/modelado (IDW, superficies).
 *  PROPUESTO     — propuesta/borrador (pedimento, sondaje, target).
 *  CONTEXTO      — contexto regional; verificar antes de usar como detalle.
 */
export type Evidence =
  "OFICIAL" | "MEDIDO" | "CERTIFICADO" | "DERIVADO" | "INTERPRETADO" | "PROPUESTO" | "CONTEXTO";

const BG: Record<Evidence, string> = {
  OFICIAL: "#15803d",
  MEDIDO: "#0369a1",
  CERTIFICADO: "#15803d",
  DERIVADO: "#7c3aed",
  INTERPRETADO: "#a16207",
  PROPUESTO: "#b45309",
  CONTEXTO: "#b45309",
};

const DESCRIPTION: Record<Evidence, string> = {
  OFICIAL: "Fuente oficial (SERNAGEOMIN, catastro, franjas, DEM)",
  MEDIDO: "Dato medido en terreno o laboratorio (geoquímica, estaciones)",
  CERTIFICADO: "Ensaye o análisis certificado",
  DERIVADO: "Derivado de sensores (satélite, geofísica regional)",
  INTERPRETADO: "Interpolado o modelado (IDW, superficies)",
  PROPUESTO: "Propuesta o borrador (pedimento, sondaje, target)",
  CONTEXTO: "Contexto regional; verificar antes de usar como detalle",
};

export function EvidenceBadge({
  kind,
  scale,
  className,
  size = "sm",
}: {
  kind: Evidence;
  /** escala/resolución opcional, p.ej. "10–20 m", "~3.7 km reg." */
  scale?: string;
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={DESCRIPTION[kind]}>
      <span
        className={cn(
          "rounded font-bold uppercase leading-tight text-white",
          size === "xs" ? "px-1 text-[8px]" : "px-1.5 py-0.5 text-[9px]",
        )}
        style={{ background: BG[kind] }}
      >
        {kind}
      </span>
      {scale && (
        <span className={cn("text-muted-foreground", size === "xs" ? "text-[9px]" : "text-[10px]")}>
          {scale}
        </span>
      )}
    </span>
  );
}
