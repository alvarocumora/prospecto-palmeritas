import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel de contenido titulado (sobre la primitiva Card). Header opcional con
 * título + acciones; cuerpo con padding consistente. Unifica los "recuadros"
 * dispersos de la plataforma.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
            {description && (
              <div className="text-xs text-muted-foreground">{description}</div>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!noPadding && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
