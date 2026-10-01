import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DataRoomManager } from "@/features/listings/DataRoomManager";
import { ListingInquiriesPanel } from "@/features/listings/ListingInquiriesPanel";
import { ValuationPanel } from "@/modules/deals/ui/ValuationPanel";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { fmtUSD } from "@/modules/deals/domain/format";

type ListingRow = {
  id: string;
  title: string;
  commodity: string;
  country: string | null;
  region: string | null;
  stage: string;
  modality: string;
  asking_price_usd: number | null;
  royalty_pct: number | null;
  area_ha: number | null;
  is_published: boolean;
  views_count: number;
  owner_user_id: string;
  code: string | null;
  summary: string | null;
  project_id: string | null;
};

export const Route = createFileRoute("/_authenticated/dashboard/listings/$listingId")({
  head: () => ({ meta: [{ title: "Administrar listing — Geocapitals" }] }),
  component: ListingAdminPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Listing no encontrado o no tienes acceso.{" "}
      <Link to="/dashboard/listings" className="text-gold hover:underline">
        Volver
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-danger">
      Error: {(error as Error).message}{" "}
      <Link to="/dashboard/listings" className="text-gold hover:underline">
        Volver
      </Link>
    </div>
  ),
});

function ListingAdminPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPub, setSavingPub] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("property_listings")
      .select(
        "id,title,commodity,country,region,stage,modality,asking_price_usd,royalty_pct,area_ha,is_published,views_count,owner_user_id,code,summary,project_id",
      )
      .eq("id", listingId)
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) throw notFound();
    setListing(data as ListingRow);
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublished = async () => {
    if (!listing) return;
    setSavingPub(true);
    const next = !listing.is_published;
    const { error } = await supabase
      .from("property_listings")
      .update({ is_published: next })
      .eq("id", listing.id);
    setSavingPub(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Listing publicado en el deal flow" : "Listing despublicado");
    setListing({ ...listing, is_published: next });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> Cargando listing…
      </div>
    );
  }
  if (!listing) return null;
  const isOwner = user?.id === listing.owner_user_id;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <Link
        to="/dashboard/listings"
        className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="w-3 h-3" /> Mis listings
      </Link>

      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{listing.title}</h1>
          <div className="text-xs text-muted-foreground mt-1">
            {listing.commodity} · {[listing.region, listing.country].filter(Boolean).join(", ")} ·{" "}
            {STAGE_LABEL[listing.stage] ?? listing.stage} ·{" "}
            {MODALITY_LABEL[listing.modality] ?? listing.modality}
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap text-xs font-mono">
            <span className="text-foreground font-semibold">
              {listing.modality === "royalty" && listing.royalty_pct != null
                ? `${listing.royalty_pct}% NSR`
                : fmtUSD(listing.asking_price_usd)}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Eye className="w-3 h-3" /> {listing.views_count} vistas
            </span>
            {listing.area_ha != null && (
              <span className="text-muted-foreground">
                {listing.area_ha.toLocaleString("es-CL")} ha
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-mono px-2 py-1 rounded border ${
              listing.is_published
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-warn/40 bg-warn/10 text-warn"
            }`}
          >
            {listing.is_published ? "Publicado" : "Borrador"}
          </span>
          {isOwner && (
            <button
              type="button"
              onClick={() => void togglePublished()}
              disabled={savingPub}
              className="rounded border border-border px-3 py-1.5 text-xs font-mono hover:border-gold/60 disabled:opacity-50"
            >
              {savingPub && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
              {listing.is_published ? "Despublicar" : "Publicar"}
            </button>
          )}
          {listing.is_published && (
            <Link
              to="/proyectos/$listingId"
              params={{ listingId: listing.id }}
              target="_blank"
              className="inline-flex items-center gap-1 rounded bg-gold text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-gold/90"
            >
              Ver ficha pública <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="space-y-6">
          <section className="rounded border border-border bg-bg-panel p-4">
            <h2 className="text-sm font-semibold mb-1">Data room</h2>
            <p className="text-[11px] text-muted-foreground">
              Sube NI 43-101, títulos de concesión, geología y modelo financiero. Los archivos
              marcados con NDA solo se descargan cuando el inversionista firma dentro de la
              plataforma.
            </p>
            <DataRoomManager listingId={listing.id} />
          </section>

          <ListingInquiriesPanel listingId={listing.id} />
        </div>

        <aside className="space-y-6">
          <ValuationPanel listingId={listing.id} />

          {/* Documentos del deal de venta: NDA → LOI → Term Sheet → SPA */}
          <section className="rounded border border-border bg-bg-panel p-4">
            <h2 className="text-sm font-semibold mb-1">Documentos del deal</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Genera y envía a firma electrónica los acuerdos de la venta — el interesado firma
              desde un link, sin cuenta.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["nda", "NDA"],
                  ["loi", "LOI"],
                  ["term-sheet", "Term Sheet"],
                  ["spa", "Contrato SPA"],
                ] as const
              ).map(([tpl, label]) => (
                <Link
                  key={tpl}
                  to="/dashboard/documentos/$templateId"
                  params={{ templateId: tpl }}
                  className="px-3 py-1.5 rounded border border-border text-xs font-mono hover:border-gold/60"
                >
                  {label}
                </Link>
              ))}
            </div>
            <Link
              to="/dashboard/ni43101"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-gold hover:underline"
            >
              Informe NI 43-101 del proyecto →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
