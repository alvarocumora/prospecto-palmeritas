// Renderiza una sección con narrativa IA: párrafos, bullets, tablas, warnings.
import type { SectionNarrative } from "../ai/generateNarrative.functions";
import { AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  sectionNumber: string;
  narrative: SectionNarrative | null;
  loading: boolean;
  preliminary: boolean;
  onRegenerate?: () => void;
  cached?: boolean;
  fallbackTitle: string;
};

export function SectionRenderer({
  sectionNumber, narrative, loading, preliminary, onRegenerate, cached, fallbackTitle,
}: Props) {
  return (
    <section className="space-y-4 scroll-mt-20" id={`sec-${sectionNumber}`}>
      <header className="flex items-start justify-between gap-3 border-b border-border pb-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            <span className="text-muted-foreground mr-2">§{sectionNumber}</span>
            {narrative?.title ?? fallbackTitle}
          </h2>
          {preliminary && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Modelo preliminar generado por IA — requiere validación QP
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cached && !loading && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" /> caché
            </span>
          )}
          {onRegenerate && (
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </header>

      {loading && !narrative && (
        <div className="space-y-2">
          <div className="h-4 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 bg-muted/50 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-muted/50 rounded animate-pulse w-4/6" />
        </div>
      )}

      {narrative && (
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          {narrative.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {narrative.bullets && narrative.bullets.length > 0 && (
            <ul className="list-disc pl-5 space-y-1">
              {narrative.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {narrative.tables?.map((t, ti) => (
            <div key={ti} className="overflow-x-auto rounded-md border border-border">
              {t.caption && <div className="px-3 py-1.5 text-xs font-medium bg-muted/40 border-b border-border">{t.caption}</div>}
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    {t.headers.map((h, hi) => (
                      <th key={hi} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-border">
                      {row.map((c, ci) => <td key={ci} className="px-3 py-1.5">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {narrative.warnings && narrative.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-1">
              {narrative.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
