// Participantes de la operación: invitar brókers/asesores con su propio enlace
// privado, copiar o compartir el acceso y revocarlo cuando corresponda.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Plus, Loader2, Link2, MessageCircle, Ban, RefreshCw } from "lucide-react";
import {
  listTradeParticipants,
  inviteTradeParticipant,
  revokeTradeParticipant,
  rotateParticipantLink,
  PARTICIPANT_ROLES,
  type ParticipantRow,
} from "@/lib/tradeParticipants.functions";

const roleLabel = (r: string) => PARTICIPANT_ROLES.find((x) => x.value === r)?.label ?? r;

export function TradeParticipantsPanel({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listTradeParticipants);
  const invite = useServerFn(inviteTradeParticipant);
  const revoke = useServerFn(revokeTradeParticipant);
  const rotate = useServerFn(rotateParticipantLink);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    role: "broker",
    email: "",
    name: "",
    company: "",
    canViewDocuments: true,
    canNegotiate: false,
    canUpload: false,
    sendEmail: true,
  });

  const q = useQuery({
    queryKey: ["trade-participants", tradeId],
    queryFn: () => list({ data: { tradeId } }),
    staleTime: 15_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["trade-participants", tradeId] });

  const submit = async () => {
    if (!form.email.trim()) return toast.error("Indica el correo del participante.");
    setBusy(true);
    try {
      const r = await invite({
        data: {
          tradeId,
          role: form.role as "broker",
          email: form.email.trim(),
          name: form.name.trim() || undefined,
          company: form.company.trim() || undefined,
          canViewDocuments: form.canViewDocuments,
          canNegotiate: form.canNegotiate,
          canUpload: form.canUpload,
          sendEmail: form.sendEmail,
        },
      });
      setLastUrl(r.url);
      void navigator.clipboard.writeText(r.url).catch(() => undefined);
      toast.success(
        form.sendEmail ? "Invitación enviada y enlace copiado." : "Enlace generado y copiado.",
      );
      setForm({ ...form, email: "", name: "", company: "" });
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo invitar al participante.");
    } finally {
      setBusy(false);
    }
  };

  const rows = (q.data ?? []) as ParticipantRow[];

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" /> Participantes de la operación
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Invitar
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada participante recibe un enlace privado a la ficha de la operación. Nunca ve precio base,
        margen ni reparto de comisiones.
      </p>

      {open ? (
        <div className="mt-4 space-y-3 rounded border border-border bg-muted/30 p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-muted-foreground">Rol</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1.5"
              >
                {PARTICIPANT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Correo</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nombre@empresa.com"
                className="w-full rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Empresa</span>
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["canViewDocuments", "Ver documentos"],
                ["canNegotiate", "Puede negociar"],
                ["canUpload", "Puede subir archivos"],
                ["sendEmail", "Enviar correo de invitación"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                />
                {l}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear acceso
          </button>
        </div>
      ) : null}

      {lastUrl ? (
        <p className="mt-3 break-all rounded border border-primary/30 bg-primary/5 p-2 text-[11px]">
          Último enlace emitido (solo se muestra una vez): {lastUrl}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {q.isLoading ? (
          <p className="text-xs text-muted-foreground">Cargando participantes…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no hay participantes invitados.</p>
        ) : (
          rows.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border px-3 py-2 text-xs"
            >
              <span className="font-medium">{p.name || p.email}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{roleLabel(p.role)}</span>
              {p.company ? <span className="text-muted-foreground">{p.company}</span> : null}
              <span className="text-muted-foreground">{p.email}</span>
              <span
                className={
                  p.status === "active"
                    ? "rounded bg-green-600/10 px-1.5 py-0.5 text-green-700"
                    : "rounded bg-destructive/10 px-1.5 py-0.5 text-destructive"
                }
              >
                {p.status === "active" ? "Activo" : "Revocado"}
              </span>
              {p.token_prefix ? (
                <span className="font-mono text-[10px] text-muted-foreground">{p.token_prefix}…</span>
              ) : null}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  title="Emitir nuevo enlace"
                  onClick={async () => {
                    try {
                      const r = await rotate({ data: { participantId: p.id } });
                      void navigator.clipboard.writeText(r.url).catch(() => undefined);
                      setLastUrl(r.url);
                      toast.success("Nuevo enlace copiado.");
                      refresh();
                    } catch {
                      toast.error("No se pudo emitir el enlace.");
                    }
                  }}
                  className="rounded border border-border p-1 hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <a
                  title="Compartir por WhatsApp"
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Acceso a la operación en Geocapitals — te enviamos el enlace privado por correo a ${p.email}.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-border p-1 hover:bg-muted"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  title="Copiar correo"
                  onClick={() => {
                    void navigator.clipboard.writeText(p.email);
                    toast.success("Correo copiado");
                  }}
                  className="rounded border border-border p-1 hover:bg-muted"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                {p.status === "active" ? (
                  <button
                    type="button"
                    title="Revocar acceso"
                    onClick={async () => {
                      try {
                        await revoke({ data: { participantId: p.id } });
                        toast.success("Acceso revocado.");
                        refresh();
                      } catch {
                        toast.error("No se pudo revocar el acceso.");
                      }
                    }}
                    className="rounded border border-destructive/40 p-1 text-destructive hover:bg-destructive/10"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
