import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandButton } from "@/components/brand";
import { VerificationBadge } from "@/components/brand";
import { projectVerification } from "@/lib/verification";
import type { PublicListing } from "@/lib/publicListings.functions";
import { fmtUSD } from "@/modules/deals/domain/format";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { CheckCircle2, MapPin, Mountain, ArrowRight, Lock, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { submitContactMessage } from "@/lib/contactMessages.functions";
import { terminalSlugForListing, getTerminalProject } from "@/features/terminal/terminalProjects";

export function PublicListingDrawer({
  listing,
  open,
  onOpenChange,
}: {
  listing: PublicListing | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-theme="im-light"
        className="bg-surface text-content sm:max-w-xl w-full overflow-y-auto p-0 border-l border-hairline"
      >
        {listing && <Body listing={listing} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ listing }: { listing: PublicListing }) {
  const terminalSlug = terminalSlugForListing(listing);
  const ficha = terminalSlug ? getTerminalProject(terminalSlug)?.ficha : null;
  return (
    <div className="flex flex-col">
      <div className="relative aspect-[16/9] bg-accent-brand-subtle overflow-hidden">
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Mountain className="w-14 h-14 text-accent-brand/30" />
          </div>
        )}
        <p className="absolute bottom-3 left-3 right-3 w-fit bg-surface/95 px-2 py-1 text-[10px]">{listing.cover_image_url ? "Imagen referencial · procedencia por verificar" : "Ilustración referencial"}</p>
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-3/95 text-content text-[10px] font-mono uppercase tracking-wider border border-hairline">
          {MODALITY_LABEL[listing.modality ?? ""] ?? listing.modality} ·{" "}
          {STAGE_LABEL[listing.stage ?? ""] ?? listing.stage}
        </div>
      </div>

      <div className="p-5 md:p-7">
        <SheetHeader>
          <SheetTitle asChild>
            <h2 className="font-display text-2xl text-content text-left">{listing.title}</h2>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
          {listing.code && (
            <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
              {listing.code}
            </span>
          )}
          <VerificationBadge level={projectVerification(listing.project_id)} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Kpi
            label="Términos referenciales"
            v={
              listing.modality === "royalty" && listing.royalty_pct != null
                ? `${listing.royalty_pct}% NSR`
                : fmtUSD(listing.asking_price_usd)
            }
          />
          <Kpi label="Commodity" v={listing.commodity ?? "—"} />
          <Kpi
            label="Superficie declarada"
            v={listing.area_ha != null ? `${listing.area_ha.toLocaleString("es-CL")} ha` : "—"}
          />
          <Kpi
            label="Ubicación"
            v={ficha?.region ?? ([listing.region, listing.country].filter(Boolean).join(", ") || "Por verificar")}
            icon={<MapPin className="w-3.5 h-3.5" />}
          />
        </div>

        {listing.summary && (
          <div className="mt-6">
            <div className="brand-eyebrow mb-2">Resumen</div>
            <p className="text-sm text-content leading-relaxed">{listing.summary}</p>
          </div>
        )}

        {listing.data_available && listing.data_available.length > 0 && (
          <div className="mt-6">
            <div className="brand-eyebrow mb-3">Data disponible</div>
            <ul className="grid grid-cols-2 gap-2">
              {listing.data_available.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-content">
                  <CheckCircle2 className="w-4 h-4 text-accent-brand" /> {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {terminalSlug ? (
            <Link
              to="/terminal/$slug"
              params={{ slug: terminalSlug }}
              search={{ tab: "mapa" as const }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md border border-accent-brand text-accent-brand text-sm font-medium hover:bg-accent-brand-subtle transition-colors"
            >
              Abrir terminal del activo <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              to="/proyectos/$listingId"
              params={{ listingId: listing.id }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md border border-accent-brand text-accent-brand text-sm font-medium hover:bg-accent-brand-subtle transition-colors"
            >
              Ver ficha completa & simulador <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <p className="mt-5 text-xs text-content-muted">DECLARADO · listado publicado. No constituye oferta pública, precio bursátil ni rendimiento garantizado; inversión privada e ilíquida.</p>
        <RequestAccess listing={listing} />
      </div>
    </div>
  );
}

function Kpi({ label, v, icon }: { label: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-accent-brand-subtle/40 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] text-content font-semibold break-words">{v}</div>
    </div>
  );
}

function RequestAccess({ listing }: { listing: PublicListing }) {
  const submit = useServerFn(submitContactMessage);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          name,
          email,
          organization: org || null,
          role: "investor",
          message: `Solicito acceso al data room del listado "${listing.title}" (id ${listing.id}, código ${listing.code ?? "—"}).`,
          source: `listing:${listing.id}`,
        },
      }),
  });

  if (mut.isSuccess) {
    return (
      <div className="mt-7 rounded-lg border border-hairline bg-surface-2 p-5 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-accent-brand shrink-0 mt-0.5" />
        <div>
          <div className="font-display text-[15px] text-content">Solicitud enviada</div>
          <p className="text-sm text-content-muted mt-1">
            Te contactaremos en menos de 24 h para coordinar acceso al data room.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
      className="mt-7 rounded-lg border border-hairline bg-surface-3 p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-accent-brand" />
        <div className="font-display text-[15px] text-content">Solicitar acceso al data room</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          required
          minLength={2}
          maxLength={200}
          className="brand-input"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          required
          type="email"
          maxLength={320}
          className="brand-input"
          placeholder="Email corporativo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <input
        maxLength={200}
        className="brand-input"
        placeholder="Organización / Fondo (opcional)"
        value={org}
        onChange={(e) => setOrg(e.target.value)}
      />
      {mut.isError && (
        <div className="text-sm text-content">
          {(mut.error as Error)?.message ?? "Error al enviar."}
        </div>
      )}
      <BrandButton
        type="submit"
        disabled={mut.isPending}
        className="w-full inline-flex items-center justify-center gap-2 bg-accent-brand text-accent-brand-contrast px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-95 disabled:opacity-60"
      >
        {mut.isPending ? (
          "Enviando…"
        ) : (
          <>
            Solicitar acceso <ArrowRight className="w-4 h-4" />
          </>
        )}
      </BrandButton>
      <p className="text-[11px] font-mono text-content-subtle text-center">
        Bajo NDA ·{" "}
        <Link to="/metodologia" className="text-accent-brand hover:underline">
          Verificación KYC institucional
        </Link>
      </p>
    </form>
  );
}
