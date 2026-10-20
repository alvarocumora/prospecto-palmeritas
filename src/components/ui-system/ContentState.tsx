import type { ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ContentStateKind = "loading" | "empty" | "error";

const DEFAULTS: Record<ContentStateKind, { title: string; description: string }> = {
  loading: {
    title: "Cargando información…",
    description: "Consultando los datos disponibles.",
  },
  empty: {
    title: "Sin resultados",
    description: "No hay información disponible para esta selección.",
  },
  error: {
    title: "No se pudo cargar",
    description: "La consulta falló. Intenta nuevamente.",
  },
};

/**
 * Estado accesible y reutilizable. El estado vacío se usa solo cuando el
 * servicio confirmó ausencia de datos; nunca para esconder un error de consulta.
 */
export function ContentState({
  kind,
  title,
  description,
  action,
  className,
}: {
  kind: ContentStateKind;
  title?: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "error" ? AlertCircle : Inbox;
  const defaults = DEFAULTS[kind];

  return (
    <section
      role={kind === "error" ? "alert" : "status"}
      aria-busy={kind === "loading"}
      className={cn(
        "flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-surface-3 px-5 py-9 text-center",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mb-3 h-6 w-6 text-content-subtle",
          kind === "loading" && "animate-spin motion-reduce:animate-none",
        )}
      />
      <h2 className="font-display text-xl text-content">{title ?? defaults.title}</h2>
      <p className="mt-1 max-w-md text-sm text-content-muted">
        {description ?? defaults.description}
      </p>
      {action && kind !== "loading" && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-accent-brand px-4 py-2 text-sm font-medium text-accent-brand transition-colors hover:bg-accent-brand-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          {action.label}
        </button>
      )}
    </section>
  );
}
