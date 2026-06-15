import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* Primitiva Button del lenguaje Institutional Modernist.
   Consume SOLO tokens semánticos (accent-brand / content / surface).
   Usar `asChild` para envolver un <Link> de TanStack Router. */
const brandButton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent-brand text-accent-brand-contrast shadow-sm hover:bg-im-cobalt-deep",
        outline:
          "border border-content/25 text-content hover:border-accent-brand hover:bg-im-cobalt-wash",
        ghost: "text-content hover:bg-im-cobalt-wash",
        link: "px-0 text-accent-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-brand-sm px-4 text-sm [&_svg]:size-4",
        md: "h-11 rounded-brand-md px-5 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-brand-md px-6 text-[15px] [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface BrandButtonProps
  extends ComponentProps<"button">, VariantProps<typeof brandButton> {
  asChild?: boolean;
}

export function BrandButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: BrandButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(brandButton({ variant, size }), className)} {...props} />;
}

export { brandButton };
