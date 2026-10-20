import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Chrome de contenido institucional compartido por Capital, Proyectos y Trade.
 * El shell autenticado, selector de proyecto, permisos y rutas viven fuera de aquí.
 * El canvas geoespacial oscuro se monta dentro del workspace, no cambia el tema global.
 */
export function PlatformPage({
  children,
  className,
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "standard";
}) {
  return (
    <div data-theme="im-light" className="min-h-full bg-surface text-content">
      <main
        className={cn(
          "mx-auto w-full px-4 py-6 pb-28 md:px-7 md:py-8 md:pb-10",
          width === "standard" ? "max-w-5xl" : "max-w-7xl",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

/** Un único patrón de jerarquía: contexto → título → explicación → acciones. */
export function PageHeader({
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
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between md:pb-6",
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow && (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-content-subtle">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-normal leading-tight text-content md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
