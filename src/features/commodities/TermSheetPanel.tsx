import { useEffect, useState } from "react";
import { Loader2, Copy, Check, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { draftTermSheet, type TermSheetDraft } from "@/lib/termSheet.functions";

/** Borrador de term sheet generado para una consulta (solo vendedor). */
export function TermSheetPanel({ inquiryId }: { inquiryId: string }) {
  const [draft, setDraft] = useState<TermSheetDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    draftTermSheet({ data: { inquiryId } })
      .then((d) => alive && setDraft(d))
      .catch(() => alive && toast.error("No se pudo generar el term sheet"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [inquiryId]);

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.markdown);
      setCopied(true);
      toast.success("Term sheet copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) {
    return (
      <div className="mt-2 rounded border border-border p-3 flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Generando term sheet…
      </div>
    );
  }
  if (!draft) return null;

  return (
    <div className="mt-2 rounded border border-gold/30 bg-gold/5 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-gold">
          <FileText className="w-3.5 h-3.5" /> Term sheet · {draft.termSheet.ref}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-mono hover:border-gold"
        >
          {copied ? <Check className="w-3 h-3 text-teal" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copiado" : "Copiar Markdown"}
        </button>
      </div>

      {draft.aiSummary && (
        <div className="mb-2 flex items-start gap-1.5 text-[11px] text-foreground/80">
          <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-gold" />
          <span>{draft.aiSummary}</span>
        </div>
      )}

      <div className="space-y-2">
        {draft.termSheet.sections.map((s) => (
          <div key={s.heading}>
            <div className="text-[10px] font-mono font-semibold text-foreground">{s.heading}</div>
            <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {s.fields.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-[10px] font-mono text-muted-foreground">{f.label}</dt>
                  <dd className="text-[10px] text-foreground/90">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-0.5">
        {draft.termSheet.notes.map((n, i) => (
          <p key={i} className="text-[9px] font-mono text-muted-foreground italic">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}
