// Checklist de compliance de la operación (Trades) conectado a los RPC del
// backend: `trade_documents_checklist` y `trade_documents_readiness`. Reusa el
// catálogo REICON (operation_document_structure) sobre el sistema cableado al
// menú (commodity_trades / trade_documents).
//
// Uso:
// - Dashboard interno: `<TradeComplianceChecklist tradeId={id} />` (solo lectura).
// - War Room pública: pasa `onUpload(doc_kind, file)` y el usuario externo puede
//   completar el checklist item por item; el `doc_kind` se envía tal cual como
//   `docType` de trade_documents (vocabulario canónico).

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock, AlertTriangle, Lock, Upload, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ChecklistRow = {
  section_no: number;
  section: string;
  doc_kind: string;
  title: string;
  description: string | null;
  obligation: "mandatory" | "conditional" | "if_available";
  condition: string | null;
  required_from_role: "buyer" | "seller" | "geocapitals";
  sequence: number;
  status: "falta" | "subido" | "aprobado" | "observado" | "firmado";
  document_id: string | null;
  uploaded_at: string | null;
};

type Readiness = {
  mandatory_total: number;
  mandatory_ok: number;
  mandatory_missing: number;
  optional_total: number;
  ready: boolean;
};

const STATUS_STYLE: Record<ChecklistRow["status"], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  falta: { label: "Falta", cls: "border-neutral-300 bg-white text-neutral-500", Icon: Circle },
  subido: { label: "Subido", cls: "border-blue-300 bg-blue-50 text-blue-700", Icon: Clock },
  aprobado: { label: "Aprobado", cls: "border-emerald-400 bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
  observado: { label: "Observado", cls: "border-amber-400 bg-amber-50 text-amber-800", Icon: AlertTriangle },
  firmado: { label: "Firmado", cls: "border-neutral-800 bg-neutral-900 text-white", Icon: Lock },
};

const OBLIGATION_LABEL: Record<ChecklistRow["obligation"], string> = {
  mandatory: "Obligatorio",
  conditional: "Condicional",
  if_available: "Si disponible",
};

const ROLE_LABEL: Record<ChecklistRow["required_from_role"], string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  geocapitals: "Geocapitals",
};

export type ComplianceFetchResult = { rows: ChecklistRow[]; readiness: Readiness | null };

export function TradeComplianceChecklist({
  tradeId,
  fetcher,
  queryKey,
  onUpload,
  title = "Documentos · Compliance",
}: {
  /** Modo autenticado: consulta directa por RPC con RLS del usuario. */
  tradeId?: string;
  /** Modo público (por token): fetch resuelto server-side. Ignora tradeId. */
  fetcher?: () => Promise<ComplianceFetchResult>;
  queryKey?: readonly unknown[];
  onUpload?: (docKind: string, file: File) => Promise<void>;
  title?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const usingFetcher = typeof fetcher === "function";
  const key = queryKey ?? (usingFetcher ? ["trade-checklist-public"] : ["trade-checklist", tradeId]);

  const dataQ = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ComplianceFetchResult> => {
      if (usingFetcher) return await fetcher!();
      const [c, r] = await Promise.all([
        supabase.rpc("trade_documents_checklist", { p_trade_id: tradeId }),
        supabase.rpc("trade_documents_readiness", { p_trade_id: tradeId }),
      ]);
      if (c.error) throw new Error(c.error.message);
      if (r.error) throw new Error(r.error.message);
      const readinessRow = Array.isArray(r.data) ? r.data[0] : r.data;
      return {
        rows: (c.data ?? []) as ChecklistRow[],
        readiness: (readinessRow ?? null) as Readiness | null,
      };
    },
    enabled: usingFetcher || !!tradeId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const checklistQ = { data: dataQ.data?.rows, isLoading: dataQ.isLoading, error: dataQ.error, refetch: dataQ.refetch };
  const readinessQ = { data: dataQ.data?.readiness ?? null, refetch: dataQ.refetch };


  const groups = useMemo(() => {
    const rows = checklistQ.data ?? [];
    const bySection = new Map<number, { section: string; items: ChecklistRow[] }>();
    for (const r of rows) {
      const g = bySection.get(r.section_no) ?? { section: r.section, items: [] };
      g.items.push(r);
      bySection.set(r.section_no, g);
    }
    return Array.from(bySection.entries())
      .sort(([a], [b]) => a - b)
      .map(([n, g]) => ({ n, section: g.section, items: g.items.sort((x, y) => x.sequence - y.sequence) }));
  }, [checklistQ.data]);

  const r = readinessQ.data;
  const pct = r && r.mandatory_total > 0 ? Math.round((r.mandatory_ok / r.mandatory_total) * 100) : 0;

  const handleFile = async (docKind: string, file: File | null | undefined) => {
    if (!file || !onUpload) return;
    setBusy(docKind);
    try {
      await onUpload(docKind, file);
      await Promise.all([checklistQ.refetch(), readinessQ.refetch()]);
    } finally {
      setBusy(null);
    }
  };

  if (checklistQ.isLoading) {
    return (
      <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] p-4 text-sm text-muted-foreground">
        Cargando checklist de compliance…
      </div>
    );
  }

  if (checklistQ.error) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        No se pudo cargar el checklist ({(checklistQ.error as Error).message}). Verifica que las migraciones del catálogo REICON estén aplicadas.
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[hsl(var(--im-hairline,var(--border)))] p-4 text-sm text-muted-foreground">
        No hay estructura de documentos definida para este commodity todavía.
      </div>
    );
  }

  return (
    <section className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl">{title}</h2>
          <p className="text-xs text-muted-foreground">
            Catálogo REICON aplicado por commodity. Los ítems obligatorios habilitan la evaluación comercial.
          </p>
        </div>
        {r && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Obligatorios
            </div>
            <div className="text-sm font-mono font-semibold">
              {r.mandatory_ok}/{r.mandatory_total}
            </div>
          </div>
        )}
      </header>

      {r && (
        <div>
          <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className={r.ready ? "h-full bg-emerald-600" : "h-full bg-amber-500"}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {r.ready ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> Lista para evaluación comercial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-amber-800">
                <AlertTriangle className="w-3 h-3" /> Faltan {r.mandatory_missing} documento(s) obligatorio(s)
              </span>
            )}
            <span className="text-muted-foreground">
              · Opcionales: {r.optional_total}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.n}>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-[hsl(var(--im-hairline,var(--border)))] pb-1 mb-2">
              {g.n}. {g.section}
            </h3>
            <ul className="divide-y divide-[hsl(var(--im-hairline,var(--border)))]">
              {g.items.map((it) => {
                const style = STATUS_STYLE[it.status];
                const { Icon } = style;
                return (
                  <li key={it.doc_kind} className="py-2 flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{it.title}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${style.cls}`}
                        >
                          <Icon className="w-3 h-3" />
                          {style.label}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            it.obligation === "mandatory"
                              ? "bg-neutral-900 text-white"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {OBLIGATION_LABEL[it.obligation]}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          · {ROLE_LABEL[it.required_from_role]}
                        </span>
                      </div>
                      {(it.description || it.condition) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {it.description}
                          {it.condition ? ` (aplica si: ${it.condition})` : ""}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                        {it.doc_kind}
                      </p>
                    </div>
                    {onUpload && it.status !== "firmado" && (
                      <label
                        className={`shrink-0 text-xs px-3 py-1.5 rounded border border-[hsl(var(--im-hairline,var(--border)))] cursor-pointer hover:bg-neutral-50 inline-flex items-center gap-1 ${
                          busy === it.doc_kind ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        {busy === it.doc_kind ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        {busy === it.doc_kind ? "Subiendo…" : it.status === "falta" ? "Subir" : "Reemplazar"}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            void handleFile(it.doc_kind, f);
                          }}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
