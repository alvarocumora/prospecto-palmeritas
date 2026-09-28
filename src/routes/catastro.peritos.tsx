import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ShieldCheck, ExternalLink, Gavel, Info } from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import {
  PERITOS_MENSURADORES_2026,
  PERITOS_MENSURADORES_2026_META,
} from "@/data/reference/peritosMensuradores2026";

export const Route = createFileRoute("/catastro/peritos")({
  head: () => ({
    meta: [
      { title: "Peritos Mensuradores 2026 · Catastro Chile" },
      {
        name: "description",
        content:
          "Nómina oficial SERNAGEOMIN de peritos mensuradores habilitados para el año 2026 (114 nominados, Res. Exenta N°0652). Búsqueda por nombre o RUT.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PeritosPage,
});

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PeritosPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = normalize(q.trim());
    if (!term) return PERITOS_MENSURADORES_2026;
    return PERITOS_MENSURADORES_2026.filter(
      (p) =>
        normalize(p.nombre).includes(term) ||
        p.rut.replace(/\./g, "").includes(term.replace(/\./g, "")),
    );
  }, [q]);

  const meta = PERITOS_MENSURADORES_2026_META;

  return (
    <PublicCatastroShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Catastro · Peritos mensuradores
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Nómina de Peritos Mensuradores 2026</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mb-6">
          {meta.totalNominados} personas habilitadas por SERNAGEOMIN para realizar la mensura de
          pertenencias mineras durante 2026, conforme al artículo 71 del Código de Minería.
        </p>

        {/* Ficha del acto administrativo */}
        <div className="border border-border rounded-md bg-bg-secondary/20 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-mono uppercase tracking-wider">
              Ficha del acto administrativo
            </h2>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Resolución</dt>
              <dd className="font-semibold">
                {meta.resolucion} · {new Date(meta.fecha).toLocaleDateString("es-CL")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Organismo</dt>
              <dd className="font-semibold">{meta.organismo}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Firmante</dt>
              <dd className="font-semibold">{meta.firmante}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vigencia</dt>
              <dd className="font-semibold">{meta.vigencia}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Fundamento legal</dt>
              <dd className="leading-relaxed">{meta.fundamentoLegal}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nominados</dt>
              <dd className="font-semibold">
                {meta.totalNominados} total · {meta.funcionariosPropiedadMinera} funcionarios del
                Departamento de Propiedad Minera (la resolución no distingue cuáles)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Validación del documento</dt>
              <dd>
                <a
                  href={meta.validacionDocumento}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Verificar firma electrónica <ExternalLink className="w-3 h-3" />
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3 mb-6 text-xs text-amber-600">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            Esta nómina lista solo <strong>nombre y RUT</strong>, tal como los publica SERNAGEOMIN —
            la resolución no incluye datos de contacto. Para contratar un perito, GeoCapitals no
            intermedia ni certifica disponibilidad; verifica identidad y vigencia directamente antes
            de encargar una mensura.
          </p>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o RUT…"
            className="w-full pl-9 pr-3 py-2 rounded border border-border bg-background text-sm"
          />
        </div>

        <div className="text-[10px] font-mono text-muted-foreground mb-2">
          {filtered.length} de {PERITOS_MENSURADORES_2026.length} peritos
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-bg-secondary/40">
              <tr className="text-left text-muted-foreground">
                <th className="py-2 px-3 font-mono font-normal w-12">N°</th>
                <th className="py-2 px-3 font-mono font-normal">Nombre</th>
                <th className="py-2 px-3 font-mono font-normal">RUT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.n} className="border-t border-border hover:bg-bg-secondary/20">
                  <td className="py-2 px-3 font-mono text-muted-foreground">{p.n}</td>
                  <td className="py-2 px-3">{p.nombre}</td>
                  <td className="py-2 px-3 font-mono">{p.rut}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    Sin resultados para "{q}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-start gap-2 text-[10px] font-mono text-muted-foreground">
          <Gavel className="w-3 h-3 shrink-0 mt-0.5" />
          Fuente: {meta.resolucion}, {meta.organismo}. Documento informativo, no constituye
          certificación de vigencia individual — un perito puede haber cesado funciones por
          fallecimiento, renuncia u otra causa posterior a la publicación de la resolución.
        </div>
      </div>
    </PublicCatastroShell>
  );
}
