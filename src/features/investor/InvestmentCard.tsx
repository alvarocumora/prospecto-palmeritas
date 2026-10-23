import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Box, MapPin } from "lucide-react";
import { BrandButton } from "@/components/brand";
import { ProjectCover } from "@/features/marketing/ProjectCover";
import type { CanonicalProjectSlug } from "@/lib/projects/catalog";

/** One editorial card for catalog listings and investment rounds. */
export function InvestmentCard({
  title,
  region,
  commodity,
  stage,
  image,
  imageLabel,
  slug,
  onOpen,
  children,
  updatedAt,
}: {
  title: string;
  region: string;
  commodity: string;
  stage: string;
  image?: string | null;
  imageLabel?: string;
  slug?: CanonicalProjectSlug | null;
  onOpen?: () => void;
  children: ReactNode;
  updatedAt?: string;
}) {
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-sm border border-hairline bg-surface text-content transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-accent-brand hover:shadow-[0_16px_38px_-28px_rgba(17,29,53,0.5)] focus-within:border-accent-brand focus-within:shadow-[0_16px_38px_-28px_rgba(17,29,53,0.5)] motion-reduce:transform-none">
      <figure className="relative aspect-[16/9] shrink-0 overflow-hidden bg-surface-2">
        {image ? (
          <img
            src={image}
            alt={`Vista del proyecto ${title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <ProjectCover seed={title} />
        )}
        <figcaption className="absolute bottom-3 left-3 right-3 w-fit max-w-[calc(100%-24px)] border border-white/20 bg-surface/95 px-2.5 py-1.5 font-mono text-[11px] leading-tight text-content shadow-sm">
          {image
            ? (imageLabel ?? "Imagen referencial · procedencia por verificar")
            : "Ilustración referencial"}
        </figcaption>
      </figure>
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.06em]">
          <span className="border border-hairline bg-surface-2 px-2 py-1">
            {commodity || "Mineral por verificar"}
          </span>
          <span className="border border-hairline px-2 py-1">{stage || "Etapa por verificar"}</span>
        </div>
        <div>
          <h3 className="font-serif text-[1.7rem] leading-[1.12] tracking-tight text-content">
            {title}
          </h3>
          <p className="mt-3 flex items-start gap-1.5 text-sm leading-relaxed text-content-muted">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {region || "Ubicación por verificar"}
          </p>
        </div>
        {children}
        {updatedAt && (
          <p className="text-[10px] text-content-muted">
            Consulta: {new Date(updatedAt).toLocaleString("es-CL")} · no es fecha de validación
          </p>
        )}
        <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row">
          {slug ? (
            <>
              <BrandButton asChild size="md" className="min-w-0 flex-1">
                <Link to="/terminal/$slug" params={{ slug }} search={{ tab: "tesis" }}>
                  Ver proyecto <ArrowRight className="size-4" />
                </Link>
              </BrandButton>
              <BrandButton asChild variant="outline" size="md" className="flex-1">
                <Link to="/terminal/$slug" params={{ slug }} search={{ tab: "mapa" }}>
                  <Box className="size-4" />
                  Visor 3D
                </Link>
              </BrandButton>
            </>
          ) : (
            <BrandButton onClick={onOpen} className="w-full">
              Ver proyecto <ArrowRight className="size-4" />
            </BrandButton>
          )}
        </div>
      </div>
    </article>
  );
}
