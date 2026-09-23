// Panel de Due Diligence / GeoScore por proyecto (Fase C).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Gauge } from "lucide-react";
import { getProjectDueDiligence } from "@/lib/dueDiligence.functions";

const GRADE_HINT: Record<string, string> = {
  A: "Listo para due diligence institucional",
  B: "Transaccionable con brechas acotadas",
  C: "Requiere completar evidencia técnica",
  D: "Etapa temprana — expediente incompleto",
};

export function DueDiligencePanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(getProjectDueDiligence);
  const { data, isLoading } = useQuery({
    queryKey: ["project-dd", projectId],
    queryFn: () => fn({ data: { projectId } }),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <div className="mt-4 rounded border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          Due diligence & GeoScore
        </span>
        <span className="flex items-center gap-2">
          {data && (
            <span className="text-xs font-mono tabular-nums">
              {data.geoScore}/100 · {data.grade}
            </span>
          )}
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-3 space-y-4">
          {isLoading && <div className="text-xs text-muted-foreground">Evaluando expediente…</div>}
          {data && (
            <>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold tabular-nums">{data.geoScore}</div>
                <div>
                  <div className="text-sm font-semibold">GeoScore {data.grade}</div>
                  <div className="text-xs text-muted-foreground">{GRADE_HINT[data.grade]}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {data.dimensions.map((d) => (
                  <div key={d.key} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>{d.label}</span>
                      <span className="tabular-nums text-muted-foreground">{d.score}%</span>
                    </div>
                    <div className="mt-2 h-1 w-full rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${d.score}%` }} />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {d.items.map((i) => (
                        <li key={i.key} className="flex items-start gap-2 text-[11px]">
                          {i.ok ? (
                            <CheckCircle2 className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                          ) : (
                            <Circle className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                          )}
                          <span className={i.ok ? "text-muted-foreground" : ""}>
                            {i.label}: <span className="font-mono">{i.value}</span>
                            {!i.ok && <span className="text-muted-foreground"> — {i.hint}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {data.gaps.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">
                    Próximos pasos prioritarios
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground">
                    {data.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
