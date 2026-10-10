import { useState } from "react";
import {
  X,
  Mountain,
  DollarSign,
  MapPin,
  Layers,
  Lock,
  FileText,
  ShieldCheck,
  Percent,
  Send,
  Download,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePropertyListing } from "@/hooks/usePropertyListings";
import { getDataRoomDownloadUrl, signNdaAndGrantAccess } from "@/lib/dataRoom.functions";
import { ValuationPanel } from "./ValuationPanel";
import { DealStageTracker } from "./DealStageTracker";
import { MODALITY_LABEL, STAGE_LABEL } from "../domain/constants";
import { fmtUSD } from "../domain/format";
import { upsertInquiry } from "../application/inquiries";

export function ListingDetailDrawer({
  listingId,
  onClose,
  onMutated,
}: {
  listingId: string | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  const { user } = useAuth();
  const { listing, files, inquiry, loading, refresh } = usePropertyListing(listingId);
  const [tab, setTab] = useState<"overview" | "valuation" | "dataroom" | "inquiry">("overview");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);

  const isOwner = !!(user && listing && user.id === listing.owner_user_id);
  const ndaSigned = !!inquiry?.nda_signed_at;
  const canSeeNda = isOwner || ndaSigned;

  if (!listingId) return null;

  const submitInquiry = async () => {
    if (!user || !listing || !message.trim()) return;
    setSending(true);
    const { error } = await upsertInquiry({
      listingId: listing.id,
      userId: user.id,
      message,
      currentStatus: inquiry?.status,
    });
    setSending(false);
    if (error) {
      toast.error(`No se pudo enviar: ${error.message}`);
      return;
    }
    setMessage("");
    toast.success("Mensaje enviado al titular");
    refresh();
    onMutated();
  };

  const signNDA = async () => {
    if (!user || !listing) return;
    setSigning(true);
    try {
      // Firma NDA + avance de etapa + permiso de data room + bitácora (server)
      await signNdaAndGrantAccess({
        data: { listingId: listing.id, signature: user.email ?? "signed" },
      });
      toast.success("NDA firmado · acceso al data room habilitado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar el NDA");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-surface/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full bg-surface-2 border-l border-hairline flex flex-col animate-fade-up overflow-hidden">
        {loading || !listing ? (
          <div className="flex-1 flex items-center justify-center text-xs font-mono text-content-subtle">
            Cargando…
          </div>
        ) : (
          <>
            <header className="shrink-0 border-b border-hairline">
              <div className="aspect-[16/7] bg-surface-3 relative">
                {listing.cover_image_url ? (
                  <img
                    src={listing.cover_image_url}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Mountain className="w-12 h-12 text-content-subtle/30" />
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface/80 backdrop-blur border border-hairline text-content hover:bg-surface inline-flex items-center justify-center"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-accent-brand/90 text-bg-primary text-[9px] font-mono uppercase font-bold">
                      {MODALITY_LABEL[listing.modality] ?? listing.modality}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface/85 backdrop-blur text-[9px] font-mono text-content border border-hairline">
                      {listing.commodity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface/85 backdrop-blur text-[9px] font-mono text-content-subtle border border-hairline">
                      {STAGE_LABEL[listing.stage] ?? listing.stage}
                    </span>
                  </div>
                  <h2 className="text-base md:text-lg font-mono font-bold text-content drop-shadow-lg">
                    {listing.title}
                  </h2>
                  {listing.code && (
                    <div className="text-[10px] font-mono text-content-subtle">{listing.code}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border">
                <Stat
                  icon={<DollarSign className="w-3 h-3" />}
                  label="Precio"
                  value={
                    listing.modality === "royalty" && listing.royalty_pct != null
                      ? `${listing.royalty_pct}% NSR`
                      : fmtUSD(listing.asking_price_usd)
                  }
                />
                <Stat
                  icon={<MapPin className="w-3 h-3" />}
                  label="Ubicación"
                  value={[listing.region, listing.country].filter(Boolean).join(", ") || "—"}
                />
                <Stat
                  icon={<Layers className="w-3 h-3" />}
                  label="Superficie"
                  value={listing.area_ha ? `${listing.area_ha.toLocaleString("es-CL")} ha` : "—"}
                />
              </div>

              <nav className="flex gap-1 px-3 border-t border-hairline overflow-x-auto">
                {(["overview", "valuation", "dataroom", "inquiry"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                      tab === t
                        ? "border-accent-brand text-accent-brand"
                        : "border-transparent text-content-subtle hover:text-content"
                    }`}
                  >
                    {t === "overview" && "Resumen"}
                    {t === "valuation" && (
                      <>
                        <Calculator className="w-3 h-3" /> Valuación
                      </>
                    )}
                    {t === "dataroom" && `Data Room (${files.length})`}
                    {t === "inquiry" && "Contacto / NDA"}
                  </button>
                ))}
              </nav>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "overview" && (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-[10px] font-mono uppercase text-content-subtle mb-2">
                      Descripción
                    </h3>
                    <p className="text-xs font-mono text-content whitespace-pre-wrap leading-relaxed">
                      {listing.summary || "Sin descripción provista."}
                    </p>
                  </section>
                  {listing.data_available.length > 0 && (
                    <section>
                      <h3 className="text-[10px] font-mono uppercase text-content-subtle mb-2">
                        Información disponible
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {listing.data_available.map((d) => (
                          <span
                            key={d}
                            className="px-2 py-1 rounded border border-hairline bg-surface-3 text-[10px] font-mono text-content"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="grid grid-cols-2 gap-3">
                    <Field
                      label="Modalidad"
                      value={MODALITY_LABEL[listing.modality] ?? listing.modality}
                    />
                    <Field label="Etapa" value={STAGE_LABEL[listing.stage] ?? listing.stage} />
                    <Field label="Commodity" value={listing.commodity} />
                    <Field
                      label="Royalty"
                      value={listing.royalty_pct ? `${listing.royalty_pct}%` : "—"}
                      icon={<Percent className="w-3 h-3" />}
                    />
                    <Field
                      label="Publicado"
                      value={new Date(listing.created_at).toLocaleDateString("es-CL")}
                    />
                    <Field label="Vistas" value={String(listing.views_count)} />
                  </section>
                </div>
              )}

              {tab === "valuation" && <ValuationPanel listingId={listing.id} />}

              {tab === "dataroom" && (
                <div>
                  {!canSeeNda && (
                    <div className="mb-3 p-3 rounded border border-accent-brand/30 bg-accent-brand/5 text-xs font-mono text-content">
                      <Lock className="w-3.5 h-3.5 inline mr-1.5 text-accent-brand" />
                      Algunos archivos requieren NDA firmado. Ve a la pestaña{" "}
                      <strong>Contacto / NDA</strong>.
                    </div>
                  )}
                  {files.length === 0 ? (
                    <div className="text-center py-10 text-xs font-mono text-content-subtle">
                      El titular aún no ha subido archivos al data room.
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {files.map((f) => {
                        const locked = f.requires_nda && !canSeeNda;
                        return (
                          <li
                            key={f.id}
                            className="flex items-center gap-2 px-2 py-2 rounded border border-hairline bg-surface"
                          >
                            {locked ? (
                              <Lock className="w-3.5 h-3.5 text-content-subtle shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-accent-brand shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-content truncate">
                                {f.file_name}
                              </div>
                              <div className="text-[10px] font-mono text-content-subtle">
                                {f.category ?? "documento"}
                                {f.file_size_bytes
                                  ? ` · ${(f.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                                  : ""}
                                {f.requires_nda && " · NDA"}
                              </div>
                            </div>
                            {locked ? (
                              <span className="text-[10px] font-mono text-content-subtle">
                                Bloqueado
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const { url } = await getDataRoomDownloadUrl({
                                      data: { listingId: listing.id, fileId: f.id },
                                    });

                                    window.open(url, "_blank", "noopener");
                                  } catch (e) {
                                    toast.error(
                                      e instanceof Error ? e.message : "Error al descargar",
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-brand hover:underline"
                              >
                                <Download className="w-3 h-3" /> Descargar
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {tab === "inquiry" && (
                <div className="space-y-4">
                  {inquiry && (
                    <DealStageTracker
                      listingId={listing.id}
                      onAdvanced={() => {
                        refresh();
                        onMutated();
                      }}
                    />
                  )}
                  {isOwner ? (
                    <div className="p-3 rounded border border-hairline bg-surface-3 text-xs font-mono text-content-subtle">
                      Eres el titular de este listing. Las consultas de interesados aparecerán en tu
                      bandeja.
                    </div>
                  ) : (
                    <>
                      <section className="p-3 rounded border border-hairline bg-surface-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck
                            className={`w-4 h-4 ${ndaSigned ? "text-accent-brand" : "text-content-subtle"}`}
                          />
                          <h3 className="text-xs font-mono font-semibold">
                            Acuerdo de Confidencialidad (NDA)
                          </h3>
                        </div>
                        {ndaSigned ? (
                          <div className="text-[11px] font-mono text-content">
                            Firmaste el NDA el{" "}
                            {new Date(inquiry!.nda_signed_at!).toLocaleString("es-CL")}. Puedes
                            acceder a los archivos restringidos del data room.
                          </div>
                        ) : (
                          <>
                            <p className="text-[11px] font-mono text-content-subtle mb-2 leading-relaxed">
                              Al firmar accedes a información confidencial del titular bajo
                              obligación de no divulgación. Tu nombre, email y fecha quedarán
                              registrados.
                            </p>
                            <button
                              onClick={signNDA}
                              disabled={signing || !user}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-brand text-bg-primary text-xs font-mono font-semibold hover:bg-accent-brand/90 disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {signing ? "Firmando…" : "Firmar NDA"}
                            </button>
                          </>
                        )}
                      </section>

                      <section>
                        <h3 className="text-xs font-mono font-semibold mb-2">
                          Enviar consulta al titular
                        </h3>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          placeholder="Describe tu interés (LOI preliminar, due diligence, calendario…)"
                          className="w-full px-2 py-1.5 text-xs font-mono rounded border border-hairline bg-surface outline-none focus:border-accent-brand resize-none"
                        />
                        <button
                          onClick={submitInquiry}
                          disabled={sending || !message.trim() || !user}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-hairline bg-surface text-content hover:bg-accent text-xs font-mono disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5 text-accent-brand" />
                          {sending
                            ? "Enviando…"
                            : inquiry
                              ? "Actualizar consulta"
                              : "Enviar consulta"}
                        </button>
                        {inquiry && (
                          <div className="mt-2 text-[10px] font-mono text-content-subtle">
                            Estado actual: <span className="text-content">{inquiry.status}</span> ·
                            creada el {new Date(inquiry.created_at).toLocaleDateString("es-CL")}
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-content-subtle">
        {icon}
        {label}
      </div>
      <div className="text-xs font-mono font-semibold text-content mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-content-subtle mb-0.5 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-xs font-mono text-content">{value}</div>
    </div>
  );
}
