import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileSignature,
  Plus,
  Copy,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Ban,
  Mail,
  Loader2,
} from "lucide-react";
import {
  createOperationSignatureFlow,
  listOperationSignatureFlows,
  voidOperationSignatureFlow,
} from "@/lib/operations/signatures.functions";

type Doc = {
  id: string;
  title: string;
  kind: string;
  version: number;
  is_frozen: boolean;
  sha256: string | null;
};

type Participant = {
  role: string;
  full_name: string | null;
  email: string | null;
};

type Props = {
  operationId: string;
  documents: Doc[];
  participants: Participant[];
  canManage: boolean;
};

const TEMPLATES = ["NDA", "NCNDA", "LOI", "SPA", "MOU", "OTRO"] as const;
type Template = (typeof TEMPLATES)[number];

const ROLE_LABEL: Record<string, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  geocapitals: "GeoCapitals",
  advisor: "Asesor",
  witness: "Testigo",
};

export function OperationSignaturesPanel({
  operationId,
  documents,
  participants,
  canManage,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOperationSignatureFlows);
  const createFn = useServerFn(createOperationSignatureFlow);
  const voidFn = useServerFn(voidOperationSignatureFlow);

  const flowsQuery = useQuery({
    queryKey: ["op-signatures", operationId],
    queryFn: () => listFn({ data: { operation_id: operationId } }),
  });

  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState<string>(
    documents.find((d) => d.is_frozen)?.id ?? documents[0]?.id ?? "",
  );
  const [template, setTemplate] = useState<Template>("NDA");
  const [expDays, setExpDays] = useState(14);
  const [signers, setSigners] = useState<Array<{ role: string; name: string; email: string }>>(
    () => {
      const rows: Array<{ role: string; name: string; email: string }> = [];
      for (const p of participants) {
        if (p.role === "buyer" || p.role === "seller") {
          rows.push({
            role: p.role,
            name: p.full_name ?? "",
            email: p.email ?? "",
          });
        }
      }
      if (rows.length === 0) {
        rows.push({ role: "buyer", name: "", email: "" });
        rows.push({ role: "seller", name: "", email: "" });
      }
      return rows;
    },
  );
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    if (!documentId) return toast.error("Selecciona un documento");
    const clean = signers.filter((s) => s.name.trim().length >= 2);
    if (clean.length === 0) return toast.error("Añade al menos un firmante");
    setCreating(true);
    try {
      await createFn({
        data: {
          operation_id: operationId,
          document_id: documentId,
          template,
          expires_in_days: expDays,
          signers: clean.map((s, i) => ({
            role: s.role as never,
            name: s.name.trim(),
            email: s.email.trim() || undefined,
            order: i + 1,
          })),
        },
      });
      toast.success("Flujo de firma creado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["op-signatures", operationId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el flujo");
    } finally {
      setCreating(false);
    }
  };

  const onVoid = async (envelopeId: string) => {
    if (!confirm("¿Anular este flujo? Las firmas pendientes se invalidarán.")) return;
    try {
      await voidFn({ data: { envelope_id: envelopeId } });
      toast.success("Flujo anulado");
      qc.invalidateQueries({ queryKey: ["op-signatures", operationId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular");
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const flows = flowsQuery.data ?? [];

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-accent-brand" />
          <h3 className="text-sm font-semibold text-content">Flujos de firma electrónica</h3>
          {flows.length > 0 && (
            <span className="text-[10px] rounded-full bg-surface-3 px-2 py-0.5 text-content-subtle">
              {flows.length}
            </span>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-md bg-content text-surface px-2.5 py-1 text-xs font-medium hover:opacity-90"
          >
            <Plus className="w-3 h-3" /> Nuevo flujo
          </button>
        )}
      </div>

      {flowsQuery.isLoading ? (
        <div className="h-16 rounded-lg bg-surface-3 animate-pulse" />
      ) : flows.length === 0 ? (
        <div className="text-xs text-content-subtle py-4 text-center">
          No hay flujos de firma en esta operación.
          {canManage && documents.length > 0 && (
            <>
              {" "}
              Crea uno sobre un documento <span className="font-medium">congelado</span>.
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {flows.map((f) => {
            const meta = (f.metadata ?? {}) as Record<string, string | number>;
            return (
              <li key={f.id} className="rounded-lg border border-hairline bg-surface-3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-content truncate">
                      {String(meta.template ?? "").toUpperCase() || "DOC"} · {f.document_title}
                    </div>
                    <div className="text-[10px] text-content-subtle">
                      v{meta.document_version ?? "-"} ·{" "}
                      <code className="font-mono">
                        {String(f.document_hash ?? "").slice(0, 16)}…
                      </code>
                    </div>
                  </div>
                  <StatusBadge
                    status={f.status}
                    done={f.completed_signers ?? 0}
                    req={f.required_signers ?? 0}
                  />
                </div>

                <ul className="mt-2.5 space-y-1">
                  {f.signers.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex items-center gap-1.5">
                        {s.status === "signed" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-content-subtle shrink-0" />
                        )}
                        <span className="truncate">
                          <strong>{s.signer_name}</strong>{" "}
                          <span className="text-content-subtle">
                            · {ROLE_LABEL[s.signer_role] ?? s.signer_role}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.emailed_at && (
                          <Mail className="w-3 h-3 text-emerald-600" aria-label="Email enviado" />
                        )}
                        {canManage && s.status !== "signed" && (
                          <button
                            onClick={() => void copy(s.sign_url)}
                            className="inline-flex items-center gap-1 rounded border border-hairline px-1.5 py-0.5 text-[10px] hover:bg-surface"
                            title="Copiar enlace de firma"
                          >
                            <Copy className="w-3 h-3" /> Link
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {canManage && f.status !== "completed" && f.status !== "void" && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => void onVoid(f.id)}
                      className="inline-flex items-center gap-1 text-[10px] text-rose-700 hover:underline"
                    >
                      <Ban className="w-3 h-3" /> Anular flujo
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Dialog crear */}
      {open && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-surface border border-hairline p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-accent-brand" />
              <h4 className="text-sm font-semibold text-content">Nuevo flujo de firma</h4>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-content-subtle">
                Documento
              </label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-surface-3 px-2 py-2 text-sm"
              >
                <option value="">— seleccionar —</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} · v{d.version}
                    {d.is_frozen ? " · 🔒 congelado" : " · se congelará al firmar"}
                  </option>
                ))}
              </select>
              {documents.every((d) => !d.is_frozen) && documents.length > 0 && (
                <div className="mt-1 text-[10px] text-amber-700 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Ningún documento está congelado. Al crear el
                  flujo se congelará automáticamente.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-content-subtle">
                  Plantilla
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as Template)}
                  className="mt-1 w-full rounded-md border border-hairline bg-surface-3 px-2 py-2 text-sm"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-content-subtle">
                  Vence en (días)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={expDays}
                  onChange={(e) => setExpDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-hairline bg-surface-3 px-2 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase tracking-wider text-content-subtle">
                  Firmantes
                </label>
                <button
                  onClick={() =>
                    setSigners((s) => [...s, { role: "advisor", name: "", email: "" }])
                  }
                  className="text-[10px] text-accent-brand hover:underline"
                >
                  + añadir
                </button>
              </div>
              <div className="space-y-1.5">
                {signers.map((s, i) => (
                  <div key={i} className="grid grid-cols-[80px_1fr_1fr_auto] gap-1.5">
                    <select
                      value={s.role}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSigners((arr) => arr.map((x, j) => (i === j ? { ...x, role: v } : x)));
                      }}
                      className="rounded-md border border-hairline bg-surface-3 px-1 py-1.5 text-xs"
                    >
                      {Object.keys(ROLE_LABEL).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={s.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSigners((arr) => arr.map((x, j) => (i === j ? { ...x, name: v } : x)));
                      }}
                      placeholder="Nombre completo"
                      className="rounded-md border border-hairline bg-surface-3 px-2 py-1.5 text-xs"
                    />
                    <input
                      type="email"
                      value={s.email}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSigners((arr) => arr.map((x, j) => (i === j ? { ...x, email: v } : x)));
                      }}
                      placeholder="email@empresa.com"
                      className="rounded-md border border-hairline bg-surface-3 px-2 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => setSigners((arr) => arr.filter((_, j) => j !== i))}
                      className="rounded-md border border-hairline px-1.5 text-xs text-rose-700 hover:bg-surface-3"
                      title="Eliminar firmante"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-hairline px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => void onCreate()}
                disabled={creating}
                className="inline-flex items-center gap-1 rounded-md bg-content text-surface px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileSignature className="w-3 h-3" />
                )}
                Crear y enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, done, req }: { status: string; done: number; req: number }) {
  const label =
    status === "completed"
      ? "Completado"
      : status === "void"
        ? "Anulado"
        : status === "in_progress"
          ? `${done}/${req} firmas`
          : `Pendiente ${done}/${req}`;
  const cls =
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-700"
      : status === "void"
        ? "bg-rose-500/15 text-rose-700"
        : "bg-accent-brand/10 text-accent-brand";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
