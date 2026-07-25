import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getPortalView, claimPortalInvitation, postPortalMessage } from "@/lib/operations/portal.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, FileText, Lock, MessageCircle, ShieldCheck } from "lucide-react";

type Role = "buyer" | "seller";
type PortalData = Awaited<ReturnType<typeof getPortalView>>;

const ROLE_COPY: Record<Role, { title: string; eyebrow: string; description: string }> = {
  buyer: {
    title: "Portal del Comprador",
    eyebrow: "Buyer Workspace",
    description: "Completa perfil KYC, sube LOI/ICPO/PoF y firma acuerdos para avanzar tu operación.",
  },
  seller: {
    title: "Portal del Vendedor",
    eyebrow: "Seller Workspace",
    description: "Adjunta licencias mineras, ensayes, permisos de exportación y firma acuerdos comerciales.",
  },
};

export default function PortalPage({ token, role }: { token: string; role: Role }) {
  const view = useServerFn(getPortalView);
  const claim = useServerFn(claimPortalInvitation);
  const postMsg = useServerFn(postPortalMessage);
  const { user, session } = useAuth();

  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  const load = async () => {
    try {
      const d = await view({ data: { token, role } });
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enlace inválido");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const doClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      await claim({ data: { token, role } });
      setClaimed(true);
      await load();
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "No fue posible vincular tu acceso");
    } finally {
      setClaiming(false);
    }
  };

  const send = async () => {
    if (!msg.trim()) return;
    await postMsg({ data: { token, role, body: msg } });
    setMsg("");
    await load();
  };

  const copy = ROLE_COPY[role];

  if (error) {
    return (
      <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]">
        <div className="mx-auto max-w-2xl px-4 py-24">
          <div className="rounded-xl border border-[hsl(var(--hairline))] bg-white p-8 text-center shadow-sm">
            <Lock className="mx-auto h-8 w-8 text-[hsl(var(--content-subtle))]" />
            <h1 className="mt-4 font-serif text-2xl">Enlace no disponible</h1>
            <p className="mt-2 text-sm text-[hsl(var(--content-subtle))]">{error}</p>
            <p className="mt-6 text-xs text-[hsl(var(--content-subtle))]">
              Contacta a tu ejecutivo de Geocapitals o escribe a{" "}
              <a className="underline" href="mailto:info@geocapitals.com">info@geocapitals.com</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))]">
        <div className="mx-auto max-w-2xl px-4 py-24 text-center text-sm text-[hsl(var(--content-subtle))]">
          Cargando portal…
        </div>
      </div>
    );
  }

  const op = data.operation;
  const needsAuth = !user || !session;
  const alreadyLinked = data.invitation.accepted || claimed;

  return (
    <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--hairline))] bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">{copy.eyebrow}</div>
            <div className="mt-1 font-serif text-lg">{copy.title}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">Operación</div>
            <div className="mt-1 font-mono text-sm">{op.code}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <section>
          <p className="max-w-2xl text-sm text-[hsl(var(--content-subtle))]">{copy.description}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Producto" value={`${op.commodity}${op.subproduct ? " · " + op.subproduct : ""}`} />
            <Card label="Cantidad mensual" value={op.quantity_monthly ? `${op.quantity_monthly} ${op.unit ?? "MT"}` : "Por definir"} />
            <Card label="Destino" value={op.destination_country ?? "Por definir"} />
            <Card label="Incoterm" value={op.incoterm ?? "Por definir"} />
          </div>
        </section>

        {/* Auth / claim panel */}
        {!alreadyLinked && (
          <section className="rounded-xl border border-[hsl(var(--hairline))] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-[hsl(var(--accent-brand))]" />
              <div className="flex-1">
                <div className="font-serif text-lg">Vincula tu acceso</div>
                <p className="mt-1 text-sm text-[hsl(var(--content-subtle))]">
                  Este enlace fue emitido para <b>{data.invitation.email}</b>. Debes iniciar sesión con ese correo para
                  quedar vinculado a la operación.
                </p>
                {needsAuth ? (
                  <div className="mt-4 flex gap-2">
                    <Link
                      to="/auth"
                      search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" } as never}
                      className="inline-flex items-center rounded-md bg-[hsl(var(--accent-brand))] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Iniciar sesión / registrarme
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button onClick={doClaim} disabled={claiming}>
                      {claiming ? "Vinculando…" : "Confirmar mi acceso"}
                    </Button>
                    {claimError && <div className="mt-2 text-xs text-red-600">{claimError}</div>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Checklist / documents */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">Documentación</h2>
            <span className="text-xs text-[hsl(var(--content-subtle))]">
              {data.documents.length} documento{data.documents.length === 1 ? "" : "s"} compartido{data.documents.length === 1 ? "" : "s"}
            </span>
          </div>
          {data.documents.length === 0 ? (
            <EmptyState icon={FileText} text="Geocapitals aún no ha compartido documentos contigo. Recibirás una notificación cuando haya novedades." />
          ) : (
            <div className="grid gap-3">
              {data.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--hairline))] bg-white px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-[hsl(var(--content-subtle))]">
                      {d.kind} · v{d.version} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusPill status={d.review_status ?? "pending"} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tasks */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">Próximas acciones</h2>
            <span className="text-xs text-[hsl(var(--content-subtle))]">{data.tasks.length} tarea(s)</span>
          </div>
          {data.tasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} text="No hay tareas pendientes por ahora." />
          ) : (
            <div className="grid gap-3">
              {data.tasks.map((t) => (
                <div key={t.id} className="rounded-lg border border-[hsl(var(--hairline))] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t.title}</div>
                      {t.description && <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">{t.description}</div>}
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[hsl(var(--content-subtle))]">
                    {t.due_date && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {t.due_date}</span>}
                    <span>Prioridad: {t.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Messages */}
        <section>
          <h2 className="mb-3 font-serif text-xl">Mensajes con Geocapitals</h2>
          <div className="rounded-xl border border-[hsl(var(--hairline))] bg-white">
            <div className="max-h-72 space-y-3 overflow-y-auto p-4">
              {data.messages.length === 0 ? (
                <div className="text-center text-xs text-[hsl(var(--content-subtle))]">
                  <MessageCircle className="mx-auto h-6 w-6 opacity-40" /> Sin mensajes aún.
                </div>
              ) : (
                data.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.author_role === role ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.author_role === role
                          ? "bg-[hsl(var(--accent-brand))] text-white"
                          : "bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
                      }`}
                    >
                      <div className="text-[10px] uppercase opacity-70">
                        {m.author_role === "geocapitals" ? "Geocapitals" : "Tú"}
                      </div>
                      <div>{m.body}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {alreadyLinked && (
              <div className="border-t border-[hsl(var(--hairline))] p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    placeholder="Escribe un mensaje a tu ejecutivo Geocapitals…"
                    className="min-h-[60px] flex-1"
                  />
                  <Button onClick={send} disabled={!msg.trim()}>Enviar</Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-[hsl(var(--hairline))] pt-6 text-center text-xs text-[hsl(var(--content-subtle))]">
          Portal seguro · Geocapitals · info@geocapitals.com · WhatsApp +56 9 6218 4071
        </footer>
      </main>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--hairline))] bg-white p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[hsl(var(--hairline))] bg-white/50 p-8 text-center">
      <Icon className="mx-auto h-6 w-6 text-[hsl(var(--content-subtle))]" />
      <p className="mt-2 text-xs text-[hsl(var(--content-subtle))]">{text}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-800" },
    approved: { label: "Aprobado", cls: "bg-emerald-100 text-emerald-800" },
    observed: { label: "Observado", cls: "bg-orange-100 text-orange-800" },
    completed: { label: "Completado", cls: "bg-emerald-100 text-emerald-800" },
    in_progress: { label: "En progreso", cls: "bg-blue-100 text-blue-800" },
    overdue: { label: "Vencida", cls: "bg-red-100 text-red-800" },
    answered: { label: "Respondida", cls: "bg-blue-100 text-blue-800" },
    under_review: { label: "En revisión", cls: "bg-blue-100 text-blue-800" },
  };
  const item = map[status] ?? { label: status, cls: "bg-neutral-100 text-neutral-700" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${item.cls}`}>{item.label}</span>;
}
