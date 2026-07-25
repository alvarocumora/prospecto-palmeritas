import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getOperationDetail,
  regenerateInvitation,
  revokeInvitation,
  createOperationTask,
  postOperationMessage,
} from "@/lib/operations/operations.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw, Ban, Activity, Users } from "lucide-react";
import { OperationDocumentsPanel, type OperationDocLike } from "@/features/operations/OperationDocumentsPanel";

export const Route = createFileRoute("/_authenticated/dashboard/operaciones/$id")({
  head: () => ({
    meta: [{ title: "Operación · Trade Desk — Geocapitals" }],
  }),
  component: OperationDetail,
});

type Detail = Awaited<ReturnType<typeof getOperationDetail>>;

function OperationDetail() {
  const { id } = useParams({ from: "/_authenticated/dashboard/operaciones/$id" });
  const load = useServerFn(getOperationDetail);
  const regen = useServerFn(regenerateInvitation);
  const revoke = useServerFn(revokeInvitation);
  const newTask = useServerFn(createOperationTask);
  const postMsg = useServerFn(postOperationMessage);

  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState({ title: "", target_role: "buyer" as "buyer" | "seller", priority: "medium" });
  const [msgDraft, setMsgDraft] = useState({ channel: "buyer_gc" as "buyer_gc" | "seller_gc" | "tripartite" | "internal", body: "" });

  const refresh = async () => {
    try {
      const d = await load({ data: { id } });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel(`op-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "operation_documents", filter: `operation_id=eq.${id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "operation_tasks", filter: `operation_id=eq.${id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "operation_messages", filter: `operation_id=eq.${id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "operation_access_logs", filter: `operation_id=eq.${id}` }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] p-8 text-sm text-red-600">{error}</div>;
  if (!data) return <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] p-8 text-sm">Cargando…</div>;

  const op = data.operation;
  const buyerLink = data.portalLinks.find((l) => l.role === "buyer");
  const sellerLink = data.portalLinks.find((l) => l.role === "seller");
  const buyerTasks = data.tasks.filter((t) => t.target_role === "buyer");
  const sellerTasks = data.tasks.filter((t) => t.target_role === "seller");
  const buyerDocs = data.documents.filter((d) => ["buyer_shared", "all_parties"].includes(d.visibility as string));
  const sellerDocs = data.documents.filter((d) => ["seller_shared", "all_parties"].includes(d.visibility as string));

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  const submitTask = async () => {
    if (!taskDraft.title.trim()) return;
    await newTask({ data: { operation_id: id, ...taskDraft } });
    setTaskDraft({ title: "", target_role: taskDraft.target_role, priority: "medium" });
    void refresh();
  };
  const submitMsg = async () => {
    if (!msgDraft.body.trim()) return;
    await postMsg({ data: { operation_id: id, channel: msgDraft.channel, body: msgDraft.body } });
    setMsgDraft({ ...msgDraft, body: "" });
    void refresh();
  };

  return (
    <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--hairline))] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">
            Trade Desk · {op.code}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <h1 className="font-serif text-2xl">{op.name}</h1>
            <div className="text-xs text-[hsl(var(--content-subtle))]">
              {op.commodity} · {op.incoterm ?? "sin incoterm"} · {op.destination_country ?? "destino pendiente"}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PortalLinkCard
              role="buyer"
              email={op.buyer_email}
              company={op.buyer_company}
              link={buyerLink?.url}
              onCopy={() => buyerLink && copy(buyerLink.url)}
              onRegenerate={async () => {
                await regen({ data: { operation_id: id, role: "buyer" } });
                void refresh();
              }}
            />
            <PortalLinkCard
              role="seller"
              email={op.seller_email}
              company={op.seller_company}
              link={sellerLink?.url}
              onCopy={() => sellerLink && copy(sellerLink.url)}
              onRegenerate={async () => {
                await regen({ data: { operation_id: id, role: "seller" } });
                void refresh();
              }}
            />
          </div>
        </div>
      </header>

      {/* 3 columnas */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <Column
            title="Comprador"
            status={op.buyer_status}
            docs={buyerDocs.length}
            tasks={buyerTasks}
          />
          <Column
            title="GeoCapitals · Control"
            status={op.status}
            docs={data.documents.length}
            tasks={data.tasks}
            highlight
          />
          <Column
            title="Vendedor"
            status={op.seller_status}
            docs={sellerDocs.length}
            tasks={sellerTasks}
          />
        </div>

        {/* Data Room de la operación */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">Data Room · Documentos ({data.documents.length})</h2>
            <span className="text-xs text-[hsl(var(--content-subtle))]">
              Segrega por rol · aprueba, solicita ajustes o congela para firma.
            </span>
          </div>
          <OperationDocumentsPanel
            documents={data.documents as unknown as OperationDocLike[]}
            role="geocapitals"
            operationId={id}
            canReview
            onChange={refresh}
          />
        </section>


        {/* Actividad + acciones */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[hsl(var(--hairline))] bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-serif text-lg">
              <Activity className="h-4 w-4" /> Actividad reciente
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {data.activity.length === 0 ? (
                <div className="text-xs text-[hsl(var(--content-subtle))]">Sin actividad aún.</div>
              ) : (
                data.activity.map((a) => (
                  <div key={a.id} className="border-b border-[hsl(var(--hairline))] pb-2 text-xs last:border-0">
                    <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--content-subtle))]">
                      {new Date(a.created_at as string).toLocaleString()} · {a.actor_role ?? "sistema"}
                    </div>
                    <div>{a.action}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--hairline))] bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-serif text-lg">
              <Users className="h-4 w-4" /> Nueva tarea
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Título de la tarea (ej: Adjuntar permiso de exportación vigente)"
                value={taskDraft.title}
                onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-md border border-[hsl(var(--hairline))] bg-white px-2 py-2 text-sm"
                  value={taskDraft.target_role}
                  onChange={(e) => setTaskDraft({ ...taskDraft, target_role: e.target.value as "buyer" | "seller" })}
                >
                  <option value="buyer">Dirigida al comprador</option>
                  <option value="seller">Dirigida al vendedor</option>
                </select>
                <select
                  className="rounded-md border border-[hsl(var(--hairline))] bg-white px-2 py-2 text-sm"
                  value={taskDraft.priority}
                  onChange={(e) => setTaskDraft({ ...taskDraft, priority: e.target.value })}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              <Button onClick={submitTask} disabled={!taskDraft.title.trim()}>Crear tarea</Button>
            </div>

            <div className="mt-6 border-t border-[hsl(var(--hairline))] pt-4">
              <div className="mb-2 font-serif text-sm">Enviar mensaje</div>
              <div className="grid grid-cols-1 gap-2">
                <select
                  className="rounded-md border border-[hsl(var(--hairline))] bg-white px-2 py-2 text-sm"
                  value={msgDraft.channel}
                  onChange={(e) => setMsgDraft({ ...msgDraft, channel: e.target.value as typeof msgDraft.channel })}
                >
                  <option value="buyer_gc">Canal Comprador ↔ GC</option>
                  <option value="seller_gc">Canal Vendedor ↔ GC</option>
                  <option value="tripartite">Canal Tripartito</option>
                  <option value="internal">Nota interna</option>
                </select>
                <Textarea
                  value={msgDraft.body}
                  onChange={(e) => setMsgDraft({ ...msgDraft, body: e.target.value })}
                  placeholder="Escribe el mensaje…"
                />
                <Button onClick={submitMsg} disabled={!msgDraft.body.trim()}>Enviar</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Invitaciones */}
        <div className="mt-8 rounded-xl border border-[hsl(var(--hairline))] bg-white p-4">
          <div className="mb-3 font-serif text-lg">Invitaciones emitidas</div>
          {data.invitations.length === 0 ? (
            <div className="text-xs text-[hsl(var(--content-subtle))]">Aún no hay invitaciones.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
                <tr>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Correo</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Expira</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.invitations.map((inv) => (
                  <tr key={inv.id as string} className="border-t border-[hsl(var(--hairline))]">
                    <td className="py-2 text-xs">{inv.participant_type}</td>
                    <td className="py-2 text-xs">{inv.invited_email}</td>
                    <td className="py-2 text-xs">{inv.status}</td>
                    <td className="py-2 text-xs">{new Date(inv.expires_at as string).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      {inv.status === "pending" && (
                        <button
                          onClick={async () => {
                            await revoke({ data: { invitation_id: inv.id as string } });
                            void refresh();
                          }}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                          <Ban className="h-3 w-3" /> Revocar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function PortalLinkCard({
  role,
  email,
  company,
  link,
  onCopy,
  onRegenerate,
}: {
  role: "buyer" | "seller";
  email: string | null;
  company: string | null;
  link?: string;
  onCopy: () => void;
  onRegenerate: () => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--surface-paper))] p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">
            Portal {role === "buyer" ? "Comprador" : "Vendedor"}
          </div>
          <div className="mt-1 text-sm font-medium">{company ?? email ?? "Sin contraparte"}</div>
        </div>
      </div>
      {link ? (
        <div className="mt-3 space-y-2">
          <div className="truncate rounded bg-white px-2 py-1 font-mono text-[10px]">{link}</div>
          <div className="flex gap-2">
            <button onClick={onCopy} className="inline-flex items-center gap-1 text-xs text-[hsl(var(--accent-brand))] hover:underline">
              <Copy className="h-3 w-3" /> Copiar link
            </button>
            <button onClick={onRegenerate} className="inline-flex items-center gap-1 text-xs text-[hsl(var(--content-subtle))] hover:underline">
              <RefreshCw className="h-3 w-3" /> Regenerar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-[hsl(var(--content-subtle))]">
          Sin invitación activa. {email ? "Regenera para emitir un link nuevo." : "Registra el email para generar el link."}
          {email && (
            <button onClick={onRegenerate} className="ml-2 inline-flex items-center gap-1 text-[hsl(var(--accent-brand))] hover:underline">
              <RefreshCw className="h-3 w-3" /> Generar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  status,
  docs,
  tasks,
  highlight,
}: {
  title: string;
  status: string;
  docs: number;
  tasks: Detail["tasks"];
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-[hsl(var(--accent-brand))] bg-white" : "border-[hsl(var(--hairline))] bg-white"}`}>
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">Estado</div>
        <div className="mt-1 font-serif text-lg">{title}</div>
        <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">{status}</div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded bg-[hsl(var(--surface-paper))] p-2">
          <div className="text-[10px] uppercase text-[hsl(var(--content-subtle))]">Docs</div>
          <div className="font-mono">{docs}</div>
        </div>
        <div className="rounded bg-[hsl(var(--surface-paper))] p-2">
          <div className="text-[10px] uppercase text-[hsl(var(--content-subtle))]">Tareas</div>
          <div className="font-mono">{tasks.length}</div>
        </div>
      </div>
      <div className="space-y-2">
        {tasks.slice(0, 5).map((t) => (
          <div key={t.id as string} className="rounded border border-[hsl(var(--hairline))] px-2 py-1 text-xs">
            <div className="font-medium">{t.title}</div>
            <div className="text-[10px] text-[hsl(var(--content-subtle))]">{t.status} · {t.priority}</div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="rounded border border-dashed border-[hsl(var(--hairline))] p-3 text-center text-[10px] text-[hsl(var(--content-subtle))]">
            Sin tareas
          </div>
        )}
      </div>
    </div>
  );
}
