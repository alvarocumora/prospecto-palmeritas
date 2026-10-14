import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sparkles, X, Send, Loader2, History, Plus, Trash2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ANCHOR_LABEL, emitSceneFocus, parseAnchors } from "@/components/geoscene/anchors";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = {
  id: string;
  title: string;
  module: string;
  project_id: string | null;
  updated_at: string;
  messages: Msg[];
};

const MODULE_LABELS: Record<string, string> = {
  "/dashboard": "Mission Control",
  "/dashboard/map": "Centro Operativo",
  "/dashboard/command-center": "Command Center",
  "/catastro/proyecto": "Catastro",
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
  "/dashboard/marketplace": "Capas GIS",
  "/dashboard/deals": "Marketplace Deals",
  "/dashboard/projects": "Proyectos",
  "/dashboard/campaigns": "Campañas",
  "/dashboard/geology3d": "Geología 3D",
  "/dashboard/sat3d": "Satélite 3D",
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
  Catastro: ["¿Qué concesiones vencen en 90 días?", "Resume overlaps activos en el AOI"],
  Geofísica: ["¿Qué anomalías mag merecen ground-truthing?", "Correlación mag ↔ targets activos"],
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

function titleFrom(messages: Msg[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Nueva conversación";
  return first.content.slice(0, 60).trim() + (first.content.length > 60 ? "…" : "");
}

export function GlobalGeoCopilot() {
  const { active } = useProjects();
  const location = useLocation();
  const moduleLabel = resolveModule(location.pathname);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Load conversations for current project+module when opening or context changes
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let q = supabase
        .from("geo_copilot_conversations")
        .select("id,title,module,project_id,updated_at,messages")
        .eq("module", moduleLabel)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (active?.id) q = q.eq("project_id", active.id);
      else q = q.is("project_id", null);
      const { data, error } = await q;
      if (error) throw error;
      setConversations((data ?? []) as Conversation[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, [active?.id, moduleLabel]);

  useEffect(() => {
    if (!open) return;
    loadConversations();
  }, [open, loadConversations]);

  // Reset active conversation when project/module changes
  useEffect(() => {
    setConvId(null);
    setMessages([]);
    setShowHistory(false);
  }, [active?.id, moduleLabel]);

  // Persist messages (debounced) — create on first message, update afterwards
  useEffect(() => {
    if (messages.length === 0 || streaming) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const title = titleFrom(messages);
        if (!convId) {
          const { data, error } = await supabase
            .from("geo_copilot_conversations")
            .insert({
              user_id: user.id,
              project_id: active?.id ?? null,
              module: moduleLabel,
              title,
              messages: messages as unknown as never,
            })
            .select("id")
            .single();
          if (error) throw error;
          setConvId(data.id);
        } else {
          const { error } = await supabase
            .from("geo_copilot_conversations")
            .update({ messages: messages as unknown as never, title })
            .eq("id", convId);
          if (error) throw error;
        }
      } catch (e) {
        console.error("[GeoCopilot] save error", e);
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [messages, streaming, convId, active?.id, moduleLabel]);

  const newConversation = () => {
    setConvId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const openConversation = (c: Conversation) => {
    setConvId(c.id);
    setMessages(Array.isArray(c.messages) ? c.messages : []);
    setShowHistory(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Borrar esta conversación?")) return;
    const { error } = await supabase.from("geo_copilot_conversations").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo borrar");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (convId === id) {
      setConvId(null);
      setMessages([]);
    }
  };

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
      // refresh history list after a response so order updates
      loadConversations();
    }
  };

  const suggestions = SUGGESTIONS_BY_MODULE[moduleLabel] ?? DEFAULT_SUGGESTIONS;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Geo·AI Copilot contextual (⌘K)"
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
        <span className="hidden sm:inline uppercase tracking-wider">Geo·AI Copilot · ⌘K</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed top-10 right-2 sm:right-3 z-50 w-[min(94vw,460px)] h-[min(76vh,600px)] flex flex-col rounded-[3px] border border-border bg-bg-secondary/98 backdrop-blur shadow-2xl animate-fade-up"
          role="dialog"
          aria-label="Geo Copilot global"
        >
          <header className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <div className="font-mono text-xs font-semibold flex-1 min-w-0 truncate">
              Geo Copilot ·{" "}
              <span className="text-gold uppercase tracking-wider">{moduleLabel}</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[100px]">
              {active?.code ?? "Sin proyecto"}
            </span>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              title="Historial"
              className={cn(
                "p-1 rounded transition-colors",
                showHistory ? "text-gold bg-gold/10" : "text-text-dim hover:text-foreground",
              )}
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={newConversation}
              title="Nueva conversación"
              className="p-1 text-text-dim hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-text-dim hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </header>

          {showHistory ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-text-dim border-b border-border">
                Historial · {moduleLabel} · {active?.code ?? "sin proyecto"}
              </div>
              {loadingHistory && (
                <div className="px-3 py-4 text-xs text-muted-foreground font-mono inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> cargando…
                </div>
              )}
              {!loadingHistory && conversations.length === 0 && (
                <div className="px-3 py-6 text-xs text-muted-foreground font-mono text-center">
                  Sin conversaciones previas en este módulo.
                </div>
              )}
              <ul>
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c)}
                      className={cn(
                        "w-full text-left px-3 py-2 border-b border-border/40 hover:bg-bg-elevated transition-colors flex items-start gap-2 group",
                        convId === c.id && "bg-bg-elevated border-l-2 border-l-gold",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-mono text-foreground truncate">
                          {c.title}
                        </div>
                        <div className="text-[10px] text-text-dim font-mono tabular-nums">
                          {new Date(c.updated_at).toLocaleString()} ·{" "}
                          {Array.isArray(c.messages) ? c.messages.length : 0} msg
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteConversation(c.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-signal-red p-1"
                        aria-label="Borrar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
                {messages.length === 0 && (
                  <div className="text-xs text-muted-foreground font-mono space-y-2">
                    <p className="text-gold">
                      Pregunta sobre cualquier módulo. Las conversaciones se guardan por proyecto y
                      módulo — abre el ícono de historial para retomarlas.
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
            </>
          )}
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
