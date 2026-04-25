import { useState, useMemo } from "react";
import { useSignatureEnvelopes, type SignatureEnvelope } from "@/hooks/useSignatureEnvelopes";
import { useTeam } from "@/hooks/useTeam";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Plus, ShieldCheck, X, Loader2, FileText, BadgeCheck, AlertTriangle } from "lucide-react";

const DOC_TYPES: Array<{ value: SignatureEnvelope["document_type"]; label: string }> = [
  { value: "qp_certificate", label: "Certificado QP (NI 43-101 §2)" },
  { value: "ni43101_report", label: "Reporte técnico NI 43-101 (PDF maestro)" },
  { value: "compliance_report", label: "Reporte de Compliance (JORC/CIM)" },
];

const SIGNER_ROLES = [
  { value: "qp", label: "Qualified Person" },
  { value: "reviewer", label: "Revisor" },
  { value: "approver", label: "Aprobador" },
  { value: "auditor", label: "Auditor" },
];

export function SignatureEnvelopesPanel() {
  const { user } = useAuth();
  const { envelopes, signatures, loading, createEnvelope, signEnvelope, rejectEnvelope } = useSignatureEnvelopes();
  const { active } = useProjects();
  const { members } = useTeam(active?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  const sigsByEnv = useMemo(() => {
    const m = new Map<string, typeof signatures>();
    for (const s of signatures) {
      const arr = m.get(s.envelope_id) ?? [];
      arr.push(s);
      m.set(s.envelope_id, arr);
    }
    return m;
  }, [signatures]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Firmas digitales internas</div>
          <div className="text-[10px] text-text-dim font-mono">HMAC-SHA256 + hash de documento · auditable</div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3 h-3 mr-1" /> Crear envelope
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-text-dim text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Cargando…</div>
      ) : envelopes.length === 0 ? (
        <div className="border border-border rounded p-8 text-center text-text-dim font-mono text-xs">
          No hay envelopes de firma. Crea uno para iniciar el proceso de firma digital.
        </div>
      ) : (
        <div className="space-y-2">
          {envelopes.map((env) => {
            const sigs = sigsByEnv.get(env.id) ?? [];
            const mySig = sigs.find((s) => s.signer_user_id === user?.id);
            const canSign = mySig && mySig.status === "pending" && env.status !== "complete" && env.status !== "rejected";
            return (
              <div key={env.id} className="border border-border rounded bg-card overflow-hidden">
                <div className="p-3 border-b border-border flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-signal-cyan shrink-0" />
                      <div className="font-mono text-sm truncate">{env.document_title}</div>
                      <EnvelopeStatusBadge status={env.status} />
                    </div>
                    <div className="text-[10px] text-text-dim font-mono mt-1 flex items-center gap-3 flex-wrap">
                      <span className="uppercase">{DOC_TYPES.find(d => d.value === env.document_type)?.label ?? env.document_type}</span>
                      <span>Hash: <code className="text-foreground">{env.document_hash.slice(0, 16)}…</code></span>
                      <span>{env.completed_signers}/{env.required_signers} firmas</span>
                    </div>
                  </div>
                  {canSign && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => signEnvelope(env.id)}>
                        <ShieldCheck className="w-3 h-3 mr-1" /> Firmar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-signal-amber" onClick={() => {
                        const reason = prompt("Motivo del rechazo:");
                        if (reason) rejectEnvelope(env.id, reason);
                      }}>
                        <X className="w-3 h-3 mr-1" /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {sigs.sort((a, b) => a.signing_order - b.signing_order).map((s) => (
                    <div key={s.id} className="px-3 py-2 flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-text-dim w-6">#{s.signing_order}</span>
                      <span className="flex-1 truncate">{s.signer_name}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">{s.signer_role}</Badge>
                      <SignatureStatusPill status={s.status} />
                      {s.signed_at && (
                        <span className="text-[9px] text-signal-cyan flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> {new Date(s.signed_at).toLocaleString("es-CL")}
                        </span>
                      )}
                      {s.signature_hmac && (
                        <code className="text-[9px] text-text-dim hidden md:inline">HMAC: {s.signature_hmac.slice(0, 12)}…</code>
                      )}
                      {s.rejection_reason && (
                        <span className="text-[9px] text-signal-red flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {s.rejection_reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateEnvelopeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members.map(m => ({ user_id: m.user_id, name: m.display_name ?? m.email ?? m.user_id, email: m.email ?? undefined }))}
        onCreate={async (data) => {
          await createEnvelope(data);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function EnvelopeStatusBadge({ status }: { status: SignatureEnvelope["status"] }) {
  const map: Record<string, string> = {
    pending: "border-border text-text-dim",
    partial: "border-signal-amber/40 text-signal-amber",
    complete: "border-signal-cyan/40 text-signal-cyan",
    rejected: "border-signal-red/40 text-signal-red",
    expired: "border-border text-text-dim",
  };
  return <span className={`text-[9px] font-mono uppercase border rounded px-1 py-0 ${map[status] ?? map.pending}`}>{status}</span>;
}

function SignatureStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendiente", cls: "border-border text-text-dim" },
    signed: { label: "Firmado", cls: "border-signal-cyan/40 text-signal-cyan" },
    rejected: { label: "Rechazado", cls: "border-signal-red/40 text-signal-red" },
  };
  const m = map[status] ?? map.pending;
  return <span className={`text-[9px] font-mono uppercase border rounded px-1 py-0 ${m.cls}`}>{m.label}</span>;
}

function CreateEnvelopeDialog({ open, onClose, members, onCreate }: {
  open: boolean;
  onClose: () => void;
  members: Array<{ user_id: string; name: string; email?: string }>;
  onCreate: (data: {
    document_type: SignatureEnvelope["document_type"];
    document_title: string;
    document_payload: string;
    signers: Array<{ user_id: string; name: string; role: string; email?: string }>;
  }) => Promise<void>;
}) {
  const [docType, setDocType] = useState<SignatureEnvelope["document_type"]>("qp_certificate");
  const [title, setTitle] = useState("");
  const [payload, setPayload] = useState("");
  const [signers, setSigners] = useState<Array<{ user_id: string; role: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title || !payload || signers.length === 0) return;
    setSubmitting(true);
    const enriched = signers.map((s) => {
      const m = members.find((mm) => mm.user_id === s.user_id);
      return { user_id: s.user_id, name: m?.name ?? s.user_id, email: m?.email, role: s.role };
    });
    await onCreate({ document_type: docType, document_title: title, document_payload: payload, signers: enriched });
    setSubmitting(false);
    setTitle(""); setPayload(""); setSigners([]); setDocType("qp_certificate");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-signal-cyan" /> Crear envelope de firma
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-mono">Tipo de documento</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as SignatureEnvelope["document_type"])}>
              <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs font-mono" placeholder="Ej: Certificado QP — Juan Pérez (Geología §6)" />
          </div>
          <div>
            <Label className="text-xs font-mono">Contenido / payload (se hashea con SHA-256)</Label>
            <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} className="text-xs font-mono min-h-24" placeholder="Pega aquí el texto del certificado, resumen del reporte o referencia inmutable…" />
          </div>
          <div>
            <Label className="text-xs font-mono">Firmantes</Label>
            <div className="space-y-1.5">
              {signers.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Select value={s.user_id} onValueChange={(v) => setSigners(arr => arr.map((x, j) => j === i ? { ...x, user_id: v } : x))}>
                    <SelectTrigger className="h-7 text-xs font-mono flex-1"><SelectValue placeholder="Seleccionar miembro" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={s.role} onValueChange={(v) => setSigners(arr => arr.map((x, j) => j === i ? { ...x, role: v } : x))}>
                    <SelectTrigger className="h-7 text-xs font-mono w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIGNER_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSigners(arr => arr.filter((_, j) => j !== i))}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSigners(arr => [...arr, { user_id: "", role: "qp" }])}>
                <Plus className="w-3 h-3 mr-1" /> Añadir firmante
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting || !title || !payload || signers.length === 0 || signers.some(s => !s.user_id)}>
            {submitting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Crear envelope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
