import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createInvitationLink,
  listInvitationLinks,
  toggleInvitationLink,
  type InvitationLink,
} from "@/lib/suppliers/links.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Link2, Power, PowerOff } from "lucide-react";
import { publicUrl } from "@/lib/publicUrl";

export const Route = createFileRoute("/_authenticated/dashboard/enlaces")({
  head: () => ({
    meta: [
      { title: "Enlaces de invitación de proveedores — Geocapitals" },
      {
        name: "description",
        content:
          "Genera y comparte enlaces de invitación al portal de proveedores con seguimiento de aperturas y conversiones.",
      },
    ],
  }),
  component: EnlacesPage,
});

function EnlacesPage() {
  const list = useServerFn(listInvitationLinks);
  const create = useServerFn(createInvitationLink);
  const toggle = useServerFn(toggleInvitationLink);
  const [links, setLinks] = useState<InvitationLink[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    setLinks(await list({}));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await create({ data: { label: label.trim() } });
      setLabel("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function buildUrl(token: string): string {
    return publicUrl(`/inscripcion?ref=${token}`);
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(buildUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
            Staff · Portal de proveedores
          </div>
          <h1 className="mt-1 font-serif text-3xl">Enlaces de invitación</h1>
          <p className="mt-2 max-w-2xl text-sm text-[hsl(var(--content-subtle))]">
            Cada enlace genera un token único que puedes compartir con un intermediario, un
            productor o publicar por WhatsApp. Al abrirse y al completarse la ficha se suma al
            contador correspondiente.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-end gap-3 rounded border border-[hsl(var(--hairline))] bg-white p-4">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
              Etiqueta interna
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Contacto Antofagasta – julio"
            />
          </div>
          <Button onClick={onCreate} disabled={busy || !label.trim()}>
            <Link2 className="mr-2 h-4 w-4" /> Generar enlace
          </Button>
        </div>

        <div className="overflow-x-auto rounded border border-[hsl(var(--hairline))] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[hsl(var(--surface))] text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
              <tr>
                <th className="p-3 text-left">Etiqueta</th>
                <th className="p-3 text-left">Enlace</th>
                <th className="p-3 text-right">Aperturas</th>
                <th className="p-3 text-right">Inscripciones</th>
                <th className="p-3 text-right">Estado</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {links.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[hsl(var(--content-subtle))]">
                    Aún no hay enlaces creados.
                  </td>
                </tr>
              ) : (
                links.map((l) => (
                  <tr key={l.id} className="border-t border-[hsl(var(--hairline))]">
                    <td className="p-3 font-medium">{l.label}</td>
                    <td className="p-3 font-mono text-xs">
                      <div className="max-w-[280px] truncate" title={buildUrl(l.token)}>
                        {buildUrl(l.token)}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">{l.opens_count}</td>
                    <td className="p-3 text-right font-mono">{l.completions_count}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase ${
                          l.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {l.active ? "Activo" : "Pausado"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => copy(l.token)}>
                          <Copy className="mr-1 h-3 w-3" />
                          {copied === l.token ? "Copiado" : "Copiar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await toggle({ data: { id: l.id, active: !l.active } });
                            await refresh();
                          }}
                        >
                          {l.active ? (
                            <>
                              <PowerOff className="mr-1 h-3 w-3" /> Pausar
                            </>
                          ) : (
                            <>
                              <Power className="mr-1 h-3 w-3" /> Activar
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
