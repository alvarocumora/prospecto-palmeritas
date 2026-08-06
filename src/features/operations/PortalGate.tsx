// Puerta de acceso al panel privado de operación: correo autorizado + código
// de un solo uso enviado por email. El enlace por sí solo no abre nada.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getOperacionAccessInfo,
  requestPortalOtp,
  verifyPortalOtp,
} from "@/lib/portalAuth.functions";

export const portalSessionKey = (token: string) => `gc_portal_session:${token}`;

export function PortalGate({
  token,
  onGranted,
}: {
  token: string;
  onGranted: (session: string) => void;
}) {
  const infoFn = useServerFn(getOperacionAccessInfo);
  const requestFn = useServerFn(requestPortalOtp);
  const verifyFn = useServerFn(verifyPortalOtp);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  const { data: info, isLoading } = useQuery({
    queryKey: ["operacion-access", token],
    queryFn: () => infoFn({ data: { token } }),
    staleTime: 60_000,
    retry: false,
  });

  const sendCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Escribe un correo válido.");
      return;
    }
    setBusy(true);
    try {
      await requestFn({ data: { token, email: email.trim() } });
      setStep("code");
      toast.success("Si el correo está autorizado, recibirás un código en unos segundos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error("El código tiene 6 dígitos.");
      return;
    }
    setBusy(true);
    try {
      const r = await verifyFn({ data: { token, email: email.trim(), code: code.trim() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onGranted(r.session);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo validar el código.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-[hsl(var(--im-ink-soft))]">Verificando enlace…</p>;
  }

  if (!info?.valid) {
    return (
      <div className="rounded-lg border border-[hsl(var(--im-hairline))] p-8 bg-white">
        <h1 className="font-serif text-2xl mb-2">Enlace no válido</h1>
        <p className="text-sm text-[hsl(var(--im-ink-soft))]">
          El enlace expiró o no corresponde a una operación activa. Solicítelo nuevamente a su
          contraparte en Geocapitals.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto rounded-lg border border-[hsl(var(--im-hairline))] bg-white p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--im-accent-brand))]">
        Acceso restringido
      </p>
      <h1 className="font-serif text-2xl mt-2">
        {info.reference ?? "Operación"} · Panel de contraparte
      </h1>
      <p className="text-sm text-[hsl(var(--im-ink-soft))] mt-2">
        Este panel no es público. Valida tu correo autorizado para abrirlo; te enviaremos un código
        de un solo uso válido por 15 minutos.
      </p>
      {info.hints.length > 0 && (
        <p className="text-xs text-[hsl(var(--im-ink-soft))] mt-2">
          Correos habilitados: {info.hints.join(" · ")}
        </p>
      )}

      {step === "email" ? (
        <div className="mt-6 space-y-3">
          <label className="block text-xs">
            <span className="block text-[hsl(var(--im-ink-soft))] mb-1">Correo autorizado</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendCode()}
              placeholder="nombre@empresa.com"
              className="w-full px-3 py-2 rounded border border-[hsl(var(--im-hairline))] bg-white text-sm"
            />
          </label>
          <button
            onClick={() => void sendCode()}
            disabled={busy}
            className="px-4 py-2 rounded bg-[hsl(var(--im-accent-brand))] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Enviarme el código"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <label className="block text-xs">
            <span className="block text-[hsl(var(--im-ink-soft))] mb-1">
              Código enviado a {email}
            </span>
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && void verify()}
              placeholder="••••••"
              className="w-full px-3 py-2 rounded border border-[hsl(var(--im-hairline))] bg-white text-lg tracking-[0.5em]"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void verify()}
              disabled={busy}
              className="px-4 py-2 rounded bg-[hsl(var(--im-accent-brand))] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Validando…" : "Entrar al panel"}
            </button>
            <button
              onClick={() => {
                setStep("email");
                setCode("");
              }}
              className="text-sm text-[hsl(var(--im-ink-soft))]"
            >
              Usar otro correo
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-[hsl(var(--im-ink-soft))]">
        ¿Tu correo no está habilitado? Escríbenos a info@geocapitals.com o WhatsApp +56 9 6218 4071.
      </p>
    </div>
  );
}
