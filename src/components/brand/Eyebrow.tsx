import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* Etiqueta superior (mono, mayúsculas, tracking amplio) del lenguaje
   Institutional Modernist. Sustituye a la clase utilitaria `.brand-eyebrow`. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.18em] text-content-subtle",
        className,
      )}
      {...props}
    />
  );
}
