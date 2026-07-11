import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Coins, Plus, TrendingUp, Wallet, Users, Info, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  listOfferings,
  listMyHoldings,
  createOffering,
  setOfferingStatus,
  subscribeOffering,
  getOfferingDetail,
} from "@/lib/tokenization.functions";
import { QueryError } from "@/components/ui/QueryError";

export const Route = createFileRoute("/_authenticated/dashboard/offerings")({
  head: () => ({ meta: [{ title: "Tokenización · Ofertas — Geocapitals" }] }),
  component: OfferingsPage,
});

const fmtUsd = (n: number) => `US$ ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Abierta",
  closed: "Cerrada",
  cancelled: "Cancelada",
  pending: "Pendiente",
  confirmed: "Confirmada",
  rejected: "Rechazada",
};

function OfferingsPage() {
  const { active } = useProjects();
  const canEmit = active?.role === "owner" || active?.role === "admin";
  const [tab, setTab] = useState<"browse" | "holdings" | "emit">("browse");

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <header className="mb-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Dashboard
        </Link>
        <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
          <Coins className="w-5 h-5 text-gold" /> Tokenización de activos
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Participaciones fraccionadas sobre proyectos mineros. Explora ofertas, gestiona tus
          participaciones y —si eres titular— emite una nueva.
        </p>
      </header>

      <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-500 mb-4 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Participaciones referenciales para gestión de cap table. No constituye oferta pública de
        valores ni asesoría de inversión; sujeto a due diligence y documentación legal.
      </div>

      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        <TabBtn active={tab === "browse"} onClick={() => setTab("browse")}>
          Ofertas
        </TabBtn>
        <TabBtn active={tab === "holdings"} onClick={() => setTab("holdings")}>
          Mis participaciones
        </TabBtn>
        {canEmit && (
          <TabBtn active={tab === "emit"} onClick={() => setTab("emit")}>
            Emitir
          </TabBtn>
        )}
      </div>

      {tab === "browse" && <BrowseTab />}
      {tab === "holdings" && <HoldingsTab />}
      {tab === "emit" && canEmit && active && (
        <EmitTab projectId={active.id} projectName={active.name} />
      )}
    </div>
  );
}

// ---------- Explorar ofertas ----------
function BrowseTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOfferings);
  const subFn = useServerFn(subscribeOffering);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["offerings"],
    queryFn: () => listFn(),
  });
  const [units, setUnits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const subscribe = async (id: string, minUnits: number) => {
    const n = Number(units[id] ?? minUnits);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Indica cuántas unidades");
    setBusy(id);
    try {
      await subFn({ data: { offeringId: id, units: Math.floor(n) } });
      toast.success("Compromiso registrado. Queda pendiente de confirmación.");
      void qc.invalidateQueries({ queryKey: ["offerings"] });
      void qc.invalidateQueries({ queryKey: ["my-holdings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo suscribir");
    } finally {
      setBusy(null);
    }
  };

  if (isError)
    return <QueryError message="No pudimos cargar las ofertas." onRetry={() => void refetch()} />;
  if (isLoading) return <Loading />;
  const open = (data ?? []).filter((o) => o.status === "open");
  if (open.length === 0) return <Empty>No hay ofertas abiertas por ahora.</Empty>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {open.map((o) => (
        <div key={o.id} className="rounded-lg border border-border bg-bg-secondary/30 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gold">
                {o.token_symbol} · {o.instrument}
              </div>
              <div className="font-semibold truncate">{o.title}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold">{fmtUsd(o.price_per_unit_usd)}</div>
              <div className="text-[10px] text-muted-foreground">por unidad</div>
            </div>
          </div>
          <ProgressBar pct={o.stats.pctSubscribed} />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
            <span>
              {o.stats.unitsCommitted.toLocaleString("es-CL")} /{" "}
              {o.stats.totalUnits.toLocaleString("es-CL")} u · {o.stats.pctSubscribed.toFixed(0)}%
            </span>
            <span>{fmtUsd(o.stats.committedUsd)} comprometido</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number"
              min={o.min_units}
              placeholder={`mín ${o.min_units}`}
              value={units[o.id] ?? ""}
              onChange={(e) => setUnits((u) => ({ ...u, [o.id]: e.target.value }))}
              className="w-24 px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => void subscribe(o.id, o.min_units)}
              disabled={busy === o.id || o.stats.unitsAvailable === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === o.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : o.stats.unitsAvailable === 0 ? (
                "Agotada"
              ) : (
                "Comprometer"
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Mis participaciones ----------
function HoldingsTab() {
  const listFn = useServerFn(listMyHoldings);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-holdings"],
    queryFn: () => listFn(),
  });
  const totals = useMemo(() => {
    const rows = data ?? [];
    const active = rows.filter((r) => r.status === "confirmed" || r.status === "pending");
    return {
      units: active.reduce((a, r) => a + r.units, 0),
      amount: active.reduce((a, r) => a + Number(r.amount_usd), 0),
      count: active.length,
    };
  }, [data]);

  if (isError)
    return (
      <QueryError message="No pudimos cargar tus participaciones." onRetry={() => void refetch()} />
    );
  if (isLoading) return <Loading />;
  if ((data ?? []).length === 0)
    return <Empty>Aún no tienes participaciones. Explora las ofertas abiertas.</Empty>;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat icon={Wallet} label="Compromisos" value={String(totals.count)} />
        <Stat icon={Coins} label="Unidades" value={totals.units.toLocaleString("es-CL")} />
        <Stat icon={TrendingUp} label="Monto" value={fmtUsd(totals.amount)} />
      </div>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-bg-secondary/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Oferta</th>
              <th className="px-3 py-2 text-right">Unidades</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="font-mono text-gold">{r.token_symbol}</span> · {r.title}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.units.toLocaleString("es-CL")}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.pct.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right font-mono">{fmtUsd(Number(r.amount_usd))}</td>
                <td className="px-3 py-2">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Emitir (titular) ----------
function EmitTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createOffering);
  const statusFn = useServerFn(setOfferingStatus);
  const listFn = useServerFn(listOfferings);
  const { data } = useQuery({ queryKey: ["offerings"], queryFn: () => listFn() });
  const mine = (data ?? []).filter((o) => o.project_id === projectId);

  const [form, setForm] = useState({
    tokenSymbol: "",
    title: "",
    totalUnits: "",
    pricePerUnitUsd: "",
    minUnits: "1",
    instrument: "participation" as "participation" | "royalty" | "equity" | "debt",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const totalUnits = Number(form.totalUnits);
    const price = Number(form.pricePerUnitUsd);
    if (!form.tokenSymbol.trim() || !form.title.trim() || !(totalUnits > 0) || !(price >= 0)) {
      return toast.error("Completa símbolo, título, unidades y precio.");
    }
    setSaving(true);
    try {
      await createFn({
        data: {
          projectId,
          tokenSymbol: form.tokenSymbol.trim(),
          title: form.title.trim(),
          instrument: form.instrument,
          totalUnits: Math.floor(totalUnits),
          pricePerUnitUsd: price,
          minUnits: Math.max(1, Math.floor(Number(form.minUnits) || 1)),
        },
      });
      toast.success("Oferta creada en borrador. Ábrela para recibir compromisos.");
      setForm({
        tokenSymbol: "",
        title: "",
        totalUnits: "",
        pricePerUnitUsd: "",
        minUnits: "1",
        instrument: "participation",
      });
      void qc.invalidateQueries({ queryKey: ["offerings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: "open" | "closed") => {
    try {
      await statusFn({ data: { id, status } });
      toast.success(status === "open" ? "Oferta abierta" : "Oferta cerrada");
      void qc.invalidateQueries({ queryKey: ["offerings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-bg-secondary/30 p-4">
        <div className="text-sm font-semibold mb-1 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-primary" /> Nueva oferta · {projectName}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          <Field label="Símbolo">
            <input
              value={form.tokenSymbol}
              onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value })}
              placeholder="LV5"
              maxLength={12}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded font-mono uppercase focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Instrumento">
            <select
              value={form.instrument}
              onChange={(e) =>
                setForm({ ...form, instrument: e.target.value as typeof form.instrument })
              }
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            >
              <option value="participation">Participación</option>
              <option value="royalty">Royalty</option>
              <option value="equity">Equity</option>
              <option value="debt">Deuda</option>
            </select>
          </Field>
          <Field label="Título" full>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Participación 10% Los Verdes 5"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Unidades totales">
            <input
              type="number"
              value={form.totalUnits}
              onChange={(e) => setForm({ ...form, totalUnits: e.target.value })}
              placeholder="1000"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Precio por unidad (USD)">
            <input
              type="number"
              value={form.pricePerUnitUsd}
              onChange={(e) => setForm({ ...form, pricePerUnitUsd: e.target.value })}
              placeholder="50"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Mínimo por inversionista">
            <input
              type="number"
              value={form.minUnits}
              onChange={(e) => setForm({ ...form, minUnits: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </Field>
        </div>
        <button
          onClick={() => void submit()}
          disabled={saving}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Crear en borrador
        </button>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Mis emisiones
        </div>
        {mine.length === 0 ? (
          <Empty>Sin emisiones para este proyecto.</Empty>
        ) : (
          <div className="space-y-2">
            {mine.map((o) => (
              <OfferingAdminRow key={o.id} offering={o} onChangeStatus={changeStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OfferingAdminRow({
  offering: o,
  onChangeStatus,
}: {
  offering: Awaited<ReturnType<typeof listOfferings>>[number];
  onChangeStatus: (id: string, status: "open" | "closed") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailFn = useServerFn(getOfferingDetail);
  const { data: detail } = useQuery({
    queryKey: ["offering-detail", o.id],
    queryFn: () => detailFn({ data: { id: o.id } }),
    enabled: expanded,
  });

  return (
    <div className="rounded-lg border border-border bg-bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            <span className="font-mono text-gold">{o.token_symbol}</span> · {o.title}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {o.stats.unitsCommitted}/{o.stats.totalUnits} u · {o.stats.investorCount}{" "}
            inversionista(s) · {fmtUsd(o.stats.committedUsd)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusPill status={o.status} />
          {o.status === "draft" && (
            <button
              onClick={() => onChangeStatus(o.id, "open")}
              className="px-2 py-1 rounded text-[10px] font-mono border border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
            >
              Abrir
            </button>
          )}
          {o.status === "open" && (
            <button
              onClick={() => onChangeStatus(o.id, "closed")}
              className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1 rounded text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Users className="w-3 h-3" /> Cap table
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-border pt-2">
          {!detail || detail.capTable.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">Sin inversionistas todavía.</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-left text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-1">Inversionista</th>
                  <th className="py-1 text-right">Unidades</th>
                  <th className="py-1 text-right">%</th>
                  <th className="py-1 text-right">Monto</th>
                  <th className="py-1">Estado</th>
                </tr>
              </thead>
              <tbody>
                {detail.capTable.map((e) => (
                  <tr key={e.investorUserId} className="border-t border-border/60">
                    <td className="py-1 font-mono">{e.investorUserId.slice(0, 8)}…</td>
                    <td className="py-1 text-right font-mono">{e.units.toLocaleString("es-CL")}</td>
                    <td className="py-1 text-right font-mono">{e.pct.toFixed(2)}%</td>
                    <td className="py-1 text-right font-mono">{fmtUsd(e.amountUsd)}</td>
                    <td className="py-1">
                      <StatusPill status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- UI helpers ----------
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-primary text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-3 h-2 rounded-full bg-muted/40 overflow-hidden">
      <div
        className="h-full bg-primary rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "open" || status === "confirmed"
      ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
      : status === "pending" || status === "draft"
        ? "text-amber-600 border-amber-500/40 bg-amber-500/10"
        : status === "rejected" || status === "cancelled"
          ? "text-red-600 border-red-500/40 bg-red-500/10"
          : "text-muted-foreground border-border";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-xs ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-bg-secondary/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
      {children}
    </div>
  );
}
