// Accesos de la operación: comprador, vendedor y participantes adicionales
// (bróker, asesor, observador). Cada uno con su enlace privado y revocación.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Plus, Loader2, Copy, Ban, MessageSquare } from "lucide-react";
import {
  listTradeAccess,
  issueTradeAccess,
  revokeTradeAccess,
  PARTICIPANT_ROLE_LABEL,
  TRADE_PARTICIPANT_ROLES,
  type TradeParticipantRole,
} from "@/lib/tradeAccess.functions";

const input = "rounded border border-border px-2 py-1.5 text-xs w-full";

export function TradeAccessLinksPanel({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTradeAccess);
  const issueFn = useServerFn(issueTradeAccess);
  const revokeFn = useServerFn(revokeTradeAccess);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    role: "broker" as TradeParticipantRole,
    email: "",
    fullName: "",
    company: "",
    canUpload: false,
    canNegotiate: false,
  });

  const q = useQuery({
    queryKey: ["trade-access", tradeId],
    queryFn: () => listFn({ data: { tradeId } }),
    staleTime: 15_000,
    retry: false,
  });

  const issue = async () => {
    if (!form.email.trim()) {
      toast.error("Indica el correo del participante.");
      return;
    }
    setBusy(true);
    try {
      const r = await issueFn({
        data: {
          tradeId,
          role: form.role,
          email: form.email.trim(),
          fullName: form.fullName.trim() || undefined,
          company: form.company.trim() || undefined,
          canUpload: form.canUpload,
          canNegotiate: form.canNegotiate,
        },
      });
      setLastUrl(r.url);
      setForm({ ...form, email: "", fullName: "", company: "" });
      setOpen(false);
      toast.success("Acceso emitido. Copia el enlace: solo se muestra una vez.");
      void qc.invalidateQueries({ queryKey: ["trade-access", tradeId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo emitir el acceso.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (accessId: string) => {
    try {
      await revokeFn({ data: { tradeId, accessId } });
      toast.success("Acceso revocado.");
      void qc.invalidateQueries({ queryKey: ["trade-access", tradeId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado.");
  };

  return (
    <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold inline-flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Accesos de la operación
        </h3>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Participante
        </button>
      </div>

      {lastUrl ? (
        <div className="mt-3 rounded border border-[#1B3FAE]/30 bg-[#1B3FAE]/5 p-2 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Enlace privado (se muestra una sola vez)
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="truncate">{lastUrl}</code>
            <button type="button" onClick={() => void copy(lastUrl)} className="shrink-0 text-[#1B3FAE]">
              <Copy className="h-3 w-3" />
            </button>
            <a
              className="shrink-0 text-[#1B3FAE] inline-flex items-center gap-1"
              href={`https://wa.me/?text=${encodeURIComponent(`Acceso privado a la operación GeoCapitals: ${lastUrl}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageSquare className="h-3 w-3" /> WhatsApp
            </a>
          </div>
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="mt-3 text-xs text-neutral-500 inline-flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando accesos…
        </p>
      ) : q.error ? (
        <p className="mt-3 text-xs text-neutral-500">Sin permisos para ver los accesos.</p>
      ) : (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-1">Rol</th>
              <th className="py-1">Correo</th>
              <th className="py-1">Token</th>
              <th className="py-1">Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(q.data?.legacy ?? []).map((l) => (
              <tr key={l.party} className="border-t border-neutral-200">
                <td className="py-1.5">{PARTICIPANT_ROLE_LABEL[l.party]}</td>
                <td className="py-1.5">{l.email ?? "—"}</td>
                <td className="py-1.5 font-mono">{l.token_prefix ?? "—"}</td>
                <td className="py-1.5">{l.active ? "Activo" : "Sin emitir"}</td>
                <td />
              </tr>
            ))}
            {(q.data?.participants ?? []).map((r) => (
              <tr key={r.id} className="border-t border-neutral-200">
                <td className="py-1.5">
                  {PARTICIPANT_ROLE_LABEL[r.role]}
                  {r.can_upload ? " · carga" : ""}
                  {r.can_negotiate ? " · negocia" : ""}
                </td>
                <td className="py-1.5">{r.email}</td>
                <td className="py-1.5 font-mono">{r.token_prefix}</td>
                <td className="py-1.5">
                  {r.active ? "Activo" : r.revoked_at ? "Revocado" : "Expirado"}
                  {r.last_access_at
                    ? ` · ${new Date(r.last_access_at).toISOString().slice(0, 10)}`
                    : ""}
                </td>
                <td className="py-1.5 text-right">
                  {r.active ? (
                    <button
                      type="button"
                      onClick={() => void revoke(r.id)}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label="Revocar acceso"
                    >
                      <Ban className="h-3 w-3" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open ? (
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select
            className={input}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as TradeParticipantRole })}
          >
            {TRADE_PARTICIPANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {PARTICIPANT_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input
            className={input}
            placeholder="Correo"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className={input}
            placeholder="Nombre"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            className={input}
            placeholder="Empresa"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
          <label className="text-xs inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.canUpload}
              onChange={(e) => setForm({ ...form, canUpload: e.target.checked })}
            />
            Puede subir documentos
          </label>
          <label className="text-xs inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.canNegotiate}
              onChange={(e) => setForm({ ...form, canNegotiate: e.target.checked })}
            />
            Puede negociar
          </label>
          <button
            type="button"
            onClick={() => void issue()}
            disabled={busy}
            className="rounded bg-[#1B3FAE] px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {busy ? "Emitiendo…" : "Emitir acceso"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
