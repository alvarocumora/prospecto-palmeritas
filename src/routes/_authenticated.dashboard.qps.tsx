import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQualifiedPersons, type QualifiedPerson, type TechnicalReport, type ReportSection } from "@/hooks/useQualifiedPersons";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canWrite } from "@/hooks/useProjectRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck, Plus, FileText, ShieldCheck, Pencil, Trash2,
  CheckCircle2, Clock, FileSignature, BadgeCheck, Loader2, RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/qps")({
  head: () => ({
    meta: [
      { title: "QPs · Personas Calificadas | Geocapitals" },
      { name: "description", content: "Gestión de Qualified Persons (NI 43-101): registro, asignaciones a reportes y estado de firma." },
    ],
  }),
  component: QpsPage,
});

const NI43101_SECTIONS: { no: number; title: string }[] = [
  { no: 1, title: "Resumen ejecutivo" },
  { no: 2, title: "Introducción" },
  { no: 3, title: "Confianza en otros expertos" },
  { no: 4, title: "Descripción y ubicación" },
  { no: 5, title: "Acceso, clima e infraestructura" },
  { no: 6, title: "Historia" },
  { no: 7, title: "Geología regional y local" },
  { no: 8, title: "Tipo de depósito" },
  { no: 9, title: "Exploración" },
  { no: 10, title: "Sondajes" },
  { no: 11, title: "QA/QC y verificación de datos" },
  { no: 12, title: "Procesamiento mineralúrgico" },
  { no: 13, title: "Estimación de recursos" },
  { no: 14, title: "Conclusiones y recomendaciones" },
];

function QpsPage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const writable = canWrite(role);
  const {
    qps, reports, sections, loading,
    createQp, updateQp, deleteQp,
    createReport, deleteReport,
    upsertSection, assignQpToSection, signSection, revokeSignature,
  } = useQualifiedPersons();

  const [tab, setTab] = useState<"qps" | "reports" | "compliance">("qps");
  const [qpDialog, setQpDialog] = useState<{ open: boolean; editing: QualifiedPerson | null }>({ open: false, editing: null });
  const [reportDialog, setReportDialog] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // ensure default report is selected
  if (!activeReportId && reports.length > 0) setActiveReportId(reports[0].id);

  if (!active) {
    return (
      <div className="p-8 text-text-dim font-mono text-xs">
        Selecciona un proyecto activo para gestionar QPs.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-signal-cyan" />
          <div>
            <h1 className="text-base font-mono uppercase tracking-wide">Qualified Persons</h1>
            <p className="text-[10px] text-text-dim font-mono">Registro · Asignaciones · Estado de firma NI 43-101</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {writable && tab === "qps" && (
            <Button size="sm" onClick={() => setQpDialog({ open: true, editing: null })}>
              <Plus className="w-3 h-3 mr-1" /> Registrar QP
            </Button>
          )}
          {writable && tab === "reports" && (
            <Button size="sm" onClick={() => setReportDialog(true)}>
              <Plus className="w-3 h-3 mr-1" /> Nuevo reporte
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "qps" | "reports")}>
        <TabsList>
          <TabsTrigger value="qps"><UserCheck className="w-3 h-3 mr-1" /> Personas Calificadas ({qps.length})</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="w-3 h-3 mr-1" /> Reportes ({reports.length})</TabsTrigger>
        </TabsList>

        {/* QPs TAB */}
        <TabsContent value="qps" className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-text-dim text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Cargando…</div>
          ) : qps.length === 0 ? (
            <div className="border border-border rounded p-8 text-center text-text-dim font-mono text-xs">
              No hay QPs registrados. {writable && "Haz clic en \"Registrar QP\"."}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {qps.map((qp) => {
                const assignedCount = sections.filter((s) => s.qp_id === qp.id).length;
                const signedCount = sections.filter((s) => s.qp_id === qp.id && s.status === "signed").length;
                return (
                  <div key={qp.id} className="border border-border rounded p-3 bg-card flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-sm truncate flex items-center gap-1">
                          {qp.full_name}
                          {qp.is_verified && <BadgeCheck className="w-3 h-3 text-signal-cyan" />}
                        </div>
                        <div className="text-[10px] text-text-dim font-mono truncate">{qp.profession}</div>
                      </div>
                      {writable && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setQpDialog({ open: true, editing: qp })}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { if (confirm(`Eliminar QP ${qp.full_name}?`)) deleteQp(qp.id); }}>
                            <Trash2 className="w-3 h-3 text-signal-red" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-text-dim space-y-0.5">
                      <div><span className="text-foreground">Colegio:</span> {qp.registration_body}</div>
                      <div><span className="text-foreground">Licencia:</span> {qp.license_no}</div>
                      {qp.competency_areas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {qp.competency_areas.slice(0, 4).map((c) => (
                            <Badge key={c} variant="outline" className="text-[9px] px-1 py-0">{c}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-border">
                      <span className="text-text-dim">Secciones asignadas: <b className="text-foreground">{assignedCount}</b></span>
                      <span className="text-signal-cyan">{signedCount} firmadas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="mt-4">
          {reports.length === 0 ? (
            <div className="border border-border rounded p-8 text-center text-text-dim font-mono text-xs">
              No hay reportes técnicos. {writable && "Crea uno con el botón \"Nuevo reporte\"."}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="space-y-1">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReportId(r.id)}
                    className={`w-full text-left border rounded p-2 font-mono text-xs ${activeReportId === r.id ? "border-signal-cyan bg-signal-cyan/5" : "border-border hover:border-signal-cyan/40"}`}
                  >
                    <div className="truncate">{r.title}</div>
                    <div className="text-[9px] text-text-dim flex items-center gap-2 mt-0.5">
                      <span className="uppercase">{r.report_type}</span>
                      <span>v{r.version}</span>
                      <ReportStatusPill status={r.status} />
                    </div>
                  </button>
                ))}
              </div>
              {activeReportId && (
                <ReportDetail
                  report={reports.find((r) => r.id === activeReportId)!}
                  qps={qps}
                  sections={sections.filter((s) => s.report_id === activeReportId)}
                  writable={writable}
                  onUpsertSection={upsertSection}
                  onAssign={assignQpToSection}
                  onSign={signSection}
                  onRevoke={revokeSignature}
                  onDeleteReport={() => { if (confirm("Eliminar reporte completo?")) { deleteReport(activeReportId); setActiveReportId(null); } }}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <QpDialog
        open={qpDialog.open}
        editing={qpDialog.editing}
        onClose={() => setQpDialog({ open: false, editing: null })}
        onSave={async (data) => {
          if (qpDialog.editing) await updateQp(qpDialog.editing.id, data);
          else await createQp(data);
          setQpDialog({ open: false, editing: null });
        }}
      />

      <ReportDialog
        open={reportDialog}
        qps={qps}
        onClose={() => setReportDialog(false)}
        onSave={async (data) => {
          const r = await createReport(data);
          setReportDialog(false);
          if (r) setActiveReportId(r.id);
        }}
      />
    </div>
  );
}

function ReportStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Borrador", cls: "text-text-dim border-border" },
    review: { label: "Revisión", cls: "text-signal-amber border-signal-amber/40" },
    signed: { label: "Firmado", cls: "text-signal-cyan border-signal-cyan/40" },
    published: { label: "Publicado", cls: "text-signal-green border-signal-green/40" },
  };
  const m = map[status] ?? map.draft;
  return <span className={`inline-flex items-center px-1 py-0 border rounded text-[9px] ${m.cls}`}>{m.label}</span>;
}

function ReportDetail({
  report, qps, sections, writable, onUpsertSection, onAssign, onSign, onRevoke, onDeleteReport,
}: {
  report: TechnicalReport;
  qps: QualifiedPerson[];
  sections: ReportSection[];
  writable: boolean;
  onUpsertSection: (input: { report_id: string; section_no: number; title: string; qp_id?: string | null; status?: string }) => Promise<void>;
  onAssign: (sectionId: string, qpId: string | null) => Promise<void>;
  onSign: (sectionId: string) => Promise<void>;
  onRevoke: (sectionId: string) => Promise<void>;
  onDeleteReport: () => void;
}) {
  const sectionsByNo = useMemo(() => {
    const map = new Map<number, ReportSection>();
    for (const s of sections) map.set(s.section_no, s);
    return map;
  }, [sections]);

  const total = NI43101_SECTIONS.length;
  const signed = NI43101_SECTIONS.filter((d) => sectionsByNo.get(d.no)?.status === "signed").length;
  const assigned = NI43101_SECTIONS.filter((d) => sectionsByNo.get(d.no)?.qp_id).length;

  return (
    <div className="border border-border rounded bg-card">
      <div className="p-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-mono text-sm">{report.title}</div>
          <div className="text-[10px] text-text-dim font-mono mt-0.5">
            {report.effective_date ? `Vigente: ${report.effective_date}` : "Sin fecha vigente"} · Lead QP: {qps.find(q => q.id === report.lead_qp_id)?.full_name ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span><b className="text-signal-cyan">{signed}</b>/{total} firmadas</span>
          <span><b className="text-foreground">{assigned}</b>/{total} asignadas</span>
          {writable && (
            <Button variant="ghost" size="sm" className="h-6 text-signal-red" onClick={onDeleteReport}>
              <Trash2 className="w-3 h-3 mr-1" /> Eliminar
            </Button>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {NI43101_SECTIONS.map((def) => {
          const s = sectionsByNo.get(def.no);
          const qp = s?.qp_id ? qps.find((q) => q.id === s.qp_id) : null;
          const isSigned = s?.status === "signed";

          return (
            <div key={def.no} className="p-2.5 flex items-center gap-3 flex-wrap">
              <div className="font-mono text-[10px] text-text-dim w-8 shrink-0">§{def.no}</div>
              <div className="flex-1 min-w-[180px]">
                <div className="text-xs font-mono">{def.title}</div>
                {s?.signed_at && (
                  <div className="text-[9px] text-signal-cyan font-mono mt-0.5 flex items-center gap-1">
                    <FileSignature className="w-3 h-3" />
                    Firmado {new Date(s.signed_at).toLocaleString("es-CL")} · hash {s.signature_hash?.slice(0, 16)}…
                  </div>
                )}
              </div>

              <div className="min-w-[180px]">
                <Select
                  disabled={!writable || isSigned}
                  value={s?.qp_id ?? "__none"}
                  onValueChange={async (val) => {
                    const qpId = val === "__none" ? null : val;
                    if (!s) {
                      await onUpsertSection({ report_id: report.id, section_no: def.no, title: def.title, qp_id: qpId, status: qpId ? "drafting" : "empty" });
                    } else {
                      await onAssign(s.id, qpId);
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs font-mono">
                    <SelectValue placeholder="Asignar QP…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sin asignar —</SelectItem>
                    {qps.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.full_name} · {q.profession}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <SectionStatusBadge status={s?.status ?? "empty"} />
                {writable && s && qp && !isSigned && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSign(s.id)}>
                    <ShieldCheck className="w-3 h-3 mr-1" /> Firmar
                  </Button>
                )}
                {writable && s && isSigned && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-signal-amber" onClick={() => onRevoke(s.id)}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Revocar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    empty: { label: "Vacía", icon: <Clock className="w-3 h-3" />, cls: "text-text-dim border-border" },
    drafting: { label: "Redactando", icon: <Pencil className="w-3 h-3" />, cls: "text-signal-amber border-signal-amber/40" },
    ready: { label: "Lista", icon: <CheckCircle2 className="w-3 h-3" />, cls: "text-foreground border-border" },
    signed: { label: "Firmada", icon: <ShieldCheck className="w-3 h-3" />, cls: "text-signal-cyan border-signal-cyan/40 bg-signal-cyan/5" },
  };
  const m = map[status] ?? map.empty;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[9px] font-mono ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

/* ========== DIALOGS ========== */

function QpDialog({
  open, editing, onClose, onSave,
}: {
  open: boolean;
  editing: QualifiedPerson | null;
  onClose: () => void;
  onSave: (data: Partial<QualifiedPerson>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    full_name: "", profession: "", registration_body: "", license_no: "",
    competency_areas: "", bio: "",
  });
  const [saving, setSaving] = useState(false);

  // reset when opened
  useMemo(() => {
    if (open) {
      setForm({
        full_name: editing?.full_name ?? "",
        profession: editing?.profession ?? "",
        registration_body: editing?.registration_body ?? "",
        license_no: editing?.license_no ?? "",
        competency_areas: (editing?.competency_areas ?? []).join(", "),
        bio: editing?.bio ?? "",
      });
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {editing ? "Editar QP" : "Registrar Persona Calificada (QP)"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Profesión *</Label>
              <Input placeholder="Geólogo / Mining Eng." value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">N° licencia *</Label>
              <Input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Colegio / Asociación *</Label>
            <Input placeholder="AusIMM · CIM · Colegio de Geólogos de Chile" value={form.registration_body} onChange={(e) => setForm({ ...form, registration_body: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Áreas de competencia (separadas por coma)</Label>
            <Input placeholder="exploración, recursos, QA/QC" value={form.competency_areas} onChange={(e) => setForm({ ...form, competency_areas: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Bio / experiencia</Label>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || !form.full_name || !form.profession || !form.license_no || !form.registration_body}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  full_name: form.full_name,
                  profession: form.profession,
                  registration_body: form.registration_body,
                  license_no: form.license_no,
                  competency_areas: form.competency_areas.split(",").map((s) => s.trim()).filter(Boolean),
                  bio: form.bio || null,
                });
              } finally { setSaving(false); }
            }}
          >
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({
  open, qps, onClose, onSave,
}: {
  open: boolean;
  qps: QualifiedPerson[];
  onClose: () => void;
  onSave: (data: { title: string; report_type: string; lead_qp_id: string | null; effective_date: string | null; summary: string | null }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "", report_type: "ni43101", lead_qp_id: "", effective_date: "", summary: "",
  });
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) setForm({ title: "", report_type: "ni43101", lead_qp_id: "", effective_date: "", summary: "" });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Nuevo reporte técnico</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.report_type} onValueChange={(v) => setForm({ ...form, report_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ni43101">NI 43-101</SelectItem>
                  <SelectItem value="jorc">JORC</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Fecha vigente</Label>
              <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Lead QP</Label>
            <Select value={form.lead_qp_id || "__none"} onValueChange={(v) => setForm({ ...form, lead_qp_id: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sin Lead QP —</SelectItem>
                {qps.map((q) => <SelectItem key={q.id} value={q.id}>{q.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Resumen</Label>
            <Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || !form.title}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  title: form.title,
                  report_type: form.report_type,
                  lead_qp_id: form.lead_qp_id || null,
                  effective_date: form.effective_date || null,
                  summary: form.summary || null,
                });
              } finally { setSaving(false); }
            }}
          >
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
