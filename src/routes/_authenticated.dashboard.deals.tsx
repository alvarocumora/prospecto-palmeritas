// Marketplace de propiedades mineras (deals): listado público con filtros
// y panel de detalle (overview + data room + inquiry/NDA + mensajería).

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Briefcase, MapPin, Search, Filter, Eye, Lock, FileText,
  Send, Layers, X, DollarSign, Percent, Mountain, ShieldCheck,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { usePropertyListings, usePropertyListing, type PropertyListing } from "@/hooks/usePropertyListings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/deals")({
  head: () => ({
    meta: [
      { title: "Marketplace de Propiedades — Geocapitals" },
      { name: "description", content: "Compra, venta, JV y royalties de propiedades mineras." },
    ],
  }),
  component: DealsPage,
});

const COMMODITY_OPTIONS = ["Au", "Ag", "Cu", "Au-Ag", "Au-Cu", "Cu-Au", "Li", "Fe", "Mo"];
const STAGE_OPTIONS = ["greenfield", "scoping", "brownfield", "prefeasibility", "feasibility", "production"];
const MODALITY_OPTIONS = ["sale", "jv", "royalty", "option", "lease"];

const STAGE_LABEL: Record<string, string> = {
  greenfield: "Greenfield",
  scoping: "Scoping",
  brownfield: "Brownfield",
  prefeasibility: "Pre-feasibility",
  feasibility: "Feasibility",
  production: "Producción",
};
const MODALITY_LABEL: Record<string, string> = {
  sale: "Venta",
  jv: "JV",
  royalty: "Royalty",
  option: "Opción",
  lease: "Arriendo",
};

function fmtUSD(v: number | null): string {
  if (v == null) return "A consultar";
  if (v >= 1_000_000) return `US$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `US$ ${(v / 1_000).toFixed(0)}k`;
  return `US$ ${v.toFixed(0)}`;
}

function DealsPage() {
  const { active } = useProjects();
  const { listings, loading, refresh } = usePropertyListings();
  const [scope, setScope] = useState<"project" | "all">(active ? "project" : "all");
  const [search, setSearch] = useState("");
  const [commodity, setCommodity] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [modality, setModality] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = listings.filter((l) => l.is_published);
    if (scope === "project" && active?.id) list = list.filter((l) => l.project_id === active.id);
    if (commodity) list = list.filter((l) => l.commodity === commodity);
    if (stage) list = list.filter((l) => l.stage === stage);
    if (modality) list = list.filter((l) => l.modality === modality);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.code ?? "").toLowerCase().includes(q) ||
          (l.region ?? "").toLowerCase().includes(q) ||
          (l.summary ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [listings, scope, active?.id, commodity, stage, modality, search]);

  const projectCount = useMemo(
    () => listings.filter((l) => l.is_published && l.project_id === active?.id).length,
    [listings, active?.id],
  );
  const allCount = useMemo(() => listings.filter((l) => l.is_published).length, [listings]);

  const clearFilters = () => {
    setSearch("");
    setCommodity("");
    setStage("");
    setModality("");
  };
  const activeFilters = (commodity ? 1 : 0) + (stage ? 1 : 0) + (modality ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto">
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="w-5 h-5 text-gold" />
          <h1 className="text-lg md:text-xl font-mono font-semibold text-foreground">
            Marketplace de Propiedades
          </h1>
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          Pertenencias, JVs, royalties y opciones de propiedades mineras. Firma NDA para acceder al data room.
        </p>
      </header>

      {/* Scope tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-border">
        <button
          onClick={() => setScope("project")}
          disabled={!active}
          className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors disabled:opacity-40 ${
            scope === "project"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mi proyecto {active ? `(${projectCount})` : ""}
        </button>
        <button
          onClick={() => setScope("all")}
          className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors ${
            scope === "all"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Todo el marketplace ({allCount})
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, código, región…"
            className="w-full pl-7 pr-2 py-1.5 text-xs font-mono rounded border border-border bg-background outline-none focus:border-gold"
          />
        </div>
        <FilterSelect
          icon={<Mountain className="w-3 h-3" />}
          value={commodity}
          onChange={setCommodity}
          placeholder="Commodity"
          options={COMMODITY_OPTIONS}
        />
        <FilterSelect
          icon={<Layers className="w-3 h-3" />}
          value={stage}
          onChange={setStage}
          placeholder="Etapa"
          options={STAGE_OPTIONS}
          labelMap={STAGE_LABEL}
        />
        <FilterSelect
          icon={<Briefcase className="w-3 h-3" />}
          value={modality}
          onChange={setModality}
          placeholder="Modalidad"
          options={MODALITY_OPTIONS}
          labelMap={MODALITY_LABEL}
        />
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" /> Limpiar ({activeFilters})
          </button>
        )}
        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          <Filter className="w-3 h-3 inline mr-1" />
          {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-xs font-mono text-muted-foreground">Cargando ofertas…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Briefcase className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <div className="text-sm font-mono text-foreground mb-1">Sin resultados</div>
          <div className="text-xs font-mono text-muted-foreground">
            {activeFilters > 0
              ? "Ajusta los filtros o cambia el scope."
              : scope === "project"
                ? "Este proyecto aún no tiene listings públicos."
                : "No hay propiedades publicadas."}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} onOpen={() => setSelectedId(l.id)} />
          ))}
        </div>
      )}

      <ListingDetailDrawer
        listingId={selectedId}
        onClose={() => setSelectedId(null)}
        onMutated={refresh}
      />
    </div>
  );
}

function FilterSelect({
  value, onChange, placeholder, options, labelMap, icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labelMap?: Record<string, string>;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center">
      {icon && <span className="absolute left-2 text-muted-foreground pointer-events-none">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none pr-6 py-1.5 text-xs font-mono rounded border border-border bg-background outline-none focus:border-gold cursor-pointer ${icon ? "pl-7" : "pl-2"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelMap?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ListingCard({ listing, onOpen }: { listing: PropertyListing; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-lg border border-border bg-bg-secondary hover:border-gold/60 hover:bg-bg-elevated transition-all overflow-hidden flex flex-col group"
    >
      <div className="aspect-[16/9] bg-bg-elevated relative overflow-hidden">
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mountain className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/85 backdrop-blur text-[9px] font-mono uppercase text-gold border border-gold/40">
          {MODALITY_LABEL[listing.modality] ?? listing.modality}
        </div>
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/85 backdrop-blur text-[9px] font-mono text-foreground">
          <Eye className="w-2.5 h-2.5" /> {listing.views_count}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-mono font-semibold text-foreground line-clamp-2 group-hover:text-gold transition-colors">
            {listing.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border">{listing.commodity}</span>
          <span>{STAGE_LABEL[listing.stage] ?? listing.stage}</span>
        </div>
        {(listing.region || listing.country) && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {[listing.region, listing.country].filter(Boolean).join(", ")}
            {listing.area_ha && <span className="ml-auto">{listing.area_ha.toLocaleString("es-CL")} ha</span>}
          </div>
        )}
        {listing.summary && (
          <p className="text-[11px] font-mono text-muted-foreground line-clamp-2 mt-1">
            {listing.summary}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-border">
          <div className="text-xs font-mono text-gold font-semibold">
            {listing.modality === "royalty" && listing.royalty_pct != null
              ? `${listing.royalty_pct}% NSR`
              : fmtUSD(listing.asking_price_usd)}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground group-hover:text-gold">
            Ver detalle →
          </span>
        </div>
      </div>
    </button>
  );
}

function ListingDetailDrawer({
  listingId, onClose, onMutated,
}: {
  listingId: string | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  const { user } = useAuth();
  const { listing, files, inquiry, loading, refresh } = usePropertyListing(listingId);
  const [tab, setTab] = useState<"overview" | "dataroom" | "inquiry">("overview");
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
    const { error } = await supabase.from("property_deal_inquiries").upsert(
      {
        listing_id: listing.id,
        inquirer_user_id: user.id,
        message: message.trim(),
        status: inquiry?.status ?? "inquiry",
      },
      { onConflict: "listing_id,inquirer_user_id" },
    );
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
    const { error } = await supabase.from("property_deal_inquiries").upsert(
      {
        listing_id: listing.id,
        inquirer_user_id: user.id,
        nda_signed_at: new Date().toISOString(),
        nda_signature: user.email ?? "signed",
        status: "nda_signed",
      },
      { onConflict: "listing_id,inquirer_user_id" },
    );
    setSigning(false);
    if (error) {
      toast.error(`No se pudo firmar el NDA: ${error.message}`);
      return;
    }
    toast.success("NDA firmado · acceso al data room habilitado");
    refresh();
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full bg-bg-secondary border-l border-border flex flex-col animate-fade-up overflow-hidden">
        {loading || !listing ? (
          <div className="flex-1 flex items-center justify-center text-xs font-mono text-muted-foreground">
            Cargando…
          </div>
        ) : (
          <>
            <header className="shrink-0 border-b border-border">
              <div className="aspect-[16/7] bg-bg-elevated relative">
                {listing.cover_image_url ? (
                  <img src={listing.cover_image_url} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Mountain className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur border border-border text-foreground hover:bg-background inline-flex items-center justify-center"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-gold/90 text-bg-primary text-[9px] font-mono uppercase font-bold">
                      {MODALITY_LABEL[listing.modality] ?? listing.modality}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-background/85 backdrop-blur text-[9px] font-mono text-foreground border border-border">
                      {listing.commodity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-background/85 backdrop-blur text-[9px] font-mono text-muted-foreground border border-border">
                      {STAGE_LABEL[listing.stage] ?? listing.stage}
                    </span>
                  </div>
                  <h2 className="text-base md:text-lg font-mono font-bold text-foreground drop-shadow-lg">
                    {listing.title}
                  </h2>
                  {listing.code && (
                    <div className="text-[10px] font-mono text-muted-foreground">{listing.code}</div>
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

              <nav className="flex gap-1 px-3 border-t border-border">
                {(["overview", "dataroom", "inquiry"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-xs font-mono border-b-2 -mb-px transition-colors ${
                      tab === t
                        ? "border-gold text-gold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "overview" && "Resumen"}
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
                    <h3 className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Descripción</h3>
                    <p className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                      {listing.summary || "Sin descripción provista."}
                    </p>
                  </section>
                  {listing.data_available.length > 0 && (
                    <section>
                      <h3 className="text-[10px] font-mono uppercase text-muted-foreground mb-2">
                        Información disponible
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {listing.data_available.map((d) => (
                          <span
                            key={d}
                            className="px-2 py-1 rounded border border-border bg-bg-elevated text-[10px] font-mono text-foreground"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="grid grid-cols-2 gap-3">
                    <Field label="Modalidad" value={MODALITY_LABEL[listing.modality] ?? listing.modality} />
                    <Field label="Etapa" value={STAGE_LABEL[listing.stage] ?? listing.stage} />
                    <Field label="Commodity" value={listing.commodity} />
                    <Field label="Royalty" value={listing.royalty_pct ? `${listing.royalty_pct}%` : "—"} icon={<Percent className="w-3 h-3" />} />
                    <Field label="Publicado" value={new Date(listing.created_at).toLocaleDateString("es-CL")} />
                    <Field label="Vistas" value={String(listing.views_count)} />
                  </section>
                </div>
              )}

              {tab === "dataroom" && (
                <div>
                  {!canSeeNda && (
                    <div className="mb-3 p-3 rounded border border-gold/30 bg-gold/5 text-xs font-mono text-foreground">
                      <Lock className="w-3.5 h-3.5 inline mr-1.5 text-gold" />
                      Algunos archivos requieren NDA firmado. Ve a la pestaña <strong>Contacto / NDA</strong>.
                    </div>
                  )}
                  {files.length === 0 ? (
                    <div className="text-center py-10 text-xs font-mono text-muted-foreground">
                      El titular aún no ha subido archivos al data room.
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {files.map((f) => {
                        const locked = f.requires_nda && !canSeeNda;
                        return (
                          <li
                            key={f.id}
                            className="flex items-center gap-2 px-2 py-2 rounded border border-border bg-background"
                          >
                            {locked ? (
                              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-gold shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-foreground truncate">{f.file_name}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {f.category ?? "documento"}
                                {f.file_size_bytes ? ` · ${(f.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : ""}
                                {f.requires_nda && " · NDA"}
                              </div>
                            </div>
                            {locked ? (
                              <span className="text-[10px] font-mono text-muted-foreground">Bloqueado</span>
                            ) : (
                              <span className="text-[10px] font-mono text-gold">Accesible</span>
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
                  {isOwner ? (
                    <div className="p-3 rounded border border-border bg-bg-elevated text-xs font-mono text-muted-foreground">
                      Eres el titular de este listing. Las consultas de interesados aparecerán en tu bandeja.
                    </div>
                  ) : (
                    <>
                      <section className="p-3 rounded border border-border bg-bg-elevated">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck className={`w-4 h-4 ${ndaSigned ? "text-gold" : "text-muted-foreground"}`} />
                          <h3 className="text-xs font-mono font-semibold">
                            Acuerdo de Confidencialidad (NDA)
                          </h3>
                        </div>
                        {ndaSigned ? (
                          <div className="text-[11px] font-mono text-foreground">
                            Firmaste el NDA el{" "}
                            {new Date(inquiry!.nda_signed_at!).toLocaleString("es-CL")}. Puedes acceder a los
                            archivos restringidos del data room.
                          </div>
                        ) : (
                          <>
                            <p className="text-[11px] font-mono text-muted-foreground mb-2 leading-relaxed">
                              Al firmar accedes a información confidencial del titular bajo obligación de no
                              divulgación. Tu nombre, email y fecha quedarán registrados.
                            </p>
                            <button
                              onClick={signNDA}
                              disabled={signing || !user}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90 disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {signing ? "Firmando…" : "Firmar NDA"}
                            </button>
                          </>
                        )}
                      </section>

                      <section>
                        <h3 className="text-xs font-mono font-semibold mb-2">Enviar consulta al titular</h3>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          placeholder="Describe tu interés (LOI preliminar, due diligence, calendario…)"
                          className="w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-background outline-none focus:border-gold resize-none"
                        />
                        <button
                          onClick={submitInquiry}
                          disabled={sending || !message.trim() || !user}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-background text-foreground hover:bg-accent text-xs font-mono disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5 text-gold" />
                          {sending ? "Enviando…" : inquiry ? "Actualizar consulta" : "Enviar consulta"}
                        </button>
                        {inquiry && (
                          <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                            Estado actual: <span className="text-foreground">{inquiry.status}</span> · creada el{" "}
                            {new Date(inquiry.created_at).toLocaleDateString("es-CL")}
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
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xs font-mono font-semibold text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-xs font-mono text-foreground">{value}</div>
    </div>
  );
}
