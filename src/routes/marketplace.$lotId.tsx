import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Award,
  ShieldCheck,
  Anchor,
  MapPin,
  FileText,
  Layers,
  Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow } from "@/components/brand";
import { CommodityCover } from "@/features/marketing/CommodityCover";
import { LotTrustPanel } from "@/components/marketplace/LotTrustPanel";
import { LotValuationPanel } from "@/components/marketplace/LotValuationPanel";
import { Reveal } from "@/features/marketing/Reveal";
import { useAuth } from "@/hooks/useAuth";
import {
  getCommodityLotDetail,
  createCommodityInquiry,
  listPublishedCommodityLots,
  getMyVerificationStatus,
  type CommodityLotRow,
} from "@/lib/marketplace.functions";
import { getMetalPrices, type MetalQuote } from "@/lib/commodityPrices.functions";
import {
  commodityLabel,
  commodityColor,
  countryFlag,
  countryName,
  formLabel,
  formatTonnes,
  FREQUENCIES,
} from "@/lib/commodityLabels";

/** Formatea una fecha ISO como dd-MM-yyyy en UTC — estable entre SSR y cliente. */
function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}-${mm}-${yy}`;
}

export const Route = createFileRoute("/marketplace/$lotId")({
  loader: async ({ params }) => {
    const lot = await getCommodityLotDetail({ data: { id: params.lotId } });
    if (!lot) throw notFound();
    return lot;
  },
  head: ({ params, loaderData }) => {
    const lot = loaderData;
    const url = `https://geocapitals.com/marketplace/${params.lotId}`;
    if (!lot) {
      return {
        meta: [{ title: "Lote no encontrado — Geocapitals Marketplace" }],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const title = `${lot.title} — Geocapitals Marketplace`;
    const desc =
      lot.summary ??
      `${commodityLabel(lot.commodity)} desde ${countryName(lot.country)} · ${formatTonnes(lot.tonnage_available_t)} disponible · Incoterm ${lot.incoterm ?? "—"}.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
    ];
    if (lot.cover_image_url) {
      meta.push({ property: "og:image", content: lot.cover_image_url });
      meta.push({ property: "twitter:image", content: lot.cover_image_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: lot.title,
            description: desc,
            brand: { "@type": "Organization", name: "Geocapitals" },
            countryOfOrigin: countryName(lot.country),
            category: commodityLabel(lot.commodity),
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="brand-light min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 grid place-items-center p-10">
        <div className="text-center">
          <Package className="w-8 h-8 text-accent-brand mx-auto mb-3" strokeWidth={1.5} />
          <div className="font-display text-2xl text-content">Lote no disponible</div>
          <p className="text-sm text-content-subtle mt-2 max-w-sm mx-auto">
            El lote fue archivado o aún no está publicado y verificado.
          </p>
          <BrandButton asChild className="mt-6">
            <Link to="/marketplace">Ver marketplace</Link>
          </BrandButton>
        </div>
      </main>
      <MarketingFooter />
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="brand-light min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1 grid place-items-center p-10">
        <div className="text-center">
          <div className="font-display text-2xl text-content">Error al cargar el lote</div>
          <BrandButton onClick={() => reset()} className="mt-6">
            Reintentar
          </BrandButton>
        </div>
      </main>
      <MarketingFooter />
    </div>
  ),
  component: LotDetailPage,
});

function LotDetailPage() {
  const lot = Route.useLoaderData() as import("@/lib/marketplace.functions").CommodityLotDetail;
  const { user } = useAuth();
  const navigate = useNavigate();
  const inquiryFn = useServerFn(createCommodityInquiry);
  const kycFn = useServerFn(getMyVerificationStatus);
  const { data: kyc } = useQuery({
    queryKey: ["my-kyc-status"],
    queryFn: () => kycFn(),
    staleTime: 60_000,
    enabled: !!user,
  });
  const kycApproved = kyc?.status === "approved";

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    buyer_role: "trader" as const,
    company_name: "",
    intended_use: "",
    target_volume_t: "",
    target_price_usd_t: "",
    message: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate({ to: "/auth", search: { intent: "investor" } as never });
      return;
    }
    setSubmitting(true);
    try {
      await inquiryFn({
        data: {
          lot_id: lot.id,
          buyer_role: form.buyer_role,
          company_name: form.company_name || undefined,
          intended_use: form.intended_use || undefined,
          target_volume_t: form.target_volume_t ? Number(form.target_volume_t) : undefined,
          target_price_usd_t: form.target_price_usd_t ? Number(form.target_price_usd_t) : undefined,
          message: form.message || undefined,
        },
      });
      toast.success("Solicitud enviada. Sigue el avance en Mis cotizaciones del dashboard.");
      setOpen(false);
      setForm({
        buyer_role: "trader",
        company_name: "",
        intended_use: "",
        target_volume_t: "",
        target_price_usd_t: "",
        message: "",
      });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="brand-light min-h-screen flex flex-col">
      <MarketingHeader />

      {/* Portada: imagen real si existe, si no patrón generativo */}
      <div className="relative h-56 md:h-72 overflow-hidden border-b border-hairline bg-slate-100">
        {lot.cover_image_url ? (
          <img
            src={lot.cover_image_url}
            alt={lot.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <CommodityCover
            seed={lot.id}
            commodity={lot.commodity}
            form={lot.form}
            className="absolute inset-0"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-0 right-0">
          <div className="max-w-7xl mx-auto px-5 flex items-end justify-between gap-3 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/80">
              Marketplace · {formLabel(lot.form)}
            </span>
            <span className="text-[11px] font-mono text-white/90">
              {countryFlag(lot.country)} {countryName(lot.country)}
              {lot.port_of_loading && ` · ${lot.port_of_loading}`}
            </span>
          </div>
        </div>
      </div>

      <section className="border-b border-hairline bg-gradient-to-b from-accent-brand-subtle/60 to-white">
        <div className="max-w-7xl mx-auto px-5 py-10">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-content-subtle hover:text-accent-brand"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al marketplace
          </Link>
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded"
              style={{
                background: `${commodityColor(lot.commodity)}22`,
                color: commodityColor(lot.commodity),
              }}
            >
              {commodityLabel(lot.commodity)}
            </span>
            <span className="text-[11px] font-mono text-content-subtle">
              {countryFlag(lot.country)} {countryName(lot.country)}
              {lot.region && ` · ${lot.region}`}
            </span>
            {lot.is_verified && (
              <Link
                to="/metodologia"
                title="Lote con certificaciones y cadena de custodia revisadas por el equipo. Ver metodología."
                className="text-[10px] font-mono uppercase tracking-wider inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
              >
                <ShieldCheck className="w-3 h-3" /> Verificado
              </Link>
            )}
          </div>
          <h1 className="mt-3 brand-display text-3xl md:text-4xl text-content max-w-3xl leading-tight">
            {lot.title}
          </h1>
          {lot.summary && <p className="mt-3 text-content-subtle max-w-2xl">{lot.summary}</p>}
        </div>
      </section>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-5 py-10 grid lg:grid-cols-[1fr_360px] gap-10">
          <div className="space-y-10">
            {/* Ficha técnica */}
            <section>
              <Eyebrow className="mb-3">Ficha técnica</Eyebrow>
              <div className="grid sm:grid-cols-2 gap-3">
                <TechRow k="Forma" v={formLabel(lot.form)} />
                <TechRow k="Ley" v={lot.grade_pct != null ? `${Number(lot.grade_pct)} %` : "—"} />
                <TechRow
                  k="Humedad"
                  v={lot.moisture_pct != null ? `${Number(lot.moisture_pct)} %` : "—"}
                />
                <TechRow k="Disponibilidad" v={formatTonnes(lot.tonnage_available_t)} />
                <TechRow k="Tamaño de lote" v={formatTonnes(lot.lot_size_t)} />
                <TechRow k="Frecuencia" v={FREQUENCIES[lot.frequency ?? ""] ?? "—"} />
                <TechRow k="Puerto" v={lot.port_of_loading ?? "—"} icon={Anchor} />
                <TechRow k="Incoterm" v={lot.incoterm ?? "—"} />
                <TechRow k="Precio base" v={lot.price_basis ?? "—"} />
                <TechRow
                  k="Premium / Discount"
                  v={
                    lot.premium_discount_usd_t != null
                      ? `${Number(lot.premium_discount_usd_t) > 0 ? "+" : ""}${lot.premium_discount_usd_t} USD/t`
                      : "—"
                  }
                />
                <TechRow k="Términos de pago" v={lot.payment_terms ?? "—"} />
                <TechRow k="Región" v={lot.region ?? "—"} icon={MapPin} />
              </div>
            </section>

            {/* Verificación Know-Your-Mine (agente) */}
            <LotTrustPanel lotId={lot.id} />

            {/* Valor pagable estimado (agente Assay-to-Value) */}
            <LotValuationPanel lotId={lot.id} />

            {/* Descripción larga */}
            {lot.description && (
              <section>
                <Eyebrow className="mb-3">Descripción</Eyebrow>
                <p className="text-[15px] leading-relaxed text-content whitespace-pre-line">
                  {lot.description}
                </p>
              </section>
            )}

            {/* Certificaciones */}
            <section>
              <Eyebrow className="mb-3">Certificaciones y cadena de custodia</Eyebrow>
              {lot.certifications.length === 0 && (
                <p className="text-sm text-content-subtle">
                  Certificaciones disponibles bajo NDA. Solicítalas junto con la muestra.
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {lot.certifications.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-hairline bg-white p-4 flex gap-3"
                  >
                    <span className="grid place-items-center w-10 h-10 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0">
                      <Award className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-[15px] text-content">{c.name}</div>
                      <div className="text-xs text-content-subtle">{c.issuer}</div>
                      {c.certificate_number && (
                        <div className="mt-1 text-[11px] font-mono text-content-subtle">
                          Cert #{c.certificate_number}
                        </div>
                      )}
                      {c.expires_at && (
                        <div className="text-[11px] font-mono text-content-subtle">
                          Vence {formatDateUTC(c.expires_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Lotes relacionados */}
            <RelatedLots commodity={lot.commodity} excludeId={lot.id} />
          </div>

          {/* Sidebar CTA */}
          <aside className="lg:sticky lg:top-24 h-fit space-y-4">
            <PriceReferencePanel
              commodity={lot.commodity}
              priceBasis={lot.price_basis}
              premiumDiscount={
                lot.premium_discount_usd_t != null ? Number(lot.premium_discount_usd_t) : null
              }
              askingPrice={lot.asking_price_usd != null ? Number(lot.asking_price_usd) : null}
            />
            <div className="rounded-2xl border border-hairline bg-white p-6">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                Solicitar oferta
              </div>
              <div className="mt-1 font-display text-xl text-content">Contactar al seller</div>
              <p className="mt-2 text-sm text-content-subtle">
                Envía tu interés, volumen objetivo y uso previsto. El seller responderá con
                condiciones y muestra bajo NDA.
              </p>
              {user && kyc && !kycApproved ? (
                <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <ShieldCheck className="w-4 h-4" />
                    {kyc.status === "pending_review"
                      ? "Tu verificación KYC está en revisión"
                      : "Verificación KYC requerida"}
                  </div>
                  <p className="mt-1.5 text-xs text-amber-800/80">
                    {kyc.status === "pending_review"
                      ? "Te avisaremos por email cuando esté aprobada. Después podrás solicitar ofertas."
                      : "Consultar lotes requiere un perfil de inversionista aprobado. Completa tu verificación en el dashboard."}
                  </p>
                  {kyc.status !== "pending_review" && (
                    <Link
                      to="/dashboard"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 underline hover:no-underline"
                    >
                      Completar verificación →
                    </Link>
                  )}
                </div>
              ) : !open ? (
                <BrandButton className="mt-5 w-full" onClick={() => setOpen(true)}>
                  {user ? "Solicitar oferta" : "Iniciar sesión y solicitar"}
                </BrandButton>
              ) : (
                <form onSubmit={submit} className="mt-5 space-y-3">
                  <SelectField
                    label="Rol"
                    value={form.buyer_role}
                    onChange={(v) => setForm((f) => ({ ...f, buyer_role: v as never }))}
                    options={[
                      ["trader", "Trader"],
                      ["refinery", "Refinería"],
                      ["smelter", "Fundición"],
                      ["offtaker", "Offtaker"],
                      ["industrial_end_user", "Industrial (uso final)"],
                      ["investor", "Inversionista"],
                      ["other", "Otro"],
                    ]}
                  />
                  <InputField
                    label="Empresa"
                    value={form.company_name}
                    onChange={(v) => setForm((f) => ({ ...f, company_name: v }))}
                    placeholder="Nombre de tu compañía"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <InputField
                      label="Volumen (t)"
                      value={form.target_volume_t}
                      onChange={(v) => setForm((f) => ({ ...f, target_volume_t: v }))}
                      type="number"
                      placeholder="1000"
                    />
                    <InputField
                      label="Precio (USD/t)"
                      value={form.target_price_usd_t}
                      onChange={(v) => setForm((f) => ({ ...f, target_price_usd_t: v }))}
                      type="number"
                      placeholder="8000"
                    />
                  </div>
                  <InputField
                    label="Uso previsto"
                    value={form.intended_use}
                    onChange={(v) => setForm((f) => ({ ...f, intended_use: v }))}
                    placeholder="Refinación / trading / consumo final"
                  />
                  <TextareaField
                    label="Mensaje"
                    value={form.message}
                    onChange={(v) => setForm((f) => ({ ...f, message: v }))}
                  />
                  <div className="flex gap-2 pt-1">
                    <BrandButton type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? "Enviando…" : "Enviar solicitud"}
                    </BrandButton>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-3 py-2 text-sm border border-hairline rounded-md text-content-subtle hover:text-content"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="rounded-2xl border border-hairline bg-accent-brand-subtle p-5 text-sm">
              <div className="flex items-center gap-2 text-accent-brand font-medium">
                <ShieldCheck className="w-4 h-4" /> Deal trazable
              </div>
              <p className="mt-2 text-content-subtle text-[13px]">
                Todas las conversaciones, adjuntos y NDA quedan registrados en el data room con
                audit-trail completo.
              </p>
            </div>

            <div className="rounded-2xl border border-hairline bg-white p-5 text-sm">
              <div className="flex items-center gap-2 text-content font-medium">
                <FileText className="w-4 h-4 text-accent-brand" /> Documentación disponible
              </div>
              <ul className="mt-3 space-y-2 text-[13px] text-content-subtle">
                <li className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> Análisis de laboratorio (SGS/ALS)
                </li>
                <li className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> Certificados de origen
                </li>
                <li className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> Chain of custody
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

function TechRow({ k, v, icon: Icon }: { k: string; v: string; icon?: typeof Anchor }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-white px-4 py-3">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {k}
      </div>
      <div className="text-sm text-content font-medium text-right">{v}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-hairline rounded-md px-3 py-2 text-sm bg-white text-content focus:outline-none focus:border-accent-brand"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="border border-hairline rounded-md px-3 py-2 text-sm bg-white text-content focus:outline-none focus:border-accent-brand resize-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-hairline rounded-md px-2 py-2 text-sm bg-white text-content focus:outline-none focus:border-accent-brand"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Precio de referencia spot ─────────────────────────────────────────────────

/** Mapea el commodity del lote al símbolo spot disponible (gold-api). */
function quoteCodeFor(commodity: string | null): string | null {
  if (!commodity) return null;
  if (commodity.startsWith("au_")) return "XAU";
  if (commodity.startsWith("ag_")) return "XAG";
  if (commodity.startsWith("cu_")) return "HG";
  return null;
}

function PriceReferencePanel({
  commodity,
  priceBasis,
  premiumDiscount,
  askingPrice,
}: {
  commodity: string | null;
  priceBasis: string | null;
  premiumDiscount: number | null;
  askingPrice: number | null;
}) {
  const pricesFn = useServerFn(getMetalPrices);
  const code = quoteCodeFor(commodity);
  const { data } = useQuery({
    queryKey: ["metal-prices"],
    queryFn: () => pricesFn(),
    staleTime: 5 * 60_000,
    enabled: code != null,
  });
  const quote: MetalQuote | undefined = data?.quotes.find((q) => q.code === code);

  if (!code && premiumDiscount == null && !priceBasis && askingPrice == null) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-surface-inverse text-white p-6">
      <div className="text-[10px] font-mono uppercase tracking-wider text-white/50">
        Contexto de precio
      </div>
      {quote ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold">{quote.price}</span>
          <span className="text-[10px] font-mono text-white/40">{quote.unit} · spot</span>
        </div>
      ) : (
        code == null &&
        priceBasis && <div className="mt-2 font-mono text-sm text-white/80">Base: {priceBasis}</div>
      )}
      <div className="mt-3 space-y-1.5 text-[12px] font-mono">
        {priceBasis && quote && (
          <div className="flex justify-between gap-3">
            <span className="text-white/50">Base contrato</span>
            <span className="text-white/90">{priceBasis}</span>
          </div>
        )}
        {premiumDiscount != null && (
          <div className="flex justify-between gap-3">
            <span className="text-white/50">Premium / Discount</span>
            <span className={premiumDiscount >= 0 ? "text-emerald-400" : "text-red-400"}>
              {premiumDiscount > 0 ? "+" : ""}
              {premiumDiscount} USD/t
            </span>
          </div>
        )}
        {askingPrice != null && (
          <div className="flex justify-between gap-3">
            <span className="text-white/50">Precio fijo pedido</span>
            <span className="text-white/90">US$ {askingPrice.toLocaleString("en-US")}</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-[10px] font-mono text-white/35 leading-relaxed">
        Referencia informativa
        {quote
          ? ` · actualizada ${new Date(quote.updatedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
          : ""}
        . El precio final se negocia directamente con el seller.
      </p>
    </div>
  );
}

// ── Lotes relacionados ────────────────────────────────────────────────────────

function RelatedLots({ commodity, excludeId }: { commodity: string | null; excludeId: string }) {
  const listFn = useServerFn(listPublishedCommodityLots);
  const { data } = useQuery({
    queryKey: ["related-lots", commodity],
    queryFn: () => listFn({ data: { commodity: commodity ?? undefined, limit: 4 } }),
    staleTime: 60_000,
    enabled: !!commodity,
  });
  const related = ((data ?? []) as CommodityLotRow[]).filter((l) => l.id !== excludeId).slice(0, 3);
  if (related.length === 0) return null;

  return (
    <section>
      <Eyebrow className="mb-3">Otros lotes de {commodityLabel(commodity)}</Eyebrow>
      <div className="grid sm:grid-cols-3 gap-3">
        {related.map((l, idx) => (
          <Reveal key={l.id} delay={idx * 60}>
            <Link
              to="/marketplace/$lotId"
              params={{ lotId: l.id }}
              className="group rounded-xl border border-hairline bg-white overflow-hidden block h-full hover-lift hover:border-accent-brand transition"
            >
              <div className="relative h-16 overflow-hidden">
                <div className="cover-zoom absolute inset-0">
                  <CommodityCover
                    seed={l.id}
                    commodity={l.commodity}
                    form={l.form}
                    className="w-full h-full"
                  />
                </div>
              </div>
              <div className="p-3">
                <div className="text-[13px] font-display text-content leading-snug line-clamp-2">
                  {l.title}
                </div>
                <div className="mt-1 text-[10px] font-mono text-content-subtle">
                  {countryFlag(l.country)} {formatTonnes(l.tonnage_available_t)} ·{" "}
                  {l.incoterm ?? "—"}
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
