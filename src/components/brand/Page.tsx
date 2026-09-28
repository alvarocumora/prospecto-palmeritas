import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PlatformPage({
  className,
  children,
  width = "wide",
  ...props
}: ComponentProps<"div"> & { width?: "content" | "wide" | "full" }) {
  return (
    <div
      data-theme="im-light"
      className={cn("min-h-full bg-surface text-content", className)}
      {...props}
    >
      <div
        className={cn(
          "mx-auto w-full px-4 py-6 md:px-6 md:py-8",
          width === "content" && "max-w-[1120px]",
          width === "wide" && "max-w-[1440px]",
          width === "full" && "max-w-none",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-hairline pb-5 md:pb-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-serif text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-content md:text-4xl">
            {title}
          </h1>
          {description ? (
            <div className="mt-2 max-w-3xl text-sm leading-relaxed text-content-muted">
              {description}
            </div>
          ) : null}
          {meta ? <div className="mt-3 text-xs text-content-subtle">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function PageSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      {title || eyebrow || description || action ? (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? (
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h2 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-content">
                {title}
              </h2>
            ) : null}
            {description ? (
              <div className="mt-1 max-w-3xl text-sm leading-relaxed text-content-muted">
                {description}
              </div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Surface({
  className,
  density = "normal",
  ...props
}: ComponentProps<"div"> & { density?: "compact" | "normal" | "spacious" }) {
  return (
    <div
      className={cn(
        "rounded-brand-md border border-hairline bg-surface-3 shadow-[0_1px_2px_rgba(20,24,40,0.025)]",
        density === "compact" && "p-3 md:p-4",
        density === "normal" && "p-4 md:p-5",
        density === "spacious" && "p-5 md:p-7",
        className,
      )}
      {...props}
    />
  );
}

export function SectionNav({
  items,
  className,
  stickyOffset = "page",
}: {
  items: Array<{ href: string; label: string }>;
  className?: string;
  stickyOffset?: "page" | "workspace";
}) {
  return (
    <nav
      aria-label="Secciones"
      className={cn(
        "sticky z-30 -mx-4 overflow-x-auto border-b border-hairline bg-surface/95 px-4 backdrop-blur md:-mx-6 md:px-6",
        stickyOffset === "workspace" ? "top-[72px]" : "top-0",
        className,
      )}
    >
      <div className="flex min-w-max items-center gap-5">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="border-b-2 border-transparent py-3 text-xs font-medium text-content-muted transition-colors hover:border-accent-brand hover:text-content"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
