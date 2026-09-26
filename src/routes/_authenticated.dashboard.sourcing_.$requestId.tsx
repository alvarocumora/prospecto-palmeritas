import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  Share2,
  Star,
  XCircle,
  Handshake,
  ArrowRight,
  Send,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  getSourcingRequestDetail,
  setSubmissionStatus,
  setRequestStatus,
  generateSubmissionShareLink,
  convertSubmissionToTrade,
  getSupplierFileUrl,
  dispatchSupplierSheetToBuyers,
  listSupplierSheetDispatches,
  type SubmissionRow,
} from "@/lib/sourcing.functions";
import { listPartners } from "@/lib/clients.functions";
import { supplierSheetUrl } from "@/lib/publicUrl";
import {
  SUBMISSION_STATUS_LABELS,
  SUPPLIER_ROLE_LABELS,
  normalizeSupplierRole,
  isOfferExpired,
  type SubmissionStatus,
} from "@/lib/sourcing";

export const Route = createFileRoute("/_authenticated/dashboard/sourcing_/$requestId")({
  head: () => ({ meta: [{ title: "Requerimiento — Geocapitals" }] }),
  component: RequestDetail,
});

const fmtUsdT = (n: number | null) =>
  n != null ? `US$ ${Math.round(n).toLocaleString("es-CL")}/t` : "—";

function RequestDetail() {
  const { requestId } = Route.useParams();
  const navigate = Route.useNavigate();
  const detailFn = useServerFn(getSourcingRequestDetail);
  const statusFn = useServerFn(setSubmissionStatus);
  const reqStatusFn = useServerFn(setRequestStatus);
  const shareFn = useServerFn(generateSubmissionShareLink);
  const convertFn = useServerFn(convertSubmissionToTrade);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sourcing-detail", requestId],
    queryFn: () => detailFn({ data: { id: requestId } }),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [converting, setConverting] = useState<string | null>(null);

  const onConvert = async (id: string) => {
    setConverting(id);
    try {
      const { tradeId } = await convertFn({ data: { submissionId: id } });
      toast.success("Propuesta convertida en trade. Abriendo la operación…");
      navigate({ to: "/dashboard/trades/$tradeId", params: { tradeId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo convertir.");
      setConverting(null);
    }
  };

  const onStatus = async (id: string, status: SubmissionStatus) => {
    try {
      await statusFn({ data: { id, status } });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  };

  const onShare = async (id: string) => {
    try {
      const { shareToken } = await shareFn({ data: { submissionId: id } });
      const url = supplierSheetUrl(shareToken);
      setShareLinks((m) => ({ ...m, [id]: url }));
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Ficha de proveedor lista. Link copiado para el comprador.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la ficha.");
    }
  };

  if (isLoading) return <div className="p-6 max-w-3xl h-40 rounded bg-muted/20 animate-pulse" />;
  if (!data?.request) {
    return (
      <div className="p-6 max-w-3xl text-center py-20">
        <h1 className="text-xl font-semibold mb-2">Requerimiento no encontrado</h1>
        <Link to="/dashboard/sourcing" className="text-primary underline text-sm">
          Volver a requerimientos
        </Link>
      </div>
    );
  }

  const req = data.request;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1100px]">
      <Link
        to="/dashboard/sourcing"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Requerimientos
      </Link>

      <div className="rounded-md border border-border bg-bg-secondary/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{req.reference}</h1>
              <span
                className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  req.status === "abierto"
                    ? "bg-green-500/15 text-green-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {req.status}
              </span>
            </div>
            <div className="text-sm text-text-secondary mt-1">
              {req.commodity}
              {req.form ? ` · ${req.form}` : ""}
              {req.quantity_t ? ` · ${req.quantity_t} t` : ""}
              {req.incoterm ? ` · ${req.incoterm}` : ""}
              {req.destination ? ` · ${req.destination}` : ""}
            </div>
            {req.target_price_usd_t != null && (
              <div className="text-xs text-muted-foreground mt-1">
                Precio objetivo: {fmtUsdT(req.target_price_usd_t)}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                await reqStatusFn({
                  data: { id: req.id, status: req.status === "abierto" ? "cerrado" : "abierto" },
                });
                refetch();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            }}
            className="px-3 py-1.5 rounded border border-border text-xs hover:bg-accent"
          >
            {req.status === "abierto" ? "Cerrar requerimiento" : "Reabrir"}
          </button>
        </div>

        {/* Link para proveedores */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            Link para que los proveedores suban su propuesta
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">/proveedor/{req.submit_token_prefix}…</span>
            <span className="text-[10px]">
              (el link completo se copió al crear el requerimiento; por seguridad no se vuelve a
              mostrar)
            </span>
          </div>
        </div>
      </div>

      <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
        Propuestas recibidas · {data.submissions.length}
      </h2>

      {data.submissions.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-text-secondary">
          Todavía no hay propuestas. Comparte el link con tus asociados y proveedores para empezar a
          recibirlas.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              s={s}
              shareLink={shareLinks[s.id] ?? null}
              converting={converting === s.id}
              onStatus={onStatus}
              onShare={onShare}
              onConvert={onConvert}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocChip({
  submissionId,
  doc,
}: {
  submissionId: string;
  doc: { label: string; url?: string | null; path?: string | null };
}) {
  const fileFn = useServerFn(getSupplierFileUrl);
  const [busy, setBusy] = useState(false);
  if (doc.url) {
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
      >
        <FileText className="w-3 h-3" /> {doc.label} <ExternalLink className="w-3 h-3" />
      </a>
    );
  }
  const open = async () => {
    if (!doc.path) return;
    setBusy(true);
    try {
      const { url } = await fileFn({ data: { submissionId, path: doc.path } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el archivo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={() => void open()}
      disabled={busy}
      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-50"
    >
      <FileText className="w-3 h-3" /> {doc.label} <ExternalLink className="w-3 h-3" />
    </button>
  );
}

function SubmissionCard({
  s,
  shareLink,
  converting,
  onStatus,
  onShare,
  onConvert,
}: {
  s: SubmissionRow;
  shareLink: string | null;
  converting: boolean;
  onStatus: (id: string, status: SubmissionStatus) => void;
  onShare: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        s.status === "preseleccionada"
          ? "border-primary/50 bg-primary/5"
          : s.status === "descartada"
            ? "border-border bg-muted/10 opacity-70"
            : "border-border bg-bg-secondary/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{s.supplier_name}</span>
            {s.supplier_role && (
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {SUPPLIER_ROLE_LABELS[normalizeSupplierRole(s.supplier_role) ?? "otro"] ??
                  s.supplier_role}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {[s.supplier_company, s.supplier_country].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {s.contact_email && (
              <a
                href={`mailto:${s.contact_email}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Mail className="w-3 h-3" /> {s.contact_email}
              </a>
            )}
            {s.contact_phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3" /> {s.contact_phone}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-lg font-bold">
            {s.offer_price_usd_t != null
              ? `US$ ${Math.round(s.offer_price_usd_t).toLocaleString("es-CL")}/t`
              : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {s.offer_quantity_t != null ? `${s.offer_quantity_t} t` : ""}
            {s.incoterm ? ` · ${s.incoterm}` : ""}
            {s.port_loading ? ` · ${s.port_loading}` : ""}
            {s.lead_time ? ` · ${s.lead_time}` : ""}
          </div>
          {s.offer_valid_until && (
            <div
              className={`text-[11px] mt-0.5 ${
                isOfferExpired(s.offer_valid_until, new Date())
                  ? "text-red-600 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {isOfferExpired(s.offer_valid_until, new Date()) ? "Oferta vencida" : "Válida hasta"}{" "}
              {s.offer_valid_until}
            </div>
          )}
        </div>
      </div>

      {(s.payment_terms || s.quality_grade || s.packaging) && (
        <div className="mt-2 grid sm:grid-cols-3 gap-2 text-[11px]">
          {s.payment_terms && (
            <div>
              <span className="text-muted-foreground">Pago: </span>
              {s.payment_terms}
            </div>
          )}
          {s.quality_grade && (
            <div>
              <span className="text-muted-foreground">Calidad: </span>
              {s.quality_grade}
            </div>
          )}
          {s.packaging && (
            <div>
              <span className="text-muted-foreground">Empaque: </span>
              {s.packaging}
            </div>
          )}
        </div>
      )}

      {s.specs && <p className="mt-2 text-xs text-foreground/80">{s.specs}</p>}
      {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}

      {s.documents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {s.documents.map((d, i) => (
            <DocChip key={i} submissionId={s.id} doc={d} />
          ))}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-border flex flex-wrap items-center gap-3">
        {s.status !== "preseleccionada" && (
          <button
            onClick={() => onStatus(s.id, "preseleccionada")}
            className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            <Star className="w-3 h-3" /> Preseleccionar
          </button>
        )}
        {s.status !== "descartada" && (
          <button
            onClick={() => onStatus(s.id, "descartada")}
            className="text-[11px] font-mono text-red-500 hover:underline inline-flex items-center gap-1"
          >
            <XCircle className="w-3 h-3" /> Descartar
          </button>
        )}
        {s.status === "descartada" && (
          <button
            onClick={() => onStatus(s.id, "recibida")}
            className="text-[11px] font-mono text-muted-foreground hover:underline"
          >
            Reactivar
          </button>
        )}
        <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {SUBMISSION_STATUS_LABELS[(s.status as SubmissionStatus) ?? "recibida"] ?? s.status}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => onShare(s.id)}
            className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" /> Ficha comprador
          </button>
          <DispatchButton submissionId={s.id} />
          {s.trade_id ? (
            <Link
              to="/dashboard/trades/$tradeId"
              params={{ tradeId: s.trade_id }}
              className="text-[11px] font-mono text-teal hover:underline inline-flex items-center gap-1"
            >
              <Handshake className="w-3 h-3" /> Ver trade <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            s.status !== "descartada" && (
              <button
                onClick={() => onConvert(s.id)}
                disabled={converting}
                className="text-[11px] font-mono text-teal hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Handshake className="w-3 h-3" /> {converting ? "Creando…" : "Convertir en trade"}
              </button>
            )
          )}
        </div>
      </div>

      {shareLink && (
        <div className="mt-2 flex items-center gap-2 rounded border border-primary/30 bg-primary/5 p-2">
          <code className="text-[11px] font-mono break-all flex-1">{shareLink}</code>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(shareLink);
              toast.success("Copiado");
            }}
            className="shrink-0 p-1 rounded border border-border hover:bg-accent"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      )}

      <DispatchPanel submissionId={s.id} />
    </div>
  );
}

// ---------- Despacho bajo NCNDA a compradores seleccionados ----------

function DispatchButton({ submissionId }: { submissionId: string }) {
  return (
    <button
      onClick={() => {
        const el = document.getElementById(`dispatch-${submissionId}`);
        if (el) {
          el.dataset.open = el.dataset.open === "1" ? "0" : "1";
          el.style.display = el.dataset.open === "1" ? "block" : "none";
        }
      }}
      className="text-[11px] font-mono text-cobalt hover:underline inline-flex items-center gap-1"
    >
      <Send className="w-3 h-3" /> Despachar bajo NCNDA
    </button>
  );
}

function DispatchPanel({ submissionId }: { submissionId: string }) {
  const partnersFn = useServerFn(listPartners);
  const dispatchFn = useServerFn(dispatchSupplierSheetToBuyers);
  const listFn = useServerFn(listSupplierSheetDispatches);

  const { data: partnersData } = useQuery({
    queryKey: ["partners-buyers"],
    queryFn: () => partnersFn(),
    staleTime: 60_000,
  });
  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["dispatch-history", submissionId],
    queryFn: () => listFn({ data: { submissionId } }),
    staleTime: 15_000,
  });

  const buyers = useMemo(
    () =>
      (partnersData?.partners ?? [])
        .filter((p) => (p.role === "cliente" || p.role === "broker") && p.email)
        .map((p) => ({ id: p.id, name: p.name, company: p.company, email: p.email! })),
    [partnersData],
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [extraEmails, setExtraEmails] = useState("");
  const [ncndaRef, setNcndaRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const submit = async () => {
    const chosen = buyers.filter((b) => selected[b.id]);
    const extras = extraEmails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => /.+@.+\..+/.test(e))
      .map((email) => ({ email }));
    const recipients = [
      ...chosen.map((b) => ({
        email: b.email,
        name: b.name,
        company: b.company ?? undefined,
        partnerId: b.id,
      })),
      ...extras,
    ];
    if (recipients.length === 0) {
      toast.error("Selecciona al menos un comprador o agrega un correo.");
      return;
    }
    setBusy(true);
    try {
      const res = await dispatchFn({
        data: {
          submissionId,
          recipients,
          ncndaRef: ncndaRef.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      toast.success(`Despachado a ${ok}${fail ? ` · ${fail} fallidos` : ""}`);
      setSelected({});
      setExtraEmails("");
      setNote("");
      void refetchHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo despachar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id={`dispatch-${submissionId}`}
      data-open="0"
      style={{ display: "none" }}
      className="mt-3 rounded-md border border-cobalt/30 bg-cobalt/5 p-3"
    >
      <div className="text-[11px] font-mono uppercase tracking-wider text-cobalt mb-2">
        Despacho bajo NCNDA · compradores
      </div>
      {buyers.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          No hay asociados con rol Cliente o Broker. Agrega compradores en{" "}
          <Link to="/dashboard/clientes" className="text-primary underline">
            Clientes & Asociados
          </Link>
          , o ingresa correos manualmente abajo.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-1">
          {buyers.map((b) => (
            <label
              key={b.id}
              className="flex items-center gap-2 text-xs rounded border border-border/60 bg-white/60 px-2 py-1 cursor-pointer hover:border-cobalt/50"
            >
              <input type="checkbox" checked={!!selected[b.id]} onChange={() => toggle(b.id)} />
              <div className="min-w-0">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {[b.company, b.email].filter(Boolean).join(" · ")}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="mt-2 grid gap-2">
        <input
          value={extraEmails}
          onChange={(e) => setExtraEmails(e.target.value)}
          placeholder="Correos adicionales (separados por coma)"
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-white"
        />
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={ncndaRef}
            onChange={(e) => setNcndaRef(e.target.value)}
            placeholder="Ref. NCNDA (opcional)"
            className="text-xs px-2 py-1.5 rounded border border-border bg-white"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota interna al comprador (opcional)"
            className="text-xs px-2 py-1.5 rounded border border-border bg-white"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground">
            Se enviará bajo el formato estándar de documentos de plataforma con link a la ficha en
            https://geocapitals.com. Cada envío queda auditado.
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="text-[11px] font-mono px-3 py-1.5 rounded bg-cobalt text-white hover:bg-cobalt/90 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> {busy ? "Enviando…" : "Enviar bajo NCNDA"}
          </button>
        </div>
      </div>

      {history && history.dispatches && history.dispatches.length > 0 && (
        <div className="mt-3 pt-2 border-t border-cobalt/20">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Historial · {history.dispatches.length}
          </div>
          <div className="space-y-1">
            {history.dispatches.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-[11px] text-foreground/80">
                {d.status === "sent" ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Clock className="w-3 h-3 text-amber-600" />
                )}
                <span className="font-mono truncate max-w-[240px]">{d.recipient_email}</span>
                <span className="text-muted-foreground truncate">
                  {d.recipient_company ?? d.recipient_name ?? ""}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(d.created_at as string).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
