import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

export function GeoAssistant() {
  const { active } = useProjects();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geo-assistant`;
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ project_id: active?.id ?? null, messages: next, focus: null }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        toast.error(err.error ?? "Error en el asistente");
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
          if (json === "[DONE]") { done = true; break; }
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
      toast.error("No se pudo conectar con el asistente");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 md:bottom-10 right-4 md:right-6 z-50 w-11 h-11 rounded-full bg-gold text-bg-secondary shadow-lg hover:scale-105 transition-transform inline-flex items-center justify-center"
        title="Asistente IA geológico"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {open && (
        <div className="fixed bottom-36 md:bottom-24 right-4 md:right-6 z-50 w-[min(92vw,380px)] h-[min(70vh,520px)] flex flex-col rounded-lg border border-border bg-bg-secondary shadow-2xl">
          <header className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <div className="font-mono text-xs font-semibold flex-1">Geo·AI</div>
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
              {active?.name ?? "Sin proyecto"}
            </span>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground font-mono space-y-2">
                <p className="text-gold">GeoCopilot 5.0 · contexto cargado del proyecto activo</p>
                <p>Sugerencias rápidas:</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    "¿Dónde perforar el próximo sondaje y por qué?",
                    "Resume los 5 mejores intercepts y agrupa por dominio",
                    "¿Qué targets tienen mayor score y qué evidencia los respalda?",
                    "Redacta sección 7 (Geological Setting) NI 43-101",
                    "¿Qué permisos vencen y qué actividad bloquean?",
                    "Compara mineralogía vs alteración: ¿es epitermal o pórfido?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setInput(q)}
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
                <div className={`inline-block max-w-[90%] px-2.5 py-1.5 rounded text-xs whitespace-pre-wrap ${
                  m.role === "user" ? "bg-gold/15 text-foreground" : "bg-background border border-border text-foreground"
                }`}>
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
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pregunta al asistente…"
              className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-border bg-background focus:outline-none focus:border-gold"
              disabled={streaming}
            />
            <button
              type="button"
              onClick={send}
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
