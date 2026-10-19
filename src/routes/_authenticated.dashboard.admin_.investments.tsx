import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import {
  listTicketsAdmin,
  saveRoundSettings,
  staffTicketAction,
  type RoundSpv,
  type TicketRow,
} from "@/lib/tickets.functions";
import { getCapTableAdmin, type CapTablePosition, type CapTableSpv } from "@/lib/spv.functions";
import { INVESTABLE_PROJECTS, TICKET_STATUS_LABEL, fmtMoney } from "@/lib/investor/rounds";

function pctOf(shares: number, total: number): string {
  if (!total) return "—";
  return `${((shares / total) * 100).toFixed(4)} %`;
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_authenticated/dashboard/admin_/investments")({
  head: () => ({
    meta: [
      { title: "Admin · Rondas y tickets — Geocapitals" },
      {
        name: "description",
        content:
          "Configura las rondas de Cholqui y Los Verdes y gestiona los tickets de inversión.",
      },
      { property: "og:title", content: "Admin · Rondas y tickets — Geocapitals" },
      { property: "og:description", content: "Mesa de control de tickets de inversión por SPV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminInvestmentsPage,
});

const CODES = INVESTABLE_PROJECTS.map((p) => p.spvCode);

function AdminInvestmentsPage() {
  const listFn = useServerFn(listTicketsAdmin);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => listFn({ data: { codes: [...CODES] } }),
  });
  const [filter, setFilter] = useState<string>("open");

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <Link
          to="/dashboard/admin"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-content-subtle hover:text-content"
        >
          <ArrowLeft className="w-3 h-3" /> Admin
        </Link>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Rondas y tickets de inversión</h1>
        <p className="text-sm text-content-subtle mt-1">
          Configura cada SPV, abre la ronda y mueve los tickets: contrato → pago → liquidación.
        </p>

        {isLoading && <Loader2 className="mt-6 w-5 h-5 animate-spin" />}
        {error && <p className="mt-6 text-sm text-destructive">{(error as Error).message}</p>}
        {data && (
          <>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {INVESTABLE_PROJECTS.map((p) => (
                <RoundCard
                  key={p.spvCode}
                  code={p.spvCode}
                  name={p.name}
                  spv={data.spvs.find((s) => s.project_code === p.spvCode) ?? null}
                  tickets={data.tickets}
                />
              ))}
            </div>

            <CapTableSection />

            <div className="mt-8 flex items-center gap-2">
              <h2 className="font-display text-xl mr-auto">Tickets</h2>
              {[
                ["open", "En curso"],
                ["settled", "Liquidados"],
                ["cancelled", "Cancelados"],
                ["all", "Todos"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`rounded px-2.5 py-1 text-xs border ${filter === k ? "border-accent-brand text-accent-brand" : "border-hairline text-content-subtle"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <TicketsTable
              tickets={data.tickets.filter((t) =>
                filter === "all"
                  ? true
                  : filter === "open"
                    ? !["settled", "cancelled"].includes(t.status)
                    : t.status === filter,
              )}
              spvs={data.spvs}
              profiles={data.profiles}
            />
          </>
        )}
      </div>
    </div>
  );
}

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

function RoundCard({
  code,
  name,
  spv,
  tickets,
}: {
  code: string;
  name: string;
  spv: RoundSpv | null;
  tickets: TicketRow[];
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveRoundSettings);
  const [f, setF] = useState({
    legalName: spv?.legal_name ?? "",
    rut: spv?.rut ?? "",
    totalShares: String(spv?.total_shares ?? ""),
    sharePrice: String(spv?.share_price ?? ""),
    currency: (spv?.currency as "USD" | "CLP" | "UF") ?? "USD",
    roundSize: String(spv?.round_size ?? ""),
    minTicket: String(spv?.min_ticket ?? ""),
    roundShares: String(spv?.round_shares ?? ""),
    escrow: spv?.escrow_instructions ?? "",
    open: spv?.tickets_open ?? false,
  });
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          projectCode: code,
          legalName: f.legalName.trim(),
          rut: f.rut.trim() || null,
          totalShares: Number(f.totalShares || 0),
          sharePrice: num(f.sharePrice),
          currency: f.currency,
          roundSize: num(f.roundSize),
          minTicket: num(f.minTicket),
          roundShares: num(f.roundShares),
          escrowInstructions: f.escrow.trim() || null,
          ticketsOpen: f.open,
        },
      }),
    onSuccess: () => {
      toast.success("Ronda guardada");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const mine = spv ? tickets.filter((t) => t.spv_id === spv.id) : [];
  const committed = mine
    .filter((t) => !["cancelled", "draft"].includes(t.status))
    .reduce((s, t) => s + Number(t.amount), 0);
  const settled = mine
    .filter((t) => t.status === "settled")
    .reduce((s, t) => s + Number(t.amount), 0);

  const input = (k: keyof typeof f, label: string, type = "text") => (
    <label className="text-xs text-content-subtle">
      {label}
      <input
        type={type}
        value={f[k] as string}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className="mt-1 w-full rounded border border-hairline bg-surface px-2 py-1.5 text-sm text-content font-mono"
      />
    </label>
  );

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-brand">
            {code}
          </div>
          <h3 className="font-display text-lg">{name}</h3>
        </div>
        <span
          className={`text-xs rounded px-2 py-0.5 border ${spv?.tickets_open ? "border-accent-brand text-accent-brand" : "border-hairline text-content-subtle"}`}
        >
          {spv ? (spv.tickets_open ? "Ronda abierta" : "Ronda cerrada") : "SPV sin registrar"}
        </span>
      </div>
      <div className="mt-2 text-xs font-mono text-content-subtle">
        Comprometido {fmtMoney(committed, f.currency)} · Liquidado {fmtMoney(settled, f.currency)} ·{" "}
        {mine.length} tickets
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {input("legalName", "Razón social SPV")}
        {input("rut", "RUT")}
        {input("totalShares", "Acciones emitidas", "number")}
        {input("roundShares", "Acciones ofrecidas en ronda", "number")}
        {input("sharePrice", "Precio por acción", "number")}
        <label className="text-xs text-content-subtle">
          Moneda
          <select
            value={f.currency}
            onChange={(e) => setF({ ...f, currency: e.target.value as "USD" | "CLP" | "UF" })}
            className="mt-1 w-full rounded border border-hairline bg-surface px-2 py-1.5 text-sm text-content"
          >
            <option>USD</option>
            <option>CLP</option>
            <option>UF</option>
          </select>
        </label>
        {input("roundSize", "Meta de la ronda", "number")}
        {input("minTicket", "Ticket mínimo", "number")}
      </div>
      <label className="mt-3 block text-xs text-content-subtle">
        Instrucciones de depósito (cuenta escrow)
        <textarea
          value={f.escrow}
          onChange={(e) => setF({ ...f, escrow: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded border border-hairline bg-surface px-2 py-1.5 text-sm text-content"
        />
      </label>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.open}
            onChange={(e) => setF({ ...f, open: e.target.checked })}
          />
          Abrir ronda a tickets
        </label>
        <button
          disabled={save.isPending || f.legalName.trim().length < 2}
          onClick={() => save.mutate()}
          className="rounded-md bg-accent-brand px-4 py-1.5 text-sm text-surface disabled:opacity-40"
        >
          {save.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  );
}

function CapTableSection() {
  const capFn = useServerFn(getCapTableAdmin);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-cap-table"],
    queryFn: () => capFn({ data: { codes: [...CODES] } }),
  });

  function exportCsv(spvs: CapTableSpv[], positions: CapTablePosition[]) {
    const byId = new Map(spvs.map((s) => [s.id, s]));
    const header = [
      "Proyecto",
      "Inversionista",
      "Correo",
      "Acciones",
      "% del total",
      "Monto",
      "Moneda",
      "Fecha",
      "Estado",
    ];
    const rows = positions.map((p) => {
      const s = byId.get(p.spv_id);
      return [
        s?.project_code ?? "—",
        p.investor_name,
        p.investor_email ?? "",
        p.shares,
        s ? pctOf(Number(p.shares), Number(s.total_shares)) : "—",
        p.amount_paid,
        p.currency,
        p.subscribed_on,
        p.status === "active" ? "Vigente" : "Anulado",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    downloadCsv(`cap-table-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl mr-auto">Cap table</h2>
        {data && data.positions.length > 0 && (
          <button
            onClick={() => exportCsv(data.spvs, data.positions)}
            className="inline-flex items-center gap-1.5 rounded border border-hairline px-2.5 py-1.5 text-xs text-content-subtle hover:border-accent-brand hover:text-accent-brand"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        )}
      </div>
      {isLoading && <Loader2 className="mt-3 w-5 h-5 animate-spin" />}
      {error && <p className="mt-3 text-sm text-destructive">{(error as Error).message}</p>}
      {data &&
        (data.positions.length === 0 ? (
          <p className="mt-3 text-sm text-content-subtle">Sin posiciones registradas todavía.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-content-subtle border-b border-hairline">
                  <th className="p-3">Proyecto</th>
                  <th className="p-3">Inversionista</th>
                  <th className="p-3 text-right">Acciones</th>
                  <th className="p-3 text-right">%</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p) => {
                  const s = data.spvs.find((x) => x.id === p.spv_id);
                  return (
                    <tr key={p.id} className="border-b border-hairline/70 align-top">
                      <td className="p-3 font-mono">{s?.project_code ?? "—"}</td>
                      <td className="p-3">
                        {p.investor_name}
                        {p.investor_email && (
                          <div className="text-xs text-content-subtle">{p.investor_email}</div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {Number(p.shares).toLocaleString("es-CL")}
                      </td>
                      <td className="p-3 text-right font-mono text-content-subtle">
                        {s ? pctOf(Number(p.shares), Number(s.total_shares)) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {fmtMoney(p.amount_paid, p.currency)}
                      </td>
                      <td className="p-3 font-mono text-content-subtle">{p.subscribed_on}</td>
                      <td className="p-3 text-content-subtle">
                        {p.status === "active" ? "Vigente" : "Anulado"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function TicketsTable({
  tickets,
  spvs,
  profiles,
}: {
  tickets: TicketRow[];
  spvs: RoundSpv[];
  profiles: Array<{
    user_id: string;
    full_name: string;
    company_name: string | null;
    tax_id: string | null;
    review_status: string;
    is_accredited: boolean | null;
  }>;
}) {
  const qc = useQueryClient();
  const actFn = useServerFn(staffTicketAction);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "issue_contract" | "settle" | "cancel") {
    let reason: string | null = null;
    if (action === "cancel") {
      reason = window.prompt("Motivo de cancelación:");
      if (!reason) return;
    }
    setBusy(id);
    try {
      await actFn({ data: { ticketId: id, action, reason } });
      toast.success("Ticket actualizado");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  if (!tickets.length)
    return <p className="mt-4 text-sm text-content-subtle">Sin tickets en esta vista.</p>;

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-content-subtle border-b border-hairline">
            <th className="p-3">Ticket</th>
            <th className="p-3">Proyecto</th>
            <th className="p-3">Inversionista</th>
            <th className="p-3">KYC</th>
            <th className="p-3">Monto</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Comprobante</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const p = profiles.find((x) => x.user_id === t.investor_user_id);
            const spv = spvs.find((s) => s.id === t.spv_id);
            return (
              <tr key={t.id} className="border-b border-hairline/70 align-top">
                <td className="p-3 font-mono">{t.ticket_code}</td>
                <td className="p-3">{spv?.project_code ?? "—"}</td>
                <td className="p-3">
                  <div>{p?.full_name ?? "Sin perfil"}</div>
                  <div className="text-xs text-content-subtle">
                    {[p?.company_name, p?.tax_id].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="p-3 text-xs">
                  {p?.review_status === "approved"
                    ? "Aprobado"
                    : p?.review_status === "rejected"
                      ? "Rechazado"
                      : "Pendiente"}
                </td>
                <td className="p-3 font-mono">
                  {fmtMoney(t.amount, t.currency)}
                  <div className="text-xs text-content-subtle">
                    {Number(t.shares_allocated ?? 0).toLocaleString("es-CL")} acc.
                  </div>
                </td>
                <td className="p-3 text-xs">{TICKET_STATUS_LABEL[t.status] ?? t.status}</td>
                <td className="p-3 text-xs break-all max-w-[180px]">
                  {t.payment_proof_url ?? "—"}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.status === "pending_kyc" && (
                      <Btn disabled={busy === t.id} onClick={() => act(t.id, "issue_contract")}>
                        Emitir contrato
                      </Btn>
                    )}
                    {t.status === "payment_pending" && t.payment_proof_url && (
                      <Btn disabled={busy === t.id} onClick={() => act(t.id, "settle")}>
                        Confirmar pago y liquidar
                      </Btn>
                    )}
                    {!["settled", "cancelled"].includes(t.status) && (
                      <Btn disabled={busy === t.id} onClick={() => act(t.id, "cancel")} muted>
                        Cancelar
                      </Btn>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs disabled:opacity-40 ${muted ? "border-hairline text-content-subtle" : "border-accent-brand text-accent-brand"}`}
    >
      {children}
    </button>
  );
}
