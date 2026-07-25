import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  uploadOperationDocument,
  getOperationDocumentUrl,
  reviewOperationDocument,
  freezeOperationDocument,
} from "@/lib/operations/documents.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Download,
  FileText,
  Lock,
  Upload,
  AlertCircle,
  Loader2,
} from "lucide-react";

type Role = "buyer" | "seller" | "geocapitals";

export type OperationDocLike = {
  id: string;
  kind: string;
  title: string;
  description?: string | null;
  version: number;
  visibility: string;
  review_status: string | null;
  review_notes: string | null;
  uploaded_by_role: string;
  is_frozen: boolean;
  created_at: string;
  sha256?: string | null;
};

const KIND_OPTIONS: Record<Role, Array<{ value: string; label: string }>> = {
  buyer: [
    { value: "kyc", label: "KYC / KYB" },
    { value: "loi", label: "LOI / ICPO" },
    { value: "pof", label: "Proof of Funds" },
    { value: "bank_letter", label: "Carta bancaria" },
    { value: "other", label: "Otro" },
  ],
  seller: [
    { value: "mining_title", label: "Título minero / concesión" },
    { value: "assay", label: "Ensayo / análisis" },
    { value: "export_permit", label: "Permiso de exportación" },
    { value: "environmental", label: "Permiso ambiental" },
    { value: "spec_sheet", label: "Ficha técnica" },
    { value: "other", label: "Otro" },
  ],
  geocapitals: [
    { value: "nda", label: "NDA / NCNDA" },
    { value: "loi", label: "LOI" },
    { value: "spa", label: "SPA / Contrato" },
    { value: "annex", label: "Anexo técnico" },
    { value: "report", label: "Informe interno" },
    { value: "other", label: "Otro" },
  ],
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read_error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function StatusBadge({ doc }: { doc: OperationDocLike }) {
  if (doc.is_frozen)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--hairline))] bg-[hsl(var(--surface-paper))] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[hsl(var(--content))]">
        <Lock className="h-3 w-3" /> Congelado
      </span>
    );
  const cls: Record<string, string> = {
    approved: "border-emerald-600/40 bg-emerald-50 text-emerald-800",
    rejected: "border-red-600/40 bg-red-50 text-red-800",
    needs_revision: "border-amber-600/40 bg-amber-50 text-amber-800",
    pending: "border-[hsl(var(--hairline))] bg-white text-[hsl(var(--content-subtle))]",
  };
  const s = doc.review_status ?? "pending";
  const label =
    s === "approved"
      ? "Aprobado"
      : s === "rejected"
        ? "Rechazado"
        : s === "needs_revision"
          ? "Requiere ajustes"
          : "En revisión";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls[s] ?? cls.pending}`}
    >
      {label}
    </span>
  );
}

export function OperationDocumentsPanel({
  documents,
  role,
  operationId,
  token,
  canReview = false,
  onChange,
}: {
  documents: OperationDocLike[];
  role: Role;
  operationId?: string;
  token?: string;
  canReview?: boolean;
  onChange?: () => void | Promise<void>;
}) {
  const upload = useServerFn(uploadOperationDocument);
  const getUrl = useServerFn(getOperationDocumentUrl);
  const review = useServerFn(reviewOperationDocument);
  const freeze = useServerFn(freezeOperationDocument);

  const fileRef = useRef<HTMLInputElement>(null);
  const kindOptions = useMemo(() => KIND_OPTIONS[role], [role]);
  const [kind, setKind] = useState(kindOptions[0]?.value ?? "other");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setKind(kindOptions[0]?.value ?? "other");
  }, [kindOptions]);

  const submit = async () => {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Selecciona un archivo");
    if (!title.trim()) return setError("Agrega un título");
    if (file.size > 15 * 1024 * 1024) return setError("Máximo 15MB");
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      await upload({
        data: {
          operation_id: operationId,
          token,
          role,
          kind,
          title: title.trim(),
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          content_base64: b64,
        },
      });
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      await onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: string) => {
    try {
      const { url } = await getUrl({
        data: {
          document_id: id,
          token,
          role: role === "geocapitals" ? undefined : (role as "buyer" | "seller"),
        },
      });
      window.open(url, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "No disponible");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[hsl(var(--hairline))] bg-white p-4">
        <div className="mb-3 flex items-center gap-2 font-serif text-lg">
          <Upload className="h-4 w-4" /> Subir documento
        </div>
        <div className="grid gap-2 md:grid-cols-[180px_1fr]">
          <select
            className="rounded-md border border-[hsl(var(--hairline))] bg-white px-2 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {kindOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Input
            placeholder="Título / descripción breve"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          className="mt-2 block w-full text-sm"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
        />
        {error && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" /> {error}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-[hsl(var(--content-subtle))]">
          <span>Máx. 15MB · PDF, imágenes, Office.</span>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Subir
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--hairline))] bg-white">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--hairline))] px-4 py-3 font-serif text-lg">
          <FileText className="h-4 w-4" /> Documentos ({documents.length})
        </div>
        {documents.length === 0 ? (
          <div className="p-6 text-center text-sm text-[hsl(var(--content-subtle))]">
            Sin documentos aún.
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--hairline))]">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium">{d.title}</div>
                    <StatusBadge doc={d} />
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-[hsl(var(--content-subtle))]">
                    {d.kind} · v{d.version} · {d.uploaded_by_role} ·{" "}
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  {d.review_notes && (
                    <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">
                      Nota: {d.review_notes}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void download(d.id)}>
                    <Download className="h-3 w-3" />
                  </Button>
                  {canReview && !d.is_frozen && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Aprobar"
                        onClick={async () => {
                          await review({
                            data: { document_id: d.id, review_status: "approved" },
                          });
                          await onChange?.();
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Solicitar ajustes"
                        onClick={async () => {
                          const notes = window.prompt("Notas para el firmante:", d.review_notes ?? "");
                          if (notes == null) return;
                          await review({
                            data: {
                              document_id: d.id,
                              review_status: "needs_revision",
                              review_notes: notes,
                            },
                          });
                          await onChange?.();
                        }}
                      >
                        <AlertCircle className="h-3 w-3 text-amber-700" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Congelar para firma"
                        onClick={async () => {
                          if (!confirm("Congelar este documento? No podrá modificarse.")) return;
                          await freeze({ data: { document_id: d.id } });
                          await onChange?.();
                        }}
                      >
                        <Lock className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
