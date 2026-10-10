import { Briefcase, Eye, MapPin, Mountain } from "lucide-react";
import type { PropertyListing } from "@/hooks/usePropertyListings";
import { fmtUSD } from "../domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "../domain/constants";

export function ListingCard({ listing, onOpen }: { listing: PropertyListing; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-lg border border-hairline bg-surface-2 hover:border-accent-brand/60 hover:bg-surface-3 transition-all overflow-hidden flex flex-col group"
    >
      <div className="aspect-[16/9] bg-surface-3 relative overflow-hidden">
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mountain className="w-10 h-10 text-content-subtle/30" />
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface/85 backdrop-blur text-[9px] font-mono uppercase text-accent-brand border border-accent-brand/40">
          {MODALITY_LABEL[listing.modality] ?? listing.modality}
        </div>
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface/85 backdrop-blur text-[9px] font-mono text-content">
          <Eye className="w-2.5 h-2.5" /> {listing.views_count}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-normal text-content line-clamp-2 group-hover:text-accent-brand transition-colors">
            {listing.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-content-subtle">
          <span className="px-1.5 py-0.5 rounded bg-surface-3 border border-hairline">
            {listing.commodity}
          </span>
          <span>{STAGE_LABEL[listing.stage] ?? listing.stage}</span>
        </div>
        {(listing.region || listing.country) && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-content-subtle">
            <MapPin className="w-3 h-3" />
            {[listing.region, listing.country].filter(Boolean).join(", ")}
            {listing.area_ha && (
              <span className="ml-auto">{listing.area_ha.toLocaleString("es-CL")} ha</span>
            )}
          </div>
        )}
        {listing.summary && (
          <p className="text-[11px] font-mono text-content-subtle line-clamp-2 mt-1">
            {listing.summary}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-hairline">
          <div className="text-xs font-mono text-accent-brand font-semibold">
            {listing.modality === "royalty" && listing.royalty_pct != null
              ? `${listing.royalty_pct}% NSR`
              : fmtUSD(listing.asking_price_usd)}
          </div>
          <span className="text-[10px] font-mono text-content-subtle group-hover:text-accent-brand">
            <Briefcase className="w-3 h-3 inline mr-1" /> Ver detalle
          </span>
        </div>
      </div>
    </button>
  );
}
