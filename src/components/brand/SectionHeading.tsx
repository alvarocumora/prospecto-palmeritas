import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

/* Encabezado de sección: eyebrow opcional + título serif (display editorial)
   + descripción opcional. Jerarquía por escala, no por peso. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Tag = "h2",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
      <Tag className="font-serif text-3xl font-semibold leading-[1.1] tracking-[-0.01em] text-content md:text-4xl">
        {title}
      </Tag>
      {description ? (
        <p
          className={cn(
            "mt-4 text-content-muted",
            align === "center" ? "mx-auto max-w-2xl" : "max-w-xl",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
