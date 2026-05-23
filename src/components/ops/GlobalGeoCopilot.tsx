import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ANCHOR_LABEL, emitSceneFocus, parseAnchors } from "@/components/geoscene/anchors";

type Msg = { role: "user" | "assistant"; content: string };

const MODULE_LABELS: Record<string, string> = {
  "/dashboard": "Mission Control",
  "/dashboard/map": "Centro Operativo",
  "/dashboard/command-center": "Command Center",
  "/dashboard/catastro": "Catastro",
  "/dashboard/boletin": "Boletín Minero",
  "/dashboard/geophysics": "Geofísica",
  "/dashboard/drones": "Drones",
  "/dashboard/drilling": "Sondajes",
  "/dashboard/sampling": "Muestreo",
  "/dashboard/qaqc": "QA/QC",
  "/dashboard/approvals": "Aprobaciones",
  "/dashboard/targets": "Targets",
  "/dashboard/satellite-intel": "Inteligencia Satelital",
  "/dashboard/estimation": "Estimación de Recursos",
  "/dashboard/inventory": "Inventario",
  "/dashboard/finance": "Costos",
  "/dashboard/hse": "HSE",
  "/dashboard/reports": "Reportes",
  "/dashboard/ni43101": "Informe NI 43-101",
  "/dashboard/qps": "QPs · Firmas",
  "/dashboard/team": "Equipo",
  "/dashboard/audit": "Auditoría",
  "/dashboard/validation": "Validación de Datos",
  "/dashboard/marketplace": "Marketplace Capas",
  "/dashboard/deals": "Marketplace Deals",
  "/dashboard/projects": "Proyectos",
  "/dashboard/field-map": "Mapa de campo",
  "/dashboard/campaigns": "Campañas",
  "/dashboard/geology3d": "Geología 3D",
  "/dashboard/sat3d": "Satélite 3D",
  "/dashboard/3d-pro": "Mag 3D Pro",
};

function resolveModule(path: string): string {
  if (MODULE_LABELS[path]) return MODULE_LABELS[path];
  const parts = path.split("/").filter(Boolean);
  while (parts.length > 0) {
    const p = "/" + parts.join("/");
    if (MODULE_LABELS[p]) return MODULE_LABELS[p];
    parts.pop();
  }
  return "Dashboard";
}

const SUGGESTIONS_BY_MODULE: Record<string, string[]> = {
  Targets: [
    "¿Qué targets tienen mayor score y por qué?",
    "Resume evidencia multi-fuente del top 5",
  ],
  Sondajes: [
    "¿Qué sondaje conviene extender y hasta qué profundidad?",
    "Top 5 intercepts Au y su contexto litológico",
  ],
  Catastro: [
    "¿Qué concesiones vencen en 90 días?",
    "Resume overlaps activos en el AOI",
  ],
  Geofísica: [
    "¿Qué anomalías mag merecen ground-truthing?",
    "Correlación mag ↔ targets activos",
  ],
  "QA/QC": ["¿Cuál es el fail rate por batch?", "Listar duplicados con desviación >20%"],
  HSE: ["¿Qué permisos vencen en 60 días?", "Incidentes abiertos por severidad"],
  Muestreo: ["Geoquímica: fingerprint dominante del AOI", "Top assays Au del último mes"],
};

const DEFAULT_SUGGESTIONS = [
  "¿Dónde perforar el próximo sondaje y por qué?",
  "Resume los 5 mejores intercepts del proyecto",
  "¿Qué targets tienen mayor score y qué evidencia los respalda?",
  "¿Qué permisos vencen y qué actividad bloquean?",
];

export function GlobalGeoCopilot() {
  const { active } = useProjects();
  const location = useLocation();
  const moduleLabel = resolveModule(location.pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: "assistant", content: acc }];
      });
    };

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-assistant`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          project_id: active?.id ?? null,
          messages: next,
          focus: { surface: "global-topbar", module: moduleLabel, path: location.pathname },
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        toast.error(err.error ?? "Error en el copilot");
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo conectar con el copilot");
    } finally {
      setStreaming(false);
    }
  };

  const suggestions = SUGGESTIONS_BY_MODULE[moduleLabel] ?? DEFAULT_SUGGESTIONS;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Geo Copilot global (⌘K)"
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 rounded-[2px] border transition-colors font-mono text-[10px]",
          open
            ? "border-gold text-gold bg-gold/10"
            : "border-border bg-bg-elevated text-text-mono hover:border-gold hover:text-gold",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles className="w-3 h-3" />
        <span className="hidden sm:inline uppercase tracking-wider">Geo·AI</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed top-10 right-2 sm:right-3 z-50 w-[min(94vw,440px)] h-[min(72vh,560px)] flex flex-col rounded-[3px] border border-border bg-bg-secondary/98 backdrop-blur shadow-2xl animate-fade-up"
          role="dialog"
          aria-label="Geo Copilot global"
        >
          <header className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <div className="font-mono text-xs font-semibold flex-1">
              Geo Copilot ·{" "}
              <span className="text-gold uppercase tracking-wider">{moduleLabel}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
              {active?.code ?? "Sin proyecto"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-text-dim hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground font-mono space-y-2">
                <p className="text-gold">
                  Pregunta sobre cualquier módulo. Contexto del proyecto activo y módulo actual
                  inyectado automáticamente.
                </p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="text-left px-2 py-1 rounded border border-border hover:border-gold hover:bg-gold/5 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={cn(
                    "inline-block max-w-[90%] px-2.5 py-1.5 rounded text-xs whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-gold/15 text-foreground"
                      : "bg-background border border-border text-foreground",
                  )}
                >
                  {m.role === "assistant" ? renderWithAnchors(m.content) : m.content}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> pensando…
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Pregunta sobre ${moduleLabel}…`}
              className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold"
              disabled={streaming}
              autoFocus
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="px-2 py-1.5 rounded bg-gold text-bg-secondary disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function renderWithAnchors(text: string) {
  const parts = parseAnchors(text);
  return parts.map((p, i) => {
    if (p.type === "text") return <span key={i}>{p.value}</span>;
    const { kind, code } = p.anchor;
    return (
      <button
        key={i}
        type="button"
        onClick={() => emitSceneFocus(p.anchor)}
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded border border-gold/40 bg-gold/10 hover:bg-gold/20 text-[10px] font-mono uppercase text-gold transition-colors align-baseline"
        title={`Enfocar ${ANCHOR_LABEL[kind]} ${code}`}
      >
        <span className="opacity-70">{ANCHOR_LABEL[kind]}</span>
        <span className="font-semibold">{code}</span>
      </button>
    );
  });
}
