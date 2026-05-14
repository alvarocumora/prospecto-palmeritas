import { Badge } from "@/features/palmeras/components/primitives/Badge";
import { FRANCO_PROJECT } from "../data/project";

export function FrancoHero() {
  return (
    <div className="relative bg-card border border-border rounded-lg overflow-hidden animate-fade-up">
      <div className="absolute inset-0 diagonal-texture opacity-60 pointer-events-none" />
      <div className="relative p-8 md:p-10">
        <div className="flex items-center gap-2 mb-3">
          <Badge tone="gold">● {FRANCO_PROJECT.status}</Badge>
          <Badge tone="gold">{FRANCO_PROJECT.ref}</Badge>
        </div>
        <h1 className="font-mono text-3xl md:text-5xl font-bold text-foreground tracking-tight uppercase">
          {FRANCO_PROJECT.name}
        </h1>
        <p className="mt-3 font-mono text-sm text-gold-light">{FRANCO_PROJECT.coords} · WGS84</p>
        <p className="mt-4 text-sm text-muted-foreground max-w-3xl">
          {FRANCO_PROJECT.location} · Operador:{" "}
          <span className="text-foreground">{FRANCO_PROJECT.operator}</span> · Inicio: {FRANCO_PROJECT.created}
        </p>
        <p className="mt-6 text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Datos por cargar — pendiente informe pre NI 43-101
        </p>
      </div>
    </div>
  );
}
