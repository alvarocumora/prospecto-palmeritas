import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, MessageSquare } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GeoSceneMode, GeoSceneVariant } from "./types";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS: Record<GeoSceneMode, string[]> = {
  surface: [
    "¿Qué anomalías satelitales merecen ground-truthing?",
    "Resume targets visibles y su evidencia multi-fuente",
    "¿Qué litología/alteración domina en el AOI?",
  ],
  subsurface: [
    "¿Qué sondaje debería extender y hasta qué profundidad?",
    "Correlación vetas en superficie ↔ intercepts en profundidad",
    "¿Las anomalías mag se alinean con pórfidos modelados?",
  ],
  resource: [
    "Mejor pit shell según precio actual de Au",
    "Bloques con mayor NPV y su confianza geológica",
    "Compara recurso medido vs inferido por dominio",
  ],
};

export function SceneCopilot({
  mode,
  variant,
}: {
  mode: GeoSceneMode;
  variant: GeoSceneVariant;
}) {
  const { active } = useProjects();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

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
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: acc } : m,
          );
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
          focus: { scene: "GeoScene3D", mode, variant },
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

  const sugs = SUGGESTIONS[mode];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute bottom-4 right-4 z-30 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-gold text-background text-xs font-mono shadow-lg hover:scale-105 transition-transform"
        title="Geo Copilot contextual"
      >
        {open ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
        <span className="hidden sm:inline">{open ? "Cerrar" : "Geo Copilot"}</span>
      </button>

      {open && (
        <div className="absolute bottom-16 right-4 z-30 w-[min(92vw,400px)] h-[min(72vh,540px)] flex flex-col rounded-lg border border-border bg-bg-secondary/98 backdrop-blur shadow-2xl">
          <header className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <div className="font-mono text-xs font-semibold flex-1">
              Geo Copilot · <span className="text-gold uppercase">{mode}</span>
              {variant === "mag" && <span className="text-muted-foreground"> · mag</span>}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
              {active?.name ?? "Sin proyecto"}
            </span>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground font-mono space-y-2">
                <p className="text-gold">
                  Pregunta sobre la escena 3D activa. Contexto del proyecto inyectado automáticamente.
                </p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {sugs.map((q) => (
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
                  className={`inline-block max-w-[90%] px-2.5 py-1.5 rounded text-xs whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gold/15 text-foreground"
                      : "bg-background border border-border text-foreground"
                  }`}
                >
                  {m.content}
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
              placeholder={`Pregunta sobre modo ${mode}…`}
              className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold"
              disabled={streaming}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              className="px-2 py-1.5 rounded bg-gold text-background disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
