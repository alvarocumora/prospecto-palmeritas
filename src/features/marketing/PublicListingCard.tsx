import { Eye, MapPin, Mountain, Sparkles } from "lucide-react";
import type { PublicListing } from "@/lib/publicListings.functions";
import { fmtUSD } from "@/modules/deals/domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";

const MODALITY_TINT: Record<string, { bg: string; fg: string }> = {
  sale: { bg: "bg-emerald-50", fg: "text-emerald-700" },
  jv: { bg: "bg-amber-50", fg: "text-amber-700" },
  royalty: { bg: "bg-sky-50", fg: "text-sky-700" },
  option: { bg: "bg-violet-50", fg: "text-violet-700" },
  lease: { bg: "bg-slate-50", fg: "text-slate-700" },
};

export function PublicListingCard({
  listing,
  onOpen,
}: {
  listing: PublicListing;
  onOpen: () => void;
}) {
  const tint = MODALITY_TINT[listing.modality ?? ""] ?? MODALITY_TINT.sale;
  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-xl border border-hairline bg-white overflow-hidden flex flex-col hover:border-accent-brand hover:shadow-[0_20px_40px_-25px_rgba(11,42,91,0.35)] transition"
    >
      <div className="aspect-[16/9] bg-accent-brand-subtle relative overflow-hidden">
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Mountain className="w-10 h-10 text-accent-brand/30" />
          </div>
        )}
        <div
          className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${tint.bg} ${tint.fg} border border-white/60`}
        >
          {MODALITY_LABEL[listing.modality ?? ""] ?? listing.modality}
        </div>
        {listing.is_featured && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-brand-subtle/95 text-content text-[10px] font-mono uppercase tracking-wider">
            <Sparkles className="w-2.5 h-2.5" /> Destacado
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-display text-[15px] text-content leading-snug line-clamp-2 group-hover:text-accent-brand transition-colors">
          {listing.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] font-mono text-content-subtle flex-wrap">
          {listing.commodity && (
            <span className="px-1.5 py-0.5 rounded bg-accent-brand-subtle text-accent-brand border border-hairline">
              {listing.commodity}
            </span>
          )}
          {listing.stage && <span>{STAGE_LABEL[listing.stage] ?? listing.stage}</span>}
        </div>
        {(listing.region || listing.country) && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-content-subtle">
            <MapPin className="w-3 h-3" />
            <span className="truncate">
              {[listing.region, listing.country].filter(Boolean).join(", ")}
            </span>
            {listing.area_ha != null && (
              <span className="ml-auto whitespace-nowrap">
                {listing.area_ha.toLocaleString("es-CL")} ha
              </span>
            )}
          </div>
        )}
        {listing.summary && (
          <p className="text-[12px] text-content/70 line-clamp-2">{listing.summary}</p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-hairline">
          <div className="font-mono text-sm text-content font-semibold">
            {listing.modality === "royalty" && listing.royalty_pct != null
              ? `${listing.royalty_pct}% NSR`
              : fmtUSD(listing.asking_price_usd)}
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-accent-brand group-hover:underline inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> Ver detalle
          </span>
        </div>
      </div>
    </button>
  );
}
