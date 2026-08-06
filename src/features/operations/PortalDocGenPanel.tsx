// Generador de documentos de la operación, disponible solo dentro del panel
// privado (requiere sesión validada por correo + código).

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  generateOperacionDoc,
  PORTAL_DOC_TYPES,
  PORTAL_DOC_LABELS,
  PORTAL_DOC_HINTS,
  type PortalDocType,
} from "@/lib/portalDocGen.functions";

export function PortalDocGenPanel({ token, session }: { token: string; session: string }) {
  const genFn = useServerFn(generateOperacionDoc);
  const [busy, setBusy] = useState<PortalDocType | null>(null);
  const [links, setLinks] = useState<Record<string, { url: string; filename: string }>>({});

  const generate = async (docType: PortalDocType) => {
    setBusy(docType);
    try {
      const r = await genFn({ data: { token, session, docType } });
      setLinks((prev) => ({ ...prev, [docType]: { url: r.url, filename: r.filename } }));
      const a = document.createElement("a");
      a.href = r.url;
      a.download = r.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`${r.label} generado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el documento.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-6">
      <h2 className="font-serif text-xl">Generar documentos</h2>
      <p className="text-sm text-[hsl(var(--im-ink-soft))] mt-1">
        Documentos con los datos de esta operación, sello Geocapitals y QR de verificación. Se
        generan en PDF listos para firmar o enviar.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {PORTAL_DOC_TYPES.map((docType) => {
          const done = links[docType];
          return (
            <div
              key={docType}
              className="rounded border border-[hsl(var(--im-hairline))] p-4 flex flex-col gap-2"
            >
              <p className="text-sm font-medium">{PORTAL_DOC_LABELS[docType]}</p>
              <p className="text-xs text-[hsl(var(--im-ink-soft))] flex-1">
                {PORTAL_DOC_HINTS[docType]}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void generate(docType)}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded bg-[hsl(var(--im-accent-brand))] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {busy === docType ? "Generando…" : done ? "Regenerar" : "Generar PDF"}
                </button>
                {done && (
                  <a
                    href={done.url}
                    download={done.filename}
                    rel="noopener"
                    className="text-xs underline text-[hsl(var(--im-accent-brand))]"
                  >
                    Descargar
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
