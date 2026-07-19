import { Card } from "@/features/palmeras/components/primitives/Card";
import type { PalmerasTabId } from "@/features/palmeras/types";

const LABELS: Record<PalmerasTabId, string> = {
  overview: "Overview",
  geology: "Geology",
  geophysics: "Geophysics",
  targets: "Targets",
  sampling: "Sampling",
  drill: "Drill Program",
  budget: "Budget",
};

export function FrancoTabPlaceholder({ tab }: { tab: PalmerasTabId }) {
  return (
    <Card className="p-6" accent="muted">
      <div className="font-mono text-[10px] uppercase tracking-widest text-hint">
        Sin datos cargados
      </div>
      <h2 className="mt-2 font-mono text-xl text-foreground">{LABELS[tab]}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Este módulo está disponible para el Proyecto Cholqui pero aún no tiene datos. Se poblará a
        medida que se carguen muestreos, geofísica, sondajes y resultados de laboratorio.
      </p>
    </Card>
  );
}
