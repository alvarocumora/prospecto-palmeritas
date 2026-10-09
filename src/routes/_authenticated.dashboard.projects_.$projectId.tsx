import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, TrendingUp, Lock, Globe, Share2, Copy } from "lucide-react";
import {
  getProjectFundraise,
  upsertProjectFundraise,
  generateFundraiseShareLink,
} from "@/lib/fundraise.functions";
import { projectSheetUrl } from "@/lib/publicUrl";
import {
  FUNDRAISE_INSTRUMENTS,
  FUNDRAISE_INSTRUMENT_LABELS,
  FUNDRAISE_STATUSES,
  FUNDRAISE_STATUS_LABELS,
  totalAllocationPct,
  impliedPostMoneyUsd,
  type FundraiseData,
  type FundraiseInstrument,
  type FundraiseStatus,
} from "@/lib/fundraise";
import { VerificationBadge } from "@/components/brand/VerificationBadge";
import { projectVerification } from "@/lib/verification";
import { ProjectFactSheet } from "@/features/projects/ProjectFactSheet";
import { ProjectConcessions } from "@/features/projects/ProjectConcessions";

export const Route = createFileRoute("/_authenticated/dashboard/projects_/$projectId")({
  head: () => ({ meta: [{ title: "Proyecto — Geocapitals" }] }),
  component: ProjectDetailPage,
});

const usd = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}` : "—";
const toStr = (n: number | null) => (n == null ? "" : String(n));
const toNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const EMPTY: FundraiseData = {
  roundSizeUsd: null,
  minTicketUsd: null,
  instrument: null,
  equityOfferedPct: null,
  horizonYears: null,
  valuationLowUsd: null,
  valuationHighUsd: null,
  valuationMethod: null,
  financingStructure: null,
  useOfFunds: [],
  milestones: [],
  scenarios: [],
  highlights: [],
  notes: null,
  status: "draft",
  isPublic: false,
};

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const getFn = useServerFn(getProjectFundraise);
  const saveFn = useServerFn(upsertProjectFundraise);
  const shareFn = useServerFn(generateFundraiseShareLink);
  const qc = useQueryClient();
  const [shareLink, setShareLink] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["project-fundraise", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    staleTime: 30_000,
  });

  const [form, setForm] = useState<FundraiseData>(EMPTY);
  useEffect(() => {
    if (data?.fundraise) setForm(data.fundraise);
    else if (data && !data.fundraise) setForm(EMPTY);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          projectId,
          roundSizeUsd: form.roundSizeUsd,
          minTicketUsd: form.minTicketUsd,
          instrument: form.instrument,
          equityOfferedPct: form.equityOfferedPct,
          horizonYears: form.horizonYears,
          valuationLowUsd: form.valuationLowUsd,
          valuationHighUsd: form.valuationHighUsd,
          valuationMethod: form.valuationMethod,
          financingStructure: form.financingStructure,
          useOfFunds: form.useOfFunds,
          milestones: form.milestones,
          highlights: form.highlights,
          notes: form.notes,
          status: form.status,
          isPublic: form.isPublic,
        },
      }),
    onSuccess: () => {
      toast.success("Levantamiento guardado.");
      void qc.invalidateQueries({ queryKey: ["project-fundraise", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar."),
  });

  const share = useMutation({
    mutationFn: () => shareFn({ data: { projectId } }),
    onSuccess: async (res) => {
      const url = projectSheetUrl(res.token);
      setShareLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Ficha pública lista. Link copiado.");
      void qc.invalidateQueries({ queryKey: ["project-fundraise", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo publicar."),
  });

  if (isLoading) return <div className="p-6 max-w-4xl h-40 rounded bg-muted/20 animate-pulse" />;
  if (!data) {
    return (
      <div className="p-6 max-w-4xl text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Proyecto no encontrado</h1>
        <Link to="/dashboard/projects" className="text-primary underline text-sm">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  const p = data.project;
  const canEdit = data.canEdit;
  const totalPct = totalAllocationPct(form.useOfFunds);
  const postMoney = impliedPostMoneyUsd(form.roundSizeUsd, form.equityOfferedPct);
  const set = <K extends keyof FundraiseData>(k: K, v: FundraiseData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <Link
        to="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Proyectos
      </Link>

      <Link
        to="/projects/$projectId/$section"
        params={{ projectId, section: "overview" }}
        search={{ project: undefined }}
        className="inline-flex items-center text-xs text-primary hover:underline"
      >
        Mapa & exploración del proyecto →
      </Link>

      {/* Cabecera del proyecto */}
      <div className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{p.name}</h1>
              <VerificationBadge level={projectVerification(p.id)} compact />
            </div>
            <div className="text-sm text-text-secondary mt-1">
              <span className="font-mono">{p.code}</span>
              {p.commodity ? ` · ${p.commodity}` : ""}
              {p.region ? ` · ${p.region}` : ""}
              {p.country ? ` · ${p.country}` : ""}
            </div>
          </div>
          {!canEdit && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" /> Solo lectura
            </span>
          )}
        </div>
      </div>

      {data.pending && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          El módulo de financiamiento estará disponible cuando se aplique la migración{" "}
          <code>project_fundraises</code>.
        </div>
      )}

      {/* Levantamiento de capital */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Levantamiento de capital</h2>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {form.isPublic ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Globe className="w-3 h-3" /> Pública
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Lock className="w-3 h-3" /> Privada
              </span>
            )}
            <span className="font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {FUNDRAISE_STATUS_LABELS[form.status]}
            </span>
          </div>
        </div>

        {/* Métricas derivadas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Monto a levantar" value={usd(form.roundSizeUsd)} />
          <Metric label="Ticket mínimo" value={usd(form.minTicketUsd)} />
          <Metric
            label="% ofrecido"
            value={form.equityOfferedPct != null ? `${form.equityOfferedPct}%` : "—"}
          />
          <Metric label="Valorización post-money impl." value={usd(postMoney)} />
        </div>

        {/* Campos escalares */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <NumField
            label="Monto a levantar (US$)"
            value={toStr(form.roundSizeUsd)}
            onChange={(v) => set("roundSizeUsd", toNum(v))}
            disabled={!canEdit}
          />
          <NumField
            label="Ticket mínimo (US$)"
            value={toStr(form.minTicketUsd)}
            onChange={(v) => set("minTicketUsd", toNum(v))}
            disabled={!canEdit}
          />
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Instrumento</span>
            <select
              value={form.instrument ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                set("instrument", (e.target.value || null) as FundraiseInstrument | null)
              }
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
            >
              <option value="">—</option>
              {FUNDRAISE_INSTRUMENTS.map((i) => (
                <option key={i} value={i}>
                  {FUNDRAISE_INSTRUMENT_LABELS[i]}
                </option>
              ))}
            </select>
          </label>
          <NumField
            label="% de la sociedad ofrecido"
            value={toStr(form.equityOfferedPct)}
            onChange={(v) => set("equityOfferedPct", toNum(v))}
            disabled={!canEdit}
          />
          <NumField
            label="Horizonte (años)"
            value={toStr(form.horizonYears)}
            onChange={(v) => set("horizonYears", toNum(v))}
            disabled={!canEdit}
          />
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1">Estado</span>
            <select
              value={form.status}
              disabled={!canEdit}
              onChange={(e) => set("status", e.target.value as FundraiseStatus)}
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
            >
              {FUNDRAISE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FUNDRAISE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <NumField
            label="Valorización mín. (US$)"
            value={toStr(form.valuationLowUsd)}
            onChange={(v) => set("valuationLowUsd", toNum(v))}
            disabled={!canEdit}
          />
          <NumField
            label="Valorización máx. (US$)"
            value={toStr(form.valuationHighUsd)}
            onChange={(v) => set("valuationHighUsd", toNum(v))}
            disabled={!canEdit}
          />
          <TextField
            label="Método de valorización"
            value={form.valuationMethod ?? ""}
            onChange={(v) => set("valuationMethod", v || null)}
            disabled={!canEdit}
          />
        </div>

        {/* Estructura de financiamiento */}
        <label className="text-xs block">
          <span className="block text-muted-foreground mb-1">
            Estructura de financiamiento (opción, hitos, regalía NSR, SPV…)
          </span>
          <textarea
            value={form.financingStructure ?? ""}
            disabled={!canEdit}
            rows={3}
            onChange={(e) => set("financingStructure", e.target.value || null)}
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
          />
        </label>

        {/* Uso de fondos */}
        <RepeatList
          title="Uso de fondos"
          canEdit={canEdit}
          suffix={
            <span
              className={`text-[11px] font-mono ${totalPct > 100 ? "text-red-600" : "text-muted-foreground"}`}
            >
              Total {totalPct}%
            </span>
          }
          rows={form.useOfFunds}
          onAdd={() => set("useOfFunds", [...form.useOfFunds, { label: "", pct: 0 }])}
          onRemove={(i) =>
            set(
              "useOfFunds",
              form.useOfFunds.filter((_, j) => j !== i),
            )
          }
          render={(row, i) => (
            <>
              <input
                value={row.label}
                disabled={!canEdit}
                placeholder="Ej. Sondaje"
                onChange={(e) =>
                  set(
                    "useOfFunds",
                    form.useOfFunds.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                  )
                }
                className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
              />
              <input
                value={toStr(row.pct)}
                disabled={!canEdit}
                placeholder="%"
                onChange={(e) =>
                  set(
                    "useOfFunds",
                    form.useOfFunds.map((r, j) =>
                      j === i ? { ...r, pct: toNum(e.target.value) ?? 0 } : r,
                    ),
                  )
                }
                className="w-20 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
              />
            </>
          )}
        />

        {/* Hitos */}
        <RepeatList
          title="Hitos"
          canEdit={canEdit}
          rows={form.milestones}
          onAdd={() => set("milestones", [...form.milestones, { when: "", what: "" }])}
          onRemove={(i) =>
            set(
              "milestones",
              form.milestones.filter((_, j) => j !== i),
            )
          }
          render={(row, i) => (
            <>
              <input
                value={row.when}
                disabled={!canEdit}
                placeholder="Ej. M6"
                onChange={(e) =>
                  set(
                    "milestones",
                    form.milestones.map((r, j) => (j === i ? { ...r, when: e.target.value } : r)),
                  )
                }
                className="w-24 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
              />
              <input
                value={row.what}
                disabled={!canEdit}
                placeholder="Qué se logra"
                onChange={(e) =>
                  set(
                    "milestones",
                    form.milestones.map((r, j) => (j === i ? { ...r, what: e.target.value } : r)),
                  )
                }
                className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
              />
            </>
          )}
        />

        {/* Highlights */}
        <RepeatList
          title="Highlights"
          canEdit={canEdit}
          rows={form.highlights}
          onAdd={() => set("highlights", [...form.highlights, ""])}
          onRemove={(i) =>
            set(
              "highlights",
              form.highlights.filter((_, j) => j !== i),
            )
          }
          render={(row, i) => (
            <input
              value={row}
              disabled={!canEdit}
              placeholder="Ej. Oro aluvial libre, gravimétrico"
              onChange={(e) =>
                set(
                  "highlights",
                  form.highlights.map((r, j) => (j === i ? e.target.value : r)),
                )
              }
              className="flex-1 px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
            />
          )}
        />

        {canEdit && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => set("isPublic", e.target.checked)}
                />
                Ficha pública
              </label>
              <button
                onClick={() => share.mutate()}
                disabled={share.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-primary/40 text-primary text-sm hover:bg-primary/10 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                {share.isPending ? "Publicando…" : "Compartir ficha pública"}
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || totalPct > 100}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {save.isPending ? "Guardando…" : "Guardar levantamiento"}
              </button>
            </div>
            {shareLink && (
              <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 p-2">
                <code className="text-[11px] font-mono break-all flex-1">{shareLink}</code>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(shareLink);
                    toast.success("Copiado");
                  }}
                  className="shrink-0 p-1 rounded border border-border hover:bg-accent"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Publicar genera un link de solo lectura con los términos de la ronda. Guarda primero
              los cambios; requiere monto, ticket e instrumento.
            </p>
          </div>
        )}
      </section>

      {/* Catastro: concesiones, superficie, matrículas y polígono */}
      <ProjectConcessions projectId={projectId} />

      {/* Ficha de datos con procedencia (CERTIFICADO / DECLARADO / A_VERIFICAR) */}
      <ProjectFactSheet projectId={projectId} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background p-2.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-mono font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="block text-muted-foreground mb-1">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="block text-muted-foreground mb-1">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm disabled:opacity-60"
      />
    </label>
  );
}

function RepeatList<T>({
  title,
  rows,
  canEdit,
  onAdd,
  onRemove,
  render,
  suffix,
}: {
  title: string;
  rows: T[];
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (row: T, i: number) => React.ReactNode;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {suffix}
          {canEdit && (
            <button
              onClick={onAdd}
              className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar
            </button>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">Sin datos.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              {render(row, i)}
              {canEdit && (
                <button
                  onClick={() => onRemove(i)}
                  className="shrink-0 p-1.5 rounded border border-border hover:bg-accent"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
