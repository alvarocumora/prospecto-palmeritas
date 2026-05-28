// Modal IA — Target Explainer (Gemini 2.5 Pro vía Lovable AI Gateway)
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, ArrowRight, X } from "lucide-react";
import { explainLosVerdesTarget, type TargetExplanation } from "@/lib/losverdes-ai.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TargetExplainerDialog({
  open,
  targetCode,
  targetName,
  onClose,
}: {
  open: boolean;
  targetCode: string | null;
  targetName: string | null;
  onClose: () => void;
}) {
  const explainFn = useServerFn(explainLosVerdesTarget);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    explanation: TargetExplanation;
    cached: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open || !targetCode) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    explainFn({ data: { targetCode } })
      .then((res) => {
        if (!cancelled) setData({ explanation: res.explanation, cached: res.cached });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error generando explicación");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetCode, explainFn]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 backdrop-blur px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Target Explainer · Gemini 2.5 Pro
              </div>
              <div className="font-semibold truncate">
                {targetCode ?? "—"} {targetName ? `· ${targetName}` : ""}
              </div>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <div className="text-sm">Analizando target con IA…</div>
              <div className="text-xs">Geología + satelital + estructural</div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {data && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Confianza {Math.round(data.explanation.confianza_pct)}%
                </Badge>
                {data.cached && (
                  <Badge variant="outline" className="border-muted-foreground/30">
                    cache
                  </Badge>
                )}
              </div>

              <Section title="Resumen">
                <p className="text-sm leading-relaxed">{data.explanation.resumen}</p>
              </Section>

              <div className="grid gap-3 md:grid-cols-2">
                <Section title="Hipótesis geológica" tone="primary">
                  <p className="text-sm leading-relaxed">{data.explanation.hipotesis_geologica}</p>
                </Section>
                <Section title="Evidencia satelital" tone="accent">
                  <p className="text-sm leading-relaxed">{data.explanation.evidencia_satelital}</p>
                </Section>
              </div>

              <Section title="Contexto estructural">
                <p className="text-sm leading-relaxed">{data.explanation.contexto_estructural}</p>
              </Section>

              <div className="grid gap-3 md:grid-cols-2">
                <BulletList
                  title="Fortalezas"
                  items={data.explanation.fortalezas}
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                />
                <BulletList
                  title="Riesgos"
                  items={data.explanation.riesgos}
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                />
              </div>

              <BulletList
                title="Próximos pasos recomendados"
                items={data.explanation.proximos_pasos}
                icon={<ArrowRight className="h-3.5 w-3.5 text-primary" />}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "primary" | "accent";
  children: React.ReactNode;
}) {
  const border =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "accent"
        ? "border-accent/30 bg-accent/5"
        : "border-border bg-muted/30";
  return (
    <div className={`rounded-lg border ${border} p-3`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function BulletList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug">
            <span className="mt-1 shrink-0">{icon}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
