import type { ReactNode } from "react";
import { Database, Map, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceStatus = "verified" | "derived" | "proposed" | "pending";

export type WorkspaceMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  status?: WorkspaceStatus;
};

export type WorkspaceTab = {
  id: string;
  label: string;
  href?: string;
};

const STATUS_CLASS: Record<WorkspaceStatus, string> = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  derived: "bg-violet-50 text-violet-700 border-violet-200",
  proposed: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ProjectWorkspaceShell({
  code,
  name,
  subtitle,
  stage,
  commodity,
  location,
  metrics,
  tabs,
  actions,
  children,
  className,
}: {
  code: string;
  name: string;
  subtitle?: string;
  stage?: string;
  commodity?: string;
  location?: string;
  metrics?: WorkspaceMetric[];
  tabs?: WorkspaceTab[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-theme="im-light" className={cn("min-h-screen bg-surface text-content", className)}>
      <header className="border-b border-hairline bg-surface/95">
        <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-content-subtle">
                <span className="font-semibold text-accent-brand">Geocapitals</span>
                <span>/</span>
                <span>{code}</span>
                {stage && (
                  <>
                    <span>/</span>
                    <span>{stage}</span>
                  </>
                )}
              </div>
              <h1 className="mt-2 font-serif text-3xl leading-tight text-content md:text-4xl">{name}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
                {subtitle && <span>{subtitle}</span>}
                {commodity && <span className="font-mono">{commodity}</span>}
                {location && <span>{location}</span>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>

          {metrics && metrics.length > 0 && (
            <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
              {metrics.slice(0, 4).map((metric) => (
                <div key={metric.label} className="min-w-0 bg-surface-3 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-content-subtle">
                      {metric.label}
                    </span>
                    {metric.status && (
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase",
                          STATUS_CLASS[metric.status],
                        )}
                      >
                        {metric.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xl font-semibold text-content">{metric.value}</div>
                  {metric.detail && (
                    <div className="mt-0.5 truncate text-[11px] text-content-subtle">{metric.detail}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {tabs && tabs.length > 0 && (
          <div className="border-t border-hairline bg-surface-2/70">
            <nav
              aria-label="Módulos del proyecto"
              className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 py-2 md:px-6"
            >
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  href={tab.href ?? `#${tab.id}`}
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-content-muted transition-colors hover:bg-accent-brand-subtle hover:text-content"
                >
                  {tab.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}

export function ProjectWorkspaceSection({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  canvas = false,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  canvas?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-surface={canvas ? "canvas" : undefined}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-2xl border border-hairline bg-surface-3",
        canvas && "border-border bg-background text-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3 border-b border-hairline px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-5",
          canvas && "border-border",
        )}
      >
        <div>
          {eyebrow && (
            <div
              className={cn(
                "text-[10px] font-mono uppercase tracking-[0.12em] text-accent-brand",
                canvas && "text-primary",
              )}
            >
              {eyebrow}
            </div>
          )}
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
          {description && (
            <p
              className={cn(
                "mt-1 max-w-3xl text-xs leading-5 text-content-muted",
                canvas && "text-muted-foreground",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function ProjectReadinessStrip({
  catastro,
  exploration,
  economics,
  validation,
}: {
  catastro: string;
  exploration: string;
  economics: string;
  validation: string;
}) {
  const items = [
    { label: "Catastro", value: catastro, icon: Map },
    { label: "Exploración", value: exploration, icon: Database },
    { label: "Economía", value: economics, icon: TrendingUp },
    { label: "Validación", value: validation, icon: ShieldCheck },
  ];

  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 bg-surface-2 px-4 py-3">
          <Icon className="h-4 w-4 shrink-0 text-accent-brand" />
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-content-subtle">
              {label}
            </div>
            <div className="truncate text-xs font-medium text-content">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
