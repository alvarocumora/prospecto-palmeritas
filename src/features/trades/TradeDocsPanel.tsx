// Documentos comerciales bilingües (ES/EN) de la operación: ICPO, FCO e IMFPA
// más la ficha técnica. Se generan en el navegador con el renderer
// institucional de Geocapitals (papel hueso · tinta · cobalto · QR).

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2, Languages } from "lucide-react";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";
import {
  buildTradeDoc,
  buildTradeFichaDoc,
  TRADE_DOC_LABELS,
  type DocLang,
  type TradeDocInput,
  type TradeDocKind,
} from "@/lib/documents/tradeDocs";

const LANGS: Array<{ value: DocLang; label: string }> = [
  { value: "both", label: "Bilingüe ES/EN" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export function TradeDocsPanel({
  input,
  title = "Documentos comerciales",
  compact = false,
}: {
  input: TradeDocInput;
  title?: string;
  compact?: boolean;
}) {
  const [lang, setLang] = useState<DocLang>("both");
  const [busy, setBusy] = useState<string | null>(null);

  const emit = async (kind: TradeDocKind | "ficha") => {
    setBusy(kind);
    try {
      const doc =
        kind === "ficha" ? buildTradeFichaDoc(input, lang) : buildTradeDoc(kind, input, lang);
      await renderGeocapitalsPdf(doc);
      toast.success("PDF generado.");
    } catch {
      toast.error("No se pudo generar el PDF.");
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50";

  return (
    <section className={compact ? "" : "rounded-lg border border-border bg-card p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Languages className="h-3.5 w-3.5" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as DocLang)}
            className="rounded border border-neutral-300 bg-transparent px-2 py-1"
          >
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void emit("ficha")} className={btn}>
          {busy === "ficha" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          Ficha en PDF
        </button>
        {(["icpo", "fco", "imfpa"] as TradeDocKind[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={busy !== null}
            onClick={() => void emit(k)}
            className={btn}
          >
            {busy === k ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {k.toUpperCase()} · {TRADE_DOC_LABELS[k].es}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Cada PDF lleva referencia única, QR de validación y sello de Geocapitals. Documentos
        preliminares: no constituyen oferta vinculante.
      </p>
    </section>
  );
}
