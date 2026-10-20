import { Mountain } from 'lucide-react';

/** Neutral illustration, never a map, simulated coordinates, or synthetic terrain. */
export function ProjectCover({ className = '' }: { seed: string; commodity?: string | null; region?: string | null; className?: string }) {
  return <div className={`flex h-full w-full items-center justify-center bg-surface-2 text-content-muted ${className}`} aria-label="Ilustración referencial">
    <Mountain className="size-16 opacity-30" strokeWidth={1} aria-hidden="true" />
    <span className="sr-only">Ilustración referencial; no representa el terreno del proyecto.</span>
  </div>;
}
