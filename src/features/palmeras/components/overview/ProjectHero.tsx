import { PALMERAS_PROJECT } from "../../data/project";
import { Badge } from "../primitives";

type ProjectHeroProps = {
  className?: string;
};

export function ProjectHero({ className = "" }: ProjectHeroProps) {
  return (
    <div
      className={`relative bg-card border border-border rounded-lg overflow-hidden animate-fade-up ${className}`}
    >
      <div className="absolute inset-0 diagonal-texture opacity-60 pointer-events-none" />
      <div className="relative p-8 md:p-10">
        <div className="flex items-center gap-2 mb-3">
          <Badge tone="teal">● {PALMERAS_PROJECT.status}</Badge>
          <Badge tone="gold">{PALMERAS_PROJECT.ref}</Badge>
        </div>
        <h1 className="font-mono text-3xl md:text-5xl font-bold text-foreground tracking-tight uppercase">
          {PALMERAS_PROJECT.name}
        </h1>
        <p className="mt-3 font-mono text-sm text-gold-light">{PALMERAS_PROJECT.coords} · WGS84</p>
        <p className="mt-4 text-sm text-muted-foreground max-w-3xl">
          {PALMERAS_PROJECT.location} · Operador:{" "}
          <span className="text-foreground">{PALMERAS_PROJECT.operator}</span> · Inicio:{" "}
          {PALMERAS_PROJECT.created}
        </p>
      </div>
    </div>
  );
}
