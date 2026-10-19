import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  FileText,
  Wallet,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import { getMyInvestmentHistory } from "@/lib/investors.functions";
import { PendingTicketBanner } from "@/features/investor/PendingTicketBanner";
import { InvestorWallet } from "@/features/investor/InvestorWallet";

export const Route = createFileRoute("/_authenticated/dashboard/investments")({
  head: () => ({ meta: [{ title: "Mis inversiones — Geocapitals" }] }),
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getMyInvestmentHistory();
      setData(d);
    } catch (e) {
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
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <header className="flex items-center justify-between gap-3 mb-5">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </Link>
          <h1 className="text-xl md:text-2xl font-bold mt-1">Mis inversiones</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Historial completo: KYC, oportunidades en evaluación y liquidaciones cerradas.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-panel px-3 py-1.5 text-xs font-mono hover:border-gold/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Recargar
        </button>
      </header>

      <PendingTicketBanner />
      <InvestorWallet />

      <Link
        to="/dashboard/inversion-colateral"
        className="mb-4 flex items-center justify-between gap-3 rounded border border-gold/40 bg-bg-panel p-4 hover:border-gold"
      >
        <div>
          <div className="text-sm font-semibold">Inversión con colateral inmobiliario</div>
          <div className="text-xs text-muted-foreground">
            UF + 12 % anual, interés mensual y parcela en garantía en el Maule · ver deck
          </div>
        </div>
        <FileText className="w-4 h-4 text-gold" />
      </Link>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : !data ? null : (
        <>
          <KycCard data={data} />
          <TotalsRow totals={data.totals} />
          <SettlementsBlock items={data.settlements} />
          <InquiriesBlock items={data.inquiries} />
        </>
      )}
    </div>
  );
}

function KycCard({ data }: { data: Data }) {
  const p = data.profile;
  if (!p) {
    return (
      <section className="rounded border border-border bg-bg-panel p-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <CircleDashed className="w-4 h-4 text-muted-foreground" />
          <span>Aún no completas tu perfil de inversionista.</span>
          <Link to="/dashboard" className="ml-auto text-xs font-mono text-gold hover:underline">
            Completar →
          </Link>
        </div>
      </section>
    );
  }
  const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    pending_review: {
      label: "En revisión",
      cls: "border-warn/40 bg-warn/10 text-warn",
      Icon: Clock,
    },
    approved: { label: "Aprobado", cls: "border-teal/40 bg-teal/10 text-teal", Icon: CheckCircle2 },
    rejected: {
      label: "Rechazado",
      cls: "border-danger/40 bg-danger/10 text-danger",
      Icon: XCircle,
    },
  };
  const s = map[p.review_status] ?? map.pending_review;
  return (
    <section className="rounded border border-border bg-bg-panel p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground">Estado KYC</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
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

function TotalsRow({ totals }: { totals: Data["totals"] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <KpiCard Icon={Wallet} label="Total pagado" value={fmtUsd(totals.paidUsd)} tone="teal" />
      <KpiCard
        Icon={DollarSign}
        label="Compromiso total"
        value={fmtUsd(totals.committedUsd)}
        tone="gold"
      />
      <KpiCard Icon={FileText} label="Operaciones" value={String(totals.count)} tone="muted" />
    </div>
  );
}

function KpiCard({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: typeof Wallet;
  label: string;
  value: string;
  tone: "teal" | "gold" | "muted";
}) {
  const cls =
    tone === "teal" ? "text-teal" : tone === "gold" ? "text-gold" : "text-muted-foreground";
  return (
    <div className="rounded border border-border bg-bg-panel p-4">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-muted-foreground">
        <Icon className={`w-3.5 h-3.5 ${cls}`} /> {label}
      </div>
      <div className={`text-xl font-bold mt-2 ${cls}`}>{value}</div>
    </div>
  );
}

function SettlementsBlock({ items }: { items: Data["settlements"] }) {
  return (
    <section className="rounded border border-border bg-bg-panel mb-4">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm">Liquidaciones</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Transacciones registradas por el equipo Geocapitals.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          Sin liquidaciones registradas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
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
                <tr key={s.id} className="border-b border-border/50 hover:bg-bg-elevated/40">
                  <td className="px-3 py-2">
                    {s.listing_id ? (
                      <Link
                        to="/proyectos/$listingId"
                        params={{ listingId: s.listing_id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {s.listing?.title ?? "Revisar oportunidad"}
                      </Link>
                    ) : (
                      <div className="font-medium text-foreground">—</div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
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
                  <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[140px]">
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
    pending: "border-warn/40 bg-warn/10 text-warn",
    invoiced: "border-gold/40 bg-gold/10 text-gold",
    paid: "border-teal/40 bg-teal/10 text-teal",
    received: "border-teal/40 bg-teal/10 text-teal",
    cancelled: "border-danger/40 bg-danger/10 text-danger",
    refunded: "border-muted/40 bg-muted/10 text-muted-foreground",
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
      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${map[status] ?? "border-border"}`}
    >
      {label}
    </span>
  );
}

function InquiriesBlock({ items }: { items: Data["inquiries"] }) {
  return (
    <section className="rounded border border-border bg-bg-panel">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm">Oportunidades en evaluación</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Data rooms y NDAs solicitados — convierten a liquidación al cerrar.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          Sin inquiries. Explora el{" "}
          <Link to="/inversionistas" className="text-gold hover:underline">
            deal flow público
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  <Link
                    to="/proyectos/$listingId"
                    params={{ listingId: i.listing_id }}
                    className="hover:underline"
                  >
                    {i.listing?.title ?? "Revisar oportunidad"}
                  </Link>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  Solicitado: {fmtDate(i.created_at)}
                  {i.nda_signed_at ? ` · NDA: ${fmtDate(i.nda_signed_at)}` : ""}
                  {i.closed_at ? ` · Cerrado: ${fmtDate(i.closed_at)}` : ""}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-bg-elevated/60">
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
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="text-foreground mt-0.5">{v}</dd>
    </div>
  );
}
