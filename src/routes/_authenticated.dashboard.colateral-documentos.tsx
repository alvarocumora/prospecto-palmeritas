import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createCollateralUpload,
  deleteCollateralDocument,
  getCollateralDataRoom,
  registerCollateralDocument,
  type CollateralDocRow,
} from "@/lib/investor/collateral.functions";
import { COLLATERAL_PROJECTS } from "@/lib/investor/collateralProgram";

export const Route = createFileRoute("/_authenticated/dashboard/colateral-documentos")({
  head: () => ({ meta: [{ title: "Documentos legales de los valles — Geocapitals" }] }),
  component: DataRoomPage,
});

/** Documentos que un inversionista espera ver antes de aceptar una parcela en garantía. */
const DOC_TYPES = [
  "Dominio vigente",
  "Hipotecas, gravámenes y prohibiciones",
  "Inscripción de dominio (copia)",
  "Plano de subdivisión",
  "Avalúo fiscal (SII)",
  "Certificado de deuda de contribuciones (TGR)",
  "Certificado de no expropiación",
  "Vigencia de la sociedad",
  "Vigencia de poderes",
  "Tasación",
  "Otro",
] as const;

type ProjectKey = "hualane" | "valle-escondido";

function DataRoomPage() {
  const fetchRoom = useServerFn(getCollateralDataRoom);
  const q = useQuery({ queryKey: ["collateral-dataroom"], queryFn: () => fetchRoom() });

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          Sala privada · Inversión con colateral
        </p>
        <h1 className="font-serif text-3xl mt-2">Documentos legales de los valles</h1>
        <p className="text-sm text-content-subtle mt-1 max-w-2xl">
          Antecedentes registrales de Valle de Hualañé y Valle Escondido Licantén. Los enlaces de
          descarga duran 10 minutos.
        </p>

        {q.isLoading && <p className="mt-8 text-sm text-content-subtle">Cargando…</p>}
        {q.isError && <p className="mt-8 text-sm text-destructive">{(q.error as Error).message}</p>}

        {q.data && !q.data.access && (
          <div className="mt-8 border border-hairline p-8 text-center max-w-lg mx-auto">
            <Lock className="w-6 h-6 mx-auto text-accent-brand" />
            <h2 className="font-serif text-xl mt-3">Acceso para inversionistas calificados</h2>
            <p className="text-sm text-content-subtle mt-2">
              Envía tu solicitud desde el simulador con el mismo email de tu cuenta. Cuando el
              equipo apruebe tu perfil, verás aquí los documentos.
            </p>
            <Link to="/inversion-colateral" className="mt-4 inline-block text-sm text-accent-brand">
              Ir al simulador
            </Link>
          </div>
        )}

        {q.data?.access && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {COLLATERAL_PROJECTS.map((p) => (
              <ProjectColumn
                key={p.key}
                projectKey={p.key}
                name={p.name}
                registry={p.registry}
                docs={q.data.docs.filter((d) => d.project_key === p.key)}
                staff={q.data.staff}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectColumn({
  projectKey,
  name,
  registry,
  docs,
  staff,
}: {
  projectKey: ProjectKey;
  name: string;
  registry: string;
  docs: CollateralDocRow[];
  staff: boolean;
}) {
  const qc = useQueryClient();
  const del = useServerFn(deleteCollateralDocument);
  const have = new Set(docs.map((d) => d.doc_type));
  const missing = DOC_TYPES.filter((t) => t !== "Otro" && !have.has(t));

  return (
    <section className="border border-hairline">
      <header className="p-5 border-b border-hairline">
        <h2 className="font-serif text-xl">{name}</h2>
        <p className="text-xs text-content-subtle mt-1">{registry}</p>
      </header>
      <ul className="divide-y divide-hairline">
        {docs.length === 0 && (
          <li className="p-5 text-sm text-content-subtle">Aún no hay documentos cargados.</li>
        )}
        {docs.map((d) => (
          <li key={d.id} className="p-4 flex items-center gap-3">
            <FileText className="w-4 h-4 text-accent-brand shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{d.title}</div>
              <div className="text-[11px] text-content-subtle">{d.doc_type}</div>
            </div>
            {d.url && (
              <a href={d.url} target="_blank" rel="noreferrer" className="text-sm text-accent-brand">
                Ver
              </a>
            )}
            {staff && (
              <button
                aria-label="Eliminar documento"
                className="text-content-subtle hover:text-destructive"
                onClick={async () => {
                  if (!confirm(`¿Eliminar "${d.title}"?`)) return;
                  try {
                    await del({ data: { id: d.id } });
                    void qc.invalidateQueries({ queryKey: ["collateral-dataroom"] });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="p-4 border-t border-hairline bg-accent-brand-subtle/50">
          <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
            Pendientes ({missing.length})
          </div>
          <p className="text-xs text-content-subtle mt-1">{missing.join(" · ")}</p>
        </div>
      )}
      {staff && <UploadBox projectKey={projectKey} />}
    </section>
  );
}

function UploadBox({ projectKey }: { projectKey: ProjectKey }) {
  const qc = useQueryClient();
  const createUp = useServerFn(createCollateralUpload);
  const register = useServerFn(registerCollateralDocument);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { path, token } = await createUp({ data: { projectKey, fileName: file.name } });
      const { error } = await supabase.storage.from("data-room").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await register({
        data: { projectKey, docType, title: file.name.replace(/\.[^.]+$/, ""), path },
      });
      toast.success("Documento cargado");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["collateral-dataroom"] });
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo cargar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 border-t border-hairline space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
        Cargar documento (solo equipo)
      </div>
      <select className="brand-input" value={docType} onChange={(e) => setDocType(e.target.value)}>
        {DOC_TYPES.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <button
        type="button"
        disabled={!file || busy}
        onClick={upload}
        className="inline-flex items-center gap-2 h-9 px-4 bg-content text-surface text-sm disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Subir
      </button>
    </div>
  );
}
