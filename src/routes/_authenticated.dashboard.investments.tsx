import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  CircleDashed,
} from "lucide-react";
import { BrandButton } from "@/components/brand";
import { toast } from "sonner";
import { getMyInvestmentHistory } from "@/lib/investors.functions";
import { PendingTicketBanner } from "@/features/investor/PendingTicketBanner";
import { InvestorWallet } from "@/features/investor/InvestorWallet";
import { ContentState, PageHeader, PlatformPage } from "@/components/ui-system";

export const Route = createFileRoute("/_authenticated/dashboard/investments")({
  head: () => ({ meta: [{ title: "Portafolio y cartola — Geocapitals" }, { name: "description", content: "Posiciones confirmadas, órdenes, contratos y estado KYC de tu inversión privada." }, { property: "og:title", content: "Portafolio y cartola — Geocapitals" }, { property: "og:description", content: "Cartola institucional de posiciones SPV y documentos de inversión." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { vista?: string } =>
    typeof s.vista === "string" ? { vista: s.vista } : {},
  component: MyInvestmentsPage,
});

type Data = Awaited<ReturnType<typeof getMyInvestmentHistory>>;

const fmtUsd = (n: number | null | undefined) =>
  n == null ? "—" : `USD ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "2-digit" })
    : "—";

function MyInvestmentsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const d = await getMyInvestmentHistory();
      setData(d);
    } catch (e) {
      setError(true); setData(null);
      toast.error(e instanceof Error ? e.message : "Error cargando historial");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { vista } = Route.useSearch();
  useEffect(() => {
    if (vista !== "wallet") return;
    document.getElementById("cartola")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [vista, loading]);

  return (
    <PlatformPage>
      <Link
        to="/dashboard"
        className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs text-content-muted hover:text-accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver al inicio
      </Link>
      <PageHeader
        eyebrow="Capital · Inversiones"
        title="Portafolio y cartola"
        description="Posiciones confirmadas, órdenes y documentos de inversión privada. El capital aportado es histórico; no es un valor de mercado."
        actions={
          <BrandButton
            variant="outline"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-hairline px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-brand"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            Recargar
          </BrandButton>
        }
      />

      <PendingTicketBanner />
      <InvestorWallet />

      <Link
        to="/dashboard/inversion-colateral"
        className="mb-4 flex items-center justify-between gap-3 rounded border border-accent-brand/40 bg-surface-3 p-4 hover:border-accent-brand"
      >
        <div>
          <div className="text-sm font-semibold">Inversión con colateral inmobiliario</div>
          <div className="text-xs text-content-muted">
            Términos referenciales del programa y documentación contractual · ver deck
          </div>
        </div>
        <FileText className="w-4 h-4 text-accent-brand" />
      </Link>

      {loading && !data ? (
        <ContentState kind="loading" title="Cargando historial de inversión…" />
      ) : error ? (
        <ContentState
          kind="error"
          title="No pudimos cargar KYC y solicitudes"
          description="El historial no está disponible en este momento; esto no significa que no tengas operaciones."
          action={{ label: "Reintentar", onClick: () => void load() }}
        />
      ) : !data ? null : (
        <>
          <KycCard data={data} />

          <SettlementsBlock items={data.settlements} />
          <InquiriesBlock items={data.inquiries} />
        </>
      )}
    </PlatformPage>
  );
}

function KycCard({ data }: { data: Data }) {
  const p = data.profile;
  if (!p) {
    return (
      <section className="rounded border border-hairline bg-surface-3 p-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <CircleDashed className="w-4 h-4 text-content-muted" />
          <span>Aún no completas tu perfil de inversionista.</span>
          <Link to="/dashboard" className="ml-auto text-xs font-mono text-accent-brand hover:underline">
            Completar →
          </Link>
        </div>
      </section>
    );
  }
  const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    pending_review: {
      label: "En revisión",
      cls: "border-hairline/40 bg-surface-2/10 text-content-muted",
      Icon: Clock,
    },
    approved: { label: "Aprobado", cls: "border-hairline/40 bg-surface-2/10 text-accent-brand", Icon: CheckCircle2 },
    rejected: {
      label: "Rechazado",
      cls: "border-hairline/40 bg-surface-2/10 text-content",
      Icon: XCircle,
    },
  };
  const s = map[p.review_status] ?? map.pending_review;
  return (
    <section className="rounded border border-hairline bg-surface-3 p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl text-content">Estado KYC y solicitudes</h2>
          <p className="text-xs text-content-muted mt-0.5">
            {p.full_name} · {p.company_name}
          </p>
        </div>
        <span
          className={`text-[11px] font-mono px-2 py-1 rounded border inline-flex items-center gap-1.5 ${s.cls}`}
        >
          <s.Icon className="w-3 h-3" /> {s.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
        <Info k="Términos aceptados" v={fmtDate(p.terms_accepted_at)} />
        <Info k="Perfil enviado" v={fmtDate(p.created_at)} />
        <Info k="Revisado" v={fmtDate(p.reviewed_at)} />
        <Info k="Motivo rechazo" v={p.rejection_reason ?? "—"} />
      </dl>
    </section>
  );
}

function SettlementsBlock({ items }: { items: Data["settlements"] }) {
  return (
    <section className="rounded border border-hairline bg-surface-3 mb-4">
      <header className="px-4 py-3 border-b border-hairline">
        <h2 className="font-semibold text-sm">Liquidaciones</h2>
        <p className="text-[11px] text-content-muted mt-0.5">
          Transacciones registradas por el equipo Geocapitals.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-content-muted">
          Sin liquidaciones registradas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-content-muted border-b border-hairline">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Proyecto</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium text-right">Monto USD</th>
                <th className="px-3 py-2 font-medium">Fee</th>
                <th className="px-3 py-2 font-medium">Recibido</th>
                <th className="px-3 py-2 font-medium">Wire ref.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-hairline/50 hover:bg-surface-2/40">
                  <td className="px-3 py-2">
                    {s.listing_id ? (
                      <Link
                        to="/proyectos/$listingId"
                        params={{ listingId: s.listing_id }}
                        className="font-medium text-content hover:underline"
                      >
                        {s.listing?.title ?? "Revisar oportunidad"}
                      </Link>
                    ) : (
                      <div className="font-medium text-content">—</div>
                    )}
                    <div className="text-[10px] text-content-muted">
                      {s.listing?.commodity ?? ""}{" "}
                      {s.listing?.country ? `· ${s.listing.country}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <SettlementStatus status={s.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtUsd(Number(s.amount_usd))}</td>
                  <td className="px-3 py-2 font-mono">
                    {s.success_fee_pct ? `${s.success_fee_pct}%` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono">{fmtDate(s.received_at ?? s.recorded_at)}</td>
                  <td className="px-3 py-2 font-mono text-content-muted truncate max-w-[140px]">
                    {s.wire_reference ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SettlementStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-hairline/40 bg-surface-2/10 text-content-muted",
    invoiced: "border-accent-brand/40 bg-accent-brand/10 text-accent-brand",
    paid: "border-hairline/40 bg-surface-2/10 text-accent-brand",
    received: "border-hairline/40 bg-surface-2/10 text-accent-brand",
    cancelled: "border-hairline/40 bg-surface-2/10 text-content",
    refunded: "border-muted/40 bg-muted/10 text-content-muted",
  };
  const label =
    status === "pending"
      ? "Pendiente"
      : status === "invoiced"
        ? "Facturado"
        : status === "paid" || status === "received"
          ? "Pagado"
          : status === "cancelled"
            ? "Cancelado"
            : status === "refunded"
              ? "Reembolsado"
              : status;
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${map[status] ?? "border-hairline"}`}
    >
      {label}
    </span>
  );
}

function InquiriesBlock({ items }: { items: Data["inquiries"] }) {
  return (
    <section className="rounded border border-hairline bg-surface-3">
      <header className="px-4 py-3 border-b border-hairline">
        <h2 className="font-semibold text-sm">Oportunidades en evaluación</h2>
        <p className="text-[11px] text-content-muted mt-0.5">
          Solicitudes y NDAs; no son posiciones confirmadas.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-content-muted">
          Sin solicitudes. Explora el{" "}
          <Link to="/inversionistas" className="text-accent-brand hover:underline">
            deal flow público
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-content truncate">
                  <Link
                    to="/proyectos/$listingId"
                    params={{ listingId: i.listing_id }}
                    className="hover:underline"
                  >
                    {i.listing?.title ?? "Revisar oportunidad"}
                  </Link>
                </div>
                <div className="text-[10px] text-content-muted font-mono">
                  Solicitado: {fmtDate(i.created_at)}
                  {i.nda_signed_at ? ` · NDA: ${fmtDate(i.nda_signed_at)}` : ""}
                  {i.closed_at ? ` · Cerrado: ${fmtDate(i.closed_at)}` : ""}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-hairline bg-surface-2/60">
                {i.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-content-muted">{k}</dt>
      <dd className="break-words text-content mt-0.5">{v}</dd>
    </div>
  );
}
