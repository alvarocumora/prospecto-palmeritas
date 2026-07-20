import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  Loader2,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listMyCommodityLots } from "@/lib/myCommodityLots.functions";
import { listMySignRequests } from "@/lib/documents/signing.functions";
import {
  listMyKycDocs,
  requestKycUpload,
  deleteMyKycDoc,
  type KycDoc,
} from "@/lib/supplierPortal.functions";
import { commodityLabel } from "@/lib/commodityLabels";

// Portal centralizado para proveedores: perfil de empresa, documentación KYC
// (subida real a storage privado), estado de lotes publicados y firmas
// pendientes en un único tablero. Todo lo demás ya existe como módulos
// separados; este hub tiene enlaces contextuales para no duplicar UI.

export const Route = createFileRoute("/_authenticated/dashboard/proveedor")({
  head: () => ({
    meta: [
      { title: "Portal de proveedores — Geocapitals" },
      { name: "description", content: "Registro, KYC, lotes y firmas del proveedor." },
    ],
  }),
  component: SupplierPortalPage,
});

const KYC_SUGGESTED = [
  "Constitución de la sociedad",
  "RUT / Tax ID de la empresa",
  "Cédula del representante legal",
  "Certificado de vigencia",
  "Certificado bancario",
  "Título minero o autorización del productor",
  "Certificado de análisis (assay)",
  "Referencia comercial",
];

function SupplierPortalPage() {
  const { profile, user, loading } = useAuth();
  const listLots = useServerFn(listMyCommodityLots);
  const listSigns = useServerFn(listMySignRequests);
  const listKyc = useServerFn(listMyKycDocs);
  const uploadFn = useServerFn(requestKycUpload);
  const deleteFn = useServerFn(deleteMyKycDoc);

  const lotsQ = useQuery({
    queryKey: ["supplier-portal-lots"],
    queryFn: () => listLots(),
    staleTime: 30_000,
  });
  const signsQ = useQuery({
    queryKey: ["supplier-portal-signs"],
    queryFn: () => listSigns(),
    staleTime: 30_000,
  });
  const kycQ = useQuery({
    queryKey: ["supplier-portal-kyc"],
    queryFn: () => listKyc(),
    staleTime: 30_000,
  });

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Máximo 25 MB por archivo.");
      return;
    }
    setUploading(true);
    try {
      const { bucket, path, token } = await uploadFn({ data: { fileName: file.name } });
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (up.error) throw up.error;
      toast.success(`Subido: ${file.name}`);
      kycQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir.");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (doc: KycDoc) => {
    if (!window.confirm(`¿Eliminar "${doc.name}"?`)) return;
    setDeleting(doc.path);
    try {
      await deleteFn({ data: { path: doc.path } });
      toast.success("Eliminado");
      kycQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeleting(null);
    }
  };

  // Progreso de onboarding: perfil + al menos un doc + al menos un lote
  const progress = useMemo(() => {
    const steps = [
      {
        key: "profile",
        label: "Perfil de empresa",
        done: Boolean(profile?.display_name && profile?.organization),
      },
      { key: "kyc", label: "Documentación KYC", done: (kycQ.data?.length ?? 0) > 0 },
      { key: "lot", label: "Primer lote publicado", done: (lotsQ.data?.length ?? 0) > 0 },
    ];
    const done = steps.filter((s) => s.done).length;
    return { steps, done, pct: Math.round((done / steps.length) * 100) };
  }, [profile, kycQ.data, lotsQ.data]);

  const now = new Date();
  const pendingSigns = (signsQ.data ?? []).filter(
    (s) => s.status === "pending" && new Date(s.expires_at) >= now,
  );

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-content-subtle">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface">
      <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-hairline">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-brand">
              <Building2 className="w-4 h-4" />
              Portal de proveedores
            </div>
            <h1 className="font-display text-3xl text-content mt-1">
              {profile?.organization || profile?.display_name || user?.email}
            </h1>
            <p className="text-sm text-content-subtle mt-1">
              Registra tu empresa, sube la documentación, publica lotes y firma los acuerdos con el
              comprador — todo desde un solo lugar.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              Onboarding
            </div>
            <div className="font-display text-3xl text-content">{progress.pct}%</div>
          </div>
        </header>

        {/* Progreso onboarding */}
        <section className="rounded-xl border border-hairline bg-white p-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {progress.steps.map((s) => (
              <div
                key={s.key}
                className={`flex items-center gap-2 p-3 rounded-lg border ${
                  s.done
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-hairline bg-surface-subtle"
                }`}
              >
                {s.done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-content-subtle shrink-0" />
                )}
                <div className="text-sm text-content">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Perfil */}
          <section className="lg:col-span-1 rounded-xl border border-hairline bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <UserCircle2 className="w-5 h-5 text-accent-brand" />
              <h2 className="font-display text-lg text-content">Perfil</h2>
            </div>
            <dl className="text-sm space-y-2">
              <Row label="Contacto" value={profile?.display_name} />
              <Row label="Empresa" value={profile?.organization} />
              <Row label="Email" value={profile?.email ?? user?.email ?? null} />
              <Row
                label="Tipo de cuenta"
                value={
                  profile?.account_type === "mining_owner"
                    ? "Productor / titular minero"
                    : profile?.account_type ?? "—"
                }
              />
            </dl>
            <Link
              to="/dashboard/profile"
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-accent-brand hover:underline"
            >
              Editar perfil <ExternalLink className="w-3 h-3" />
            </Link>
          </section>

          {/* KYC docs */}
          <section className="lg:col-span-2 rounded-xl border border-hairline bg-white p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent-brand" />
                <h2 className="font-display text-lg text-content">Documentación (KYC)</h2>
              </div>
              <label className="inline-flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg border border-hairline bg-surface-subtle hover:border-accent-brand cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                {uploading ? "Subiendo…" : "Subir documento"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void onPickFile(e)}
                />
              </label>
            </div>

            {kycQ.isLoading ? (
              <div className="h-20 rounded bg-surface-subtle animate-pulse" />
            ) : (kycQ.data?.length ?? 0) === 0 ? (
              <div className="text-sm text-content-subtle border border-dashed border-hairline rounded-lg p-4">
                <p className="mb-2">Aún no subes documentos. Suelen pedirte:</p>
                <ul className="grid sm:grid-cols-2 gap-y-1 text-[13px] list-disc pl-5">
                  {KYC_SUGGESTED.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {(kycQ.data ?? []).map((d) => (
                  <li key={d.path} className="flex items-center gap-2 py-2">
                    <FileText className="w-4 h-4 text-accent-brand shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-content truncate">{d.name}</div>
                      <div className="text-[11px] text-content-subtle">
                        {new Date(d.uploadedAt).toLocaleDateString("es-CL")}
                        {d.size ? ` · ${Math.round(d.size / 1024)} KB` : ""}
                      </div>
                    </div>
                    {d.signedUrl && (
                      <a
                        href={d.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-surface-subtle"
                        title="Ver"
                      >
                        <ExternalLink className="w-4 h-4 text-content-subtle" />
                      </a>
                    )}
                    <button
                      onClick={() => void onDelete(d)}
                      disabled={deleting === d.path}
                      className="p-1.5 rounded hover:bg-surface-subtle disabled:opacity-50"
                    >
                      {deleting === d.path ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-content-subtle">
              Almacenamiento privado. Sólo el equipo Geocapitals accede para verificar.
            </p>
          </section>
        </div>

        {/* Lotes */}
        <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-brand" />
              <h2 className="font-display text-lg text-content">Mis lotes</h2>
            </div>
            <Link
              to="/dashboard/commodity-lots"
              className="inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg bg-accent-brand text-white hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" /> Publicar lote
            </Link>
          </div>
          {lotsQ.isLoading ? (
            <div className="h-20 rounded bg-surface-subtle animate-pulse" />
          ) : (lotsQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-content-subtle">
              Aún no publicas lotes. Al crear el primero pasará por verificación del equipo antes de
              aparecer en el marketplace.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-content-subtle border-b border-hairline">
                    <th className="py-2 pr-2">Lote</th>
                    <th className="py-2 pr-2">Commodity</th>
                    <th className="py-2 pr-2">País</th>
                    <th className="py-2 pr-2">Toneladas</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2 pr-2">Consultas</th>
                  </tr>
                </thead>
                <tbody>
                  {(lotsQ.data ?? []).slice(0, 10).map((l) => (
                    <tr key={l.id} className="border-b border-hairline/50">
                      <td className="py-2 pr-2 text-content">{l.title}</td>
                      <td className="py-2 pr-2 text-content-subtle">
                        {commodityLabel(l.commodity)}
                      </td>
                      <td className="py-2 pr-2 text-content-subtle">{l.country}</td>
                      <td className="py-2 pr-2 text-content-subtle">
                        {l.tonnage_available_t?.toLocaleString("es-CL") ?? "—"}
                      </td>
                      <td className="py-2 pr-2">
                        <LotStatusBadge status={l.status} verified={l.is_verified} />
                      </td>
                      <td className="py-2 pr-2 text-content-subtle">{l.inquiry_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Firmas */}
        <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-accent-brand" />
              <h2 className="font-display text-lg text-content">Firmas y acuerdos</h2>
            </div>
            <Link
              to="/dashboard/firmas"
              className="inline-flex items-center gap-1 text-[12px] text-accent-brand hover:underline"
            >
              Ver todas <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          {signsQ.isLoading ? (
            <div className="h-20 rounded bg-surface-subtle animate-pulse" />
          ) : pendingSigns.length === 0 && (signsQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-content-subtle">
              Aún no hay documentos para firmar. Cuando el comprador emita un NCNDA, LOI o SPA
              aparecerá aquí para que lo firmes en línea.
            </p>
          ) : pendingSigns.length === 0 ? (
            <p className="text-sm text-content-subtle inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              No tienes firmas pendientes.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {pendingSigns.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-content truncate">{s.title}</div>
                    <div className="text-[11px] text-content-subtle">
                      Expira {new Date(s.expires_at).toLocaleDateString("es-CL")}
                    </div>
                  </div>
                  <Link
                    to="/dashboard/firmas"
                    className="text-[12px] text-accent-brand hover:underline"
                  >
                    Ver
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[11px] font-mono uppercase tracking-wider text-content-subtle">
        {label}
      </dt>
      <dd className="text-content text-right truncate">{value || "—"}</dd>
    </div>
  );
}

function LotStatusBadge({ status, verified }: { status: string; verified: boolean }) {
  const meta =
    status === "published" && verified
      ? { label: "Publicado", cls: "bg-green-500/15 text-green-700 border-green-500/30" }
      : status === "pending_verification"
        ? { label: "En verificación", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" }
        : status === "sold"
          ? { label: "Vendido", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30" }
          : status === "rejected"
            ? { label: "Rechazado", cls: "bg-red-500/15 text-red-700 border-red-500/30" }
            : { label: status, cls: "bg-surface-subtle text-content-subtle border-hairline" };
  const Icon = status === "published" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${meta.cls}`}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}
