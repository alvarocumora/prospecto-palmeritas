import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* Superficie elevada del lenguaje Institutional Modernist.
   `interactive` añade realce de borde/sombra en hover (tarjetas-enlace). */
export function BrandCard({
  className,
  interactive = false,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-brand-md border border-hairline bg-surface-3 p-6 transition-[border-color,box-shadow]",
        interactive &&
          "hover:border-accent-brand hover:shadow-[0_20px_40px_-25px_color-mix(in_oklab,var(--accent-brand)_35%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}
