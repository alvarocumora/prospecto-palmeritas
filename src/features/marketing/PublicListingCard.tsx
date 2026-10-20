import type { PublicListing } from "@/lib/publicListings.functions";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { terminalSlugForListing, getTerminalProject } from "@/features/terminal/terminalProjects";
import { InvestmentCard } from "@/features/investor/InvestmentCard";
import { money } from "@/features/investor/investmentPresentation";

export function PublicListingCard({
  listing: p,
  onOpen,
  updatedAt,
}: {
  listing: PublicListing;
  onOpen: () => void;
  updatedAt?: string;
}) {
  const slug = terminalSlugForListing(p);
  const ficha = slug ? getTerminalProject(slug)?.ficha : null;
  return (
    <InvestmentCard
      title={p.title}
      region={ficha?.region ?? [p.region, p.country].filter(Boolean).join(", ")}
      commodity={ficha?.commodity ?? p.commodity ?? ""}
      stage={ficha?.stage ?? STAGE_LABEL[p.stage ?? ""] ?? p.stage ?? ""}
      image={p.cover_image_url}
      slug={slug}
      onOpen={onOpen}
      updatedAt={updatedAt}
    >
      <p className="text-[10px] font-mono text-content-muted">
        DECLARADO · listado publicado ·{" "}
        {MODALITY_LABEL[p.modality ?? ""] ?? p.modality ?? "Términos por verificar"}
      </p>
      {p.summary && (
        <p className="line-clamp-2 text-sm leading-relaxed text-content-muted">{p.summary}</p>
      )}
      <dl className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        <div>
          <dt className="text-[10px] text-content-muted">Superficie declarada</dt>
          <dd className="mt-1 font-mono text-sm">
            {p.area_ha == null ? "Por verificar" : `${p.area_ha.toLocaleString("es-CL")} ha`}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-content-muted">Términos referenciales</dt>
          <dd className="mt-1 break-words font-mono text-sm">
            {p.modality === "royalty" && p.royalty_pct != null
              ? `${p.royalty_pct}% NSR`
              : p.asking_price_usd == null
                ? "Por consultar"
                : money(p.asking_price_usd)}
          </dd>
        </div>
      </dl>
      <p className="text-[10px] leading-relaxed text-content-muted">
        Inversión privada e ilíquida. No es precio bursátil ni rendimiento garantizado.
      </p>
    </InvestmentCard>
  );
}
