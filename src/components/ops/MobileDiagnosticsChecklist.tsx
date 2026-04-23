// Floating mobile-only diagnostics checklist.
// Walks the user through Home → Catastro → Mapa → Targets → Sampling,
// logs active-project state and any captured runtime/chunk errors so we can
// pinpoint exactly where mobile navigation breaks.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Activity, CheckCircle2, ChevronDown, ChevronUp, Circle, RefreshCw, Trash2, X, AlertTriangle } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "ok" | "fail";

type Step = {
  id: string;
  label: string;
  to: "/dashboard" | "/dashboard/catastro" | "/dashboard/map" | "/dashboard/targets" | "/dashboard/sampling";
  matchPrefix?: boolean;
};

type LogEntry = {
  ts: number;
  level: "info" | "warn" | "error";
  msg: string;
  meta?: Record<string, unknown>;
};

const STEPS: Step[] = [
  { id: "home", label: "Home (Mission Control)", to: "/dashboard" },
  { id: "catastro", label: "Catastro minero", to: "/dashboard/catastro", matchPrefix: true },
  { id: "map", label: "Mapa operacional", to: "/dashboard/map", matchPrefix: true },
  { id: "targets", label: "Targets", to: "/dashboard/targets", matchPrefix: true },
  { id: "sampling", label: "Sampling", to: "/dashboard/sampling", matchPrefix: true },
];

const STORAGE_KEY = "geocapitals:mobile-diag";

type PersistedState = {
  results: Record<string, StepStatus>;
  log: LogEntry[];
  open: boolean;
};

function loadPersisted(): PersistedState {
  if (typeof window === "undefined") return { results: {}, log: [], open: false };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { results: {}, log: [], open: false };
    return JSON.parse(raw) as PersistedState;
  } catch {
    return { results: {}, log: [], open: false };
  }
}

function persist(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function MobileDiagnosticsChecklist() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { active, projects, loading: projectsLoading } = useProjects();

  const initial = useRef<PersistedState>(loadPersisted());
  const [open, setOpen] = useState<boolean>(initial.current.open);
  const [collapsed, setCollapsed] = useState(false);
  const [results, setResults] = useState<Record<string, StepStatus>>(initial.current.results);
  const [log, setLog] = useState<LogEntry[]>(initial.current.log);
  const [tab, setTab] = useState<"steps" | "log">("steps");

  // Persist whenever state changes.
  useEffect(() => {
    persist({ results, log, open });
  }, [results, log, open]);

  const append = useCallback((entry: Omit<LogEntry, "ts">) => {
    setLog((prev) => {
      const next = [...prev, { ...entry, ts: Date.now() }];
      // Cap log to last 80 entries to keep storage small.
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  // Capture global errors from the window so we can correlate with steps.
  useEffect(() => {
    if (!open) return;
    const onError = (ev: ErrorEvent) => {
      const msg = String(ev.message || ev.error?.message || "unknown error");
      const isChunk =
        msg.toLowerCase().includes("importing a module script failed") ||
        msg.toLowerCase().includes("loading chunk") ||
        msg.toLowerCase().includes("failed to fetch dynamically imported module");
      append({
        level: "error",
        msg: isChunk ? `Chunk/módulo: ${msg}` : msg,
        meta: { path: location.pathname, source: ev.filename ?? null },
      });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      const msg = typeof reason === "string" ? reason : reason?.message ?? JSON.stringify(reason);
      append({ level: "error", msg: `Promise: ${msg}`, meta: { path: location.pathname } });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [open, append, location.pathname]);

  // Log route + project context whenever the user navigates while open.
  const lastSnapshotRef = useRef<string>("");
  useEffect(() => {
    if (!open) return;
    const snapshot = JSON.stringify({
      path: location.pathname,
      authLoading,
      projectsLoading,
      hasUser: !!user,
      projectCount: projects.length,
      activeId: active?.id ?? null,
      activeCode: active?.code ?? null,
    });
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;
    append({
      level: "info",
      msg: `Ruta: ${location.pathname}`,
      meta: {
        authLoading,
        projectsLoading,
        hasUser: !!user,
        projectCount: projects.length,
        activeId: active?.id ?? null,
        activeCode: active?.code ?? null,
      },
    });
  }, [open, location.pathname, authLoading, projectsLoading, user, projects.length, active?.id, active?.code, append]);

  // Auto-mark step as OK when the user reaches its route without errors in the
  // last 1.5s window (errors are captured by the global handler).
  const recentErrorAtRef = useRef<number>(0);
  useEffect(() => {
    if (!open) return;
    const lastError = log[log.length - 1];
    if (lastError?.level === "error") {
      recentErrorAtRef.current = lastError.ts;
    }
  }, [log, open]);

  useEffect(() => {
    if (!open) return;
    const step = STEPS.find((s) =>
      s.matchPrefix
        ? location.pathname === s.to || location.pathname.startsWith(s.to + "/")
        : location.pathname === s.to,
    );
    if (!step) return;
    const t = window.setTimeout(() => {
      const errored = Date.now() - recentErrorAtRef.current < 1500;
      setResults((prev) => {
        if (prev[step.id] === "fail") return prev; // keep failures sticky
        return { ...prev, [step.id]: errored ? "fail" : "ok" };
      });
      append({
        level: errored ? "warn" : "info",
        msg: `Paso «${step.label}» marcado ${errored ? "FAIL" : "OK"}`,
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [open, location.pathname, append]);

  const stats = useMemo(() => {
    const ok = Object.values(results).filter((s) => s === "ok").length;
    const fail = Object.values(results).filter((s) => s === "fail").length;
    return { ok, fail, total: STEPS.length };
  }, [results]);

  const reset = () => {
    setResults({});
    setLog([]);
    append({ level: "info", msg: "Checklist reiniciado" });
  };

  const markFail = (id: string) => {
    setResults((p) => ({ ...p, [id]: "fail" }));
    append({ level: "warn", msg: `Paso «${id}» marcado FAIL manualmente` });
  };

  // Floating launcher (mobile only).
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed left-3 z-[60] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-border bg-bg-panel/95 backdrop-blur text-[11px] font-mono text-foreground shadow-md active:scale-95"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.25rem)" }}
        title="Diagnóstico móvil"
        aria-label="Abrir diagnóstico móvil"
      >
        <Activity className="w-3.5 h-3.5 text-signal-cyan" />
        Diag {stats.ok}/{stats.total}
        {stats.fail > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-signal-red">
            <AlertTriangle className="w-3 h-3" />
            {stats.fail}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      className="md:hidden fixed left-2 right-2 z-[60] rounded-md border border-border bg-bg-panel/95 backdrop-blur shadow-xl flex flex-col"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 4rem)",
        maxHeight: "60dvh",
      }}
      role="dialog"
      aria-label="Diagnóstico móvil"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border">
        <Activity className="w-3.5 h-3.5 text-signal-cyan shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-mono uppercase tracking-wider text-foreground truncate">
            Diagnóstico móvil
          </div>
          <div className="text-[10px] font-mono text-text-dim truncate">
            {stats.ok}/{stats.total} ok
            {stats.fail > 0 ? ` · ${stats.fail} fail` : ""} · proyecto:{" "}
            {active ? `${active.code}` : projectsLoading ? "cargando…" : "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 text-text-dim hover:text-foreground"
          aria-label={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={reset}
          className="p-1 text-text-dim hover:text-signal-amber"
          aria-label="Reiniciar"
          title="Reiniciar checklist y log"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 text-text-dim hover:text-signal-red"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-border text-[10px] font-mono uppercase">
            <button
              type="button"
              onClick={() => setTab("steps")}
              className={cn(
                "flex-1 px-2 py-1.5 transition-colors",
                tab === "steps" ? "bg-bg-elevated text-signal-cyan" : "text-text-dim hover:text-foreground",
              )}
            >
              Pasos
            </button>
            <button
              type="button"
              onClick={() => setTab("log")}
              className={cn(
                "flex-1 px-2 py-1.5 transition-colors border-l border-border",
                tab === "log" ? "bg-bg-elevated text-signal-cyan" : "text-text-dim hover:text-foreground",
              )}
            >
              Log ({log.length})
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: "44dvh" }}>
            {tab === "steps" ? (
              <ul className="space-y-1">
                {STEPS.map((s, idx) => {
                  const status = results[s.id] ?? "pending";
                  const Icon =
                    status === "ok" ? CheckCircle2 : status === "fail" ? AlertTriangle : Circle;
                  const color =
                    status === "ok"
                      ? "text-signal-cyan"
                      : status === "fail"
                        ? "text-signal-red"
                        : "text-text-dim";
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-text-dim w-4 shrink-0 tabular-nums">
                        {idx + 1}.
                      </span>
                      <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
                      <Link
                        to={s.to}
                        className="flex-1 min-w-0 text-[11px] font-mono text-foreground truncate hover:text-signal-cyan"
                      >
                        {s.label}
                      </Link>
                      <button
                        type="button"
                        onClick={() => markFail(s.id)}
                        className="text-[9px] font-mono uppercase text-text-dim hover:text-signal-red px-1"
                        title="Marcar como fallo"
                      >
                        fail
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                {log.length === 0 ? (
                  <div className="text-[10px] font-mono text-text-dim text-center py-4">
                    Sin eventos todavía. Navega entre módulos.
                  </div>
                ) : (
                  <ul className="space-y-0.5 font-mono text-[10px] leading-tight">
                    {log
                      .slice()
                      .reverse()
                      .map((e, i) => (
                        <li
                          key={i}
                          className={cn(
                            "border-l-2 pl-1.5 py-0.5",
                            e.level === "error"
                              ? "border-signal-red text-signal-red"
                              : e.level === "warn"
                                ? "border-signal-amber text-signal-amber"
                                : "border-border text-text-dim",
                          )}
                        >
                          <span className="opacity-60">
                            {new Date(e.ts).toLocaleTimeString("es-CL", { hour12: false })}
                          </span>{" "}
                          <span className="text-foreground">{e.msg}</span>
                          {e.meta ? (
                            <div className="opacity-70 break-all">{JSON.stringify(e.meta)}</div>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                )}
                {log.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLog([])}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-text-dim hover:text-signal-red"
                  >
                    <Trash2 className="w-3 h-3" /> Limpiar log
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
