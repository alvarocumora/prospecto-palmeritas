// Panel admin: gestión de invitaciones a socios (broker/cliente).
// Crear, listar, reenviar, anular. Botón de despacho inicial a los 2
// correos aprobados por el fundador.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  Send,
  Ban,
  Loader2,
  Users,
  ExternalLink,
  ShieldAlert,
  Copy,
  Rocket,
} from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  listPartnerInvitations,
  createPartnerInvitation,
  resendPartnerInvitation,
  voidPartnerInvitation,
  partnerOnboardingLink,
  type PartnerInvitationRow,
  type PartnerInvitationRole,
} from "@/lib/partnerInvitations.functions";
import {
  dispatchPartnerInvitation,
  dispatchInitialPartners,
} from "@/lib/partnerDispatch.functions";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/invitaciones")({
  head: () => ({ meta: [{ title: "Invitaciones de socios — Geocapitals" }] }),
  component: InvitationsPage,
});

type ProjectOpt = { id: string; name: string; commodity: string | null };
type TradeOpt = { id: string; reference: string; commodity: string };

const STATUS_META: Record<
  PartnerInvitationRow["status"],
  { label: string; cls: string }
> = {
  pending: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  sent: { label: "Enviada", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  opened: { label: "Abierta", cls: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30" },
  signed: { label: "Firmada", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  accepted: { label: "Aceptada", cls: "bg-green-500/15 text-green-700 border-green-500/30" },
  void: { label: "Anulada", cls: "bg-muted text-muted-foreground border-border" },
};

function InvitationsPage() {
  const { isAdmin, loading } = useIsSuperAdmin();
  if (loading) {
    return (
      <div className="p-6">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <div className="text-lg font-semibold">Acceso restringido</div>
        <p className="text-sm text-text-secondary">
          Este panel es solo para administradores de Geocapitals.
        </p>
      </div>
    );
  }
  return <InvitationsAdmin />;
}

function InvitationsAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPartnerInvitations);
  const createFn = useServerFn(createPartnerInvitation);
  const resendFn = useServerFn(resendPartnerInvitation);
  const voidFn = useServerFn(voidPartnerInvitation);
  const dispatchFn = useServerFn(dispatchPartnerInvitation);
  const initialFn = useServerFn(dispatchInitialPartners);

  const [showNew, setShowNew] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [trades, setTrades] = useState<TradeOpt[]>([]);

  useEffect(() => {
    (async () => {
      const [p, t] = await Promise.all([
        supabase.from("projects").select("id, name, commodity").order("name"),
        supabase.from("commodity_trades").select("id, reference, commodity").order("created_at", { ascending: false }).limit(20),
      ]);
      setProjects((p.data ?? []) as ProjectOpt[]);
      setTrades((t.data ?? []) as TradeOpt[]);
    })();
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["partner-invitations"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });
  const rows = data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["partner-invitations"] });
    refetch();
  };

  const onDispatchInitial = async () => {
    if (!confirm("Despachar invitación institucional (NCNDA + link) a Joaquín Belmar y Eduardo?"))
      return;
    setRunning("initial");
    try {
      const res = await initialFn();
      toast.success(`Despachado a ${res.results.length} contactos`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falló el despacho");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Invitaciones de socios</h1>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Onboarding de brokers y clientes con NCNDA firmado por Geocapitals y acceso a data
            rooms de proyectos + operaciones activas.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDispatchInitial}
            disabled={running === "initial"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 bg-primary/5 text-primary text-sm hover:bg-primary/10 disabled:opacity-50"
          >
            {running === "initial" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            Despacho inicial (2 correos)
          </button>
          <button
            onClick={() => setShowNew((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nueva invitación
          </button>
        </div>
      </div>

      {showNew && (
        <NewInvitationForm
          projects={projects}
          trades={trades}
          onCancel={() => setShowNew(false)}
          onCreate={async (payload) => {
            setRunning("create");
            try {
              const inv = await createFn({ data: payload });
              toast.success("Invitación creada. Puedes despacharla desde la fila.");
              setShowNew(false);
              refresh();
              // Autodespacha si se pidió
              if (payload._dispatchNow) {
                await dispatchFn({ data: { invitationId: inv.id } });
                toast.success("Correo enviado con NCNDA y link.");
                refresh();
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "No se pudo crear");
            } finally {
              setRunning(null);
            }
          }}
          running={running === "create"}
        />
      )}

      {isLoading ? (
        <div className="h-40 rounded bg-muted/20 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
          Aún no hay invitaciones. Usa <b>Nueva invitación</b> o el botón de despacho inicial.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border bg-bg-secondary/30">
                <th className="px-4 py-2.5">Contacto</th>
                <th className="px-4 py-2.5">Alcance</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Enviada</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const M = STATUS_META[r.status];
                const link = partnerOnboardingLink(r.token);
                return (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.full_name ?? r.email}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{r.email}</div>
                      {r.company && (
                        <div className="text-[11px] text-muted-foreground">{r.company}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{r.project_ids.length} proyecto(s)</div>
                      <div className="text-muted-foreground">{r.trade_ids.length} operación(es)</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>Sugerido: {r.suggested_role}</div>
                      {r.chosen_role && (
                        <div className="text-muted-foreground">Elegido: {r.chosen_role}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${M.cls}`}
                      >
                        {M.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString("es-CL") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          toast.success("Link copiado");
                        }}
                        className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Link
                      </button>
                      {r.ncnda_pdf_url && (
                        <a
                          href={r.ncnda_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> NCNDA
                        </a>
                      )}
                      {r.status !== "void" && r.status !== "accepted" && (
                        <>
                          <button
                            onClick={async () => {
                              setRunning(r.id);
                              try {
                                await resendFn({ data: { id: r.id } });
                                toast.success("Reenviado");
                                refresh();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Falló");
                              } finally {
                                setRunning(null);
                              }
                            }}
                            disabled={running === r.id}
                            className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {running === r.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}{" "}
                            {r.status === "pending" ? "Despachar" : "Reenviar"}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Anular invitación a ${r.email}?`)) return;
                              try {
                                await voidFn({ data: { id: r.id } });
                                toast.success("Anulada");
                                refresh();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Falló");
                              }
                            }}
                            className="text-[11px] font-mono text-red-500 hover:underline inline-flex items-center gap-1"
                          >
                            <Ban className="w-3 h-3" /> Anular
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewInvitationForm({
  projects,
  trades,
  onCreate,
  onCancel,
  running,
}: {
  projects: ProjectOpt[];
  trades: TradeOpt[];
  onCreate: (payload: {
    email: string;
    fullName?: string;
    company?: string;
    suggestedRole: PartnerInvitationRole;
    projectIds: string[];
    tradeIds: string[];
    message?: string;
    _dispatchNow?: boolean;
  }) => void;
  onCancel: () => void;
  running: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<PartnerInvitationRole>("both");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [tradeIds, setTradeIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [dispatchNow, setDispatchNow] = useState(true);

  const toggle = <T,>(arr: T[], v: T, setter: (v: T[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="rounded-md border border-border bg-bg-secondary/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Nueva invitación</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          className="border border-border bg-background px-3 py-2 text-sm rounded"
          placeholder="Correo *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border border-border bg-background px-3 py-2 text-sm rounded"
          placeholder="Nombre"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="border border-border bg-background px-3 py-2 text-sm rounded"
          placeholder="Empresa"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(["broker", "investor", "both"] as PartnerInvitationRole[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-3 py-1.5 text-xs rounded border ${
              role === r
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-accent"
            }`}
          >
            {r === "broker" ? "Broker" : r === "investor" ? "Cliente" : "Ambos"}
          </button>
        ))}
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          Proyectos ({projectIds.length})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(projectIds, p.id, setProjectIds)}
              className={`text-[11px] px-2 py-1 rounded border ${
                projectIds.includes(p.id)
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          Operaciones / Trades ({tradeIds.length})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trades.map((t) => (
            <button
              key={t.id}
              onClick={() => toggle(tradeIds, t.id, setTradeIds)}
              className={`text-[11px] px-2 py-1 rounded border ${
                tradeIds.includes(t.id)
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              {t.commodity} · {t.reference}
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="w-full border border-border bg-background px-3 py-2 text-sm rounded"
        placeholder="Mensaje personal (opcional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
      />
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={dispatchNow}
          onChange={(e) => setDispatchNow(e.target.checked)}
        />
        Despachar el correo con NCNDA inmediatamente
      </label>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border text-sm hover:bg-accent"
        >
          Cancelar
        </button>
        <button
          onClick={() =>
            onCreate({
              email: email.trim(),
              fullName: fullName.trim() || undefined,
              company: company.trim() || undefined,
              suggestedRole: role,
              projectIds,
              tradeIds,
              message: message.trim() || undefined,
              _dispatchNow: dispatchNow,
            })
          }
          disabled={running || !email.includes("@")}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear
        </button>
      </div>
    </div>
  );
}
