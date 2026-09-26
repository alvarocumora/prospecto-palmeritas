import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileDown,
  Loader2,
  Mail,
  MessageCircle,
  Copy,
  Package,
  Check,
  History,
} from "lucide-react";
import {
  generateTradePack,
  dispatchTradePack,
  listTradePackVersions,
  signTradePackVersion,
  TRADE_PACK_DOCS,
  TRADE_PACK_LABELS,
  type TradePackDoc,
} from "@/lib/tradePack.functions";

type Doc = {
  type: TradePackDoc;
  label: string;
  filename: string;
  url: string;
  version?: number;
  reused?: boolean;
};

type Version = {
  id: string;
  doc_type: TradePackDoc;
  version_number: number;
  terms_hash: string;
  filename: string;
  created_at: string;
};

type Trade = {
  buyerEmail?: string | null;
  sellerEmail?: string | null;
  counterparty_email?: string | null;
  counterparty_phone?: string | null;
  counterparty_name?: string | null;
};

/** Panel de Document Pack por trade: genera Ficha/LOI/NCNDA/ICPO/SPA,
 *  descarga, copia link, comparte por WhatsApp o envía por correo. */
export function TradePackPanel({ tradeId, trade }: { tradeId: string; trade: Trade }) {
  const genFn = useServerFn(generateTradePack);
  const sendFn = useServerFn(dispatchTradePack);
  const listVersFn = useServerFn(listTradePackVersions);
  const signVerFn = useServerFn(signTradePackVersion);

  const [versions, setVersions] = useState<Version[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingVer, setLoadingVer] = useState<string | null>(null);

  const loadVersions = async () => {
    try {
      const r = await listVersFn({ data: { tradeId } });
      setVersions(r.versions);
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]);

  const [selected, setSelected] = useState<Set<TradePackDoc>>(() => new Set(TRADE_PACK_DOCS));
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Array<{ type: string; error: string }>>([]);

  // Formulario de envío por correo
  const defaultRecipients = useMemo(
    () =>
      [trade.buyerEmail, trade.sellerEmail, trade.counterparty_email]
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .join(", "),
    [trade],
  );
  const [recipients, setRecipients] = useState(defaultRecipients);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const wsPhone = (trade.counterparty_phone ?? "").replace(/[^0-9]/g, "");
  const cpName = trade.counterparty_name ?? "";

  const toggle = (k: TradePackDoc) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const doGenerate = async () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos un documento.");
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const res = await genFn({ data: { tradeId, include: [...selected] } });
      setDocs(res.docs);
      setErrors(res.errors);
      const reused = res.docs.filter((d) => d.reused).length;
      toast.success(
        `Paquete listo — ${res.docs.length} PDF${res.docs.length !== 1 ? "s" : ""}` +
          (reused ? ` (${reused} reutilizado${reused !== 1 ? "s" : ""})` : ""),
      );
      await loadVersions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando paquete");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const openWhatsapp = (doc?: Doc) => {
    const header = `📄 Geocapitals — Documentos de la operación\n\n${cpName ? `Hola ${cpName},\n\n` : ""}`;
    const body = doc
      ? `Le comparto el documento oficial:\n\n${doc.label}\n${doc.url}`
      : `Le comparto el paquete oficial:\n\n${docs
          .map((d) => `· ${d.label}: ${d.url}`)
          .join("\n")}`;
    const footer = `\n\nCualquier consulta, respondemos por este mismo canal o al info@geocapitals.com.`;
    const text = encodeURIComponent(header + body + footer);
    const base = wsPhone ? `https://wa.me/${wsPhone}` : "https://wa.me/";
    window.open(`${base}?text=${text}`, "_blank", "noopener");
  };

  const doSend = async () => {
    const list = recipients
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
    if (list.length === 0) {
      toast.error("Agrega al menos un correo válido.");
      return;
    }
    setSending(true);
    try {
      const res = await sendFn({
        data: {
          tradeId,
          recipients: list,
          include: [...selected],
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
        },
      });
      const ok = res.results.filter((r) => r.ok).length;
      toast.success(`Enviado — ${ok}/${res.results.length} destinatario(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error enviando paquete");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-secondary/30 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Document Pack
        </div>
        {docs.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {docs.length} PDF{docs.length !== 1 ? "s" : ""} generado
            {docs.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        Genera el set completo con los datos reales del trade — Ficha Técnica, LOI, NCNDA, ICPO y
        SPA (draft). Comparte por email o WhatsApp con un clic.
      </div>

      {/* Selector de documentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
        {TRADE_PACK_DOCS.map((k) => (
          <label
            key={k}
            className="flex items-center gap-2 text-[11px] font-mono border border-border rounded px-2 py-1.5 cursor-pointer hover:bg-muted/30"
          >
            <input
              type="checkbox"
              checked={selected.has(k)}
              onChange={() => toggle(k)}
              className="accent-primary"
            />
            <span className="uppercase text-[10px] font-bold">{k}</span>
            <span className="text-muted-foreground truncate">{TRADE_PACK_LABELS[k]}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={doGenerate}
          disabled={busy || selected.size === 0}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Package className="w-3.5 h-3.5" />
          )}
          Generar paquete PDF
        </button>
        {docs.length > 0 && (
          <button
            onClick={() => openWhatsapp()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/30"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Compartir todo por WhatsApp
          </button>
        )}
        {versions.length > 0 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/30"
          >
            <History className="w-3.5 h-3.5" />
            Historial ({versions.length})
          </button>
        )}
      </div>

      {/* Lista de documentos generados */}
      {docs.length > 0 && (
        <div className="rounded-md border border-border divide-y divide-border mb-3">
          {docs.map((d) => (
            <div key={d.filename} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                  {d.label}
                  {d.version != null && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/10 text-primary">
                      v{d.version}
                    </span>
                  )}
                  {d.reused && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">
                      reutilizado
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">
                  {d.filename}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener"
                  download={d.filename}
                  className="p-1.5 rounded hover:bg-muted/40"
                  title="Descargar"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => copyLink(d.url)}
                  className="p-1.5 rounded hover:bg-muted/40"
                  title="Copiar link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openWhatsapp(d)}
                  className="p-1.5 rounded hover:bg-muted/40"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historial de versiones */}
      {showHistory && versions.length > 0 && (
        <div className="rounded-md border border-border bg-muted/10 mb-3">
          <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="w-3 h-3" /> Historial de versiones
          </div>
          <div className="divide-y divide-border max-h-64 overflow-auto">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-mono uppercase text-[9px] font-bold px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                    {v.doc_type}
                  </span>
                  <span className="font-mono shrink-0">v{v.version_number}</span>
                  <span className="text-muted-foreground truncate">
                    {new Date(v.created_at).toLocaleString("es-CL", {
                      year: "2-digit",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/70 truncate hidden sm:inline">
                    #{v.terms_hash.slice(0, 8)}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    setLoadingVer(v.id);
                    try {
                      const r = await signVerFn({ data: { versionId: v.id } });
                      const a = document.createElement("a");
                      a.href = r.url;
                      a.download = r.filename;
                      a.rel = "noopener";
                      a.target = "_blank";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Error");
                    } finally {
                      setLoadingVer(null);
                    }
                  }}
                  disabled={loadingVer === v.id}
                  className="p-1 rounded hover:bg-muted/40 shrink-0"
                  title="Descargar esta versión"
                >
                  {loadingVer === v.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="text-[11px] text-destructive font-mono mb-3">
          Errores: {errors.map((e) => `${e.type}: ${e.error}`).join(" · ")}
        </div>
      )}

      {/* Envío por correo */}
      {docs.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Enviar por correo
          </div>
          <div className="grid gap-2">
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="destinatarios (separados por coma)"
              className="text-xs px-2 py-1.5 rounded border border-border bg-background"
            />
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto (opcional — usa el default de Geocapitals si vacío)"
              className="text-xs px-2 py-1.5 rounded border border-border bg-background"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensaje adicional (opcional)"
              rows={3}
              className="text-xs px-2 py-1.5 rounded border border-border bg-background resize-y"
            />
            <button
              onClick={doSend}
              disabled={sending}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50 w-fit"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Enviar paquete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
