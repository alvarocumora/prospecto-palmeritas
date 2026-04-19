import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useExplorationCampaigns } from "@/hooks/useExplorationCampaigns";
import {
  useCampaignFinance,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/hooks/useCampaignFinance";
import { useProjectRole, canAccess } from "@/hooks/useProjectRole";
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2, XCircle, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/finance")({
  component: FinancePage,
});

function FinancePage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const projectId = active?.id ?? null;
  const { data: campaigns } = useExplorationCampaigns(projectId);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const effectiveCampaignId = campaignId ?? campaigns[0]?.id ?? null;
  const fin = useCampaignFinance(projectId, effectiveCampaignId);

  const canEdit = canAccess(role, "overview") && ["owner", "admin", "project_manager", "chief_geologist"].includes(role ?? "");
  const canApprove = ["owner", "admin", "project_manager"].includes(role ?? "");

  // Aggregations
  const summary = useMemo(() => {
    const plannedByCat: Record<string, number> = {};
    const actualByCat: Record<string, number> = {};
    for (const b of fin.budgets) plannedByCat[b.category] = (plannedByCat[b.category] ?? 0) + Number(b.planned_amount_usd);
    for (const e of fin.expenses) {
      if (e.status !== "rejected") {
        actualByCat[e.category] = (actualByCat[e.category] ?? 0) + Number(e.amount_usd);
      }
    }
    const planned = Object.values(plannedByCat).reduce((a, b) => a + b, 0);
    const actual = Object.values(actualByCat).reduce((a, b) => a + b, 0);
    const totalMeters = fin.expenses
      .filter((e) => e.category === "drilling" && e.status === "approved")
      .reduce((acc, e) => acc + (Number(e.meters_drilled) || 0), 0);
    const drillingCost = fin.expenses
      .filter((e) => e.category === "drilling" && e.status === "approved")
      .reduce((acc, e) => acc + Number(e.amount_usd), 0);
    const costPerMeter = totalMeters > 0 ? drillingCost / totalMeters : null;
    const pending = fin.expenses.filter((e) => e.status === "pending");
    return { plannedByCat, actualByCat, planned, actual, costPerMeter, totalMeters, pendingCount: pending.length };
  }, [fin.budgets, fin.expenses]);

  if (!projectId) {
    return <div className="p-6 text-sm font-mono text-muted-foreground">Selecciona un proyecto.</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-gold" /> Costos & Budget
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          Control financiero por campaña · presupuesto vs gasto real · costo por metro perforado
        </p>
      </header>

      {/* Campaign selector */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-mono text-muted-foreground">Campaña:</label>
        <select
          value={effectiveCampaignId ?? ""}
          onChange={(e) => setCampaignId(e.target.value || null)}
          className="px-3 py-1.5 rounded border border-border bg-background text-sm font-mono"
        >
          <option value="">— Selecciona —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.phase})</option>
          ))}
        </select>
      </div>

      {!effectiveCampaignId && (
        <div className="text-sm font-mono text-muted-foreground bg-muted/30 border border-border rounded p-6 text-center">
          Crea una campaña en <span className="text-gold">Campañas</span> para empezar a registrar presupuesto y gastos.
        </div>
      )}

      {effectiveCampaignId && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Presupuesto" value={`$${summary.planned.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} accent="text-info" />
            <KpiCard label="Gasto real" value={`$${summary.actual.toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} accent={summary.actual > summary.planned ? "text-destructive" : "text-teal"} />
            <KpiCard label="Saldo" value={`$${(summary.planned - summary.actual).toLocaleString()}`} icon={<TrendingDown className="w-4 h-4" />} accent={summary.planned - summary.actual >= 0 ? "text-teal" : "text-destructive"} />
            <KpiCard
              label="USD/metro perf."
              value={summary.costPerMeter != null ? `$${summary.costPerMeter.toFixed(0)}` : "—"}
              sub={summary.totalMeters > 0 ? `${summary.totalMeters.toFixed(0)} m` : undefined}
              icon={<DollarSign className="w-4 h-4" />}
              accent="text-gold"
            />
          </div>

          {/* Budget vs Actual table */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold mb-3 font-mono uppercase tracking-wider text-muted-foreground">Presupuesto por categoría</h2>
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Categoría</th>
                    <th className="text-right px-3 py-2">Planificado</th>
                    <th className="text-right px-3 py-2">Real</th>
                    <th className="text-right px-3 py-2">Δ</th>
                    <th className="text-left px-3 py-2 w-32">Avance</th>
                    {canEdit && <th className="text-right px-3 py-2">Editar</th>}
                  </tr>
                </thead>
                <tbody>
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const planned = summary.plannedByCat[cat] ?? 0;
                    const actual = summary.actualByCat[cat] ?? 0;
                    const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
                    const over = actual > planned && planned > 0;
                    return (
                      <tr key={cat} className="border-t border-border">
                        <td className="px-3 py-2">{CATEGORY_LABELS[cat]}</td>
                        <td className="px-3 py-2 text-right">${planned.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">${actual.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right ${over ? "text-destructive" : "text-teal"}`}>
                          ${(planned - actual).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-2 rounded bg-muted overflow-hidden">
                            <div
                              className={`h-full ${over ? "bg-destructive" : pct > 80 ? "bg-gold" : "bg-teal"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2 text-right">
                            <BudgetEditor cat={cat} current={planned} onSave={fin.upsertBudget} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Add expense */}
          {canEdit && <ExpenseForm onAdd={fin.addExpense} />}

          {/* Expenses list */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold mb-3 font-mono uppercase tracking-wider text-muted-foreground">
              Gastos registrados {summary.pendingCount > 0 && <span className="ml-2 text-gold">· {summary.pendingCount} pendientes</span>}
            </h2>
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Categoría</th>
                    <th className="text-left px-3 py-2">Descripción</th>
                    <th className="text-left px-3 py-2">Proveedor</th>
                    <th className="text-right px-3 py-2">Monto</th>
                    <th className="text-right px-3 py-2">Metros</th>
                    <th className="text-center px-3 py-2">Estado</th>
                    {(canApprove || canEdit) && <th className="text-right px-3 py-2">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {fin.expenses.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sin gastos registrados.</td></tr>
                  )}
                  {fin.expenses.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2">{e.expense_date}</td>
                      <td className="px-3 py-2">{CATEGORY_LABELS[e.category]}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{e.description}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.vendor ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">${Number(e.amount_usd).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{e.meters_drilled ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={e.status} />
                      </td>
                      {(canApprove || canEdit) && (
                        <td className="px-3 py-2 text-right space-x-1">
                          {canApprove && e.status === "pending" && (
                            <>
                              <button
                                onClick={async () => {
                                  const { error } = await fin.setExpenseStatus(e.id, "approved");
                                  if (error) toast.error(error); else toast.success("Aprobado");
                                }}
                                className="text-teal hover:underline"
                              >Aprobar</button>
                              <button
                                onClick={async () => {
                                  const { error } = await fin.setExpenseStatus(e.id, "rejected");
                                  if (error) toast.error(error); else toast.success("Rechazado");
                                }}
                                className="text-destructive hover:underline"
                              >Rechazar</button>
                            </>
                          )}
                          {canEdit && (
                            <button
                              onClick={async () => {
                                if (!confirm("¿Eliminar este gasto?")) return;
                                const { error } = await fin.deleteExpense(e.id);
                                if (error) toast.error(error); else toast.success("Eliminado");
                              }}
                              className="text-muted-foreground hover:text-destructive inline-flex"
                            ><Trash2 className="w-3 h-3" /></button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="border border-border rounded p-3 bg-bg-secondary">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className={`text-lg font-semibold ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <span className="inline-flex items-center gap-1 text-teal text-[10px]"><CheckCircle2 className="w-3 h-3" />Aprobado</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 text-destructive text-[10px]"><XCircle className="w-3 h-3" />Rechazado</span>;
  return <span className="inline-flex items-center gap-1 text-gold text-[10px]"><Clock className="w-3 h-3" />Pendiente</span>;
}

function BudgetEditor({ cat, current, onSave }: {
  cat: ExpenseCategory; current: number;
  onSave: (cat: ExpenseCategory, amount: number) => Promise<{ error: string | null }>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current.toString());
  if (!editing) {
    return (
      <button onClick={() => { setVal(current.toString()); setEditing(true); }} className="text-gold hover:underline text-[10px]">
        Editar
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number" value={val} onChange={(e) => setVal(e.target.value)}
        className="w-20 px-1 py-0.5 text-[10px] border border-border rounded bg-background"
      />
      <button
        onClick={async () => {
          const n = parseFloat(val); if (!Number.isFinite(n) || n < 0) { toast.error("Monto inválido"); return; }
          const { error } = await onSave(cat, n);
          if (error) toast.error(error); else { toast.success("Guardado"); setEditing(false); }
        }}
        className="text-teal text-[10px]">OK</button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground text-[10px]">×</button>
    </span>
  );
}

function ExpenseForm({ onAdd }: {
  onAdd: (input: { category: ExpenseCategory; description: string; amount_usd: number;
    vendor?: string | null; invoice_number?: string | null; meters_drilled?: number | null;
    expense_date?: string; }) => Promise<{ error: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("drilling");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [invoice, setInvoice] = useState("");
  const [meters, setMeters] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90"
      >
        <Plus className="w-3 h-3" /> Registrar gasto
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const n = parseFloat(amount);
        if (!Number.isFinite(n) || n < 0) { toast.error("Monto inválido"); return; }
        if (!description.trim()) { toast.error("Descripción requerida"); return; }
        const m = meters ? parseFloat(meters) : null;
        const { error } = await onAdd({
          category, description: description.trim(), amount_usd: n,
          vendor: vendor || null, invoice_number: invoice || null,
          meters_drilled: m, expense_date: date,
        });
        if (error) { toast.error(error); return; }
        toast.success("Gasto agregado");
        setDescription(""); setAmount(""); setVendor(""); setInvoice(""); setMeters("");
        setOpen(false);
      }}
      className="border border-border rounded p-4 bg-bg-secondary space-y-3"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground">Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground">Monto USD *</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required
            className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground">Metros (sondaje)</label>
          <input type="number" step="0.01" value={meters} onChange={(e) => setMeters(e.target.value)}
            className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background" />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase font-mono text-muted-foreground">Descripción *</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required
          className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground">Proveedor</label>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)}
            className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground">Nº Factura</label>
          <input value={invoice} onChange={(e) => setInvoice(e.target.value)}
            className="w-full mt-0.5 px-2 py-1 text-xs font-mono border border-border rounded bg-background" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold">Guardar</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded border border-border text-xs font-mono">Cancelar</button>
      </div>
    </form>
  );
}
