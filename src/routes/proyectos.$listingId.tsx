import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Mountain,
  Database,
  Drill,
  TestTube2,
  Satellite,
  FileSignature,
  Target,
  CheckCircle2,
  ExternalLink,
  Users,
  Box as BoxIcon,
} from "lucide-react";
import { PublicDataRoomSection } from "@/features/listings/PublicDataRoomSection";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { VerificationBadge } from "@/components/brand";
import { projectVerification } from "@/lib/verification";
import { getListingDetail, type ListingDetail } from "@/lib/listingDetail.functions";
import { InvestmentSimulator } from "@/features/listings/InvestmentSimulator";
import { fmtUSD } from "@/modules/deals/domain/format";
import { queryClient } from "@/lib/queryClient";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";

const detailQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing-detail", id],
    queryFn: () => getListingDetail({ data: { id } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/proyectos/$listingId")({
  loader: async ({ params }) => {
    const data = await queryClient.ensureQueryData(detailQuery(params.listingId));
    if (!data) throw notFound();
    return { listing: data };
  },
  head: ({ loaderData }) => {
    const l = loaderData?.listing as ListingDetail | undefined;
    if (!l) return { meta: [{ title: "Proyecto — Geocapitals" }] };
    const title = `${l.title} — Geocapitals`;
    const desc = l.summary
      ? l.summary.slice(0, 155)
      : `Oportunidad ${MODALITY_LABEL[l.modality ?? ""] ?? ""} en ${l.region ?? l.country ?? "Chile"} · ${l.commodity ?? "minería"}.`;
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (l.cover_image_url) {
      meta.push({ property: "og:image", content: l.cover_image_url });
      meta.push({ name: "twitter:image", content: l.cover_image_url });
    }
    return { meta };
  },
  notFoundComponent: () => (
    <MarketingPage
      eyebrow="404"
      title="Proyecto no encontrado"
      intro="El listado puede haber sido despublicado."
    >
      <Link to="/inversionistas" className="text-accent-brand hover:underline">
        ← Volver al deal flow
      </Link>
    </MarketingPage>
  ),
  errorComponent: ({ error }) => (
    <MarketingPage
      eyebrow="Error"
      title="No pudimos cargar el proyecto"
      intro={(error as Error).message}
    >
      <Link to="/inversionistas" className="text-accent-brand hover:underline">
        ← Volver al deal flow
      </Link>
    </MarketingPage>
  ),
  component: ListingDetailPage,
});

function ListingDetailPage() {
  const { listingId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(listingId));
  if (!data) return null;
  const l = data;
  const ubic = [l.region, l.country].filter(Boolean).join(", ") || "—";

  return (
    <MarketingPage
      eyebrow={MODALITY_LABEL[l.modality ?? ""] ?? "Oportunidad"}
      title={l.title}
      intro={
        l.summary ??
        `${STAGE_LABEL[l.stage ?? ""] ?? l.stage ?? ""} · ${l.commodity ?? ""} · ${ubic}`
      }
    >
      <div className="mb-6">
        <Link
          to="/inversionistas"
          className="inline-flex items-center gap-1.5 text-sm text-accent-brand hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al deal flow
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8">
        {/* Columna izquierda: cover + métricas técnicas */}
        <div className="space-y-6">
          <div className="rounded-xl overflow-hidden border border-hairline bg-accent-brand-subtle aspect-[16/10]">
            {l.cover_image_url ? (
              <img src={l.cover_image_url} alt={l.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center">
                <Mountain className="w-16 h-16 text-accent-brand/40" />
              </div>
            )}
          </div>

          {/* Datos del proyecto — el sello indica el nivel real de verificación */}
          <section className="rounded-xl border border-hairline bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="brand-eyebrow">Datos del proyecto</div>
              <VerificationBadge level={projectVerification(l.project_id)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Metric
                icon={<Database />}
                label="Concesiones"
                value={l.metrics.concessionsTotal}
                suffix={
                  l.metrics.concessionsArea
                    ? `${Math.round(l.metrics.concessionsArea).toLocaleString("es-CL")} ha`
                    : undefined
                }
              />
              <Metric
                icon={<Drill />}
                label="Sondajes"
                value={l.metrics.drillHoles}
                suffix={
                  l.metrics.metersDrilled
                    ? `${Math.round(l.metrics.metersDrilled).toLocaleString("es-CL")} m`
                    : undefined
                }
              />
              <Metric icon={<TestTube2 />} label="Muestras" value={l.metrics.samples} />
              <Metric
                icon={<Satellite />}
                label="Anomalías satelitales"
                value={l.metrics.satelliteAnomalies}
              />
              <Metric icon={<Target />} label="Targets exploración" value={l.metrics.targets} />
              <Metric
                icon={<FileSignature />}
                label="Reportes técnicos"
                value={l.metrics.ni43101Reports}
              />
              <Metric icon={<Users />} label="Interesados" value={l.inquiriesCount} />
            </div>
          </section>

          {/* Inteligencia satelital y 3D */}
          {l.project_id && (l.metrics.satelliteAnomalies > 0 || l.metrics.targets > 0) && (
            <section className="rounded-xl border border-hairline bg-surface-inverse text-white p-5">
              <div className="brand-eyebrow text-accent-brand-subtle mb-2">
                Inteligencia satelital en vivo
              </div>
              <p className="text-sm text-white/70 mb-4">
                Este proyecto tiene {l.metrics.satelliteAnomalies} anomalías satelitales detectadas
                por Sentinel-2. Explóralas sobre el mapa de monitoreo o en la escena 3D interactiva.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  to="/satelital"
                  search={{ project: l.project_id }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md bg-accent-brand text-white hover:opacity-90 transition"
                >
                  <Satellite className="w-3.5 h-3.5" /> Monitoreo satelital
                </Link>
                <Link
                  to="/visor-3d"
                  search={{ project: l.project_id }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md border border-white/25 text-white hover:bg-white/10 transition"
                >
                  <BoxIcon className="w-3.5 h-3.5" /> Visor 3D <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </section>
          )}

          {/* Data room real — con flujo NDA + descargas para inversionistas verificados */}
          <PublicDataRoomSection listingId={l.id} listingTitle={l.title} aggregate={l.dataRoom} />

          {/* Data disponible */}
          {l.data_available && l.data_available.length > 0 && (
            <section className="rounded-xl border border-hairline bg-white p-5">
              <div className="brand-eyebrow mb-3">Data disponible bajo NDA</div>
              <ul className="grid sm:grid-cols-2 gap-2">
                {l.data_available.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-sm text-content">
                    <CheckCircle2 className="w-4 h-4 text-accent-brand shrink-0" /> {d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {l.summary && (
            <section className="rounded-xl border border-hairline bg-white p-5">
              <div className="brand-eyebrow mb-3">Descripción</div>
              <p className="text-sm text-content leading-relaxed whitespace-pre-line">
                {l.summary}
              </p>
            </section>
          )}
        </div>

        {/* Columna derecha: ficha + simulador */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-hairline bg-white p-5 sticky top-24">
            <div className="brand-eyebrow mb-3">Ficha del proyecto</div>
            <dl className="space-y-3 text-sm">
              <FieldRow
                label="Modalidad"
                value={MODALITY_LABEL[l.modality ?? ""] ?? l.modality ?? "—"}
              />
              <FieldRow label="Etapa" value={STAGE_LABEL[l.stage ?? ""] ?? l.stage ?? "—"} />
              <FieldRow label="Commodity" value={l.commodity ?? "—"} />
              <FieldRow label="Ubicación" value={ubic} icon={<MapPin className="w-3.5 h-3.5" />} />
              <FieldRow
                label="Superficie"
                value={l.area_ha != null ? `${l.area_ha.toLocaleString("es-CL")} ha` : "—"}
              />
              <FieldRow
                label={l.modality === "royalty" ? "Royalty" : "Precio"}
                value={
                  l.modality === "royalty" && l.royalty_pct != null
                    ? `${l.royalty_pct}% NSR`
                    : fmtUSD(l.asking_price_usd)
                }
                highlight
              />
              {l.code && <FieldRow label="Código" value={l.code} mono />}
            </dl>
          </section>

          <InvestmentSimulator
            listingId={l.id}
            listingTitle={l.title}
            askingPriceUSD={l.asking_price_usd}
            modality={l.modality}
            royaltyPct={l.royalty_pct}
            stage={l.stage}
            commodity={l.commodity}
          />

          <div className="rounded-xl border border-hairline bg-accent-brand-subtle p-4 text-center">
            <p className="text-xs text-content-subtle mb-2">
              ¿Necesitas más información antes de simular?
            </p>
            <Link
              to="/contacto"
              className="inline-flex items-center gap-1 text-sm text-accent-brand font-medium hover:underline"
            >
              Hablar con un asesor <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </MarketingPage>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        <span className="text-accent-brand [&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</span>
        {label}
      </div>
      <div className="font-mono text-lg font-semibold text-content mt-1">
        {value.toLocaleString("es-CL")}
      </div>
      {suffix && <div className="text-[11px] text-content-subtle font-mono">{suffix}</div>}
    </div>
  );
}

function FieldRow({
  label,
  value,
  icon,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pb-2 border-b border-hairline last:border-0 last:pb-0">
      <dt className="text-[11px] font-mono uppercase tracking-wider text-content-subtle flex items-center gap-1 pt-0.5">
        {icon} {label}
      </dt>
      <dd
        className={`text-right ${mono ? "font-mono text-xs" : ""} ${highlight ? "text-accent-brand font-semibold" : "text-content"}`}
      >
        {value}
      </dd>
    </div>
  );
}
