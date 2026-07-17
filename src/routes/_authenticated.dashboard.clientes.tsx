import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Handshake,
  Mail,
  Phone,
  Globe,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  getClientsOverview,
  listPartners,
  upsertPartner,
  deletePartner,
  type PartnerRow,
} from "@/lib/clients.functions";
import {
  PARTNER_ROLES,
  PARTNER_ROLE_LABELS,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  type PartnerRole,
  type PartnerStatus,
} from "@/lib/clients";

// CRM de negocios: Clientes (contrapartes reales de mis trades) y Asociados
// (vendedores/gestores/brokers con los que co-gestiono deals).

export const Route = createFileRoute("/_authenticated/dashboard/clientes")({
  head: () => ({ meta: [{ title: "Clientes y Asociados — Geocapitals" }] }),
  component: ClientesPage,
});

const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `US$ ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`
    : `US$ ${Math.round(n).toLocaleString("es-CL")}`;

type Tab = "clientes" | "asociados";

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  company: "",
  role: "gestor" as PartnerRole,
  email: "",
  phone: "",
  country: "",
  commodities: "",
  notes: "",
  status: "activo" as PartnerStatus,
};

function ClientesPage() {
  const [tab, setTab] = useState<Tab>("clientes");
  const clientsFn = useServerFn(getClientsOverview);
  const partnersFn = useServerFn(listPartners);
  const saveFn = useServerFn(upsertPartner);
  const delFn = useServerFn(deletePartner);

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["crm-clients"],
    queryFn: () => clientsFn(),
    staleTime: 60_000,
  });
  const {
    data: partnersData,
    isLoading: loadingPartners,
    refetch: refetchPartners,
  } = useQuery({
    queryKey: ["crm-partners"],
    queryFn: () => partnersFn(),
    staleTime: 30_000,
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const editPartner = (p: PartnerRow) => {
    setForm({
      id: p.id,
      name: p.name,
      company: p.company ?? "",
      role: (p.role as PartnerRole) ?? "gestor",
      email: p.email ?? "",
      phone: p.phone ?? "",
      country: p.country ?? "",
      commodities: (p.commodities ?? []).join(", "),
      notes: p.notes ?? "",
      status: (p.status as PartnerStatus) ?? "activo",
    });
    setShowForm(true);
  };

  const onSave = async () => {
    if (form.name.trim().length < 2) {
      toast.error("Nombre del asociado requerido.");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: form.id,
          name: form.name,
          company: form.company || undefined,
          role: form.role,
          email: form.email || undefined,
          phone: form.phone || undefined,
          country: form.country || undefined,
          commodities: form.commodities
            ? form.commodities
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          notes: form.notes || undefined,
          status: form.status,
        },
      });
      toast.success(form.id ? "Asociado actualizado." : "Asociado agregado a tu cartera.");
      setForm(EMPTY_FORM);
      setShowForm(false);
      refetchPartners();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: PartnerRow) => {
    if (!window.confirm(`¿Eliminar a ${p.name} de tu cartera?`)) return;
    try {
      await delFn({ data: { id: p.id } });
      toast.success("Asociado eliminado.");
      refetchPartners();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Clientes y Asociados</h1>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Tu red comercial: contrapartes reales de trades y los vendedores, gestores y brokers con
            los que gestionas negocios en la plataforma.
          </p>
        </div>
        {tab === "asociados" && (
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <UserPlus className="w-4 h-4" /> Agregar asociado
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["clientes", `Clientes (${clients?.length ?? 0})`],
            ["asociados", `Asociados (${partnersData?.partners.length ?? 0})`],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-mono uppercase tracking-wide border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "clientes" &&
        (loadingClients ? (
          <div className="h-32 rounded bg-muted/20 animate-pulse" />
        ) : (clients?.length ?? 0) === 0 ? (
          <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
            Aún no tienes contrapartes. Cuando cierres tu primer trade, tus clientes aparecerán aquí
            automáticamente con su historial.{" "}
            <Link to="/dashboard/trades" className="text-primary underline">
              Ir al Trade Desk
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border bg-bg-secondary/30">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Relación</th>
                  <th className="px-4 py-2.5">Trades</th>
                  <th className="px-4 py-2.5">Valor total</th>
                  <th className="px-4 py-2.5">Última actividad</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients!.map((c) => (
                  <tr key={c.userId} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name ?? "Contraparte"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[c.organization, c.country].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" /> {c.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {c.mostlyBuysFromMe ? "Me compra" : "Me vende"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.trades} <span className="text-muted-foreground">({c.active} activos)</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{fmtUsd(c.totalUsd)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.lastActivity).toLocaleDateString("es-CL")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/dashboard/trades"
                        className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Handshake className="w-3 h-3" /> Trades
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "asociados" && (
        <>
          {partnersData?.pending && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              La cartera de asociados se activa al aplicar la migración
              <code className="font-mono">20260719100000_business_partners.sql</code> (pídesela a
              Lovable). El resto del CRM ya funciona.
            </div>
          )}

          {showForm && (
            <div className="rounded-md border border-border bg-bg-secondary/20 p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                [
                  ["name", "Nombre *", "Nombre y apellido"],
                  ["company", "Empresa", "Razón social"],
                  ["email", "Email", "correo@empresa.com"],
                  ["phone", "Teléfono / WhatsApp", "+56 9 …"],
                  ["country", "País", "Chile"],
                  ["commodities", "Commodities (coma)", "cobre, oro"],
                ] as const
              ).map(([k, label, ph]) => (
                <label key={k} className="text-xs">
                  <span className="block text-text-secondary mb-1">{label}</span>
                  <input
                    value={form[k]}
                    placeholder={ph}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
                  />
                </label>
              ))}
              <label className="text-xs">
                <span className="block text-text-secondary mb-1">Rol</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as PartnerRole })}
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
                >
                  {PARTNER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {PARTNER_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="block text-text-secondary mb-1">Estado</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PartnerStatus })}
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
                >
                  {PARTNER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PARTNER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs sm:col-span-2 lg:col-span-3">
                <span className="block text-text-secondary mb-1">Notas</span>
                <textarea
                  value={form.notes}
                  rows={2}
                  placeholder="Zona, condiciones de comisión, acuerdos…"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm"
                />
              </label>
              <div>
                <button
                  onClick={() => void onSave()}
                  disabled={saving}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
                >
                  {saving ? "Guardando…" : form.id ? "Actualizar" : "Agregar"}
                </button>
              </div>
            </div>
          )}

          {loadingPartners ? (
            <div className="h-24 rounded bg-muted/20 animate-pulse" />
          ) : (partnersData?.partners.length ?? 0) === 0 && !partnersData?.pending ? (
            <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
              Tu cartera de asociados está vacía. Agrega a los vendedores, gestores comerciales y
              brokers con los que trabajas para gestionar los negocios en conjunto.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {partnersData?.partners.map((p) => (
                <div key={p.id} className="rounded-md border border-border bg-bg-secondary/20 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[p.company, p.country].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        p.status === "activo"
                          ? "bg-green-500/15 text-green-600"
                          : p.status === "prospecto"
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {PARTNER_STATUS_LABELS[(p.status as PartnerStatus) ?? "activo"] ?? p.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-block">
                    {PARTNER_ROLE_LABELS[(p.role as PartnerRole) ?? "otro"] ?? p.role}
                  </div>
                  <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Mail className="w-3 h-3" /> {p.email}
                      </a>
                    )}
                    {p.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </div>
                    )}
                    {(p.commodities?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> {p.commodities.join(", ")}
                      </div>
                    )}
                    {p.notes && <div className="pt-1 text-foreground/80">{p.notes}</div>}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex gap-3">
                    <button
                      onClick={() => editPartner(p)}
                      className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => void onDelete(p)}
                      className="text-[11px] font-mono text-red-500 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
