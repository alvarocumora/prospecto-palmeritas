import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Mail,
  Globe,
  Building2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { listInvestorProfiles, approveInvestor, rejectInvestor } from "@/lib/investors.functions";

export const Route = createFileRoute("/_authenticated/dashboard/admin/investors")({
  head: () => ({ meta: [{ title: "Admin · Inversionistas — Geocapitals" }] }),
  component: AdminInvestorsPage,
});

type Status = "pending_review" | "approved" | "rejected" | "all";

interface Row {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string;
  country: string;
  investor_type: string;
  ticket_min_usd: number | null;
  ticket_max_usd: number | null;
  commodities: string[];
  accepted_standards: string[];
  website: string | null;
  review_status: string;
  reviewed_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  notes: string | null;
  email: string | null;
}

const fmtUsd = (n: number | null) => (n ? `$${(n / 1000).toLocaleString()}K` : "—");

function AdminInvestorsPage() {
  const [status, setStatus] = useState<Status>("pending_review");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInvestorProfiles({ data: { status } });
      setRows(data as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando inversionistas");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const onApprove = async (r: Row) => {
    setActing(r.user_id);
    try {
      await approveInvestor({ data: { userId: r.user_id } });
      toast.success(`Aprobado: ${r.full_name}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aprobar");
    } finally {
      setActing(null);
    }
  };

  const onReject = async (r: Row) => {
    const reason = window.prompt(`Motivo de rechazo para ${r.full_name}:`);
    if (!reason || reason.trim().length < 3) return;
    setActing(r.user_id);
    try {
      await rejectInvestor({ data: { userId: r.user_id, reason: reason.trim() } });
      toast.success(`Rechazado: ${r.full_name}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Admin
          </Link>
          <h1 className="text-xl md:text-2xl font-bold mt-1">Inversionistas · Revisión KYC</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Aprueba o rechaza perfiles. La aprobación envía email automático y habilita data rooms.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-panel px-3 py-1.5 text-xs font-mono hover:border-gold/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Recargar
        </button>
      </div>

      <div className="flex gap-1.5 mb-4">
        {(["pending_review", "approved", "rejected", "all"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              status === s
                ? "border-gold bg-gold/10 text-gold"
                : "border-border bg-bg-panel hover:border-gold/40"
            }`}
          >
            {s === "pending_review"
              ? "Pendientes"
              : s === "approved"
                ? "Aprobados"
                : s === "rejected"
                  ? "Rechazados"
                  : "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-border bg-bg-panel p-8 text-center text-sm text-muted-foreground">
          Sin perfiles en este estado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
              <header className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{r.full_name}</h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3 h-3" /> {r.company_name} · {r.country}
                  </div>
                </div>
                <StatusBadge s={r.review_status} />
              </header>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3">
                <Info k="Tipo" v={r.investor_type} />
                <Info k="Ticket" v={`${fmtUsd(r.ticket_min_usd)} – ${fmtUsd(r.ticket_max_usd)}`} />
                <Info k="Commodities" v={(r.commodities ?? []).join(", ") || "—"} />
                <Info k="Estándares" v={(r.accepted_standards ?? []).join(", ") || "—"} />
              </dl>

              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mb-3 font-mono">
                {r.email && (
                  <a
                    href={`mailto:${r.email}`}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Mail className="w-3 h-3" /> {r.email}
                  </a>
                )}
                {r.website && (
                  <a
                    href={r.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Globe className="w-3 h-3" /> sitio
                  </a>
                )}
                {r.terms_accepted_at && <span>Términos: ✓</span>}
                <span>Recibido: {new Date(r.created_at).toLocaleDateString()}</span>
              </div>

              {r.review_status === "pending_review" && (
                <div className="flex gap-2">
                  <button
                    disabled={acting === r.user_id}
                    onClick={() => void onApprove(r)}
                    className="inline-flex items-center gap-1.5 rounded bg-teal text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-teal/90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                  </button>
                  <button
                    disabled={acting === r.user_id}
                    onClick={() => void onReject(r)}
                    className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-mono hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    pending_review: "border-warn/40 bg-warn/10 text-warn",
    approved: "border-teal/40 bg-teal/10 text-teal",
    rejected: "border-danger/40 bg-danger/10 text-danger",
  };
  const label = s === "pending_review" ? "Pendiente" : s === "approved" ? "Aprobado" : "Rechazado";
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${map[s] ?? "border-border"}`}
    >
      {label}
    </span>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground truncate">{v}</dd>
    </>
  );
}
