import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  Link2,
  RotateCcw,
  FileText,
  ShieldCheck,
  Cloud,
  CloudOff,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Copy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import type { TemplateDef, GeneratedDoc, DocBlock } from "@/lib/documents/model";
import { buildReference } from "@/lib/documents/templates";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";
import {
  createSignRequest,
  createSignFlow,
  getMySignFlow,
  retrySigner,
  voidSignFlow,
  type SignableDoc,
  type SignFlowSummary,
} from "@/lib/documents/signing.functions";
import { supabase } from "@/integrations/supabase/client";
import { signUrl as buildSignUrl } from "@/lib/publicUrl";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_PREFIX = "geocapitals:doc:";
const FLOW_POSITION_KEYS = ["A", "B", "C", "D"] as const;

type SyncStatus = "idle" | "loading" | "saving" | "saved" | "offline" | "error";

function defaultValues(tpl: TemplateDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of tpl.fields) out[f.key] = f.default ?? "";
  return out;
}

function defaultClauses(tpl: TemplateDef): Set<string> {
  return new Set(tpl.clauses.filter((c) => c.defaultOn).map((c) => c.key));
}

export function DocumentEditor({
  template,
  draftId: draftIdProp,
  prefill,
  projectId,
  tradeId,
  inquiryId,
  signerPrefill,
}: {
  template: TemplateDef;
  /** Id del borrador. Si no viene, se crea uno nuevo (documento independiente por cliente). */
  draftId?: string;
  /** Valores iniciales (ej. desde un lote del marketplace). Pisan el borrador. */
  prefill?: Record<string, string>;
  /** Proyecto asociado (queda vinculado al borrador). */
  projectId?: string;
  /** Trade de origen: la firma queda en la trazabilidad de la operación. */
  tradeId?: string;
  /** Requerimiento de sourcing asociado. */
  inquiryId?: string;
  /** Contraparte sugerida (ej. desde un trade) para la solicitud de firma. */
  signerPrefill?: { name?: string | null; email?: string | null };
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Id estable del borrador. Se genera en cliente si no vino por URL,
  // así todos los documentos que crea el usuario desde una misma plantilla
  // (uno por cliente / operación) quedan separados.
  const draftIdRef = useRef<string>(
    draftIdProp ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : ""),
  );
  const draftId = draftIdRef.current;
  const isNewDraft = !draftIdProp;
  const storageKey = `${STORAGE_PREFIX}${template.id}:${draftId}`;

  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(template));
  const [clauses, setClauses] = useState<Set<string>>(() => defaultClauses(template));
  const [reference, setReference] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("idle");
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedRef = useRef(false);

  // Genera referencia solo en cliente para evitar mismatch SSR.
  useEffect(() => {
    setReference((prev) => prev || buildReference(template.id));
  }, [template.id]);

  // Hidratación: si viene un draftId existente, se lee de Supabase.
  // Si es un draft nuevo, se conservan defaults (+ prefill posterior).
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const loadLocal = () => {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return;
          const parsed = JSON.parse(raw) as {
            values?: Record<string, string>;
            clauses?: string[];
            reference?: string;
            docTitle?: string;
            clientName?: string;
          };
          if (parsed.values) setValues((prev) => ({ ...prev, ...parsed.values }));
          if (parsed.clauses) setClauses(new Set(parsed.clauses));
          if (parsed.reference) setReference(parsed.reference);
          if (parsed.docTitle) setDocTitle(parsed.docTitle);
          if (parsed.clientName) setClientName(parsed.clientName);
        } catch {
          // ignore
        }
      };

      if (!user) {
        loadLocal();
        setSync("offline");
        hydrated.current = true;
        return;
      }

      // Draft nuevo (sin id en URL) → arrancamos limpio; se inserta al primer save.
      if (isNewDraft) {
        loadLocal();
        setSync("idle");
        hydrated.current = true;
        return;
      }

      setSync("loading");
      const { data, error } = await supabase
        .from("document_drafts")
        .select("values, clauses, reference, title, client_name")
        .eq("id", draftId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        loadLocal();
        setSync("error");
        hydrated.current = true;
        return;
      }

      if (data) {
        const remoteValues = (data.values ?? {}) as Record<string, string>;
        const remoteClauses = (data.clauses ?? []) as string[];
        setValues((prev) => ({ ...prev, ...remoteValues }));
        setClauses(new Set(remoteClauses));
        if (data.reference) setReference(data.reference);
        if (data.title) setDocTitle(data.title);
        if (data.client_name) setClientName(data.client_name);
        persistedRef.current = true;
        setSync("saved");
      } else {
        loadLocal();
        setSync("idle");
      }
      hydrated.current = true;
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [storageKey, draftId, isNewDraft, user]);

  // Prefill (ej. desde un lote): se aplica después de hidratar y pisa el
  // borrador solo en las claves que trae, para reflejar el dato actual del lote.
  const prefillKey = prefill ? JSON.stringify(prefill) : null;
  useEffect(() => {
    if (!prefillKey) return;
    const wait = window.setInterval(() => {
      if (!hydrated.current) return;
      window.clearInterval(wait);
      const p = JSON.parse(prefillKey) as Record<string, string>;
      setValues((prev) => ({ ...prev, ...p }));
    }, 50);
    return () => window.clearInterval(wait);
  }, [prefillKey]);

  // Persistencia local + remota con debounce, indexada por draftId.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          values,
          clauses: Array.from(clauses),
          reference,
          docTitle,
          clientName,
        }),
      );
    } catch {
      // ignore
    }

    if (!user || !reference) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSync("saving");
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("document_drafts").upsert(
        {
          id: draftId,
          user_id: user.id,
          template_id: template.id,
          values,
          clauses: Array.from(clauses),
          reference,
          title: docTitle.trim() || null,
          client_name: clientName.trim() || null,
          project_id: projectId ?? null,
          trade_id: tradeId ?? null,
          inquiry_id: inquiryId ?? null,
        },
        { onConflict: "id" },
      );
      setSync(error ? "error" : "saved");
      // Al primer guardado, si estábamos en modo "nuevo", sincronizamos la URL
      // con el draftId para que refresh / share funcione y no dupliquemos rows.
      if (!error && isNewDraft && !persistedRef.current) {
        persistedRef.current = true;
        try {
          navigate({
            to: "/dashboard/documentos/$templateId",
            params: { templateId: template.id },
            search: { draftId },
            replace: true,
          });
        } catch {
          // ignore navigation errors — el borrador ya quedó guardado.
        }
      }
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    storageKey,
    values,
    clauses,
    reference,
    docTitle,
    clientName,
    user,
    template.id,
    draftId,
    isNewDraft,
    navigate,
    projectId,
    tradeId,
    inquiryId,
  ]);

  const doc = useMemo<GeneratedDoc>(
    () =>
      template.build(values, clauses, {
        reference: reference || "GC-DRAFT",
        date: new Date().toISOString(),
      }),
    [template, values, clauses, reference],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof template.fields>();
    for (const f of template.fields) {
      const g = f.group ?? "Datos del documento";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries());
  }, [template]);

  const reset = async () => {
    setValues(defaultValues(template));
    setClauses(defaultClauses(template));
    if (user && persistedRef.current) {
      await supabase.from("document_drafts").delete().eq("id", draftId).eq("user_id", user.id);
      persistedRef.current = false;
    }
    toast.success("Valores restaurados");
  };

  const [signLink, setSignLink] = useState<string | null>(null);
  const [requestingSign, setRequestingSign] = useState(false);
  const [signerEmail, setSignerEmail] = useState(signerPrefill?.email ?? "");
  const [signerName, setSignerName] = useState(signerPrefill?.name ?? "");
  const signFn = useServerFn(createSignRequest);

  // ─── Flujo ordenado multi-firmante (NCNDA y otros con ≥2 partes) ───
  const parties = useMemo(() => {
    const sig = doc.blocks.find((b) => b.kind === "signature") as
      { kind: "signature"; parties: string[] } | undefined;
    return sig?.parties ?? [];
  }, [doc]);
  const isMultiParty = parties.length >= 2;
  const flowStorageKey = `${STORAGE_PREFIX}flow:${template.id}`;

  type FlowSignerInput = { role: string; name: string; email: string };
  const [flowSigners, setFlowSigners] = useState<FlowSignerInput[]>([]);
  useEffect(() => {
    // Precarga inputs con las partes del bloque de firma.
    // Para NCNDA (posiciones A/B/C) y plantillas con convención pX_name/pX_email,
    // rellena automáticamente nombre y email desde los datos del documento para
    // que el orden de la firma coincida SIEMPRE con las partes del contrato
    // (Parte A → firmante #1, Parte B → #2, …).
    setFlowSigners((prev) =>
      parties.map((role, i) => {
        if (prev[i] && (prev[i].name || prev[i].email)) return prev[i];
        const p = FLOW_POSITION_KEYS[i];
        const name = p ? (values[`p${p}_name`] ?? "").trim() : "";
        const email = p ? (values[`p${p}_email`] ?? "").trim() : "";
        return { role, name, email };
      }),
    );
    // Depende de values para que al completar los campos de la parte, la fila
    // del flujo se actualice sola.
  }, [parties, values]);

  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowTokens, setFlowTokens] = useState<Record<number, string>>({});
  const [flowSummary, setFlowSummary] = useState<SignFlowSummary | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);

  const createFlowFn = useServerFn(createSignFlow);
  const getFlowFn = useServerFn(getMySignFlow);
  const retryFn = useServerFn(retrySigner);

  // Persiste flowId por plantilla para recuperar estado tras refresh.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem(flowStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { flowId?: string; tokens?: Record<number, string> };
        if (parsed.flowId) setFlowId(parsed.flowId);
        if (parsed.tokens) setFlowTokens(parsed.tokens);
      }
    } catch {
      // Best-effort UI persistence; failure is intentionally non-fatal.
    }
  }, [flowStorageKey, user]);

  const refreshFlow = useCallback(async () => {
    if (!flowId) return;
    try {
      const s = await getFlowFn({ data: { flowId } });
      setFlowSummary(s);
    } catch (e) {
      console.error("[refreshFlow]", e);
    }
  }, [flowId, getFlowFn]);

  useEffect(() => {
    if (!flowId) return;
    void refreshFlow();
    // Polling suave mientras haya firmantes pendientes.
    const t = setInterval(() => {
      if (flowSummary?.completed) return;
      void refreshFlow();
    }, 20_000);
    return () => clearInterval(t);
  }, [flowId, refreshFlow, flowSummary?.completed]);

  const startFlow = async () => {
    if (!user) {
      toast.error("Inicia sesión para enviar a firma.");
      return;
    }
    // Validación mínima: al menos el primer firmante debe tener email o nombre.
    const first = flowSigners[0];
    if (!first?.email && !first?.name) {
      toast.error("Ingresa al menos el nombre o email del primer firmante.");
      return;
    }
    setFlowBusy(true);
    try {
      const res = await createFlowFn({
        data: {
          templateId: template.id,
          doc: doc as unknown as SignableDoc,
          tradeId,
          signers: flowSigners.map((s) => ({
            role: s.role || undefined,
            name: s.name.trim() || undefined,
            email: s.email.trim() || undefined,
          })),
        },
      });
      const tokMap: Record<number, string> = {};
      for (const t of res.tokens) tokMap[t.order] = t.token;
      setFlowId(res.flowId);
      setFlowTokens(tokMap);
      try {
        window.localStorage.setItem(
          flowStorageKey,
          JSON.stringify({ flowId: res.flowId, tokens: tokMap }),
        );
      } catch {
        // Best-effort UI persistence; failure is intentionally non-fatal.
      }
      toast.success(
        `Flujo creado con ${res.tokens.length} firmantes en orden. Link del primero copiado.`,
      );
      await navigator.clipboard.writeText(buildSignUrl(res.tokens[0].token)).catch(() => {});
      void refreshFlow();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el flujo de firma.");
    } finally {
      setFlowBusy(false);
    }
  };

  const doRetry = async (
    requestId: string,
    order: number,
    patch: { name?: string; email?: string },
    regenerate: boolean,
  ) => {
    try {
      const res = await retryFn({
        data: {
          id: requestId,
          name: patch.name,
          email: patch.email,
          regenerateToken: regenerate,
        },
      });
      if (res.token) {
        const next = { ...flowTokens, [order]: res.token };
        setFlowTokens(next);
        try {
          window.localStorage.setItem(flowStorageKey, JSON.stringify({ flowId, tokens: next }));
        } catch {
          // Best-effort UI persistence; failure is intentionally non-fatal.
        }
        await navigator.clipboard.writeText(buildSignUrl(res.token)).catch(() => {});
        toast.success("Link regenerado y copiado.");
      } else {
        toast.success("Datos del firmante actualizados.");
      }
      await refreshFlow();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reintentar.");
    }
  };

  // Re-sincroniza el flujo actual: anula las solicitudes pendientes del flow
  // vigente y crea uno nuevo con los firmantes derivados de las partes del
  // contrato (Parte A → #1, Parte B → #2, …). No depende de tokens antiguos.
  const voidFlowFn = useServerFn(voidSignFlow);
  const resyncFlow = async () => {
    if (!user) {
      toast.error("Inicia sesión para reordenar el flujo.");
      return;
    }
    if (
      !window.confirm(
        "Se anularán los links pendientes del flujo actual y se emitirá uno nuevo con el orden correcto (Parte A → #1, Parte B → #2, …). Los ya firmados se conservan como evidencia. ¿Continuar?",
      )
    )
      return;
    setFlowBusy(true);
    try {
      if (flowId) {
        try {
          await voidFlowFn({ data: { flowId } });
        } catch (e) {
          console.warn("[resyncFlow] void failed", e);
        }
      }
      // Reset local state y localStorage antes de crear el nuevo flujo.
      setFlowId(null);
      setFlowTokens({});
      setFlowSummary(null);
      try {
        window.localStorage.removeItem(flowStorageKey);
      } catch {
        // Best-effort UI persistence; failure is intentionally non-fatal.
      }
      // Reconstruye los inputs desde las partes actuales del documento.
      const posKeys = ["A", "B", "C", "D"] as const;
      const fresh = parties.map((role, i) => {
        const p = posKeys[i];
        return {
          role,
          name: p ? (values[`p${p}_name`] ?? "").trim() : "",
          email: p ? (values[`p${p}_email`] ?? "").trim() : "",
        };
      });
      setFlowSigners(fresh);
      const res = await createFlowFn({
        data: {
          templateId: template.id,
          doc: doc as unknown as SignableDoc,
          tradeId,
          signers: fresh.map((s) => ({
            role: s.role || undefined,
            name: s.name || undefined,
            email: s.email || undefined,
          })),
        },
      });
      const tokMap: Record<number, string> = {};
      for (const t of res.tokens) tokMap[t.order] = t.token;
      setFlowId(res.flowId);
      setFlowTokens(tokMap);
      try {
        window.localStorage.setItem(
          flowStorageKey,
          JSON.stringify({ flowId: res.flowId, tokens: tokMap }),
        );
      } catch {
        // Best-effort UI persistence; failure is intentionally non-fatal.
      }
      await navigator.clipboard.writeText(buildSignUrl(res.tokens[0].token)).catch(() => {});
      toast.success(
        `Flujo re-sincronizado. #1 = ${fresh[0]?.name || fresh[0]?.role || "Parte A"}. Link del primero copiado.`,
      );
      void refreshFlow();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo re-sincronizar el flujo.");
    } finally {
      setFlowBusy(false);
    }
  };

  const requestSignature = async () => {
    if (!user) {
      toast.error("Inicia sesión para solicitar firmas.");
      return;
    }
    setRequestingSign(true);
    try {
      const { token, emailed } = await signFn({
        data: {
          templateId: template.id,
          doc: doc as unknown as SignableDoc,
          signerEmail: signerEmail.trim() || undefined,
          signerName: signerName.trim() || undefined,
          tradeId,
        },
      });
      const url = buildSignUrl(token);
      setSignLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success(
        emailed
          ? `Solicitud creada y link enviado por email a ${signerEmail.trim()}.`
          : "Solicitud de firma creada. Link copiado — compártelo con la contraparte.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la solicitud de firma.");
    } finally {
      setRequestingSign(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      // Si hay usuario logueado, el emisor (primera parte del bloque de firma)
      // aparece pre-firmado con su email + timestamp + hash corto de sesión.
      // El emisor es la primera parte del documento — tomamos el primer campo
      // de identificación de parte que exista en el formulario (partyA, seller,
      // grantor, etc.). Fallback al email del usuario.
      const emitterName =
        values["partyA"] ||
        values["seller"] ||
        values["investor"] ||
        values["grantor"] ||
        values["client"] ||
        values["divulgante"] ||
        values["vendedor"] ||
        values["emisor"] ||
        user?.email ||
        "Emisor";
      const emitterSignature = user
        ? {
            name: emitterName,
            email: user.email ?? undefined,
            signedAt: new Date().toISOString(),
            hash: user.id.replace(/-/g, "").slice(0, 12),
            partyIndex: 0,
          }
        : undefined;

      await renderGeocapitalsPdf(doc, { emitterSignature });
      toast.success(
        emitterSignature
          ? `PDF descargado · firmado por ${emitterSignature.email ?? emitterSignature.name}`
          : "PDF descargado",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-theme="im-light" className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/dashboard/documentos"
          className="inline-flex items-center gap-1.5 text-[12px] font-mono text-content-subtle hover:text-content"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a recursos
        </Link>
        <div className="flex items-center gap-3 text-[11px] font-mono text-content-subtle">
          <SyncBadge status={sync} signedIn={!!user} />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-brand" />
            Borrador editable · No constituye asesoría legal
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
          {template.acronym ?? template.shortTitle}
        </div>
        <h1 className="font-display text-3xl lg:text-4xl mt-1 text-content">{template.title}</h1>
        <p className="text-sm text-content-subtle mt-2 max-w-3xl">{template.summary}</p>
        {!user ? (
          <p className="text-[11px] font-mono text-content-subtle mt-2">
            Estás editando sin sesión: los cambios se guardan solo en este dispositivo.{" "}
            <Link to="/auth" className="text-accent-brand underline">
              Inicia sesión
            </Link>{" "}
            para sincronizar entre dispositivos.
          </p>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6">
        {/* Panel de formulario */}
        <div className="space-y-5">
          {/* Ficha del documento: separa cada borrador por cliente / operación. */}
          <section className="rounded-2xl border border-accent-brand/40 bg-accent-brand-subtle/30 p-5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-accent-brand mb-3">
              Ficha del documento
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-mono text-content mb-1">
                  Título interno
                </label>
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={`Ej: ${template.acronym ?? template.shortTitle} — Cliente / Operación`}
                  className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                />
                <p className="text-[11px] text-content-subtle mt-1">
                  Sólo lo ves tú. Sirve para distinguir cada documento en tu listado.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-mono text-content mb-1">
                  Cliente / Contraparte
                </label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre de la empresa o persona"
                  className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                />
              </div>
              {(projectId || tradeId || inquiryId) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {projectId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-hairline px-2 py-0.5 text-[10px] font-mono text-content-subtle">
                      Proyecto vinculado
                    </span>
                  )}
                  {tradeId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-hairline px-2 py-0.5 text-[10px] font-mono text-content-subtle">
                      Trade vinculado
                    </span>
                  )}
                  {inquiryId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-hairline px-2 py-0.5 text-[10px] font-mono text-content-subtle">
                      Requerimiento vinculado
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {groups.map(([groupName, fields]) => (
            <section
              key={groupName}
              className="rounded-2xl border border-hairline bg-surface-3 p-5"
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                {groupName}
              </div>
              <div className="space-y-3">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[12px] font-mono text-content mb-1">
                      {f.label}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        value={values[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        rows={3}
                        className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      >
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={values[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content focus:outline-none focus:border-accent-brand"
                      />
                    )}
                    {f.help ? (
                      <p className="text-[11px] text-content-subtle mt-1">{f.help}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {template.clauses.length > 0 ? (
            <section className="rounded-2xl border border-hairline bg-surface-3 p-5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle mb-3">
                Cláusulas opcionales
              </div>
              <div className="space-y-2">
                {template.clauses.map((c) => {
                  const on = clauses.has(c.key);
                  return (
                    <label
                      key={c.key}
                      className="flex gap-2 items-start cursor-pointer p-2 rounded-lg hover:bg-surface-subtle"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          setClauses((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.key);
                            else next.delete(c.key);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-[13px] font-medium text-content">{c.label}</div>
                        <div className="text-[11px] text-content-subtle mt-0.5">{c.text}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 sticky bottom-4">
            <button
              type="button"
              onClick={exportPdf}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-content text-surface px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              <Download className="w-4 h-4" />
              {busy ? "Generando…" : "Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={() => void requestSignature()}
              disabled={requestingSign}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-4 py-2.5 text-sm text-content hover:border-accent-brand disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {requestingSign ? "Creando…" : "Solicitar firma"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-4 py-2.5 text-sm text-content hover:border-accent-brand"
            >
              <RotateCcw className="w-4 h-4" /> Restaurar
            </button>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="block text-content-subtle mb-1">
                Email del firmante (opcional — enviamos el link)
              </span>
              <input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="contraparte@empresa.com"
                className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content"
              />
            </label>
            <label className="text-xs">
              <span className="block text-content-subtle mb-1">Nombre esperado (opcional)</span>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nombre de quien firmará"
                className="w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-sm text-content"
              />
            </label>
          </div>

          {signLink && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="text-[11px] font-medium text-amber-700 mb-1">
                Link de firma (válido 30 días) — guárdalo, no volverá a mostrarse:
              </div>
              <code className="text-xs font-mono break-all">{signLink}</code>
            </div>
          )}

          {isMultiParty && user ? (
            <SignFlowPanel
              parties={parties}
              signers={flowSigners}
              onSignersChange={setFlowSigners}
              flowId={flowId}
              tokens={flowTokens}
              summary={flowSummary}
              busy={flowBusy}
              onStart={() => void startFlow()}
              onRefresh={() => void refreshFlow()}
              onRetry={doRetry}
              onResync={() => void resyncFlow()}
            />
          ) : null}
        </div>

        {/* Preview live */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-hairline bg-surface-3 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-surface-subtle">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
                <FileText className="w-3.5 h-3.5" /> Vista previa
              </div>
              <div className="text-[10px] font-mono text-content-subtle">
                Ref {reference || "…"}
              </div>
            </div>
            <DocumentPreview doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncBadge({ status, signedIn }: { status: SyncStatus; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <span className="inline-flex items-center gap-1">
        <CloudOff className="w-3.5 h-3.5" /> Solo en este dispositivo
      </span>
    );
  }
  if (status === "loading" || status === "saving") {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {status === "loading" ? "Cargando borrador…" : "Guardando…"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <CloudOff className="w-3.5 h-3.5" /> Error al sincronizar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-accent-brand">
      <Cloud className="w-3.5 h-3.5" /> Sincronizado
    </span>
  );
}

// Colores exactos de la identidad del PDF (src/lib/documents/pdf.ts) para que
// el preview del editor sea WYSIWYG respecto al archivo generado.
const PDF = {
  paper: "#F7F5F0",
  paperAlt: "#EFEBE1",
  ink: "#1A1A2E",
  inkSoft: "#4A4A5E",
  gray: "#6B6B7B",
  cobalt: "#2B4ACB",
  hairline: "#D9D4C7",
};

/** Divide una cláusula en encabezado (1ª frase corta) + cuerpo, igual que el PDF. */
function splitClause(text: string): { heading: string | null; body: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const dot = clean.indexOf(". ");
  if (dot > 0 && dot < 80) return { heading: clean.slice(0, dot + 1), body: clean.slice(dot + 2) };
  return { heading: null, body: clean };
}

export function DocumentPreview({ doc }: { doc: GeneratedDoc }) {
  const date = new Date(doc.date).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="max-h-[80vh] overflow-y-auto" style={{ background: "#e9e7e1" }}>
      {/* Hoja tamaño documento — espeja el PDF */}
      <div
        className="mx-auto my-4 shadow-sm"
        style={{ background: PDF.paper, color: PDF.ink, maxWidth: 720, position: "relative" }}
      >
        {/* Banda superior tinta + acento cobalto (como el PDF) */}
        <div style={{ height: 6, background: PDF.ink }} />
        <div style={{ height: 2, width: "26%", background: PDF.cobalt }} />

        <div className="px-10 pt-7 pb-10">
          {/* Cabecera: marca + contacto + chip validar */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-lg tracking-tight" style={{ color: PDF.ink }}>
                GEOCAPITALS
              </div>
              <div
                className="text-[9px] font-mono uppercase tracking-wider mt-0.5"
                style={{ color: PDF.cobalt }}
              >
                Mining Intelligence · Deals · Documentation
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: PDF.gray }}>
                geocapitals.com · info@geocapitals.com
              </div>
            </div>
            <div
              className="text-center rounded"
              style={{
                border: `1px solid ${PDF.hairline}`,
                background: "#fff",
                padding: "6px 8px",
              }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(5, 5px)",
                  gap: 1,
                  width: 29,
                  margin: "0 auto",
                }}
                aria-hidden
              >
                {Array.from({ length: 25 }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      background: (i * 7) % 3 ? PDF.ink : "transparent",
                    }}
                  />
                ))}
              </div>
              <div className="text-[6px] font-bold mt-1" style={{ color: PDF.cobalt }}>
                VALIDAR
              </div>
              <div className="text-[5px] truncate max-w-[40px]" style={{ color: PDF.gray }}>
                {doc.reference}
              </div>
            </div>
          </div>

          {/* REF + fecha */}
          <div style={{ borderTop: `1px solid ${PDF.hairline}`, marginTop: 22, paddingTop: 12 }}>
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-mono font-bold uppercase"
                style={{ color: PDF.cobalt }}
              >
                REF · {doc.reference}
              </span>
              <span className="text-[10px] font-mono uppercase" style={{ color: PDF.gray }}>
                {date}
              </span>
            </div>
          </div>

          {/* Título con acento cobalto */}
          <div style={{ width: 42, height: 2, background: PDF.cobalt, marginTop: 18 }} />
          <h2
            className="font-bold leading-tight mt-2"
            style={{ color: PDF.ink, fontSize: doc.title.length > 55 ? 22 : 26 }}
          >
            {doc.title}
          </h2>
          <div style={{ borderTop: `1px solid ${PDF.hairline}`, marginTop: 16 }} />

          {/* Bloques */}
          <div className="mt-5 space-y-5">
            {doc.blocks.map((b, i) => (
              <BlockPreview key={i} block={b} />
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 40, paddingTop: 12, borderTop: `1px solid ${PDF.cobalt}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold" style={{ color: PDF.ink }}>
                  GEOCAPITALS · Mining Intelligence
                </div>
                <div className="text-[8px] italic mt-0.5 max-w-[280px]" style={{ color: PDF.gray }}>
                  Documento generado como borrador editable. No constituye asesoría legal ni oferta
                  financiera. Validar con las contrapartes antes de firmar.
                </div>
              </div>
              <div className="text-right text-[9px]" style={{ color: PDF.gray }}>
                <div style={{ color: PDF.ink, fontWeight: 700 }}>info@geocapitals.com</div>
                <div>WhatsApp +56 9 6218 4071</div>
                <div style={{ color: PDF.cobalt }}>geocapitals.com/verificar/{doc.reference}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: DocBlock }) {
  if (block.kind === "paragraph") {
    return (
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: PDF.inkSoft }}>
        {block.text}
      </p>
    );
  }
  if (block.kind === "clauses") {
    return (
      <div className="space-y-3">
        {block.items.map((it, i) => {
          const { heading, body } = splitClause(it);
          return (
            <div key={i} className="pl-4" style={{ borderLeft: `2.5px solid ${PDF.cobalt}` }}>
              {heading && (
                <div className="text-[12.5px] font-bold" style={{ color: PDF.ink }}>
                  {heading}
                </div>
              )}
              <div className="text-[12.5px] leading-relaxed" style={{ color: PDF.inkSoft }}>
                {body}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (block.kind === "fields") {
    return (
      <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
        <tbody>
          {block.rows.map(([k, val], i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? PDF.paperAlt : "transparent" }}>
              <td
                className="py-1.5 px-2 font-mono text-[10px] uppercase tracking-wide align-top"
                style={{ color: PDF.cobalt, width: 150, fontWeight: 700 }}
              >
                {k}
              </td>
              <td className="py-1.5 px-2 align-top" style={{ color: PDF.ink }}>
                {val}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {block.head.map((h, i) => (
                <th
                  key={i}
                  className="text-left px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide"
                  style={{ background: PDF.ink, color: "#fff" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${PDF.hairline}` }}>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 align-top" style={{ color: PDF.ink }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.kind === "signature") {
    const cols = Math.min(2, block.parties.length || 1);
    return (
      <div
        className="grid gap-7 pt-10"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {block.parties.map((p, i) => (
          <div key={i}>
            <div style={{ borderTop: `0.7px solid ${PDF.ink}`, paddingTop: 6 }}>
              <div className="text-[12px] font-bold" style={{ color: PDF.ink }}>
                {p}
              </div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: PDF.gray }}>
                Nombre, cargo y firma
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Panel de flujo ordenado multi-firmante ───
function SignFlowPanel({
  parties,
  signers,
  onSignersChange,
  flowId,
  tokens,
  summary,
  busy,
  onStart,
  onRefresh,
  onRetry,
  onResync,
}: {
  parties: string[];
  signers: { role: string; name: string; email: string }[];
  onSignersChange: (s: { role: string; name: string; email: string }[]) => void;
  flowId: string | null;
  tokens: Record<number, string>;
  summary: SignFlowSummary | null;
  busy: boolean;
  onStart: () => void;
  onRefresh: () => void;
  onRetry: (
    id: string,
    order: number,
    patch: { name?: string; email?: string },
    regenerate: boolean,
  ) => void;
  onResync: () => void;
}) {
  const [retryOpen, setRetryOpen] = useState<string | null>(null);
  const [retryName, setRetryName] = useState("");
  const [retryEmail, setRetryEmail] = useState("");

  const started = !!flowId && !!summary;
  // Detecta desalineación: si algún firmante pendiente no coincide (por nombre
  // o email) con los datos actuales de la parte del contrato, ofrecemos
  // re-sincronizar el flujo.
  const misaligned =
    started &&
    (summary?.signers ?? []).some((s) => {
      if (s.status === "signed") return false;
      const expected = signers[s.order];
      if (!expected) return false;
      const nameMismatch =
        expected.name && s.signerNameExpected && expected.name !== s.signerNameExpected;
      const emailMismatch = expected.email && s.signerEmail && expected.email !== s.signerEmail;
      return Boolean(nameMismatch || emailMismatch);
    });

  return (
    <section className="mt-6 rounded-2xl border border-hairline bg-surface-3 p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent-brand" />
          <div>
            <div className="text-[13px] font-medium text-content">Firma en orden</div>
            <div className="text-[11px] text-content-subtle">
              {parties.length} firmantes · cada uno recibe su propio link. El siguiente sólo puede
              firmar una vez que firmó el anterior.
            </div>
          </div>
        </div>
        {started ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onResync}
              disabled={busy}
              title="Anula los links pendientes y emite un nuevo flujo con el orden del contrato (Parte A → #1)."
              className="inline-flex items-center gap-1 text-[11px] font-mono text-accent-brand hover:underline disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" /> Reordenar y reenviar
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-content-subtle hover:text-content"
            >
              <RefreshCw className="w-3 h-3" /> Actualizar
            </button>
          </div>
        ) : null}
      </div>

      {started && misaligned ? (
        <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 flex items-start justify-between gap-3">
          <span>
            El flujo actual no coincide con las partes del contrato (Parte A → #1, Parte B → #2…).
            Pulsa <b>Reordenar y reenviar</b> para anular los links pendientes y emitir uno nuevo
            con el orden correcto.
          </span>
        </div>
      ) : null}

      {!started ? (
        <>
          <div className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 mb-3">
            El orden de firma sigue exactamente a las partes del contrato:
            <b> #1 = Parte A</b>, #2 = Parte B, #3 = Parte C. Los datos se toman de los campos
            «Firmante» del documento — edítalos ahí para no descuadrar el orden.
          </div>
          <div className="space-y-2">
            {parties.map((role, i) => {
              const s = signers[i] ?? { role, name: "", email: "" };
              const posLabel = ["Parte A", "Parte B", "Parte C", "Parte D"][i] ?? `#${i + 1}`;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-hairline bg-surface-subtle p-3 grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr] gap-2 items-center"
                >
                  <div className="text-[11px] font-mono text-accent-brand">
                    #{i + 1} · {posLabel}
                  </div>
                  <input
                    value={s.name}
                    onChange={(e) => {
                      const next = [...signers];
                      next[i] = { ...s, name: e.target.value };
                      onSignersChange(next);
                    }}
                    placeholder={role.slice(0, 40)}
                    className="rounded border border-hairline bg-surface-3 px-2 py-1.5 text-xs"
                  />
                  <input
                    type="email"
                    value={s.email}
                    onChange={(e) => {
                      const next = [...signers];
                      next[i] = { ...s, email: e.target.value };
                      onSignersChange(next);
                    }}
                    placeholder="Email del firmante"
                    className="rounded border border-hairline bg-surface-3 px-2 py-1.5 text-xs"
                  />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-brand text-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {busy ? "Creando flujo…" : "Enviar a firma en orden"}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          {summary!.signers.map((s) => {
            const isCurrent = summary!.currentOrder === s.order;
            const isSigned = s.status === "signed";
            const tokenNow = tokens[s.order];
            const link = tokenNow ? buildSignUrl(tokenNow) : null;
            return (
              <div
                key={s.id}
                className={`rounded-lg border p-3 ${
                  isSigned
                    ? "border-emerald-300 bg-emerald-50/50"
                    : isCurrent
                      ? "border-accent-brand bg-accent-brand/5"
                      : "border-hairline bg-surface-subtle"
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {isSigned ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-content-subtle" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-content truncate">
                        #{s.order + 1} · {s.role ?? `Firmante ${s.order + 1}`}
                      </div>
                      <div className="text-[11px] text-content-subtle truncate">
                        {s.signerNameExpected ?? "—"}
                        {s.signerEmail ? ` · ${s.signerEmail}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider">
                    {isSigned ? (
                      <span className="text-emerald-700">
                        firmado {s.signedAt ? new Date(s.signedAt).toLocaleDateString("es-CL") : ""}
                      </span>
                    ) : isCurrent ? (
                      <span className="text-accent-brand">pendiente · turno actual</span>
                    ) : (
                      <span className="text-content-subtle">en espera</span>
                    )}
                  </div>
                </div>

                {!isSigned && link ? (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-[10px] font-mono break-all flex-1 rounded bg-white/70 px-2 py-1 border border-hairline">
                      {link}
                    </code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(link)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-brand"
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                ) : null}

                {!isSigned ? (
                  retryOpen === s.id ? (
                    <div className="mt-2 grid sm:grid-cols-2 gap-2">
                      <input
                        value={retryName}
                        onChange={(e) => setRetryName(e.target.value)}
                        placeholder="Nuevo nombre"
                        className="rounded border border-hairline bg-white px-2 py-1 text-xs"
                      />
                      <input
                        type="email"
                        value={retryEmail}
                        onChange={(e) => setRetryEmail(e.target.value)}
                        placeholder="Nuevo email"
                        className="rounded border border-hairline bg-white px-2 py-1 text-xs"
                      />
                      <div className="flex gap-2 sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRetry(
                              s.id,
                              s.order,
                              {
                                name: retryName || undefined,
                                email: retryEmail || undefined,
                              },
                              true,
                            );
                            setRetryOpen(null);
                            setRetryName("");
                            setRetryEmail("");
                          }}
                          className="rounded bg-accent-brand text-white text-[11px] px-2 py-1"
                        >
                          Regenerar link y reenviar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRetryOpen(null)}
                          className="rounded border border-hairline text-[11px] px-2 py-1"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRetryOpen(s.id);
                        setRetryName(s.signerNameExpected ?? "");
                        setRetryEmail(s.signerEmail ?? "");
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-content-subtle hover:text-accent-brand"
                    >
                      <RefreshCw className="w-3 h-3" /> Reintentar / actualizar contacto
                    </button>
                  )
                ) : null}
              </div>
            );
          })}

          {summary!.completed ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-[12px] text-emerald-800">
              ✅ Todos los firmantes completaron su firma. El documento queda registrado en la
              trazabilidad {summary!.tradeId ? "del trade vinculado" : ""}.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
