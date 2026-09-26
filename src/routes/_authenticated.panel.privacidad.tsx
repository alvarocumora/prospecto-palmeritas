import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Download, ShieldCheck } from "lucide-react";
import { createDsr, exportMyData, listMyDsr } from "@/lib/privacy/dsr.functions";

type Dsr = {
  id: string;
  kind: string;
  status: string;
  details: string | null;
  response: string | null;
  created_at: string;
};

const KIND_LABELS: Record<string, string> = {
  access: "Acceso",
  rectification: "Rectificación",
  cancellation: "Cancelación / eliminación",
  opposition: "Oposición",
  portability: "Portabilidad",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  fulfilled: "Cumplida",
  rejected: "Rechazada",
};

export const Route = createFileRoute("/_authenticated/panel/privacidad")({
  head: () => ({
    meta: [
      { title: "Privacidad y mis datos — Geocapitals" },
      {
        name: "description",
        content:
          "Ejerce tus derechos ARCO+P (Ley 21.719 Chile): acceso, rectificación, eliminación, oposición y portabilidad.",
      },
    ],
  }),
  component: PrivacyPanel,
});

function PrivacyPanel() {
  const list = useServerFn(listMyDsr);
  const create = useServerFn(createDsr);
  const exportFn = useServerFn(exportMyData);
  const [rows, setRows] = useState<Dsr[]>([]);
  const [kind, setKind] = useState<keyof typeof KIND_LABELS>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    () =>
      list({})
        .then((r) => setRows(r as Dsr[]))
        .catch(() => setRows([])),
    [list],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async () => {
    setBusy(true);
    try {
      await create({ data: { kind, details: details || undefined } });
      setDetails("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const res = (await exportFn({})) as { json: string };
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `geocapitals-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-10">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-content-subtle">
            <ShieldCheck className="h-4 w-4" /> Ley 21.719 · Datos personales
          </div>
          <h1 className="text-3xl font-serif">Privacidad y mis datos</h1>
          <p className="text-content-subtle">
            Ejerce tus derechos ARCO+P (acceso, rectificación, cancelación, oposición,
            portabilidad). Nuestro DPO responde dentro de 30 días hábiles.
          </p>
        </header>

        <section className="rounded-lg border border-hairline bg-surface-raised p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg">Portabilidad — exportar mis datos</h2>
              <p className="text-sm text-content-subtle">
                Descarga un archivo JSON con todos tus datos personales, ofertas, RFQs y
                consentimientos registrados.
              </p>
            </div>
            <Button onClick={doExport} disabled={busy}>
              <Download className="h-4 w-4 mr-2" /> Descargar JSON
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-hairline bg-surface-raised p-6 space-y-4">
          <h2 className="font-serif text-lg">Nueva solicitud</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm space-y-1">
              <span className="text-content-subtle">Tipo</span>
              <select
                className="w-full rounded border border-hairline bg-surface px-3 py-2"
                value={kind}
                onChange={(e) => setKind(e.target.value as keyof typeof KIND_LABELS)}
              >
                {Object.entries(KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm space-y-1 block">
            <span className="text-content-subtle">Detalles (opcional)</span>
            <textarea
              className="w-full rounded border border-hairline bg-surface px-3 py-2 min-h-24"
              value={details}
              maxLength={2000}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe qué dato quieres rectificar, eliminar u obtener."
            />
          </label>
          <Button onClick={submit} disabled={busy}>
            Enviar solicitud
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg">Mis solicitudes</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-content-subtle">Aún no tienes solicitudes registradas.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded border border-hairline bg-surface-raised p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{KIND_LABELS[r.kind] ?? r.kind}</div>
                      <div className="text-xs text-content-subtle">
                        {new Date(r.created_at).toLocaleString("es-CL")}
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-wider">
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.details && (
                    <p className="mt-2 text-content-subtle whitespace-pre-wrap">{r.details}</p>
                  )}
                  {r.response && (
                    <p className="mt-2 border-t border-hairline pt-2">
                      <span className="text-xs uppercase text-content-subtle">Respuesta DPO</span>
                      <br />
                      {r.response}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-xs text-content-subtle border-t border-hairline pt-4">
          Contacto DPO:{" "}
          <a className="text-accent-brand" href="mailto:privacy@geocapitals.com">
            privacy@geocapitals.com
          </a>
        </footer>
      </div>
    </div>
  );
}
