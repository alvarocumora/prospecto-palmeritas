import type { PalmerasTabId } from "../types";
import { Card } from "./primitives";

const PLACEHOLDER_LABELS: Record<PalmerasTabId, string> = {
  overview: "Overview",
  geology: "Geology",
  geophysics: "Geophysics",
  targets: "Targets",
  sampling: "Sampling",
  drill: "Drill Program",
  budget: "Budget",
};

type PalmerasTabPlaceholderProps = {
  tab: PalmerasTabId;
};

export function PalmerasTabPlaceholder({ tab }: PalmerasTabPlaceholderProps) {
  return (
    <Card className="p-6" accent="muted">
      <div className="font-mono text-[10px] uppercase tracking-widest text-hint">Módulo pendiente de extracción</div>
      <h2 className="mt-2 font-mono text-xl text-foreground">{PLACEHOLDER_LABELS[tab]}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Este módulo ya existe en la ruta legacy. Se conectará aquí en una PR posterior para evitar mezclar
        extracción estructural con cambios de comportamiento.
      </p>
    </Card>
  );
}
