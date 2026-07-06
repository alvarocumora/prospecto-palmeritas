// Hilo de mensajes buyer↔seller de una consulta de commodity.
// Usado por ambos lados: la bandeja del buyer (/dashboard/my-inquiries) y la
// del seller (LotInquiriesManager). El otro participante recibe email.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  listInquiryMessages,
  sendInquiryMessage,
  type InquiryMessage,
} from "@/lib/marketplace.functions";

export function InquiryThread({ inquiryId }: { inquiryId: string }) {
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await listInquiryMessages({ data: { inquiryId } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error cargando mensajes");
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendInquiryMessage({ data: { inquiryId, body: text } });
      setBody("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 rounded border border-border bg-background/40 p-2.5">
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {loading ? (
          <div className="text-[11px] font-mono text-muted-foreground py-1.5">
            Cargando mensajes…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-[11px] font-mono text-muted-foreground py-1.5">
            Sin mensajes aún — escribe el primero. La otra parte recibirá un email.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded px-2.5 py-1.5 text-xs leading-relaxed ${
                  m.mine
                    ? "bg-gold/15 border border-gold/30 text-foreground"
                    : "bg-bg-panel border border-border text-foreground/90"
                }`}
              >
                <div className="whitespace-pre-line break-words">{m.body}</div>
                <div className="mt-0.5 text-[9px] font-mono text-muted-foreground text-right">
                  {new Date(m.created_at).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-2 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un mensaje…"
          maxLength={4000}
          className="flex-1 rounded border border-border bg-transparent px-2.5 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="inline-flex items-center gap-1 rounded bg-gold text-black px-2.5 py-1.5 text-[11px] font-mono font-semibold hover:bg-gold/90 disabled:opacity-40"
        >
          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Enviar
        </button>
      </form>
    </div>
  );
}
