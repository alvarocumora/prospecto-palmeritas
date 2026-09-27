import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cabecera de página/sección uniforme: título + descripción + acciones.
 * Patrón: header → (filtros) → contenido, consistente en toda la plataforma.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-xl font-bold leading-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
