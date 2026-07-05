import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  Inbox,
  Loader2,
  Mail,
  Package,
  RefreshCw,
  Briefcase,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  listContactMessages,
  setContactMessageStatus,
  listCommodityInquiries,
  setCommodityInquiryStatus,
  listDealInquiries,
  listAllListings,
  setListingPublished,
  listAllCommodityLots,
  setCommodityLotStatus,
  type ContactMessageRow,
  type CommodityInquiryRow,
  type DealInquiryRow,
  type AdminListingRow,
  type AdminCommodityLotRow,
} from "@/lib/adminInbox.functions";
import { MODALITY_LABEL, STAGE_LABEL } from "@/modules/deals/domain/constants";
import { fmtUSD } from "@/modules/deals/domain/format";
import { commodityLabel, formLabel, formatTonnes } from "@/lib/commodityLabels";

export const Route = createFileRoute("/_authenticated/dashboard/admin/inbox")({
  head: () => ({ meta: [{ title: "Admin · Bandeja de entrada — Geocapitals" }] }),
  component: AdminInboxPage,
});

type Tab = "contacto" | "marketplace" | "deals" | "listings" | "lotes";

const TABS: Array<{ key: Tab; label: string; icon: typeof Mail }> = [
  { key: "contacto", label: "Contacto", icon: Mail },
  { key: "marketplace", label: "Marketplace", icon: Package },
  { key: "deals", label: "Deals", icon: Briefcase },
  { key: "listings", label: "Listings", icon: Globe },
  { key: "lotes", label: "Lotes", icon: Package },
];

function AdminInboxPage() {
  const [tab, setTab] = useState<Tab>("contacto");

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="mb-5">
        <Link
          to="/dashboard/admin"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3 h-3" /> Admin
        </Link>
        <h1 className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">
          <Inbox className="w-5 h-5 text-gold" /> Bandeja de entrada
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Todo lo que la web pública captura: mensajes de contacto, consultas del marketplace,
          solicitudes de deal y listings esperando publicación.
        </p>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              tab === key
                ? "border-gold bg-gold/10 text-gold"
                : "border-border bg-bg-panel hover:border-gold/40"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "contacto" && <ContactTab />}
      {tab === "marketplace" && <MarketplaceTab />}
      {tab === "deals" && <DealsTab />}
      {tab === "listings" && <ListingsTab />}
      {tab === "lotes" && <LotsTab />}
    </div>
  );
}

// ── Tab: mensajes de contacto ─────────────────────────────────────────────────

function ContactTab() {
  const [status, setStatus] = useState<"new" | "handled" | "all">("new");
  const [rows, setRows] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listContactMessages({ data: { status } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando mensajes");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const markHandled = async (id: string) => {
    try {
      await setContactMessageStatus({ data: { id, status: "handled" } });
      toast.success("Marcado como atendido");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <TabFrame
      loading={loading}
      empty={rows.length === 0}
      emptyText="Sin mensajes en este estado."
      onReload={load}
      filters={
        <StatusFilters
          value={status}
          options={[
            ["new", "Nuevos"],
            ["handled", "Atendidos"],
            ["all", "Todos"],
          ]}
          onChange={(v) => setStatus(v as typeof status)}
        />
      }
    >
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
            <header className="flex items-start justify-between gap-2 mb-2 flex-wrap">
              <div className="text-sm">
                <span className="font-semibold text-foreground">{r.name}</span>{" "}
                <a
                  href={`mailto:${r.email}`}
                  className="text-gold hover:underline font-mono text-xs"
                >
                  {r.email}
                </a>
                {r.organization && (
                  <span className="text-muted-foreground text-xs"> · {r.organization}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded border border-border text-muted-foreground">
                  {r.role}
                </span>
                <span className="px-2 py-0.5 rounded border border-border text-muted-foreground">
                  {r.source}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("es-CL")}
                </span>
              </div>
            </header>
            <p className="text-sm text-foreground/85 whitespace-pre-line">{r.message}</p>
            {r.status === "new" && (
              <button
                onClick={() => void markHandled(r.id)}
                className="mt-3 inline-flex items-center gap-1.5 rounded bg-teal text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-teal/90"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar atendido
              </button>
            )}
          </article>
        ))}
      </div>
    </TabFrame>
  );
}

// ── Tab: consultas del marketplace ────────────────────────────────────────────

function MarketplaceTab() {
  const [status, setStatus] = useState<"new" | "contacted" | "all">("new");
  const [rows, setRows] = useState<CommodityInquiryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCommodityInquiries({ data: { status } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando consultas");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const markContacted = async (id: string) => {
    try {
      await setCommodityInquiryStatus({ data: { id, status: "contacted" } });
      toast.success("Marcada como contactada");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <TabFrame
      loading={loading}
      empty={rows.length === 0}
      emptyText="Sin consultas en este estado."
      onReload={load}
      filters={
        <StatusFilters
          value={status}
          options={[
            ["new", "Nuevas"],
            ["contacted", "Contactadas"],
            ["all", "Todas"],
          ]}
          onChange={(v) => setStatus(v as typeof status)}
        />
      }
    >
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
            <header className="flex items-start justify-between gap-2 mb-2 flex-wrap">
              <div className="text-sm font-semibold text-foreground">{r.lot_title ?? r.lot_id}</div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date(r.created_at).toLocaleString("es-CL")}
              </span>
            </header>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
              <Info k="Comprador" v={r.buyer_email ?? "—"} />
              <Info k="Empresa" v={r.company_name ?? "—"} />
              <Info k="Rol" v={r.buyer_role} />
              <Info k="Uso previsto" v={r.intended_use ?? "—"} />
              <Info k="Volumen" v={r.target_volume_t != null ? `${r.target_volume_t} t` : "—"} />
              <Info
                k="Precio objetivo"
                v={r.target_price_usd_t != null ? `US$ ${r.target_price_usd_t}/t` : "—"}
              />
            </div>
            {r.message && <p className="text-sm text-foreground/85">{r.message}</p>}
            {r.status === "new" && (
              <button
                onClick={() => void markContacted(r.id)}
                className="mt-3 inline-flex items-center gap-1.5 rounded bg-teal text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-teal/90"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar contactada
              </button>
            )}
          </article>
        ))}
      </div>
    </TabFrame>
  );
}

// ── Tab: solicitudes de deal ──────────────────────────────────────────────────

function DealsTab() {
  const [rows, setRows] = useState<DealInquiryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listDealInquiries());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TabFrame
      loading={loading}
      empty={rows.length === 0}
      emptyText="Sin solicitudes de deal registradas."
      onReload={load}
    >
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
            <header className="flex items-start justify-between gap-2 mb-2 flex-wrap">
              <div className="text-sm font-semibold text-foreground">
                {r.listing_title ?? r.listing_id}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span
                  className={`px-2 py-0.5 rounded border ${
                    r.nda_signed_at
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {r.nda_signed_at ? "NDA firmado" : "Sin NDA"}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("es-CL")}
                </span>
              </div>
            </header>
            <div className="text-xs text-muted-foreground mb-1">
              {r.inquirer_email ?? "—"} · estado: {r.status}
            </div>
            {r.message && <p className="text-sm text-foreground/85">{r.message}</p>}
          </article>
        ))}
      </div>
    </TabFrame>
  );
}

// ── Tab: publicación de listings ──────────────────────────────────────────────

function ListingsTab() {
  const [rows, setRows] = useState<AdminListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAllListings());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando listings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (r: AdminListingRow) => {
    setActing(r.id);
    try {
      await setListingPublished({ data: { listingId: r.id, published: !r.is_published } });
      toast.success(r.is_published ? `Despublicado: ${r.title}` : `Publicado: ${r.title}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(null);
    }
  };

  return (
    <TabFrame
      loading={loading}
      empty={rows.length === 0}
      emptyText="Sin listings registrados."
      onReload={load}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
            <header className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-foreground leading-snug">{r.title}</h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                  r.is_published
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-warn/40 bg-warn/10 text-warn"
                }`}
              >
                {r.is_published ? "Publicado" : "Borrador"}
              </span>
            </header>
            <div className="text-xs text-muted-foreground mb-2">
              {r.commodity} · {[r.region, r.country].filter(Boolean).join(", ")} ·{" "}
              {STAGE_LABEL[r.stage] ?? r.stage} · {MODALITY_LABEL[r.modality] ?? r.modality}
            </div>
            <div className="text-xs font-mono text-muted-foreground mb-3">
              {r.owner_email ?? "—"} · {fmtUSD(r.asking_price_usd)} ·{" "}
              {new Date(r.created_at).toLocaleDateString("es-CL")}
            </div>
            <button
              disabled={acting === r.id}
              onClick={() => void toggle(r)}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono font-semibold disabled:opacity-50 ${
                r.is_published
                  ? "border border-border hover:border-danger hover:text-danger"
                  : "bg-teal text-black hover:bg-teal/90"
              }`}
            >
              {r.is_published ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" /> Despublicar
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> Publicar
                </>
              )}
            </button>
          </article>
        ))}
      </div>
    </TabFrame>
  );
}

// ── Tab: verificación de lotes de commodities ─────────────────────────────────

const LOT_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "border-border text-muted-foreground" },
  pending_verification: { label: "En verificación", cls: "border-warn/40 bg-warn/10 text-warn" },
  published: { label: "Publicado", cls: "border-teal/40 bg-teal/10 text-teal" },
  under_negotiation: { label: "En negociación", cls: "border-gold/40 bg-gold/10 text-gold" },
  sold: { label: "Vendido", cls: "border-border text-muted-foreground" },
  archived: { label: "Archivado", cls: "border-border text-muted-foreground" },
};

function LotsTab() {
  const [rows, setRows] = useState<AdminCommodityLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAllCommodityLots());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando lotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (r: AdminCommodityLotRow, action: "publish" | "archive") => {
    setActing(r.id);
    try {
      await setCommodityLotStatus({ data: { lotId: r.id, action } });
      toast.success(action === "publish" ? `Publicado: ${r.title}` : `Archivado: ${r.title}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setActing(null);
    }
  };

  return (
    <TabFrame
      loading={loading}
      empty={rows.length === 0}
      emptyText="Sin lotes registrados."
      onReload={load}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => {
          const st = LOT_STATUS_META[r.status] ?? { label: r.status, cls: "border-border" };
          return (
            <article key={r.id} className="rounded border border-border bg-bg-panel p-4">
              <header className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground leading-snug">{r.title}</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${st.cls}`}
                >
                  {st.label}
                </span>
              </header>
              <div className="text-xs text-muted-foreground mb-2">
                {commodityLabel(r.commodity)} · {formLabel(r.form)} ·{" "}
                {[r.region, r.country].filter(Boolean).join(", ")}
                {r.grade_pct != null && ` · ${r.grade_pct}%`}
                {r.incoterm && ` · ${r.incoterm}`}
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-3">
                {r.seller_email ?? "—"} · {formatTonnes(r.tonnage_available_t)} ·{" "}
                {new Date(r.created_at).toLocaleDateString("es-CL")}
              </div>
              <div className="flex gap-2">
                {r.status !== "published" && (
                  <button
                    disabled={acting === r.id}
                    onClick={() => void act(r, "publish")}
                    className="inline-flex items-center gap-1.5 rounded bg-teal text-black px-3 py-1.5 text-xs font-mono font-semibold hover:bg-teal/90 disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" /> Verificar y publicar
                  </button>
                )}
                {r.status !== "archived" && (
                  <button
                    disabled={acting === r.id}
                    onClick={() => void act(r, "archive")}
                    className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-mono hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    <EyeOff className="w-3.5 h-3.5" /> Archivar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </TabFrame>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function TabFrame({
  loading,
  empty,
  emptyText,
  onReload,
  filters,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyText: string;
  onReload: () => void | Promise<void>;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>{filters}</div>
        <button
          onClick={() => void onReload()}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-panel px-3 py-1.5 text-xs font-mono hover:border-gold/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Recargar
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : empty ? (
        <div className="rounded border border-border bg-bg-panel p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function StatusFilters({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
            value === v
              ? "border-gold bg-gold/10 text-gold"
              : "border-border bg-bg-panel hover:border-gold/40"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{k}:</span>
      <span className="text-foreground truncate">{v}</span>
    </div>
  );
}
