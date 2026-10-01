import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { submitContactMessage } from "@/lib/contactMessages.functions";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { BrandButton } from "@/components/brand";

type Role = "owner" | "investor" | "qp" | "other";

const ROLES: { v: Role; label: string }[] = [
  { v: "owner", label: "Dueño de proyecto" },
  { v: "investor", label: "Inversionista / Fondo" },
  { v: "qp", label: "QP / Consultor" },
  { v: "other", label: "Otro" },
];

export function ContactForm({
  source = "landing",
  compact = false,
  defaultRole = "owner",
  defaultMessage = "",
}: {
  source?: string;
  compact?: boolean;
  defaultRole?: Role;
  defaultMessage?: string;
}) {
  const submit = useServerFn(submitContactMessage);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    role: defaultRole as Role,
    message: defaultMessage,
  });
  const mut = useMutation({
    mutationFn: () => submit({ data: { ...form, source } }),
  });

  if (mut.isSuccess) {
    return (
      <div className="rounded-xl border border-hairline bg-white p-6 flex items-start gap-3">
        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
        <div>
          <div className="font-display text-lg text-content">Mensaje recibido</div>
          <p className="text-sm text-content-subtle mt-1">
            Nuestro equipo te responde en menos de 24 horas hábiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
      className="rounded-xl border border-hairline bg-white p-5 md:p-6 space-y-4"
    >
      <div className={compact ? "grid sm:grid-cols-2 gap-3" : "grid sm:grid-cols-2 gap-4"}>
        <Field label="Nombre">
          <input
            required
            minLength={2}
            maxLength={200}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="brand-input"
            placeholder="Tu nombre"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            maxLength={320}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="brand-input"
            placeholder="tu@empresa.com"
          />
        </Field>
        <Field label="Organización">
          <input
            maxLength={200}
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className="brand-input"
            placeholder="(opcional)"
          />
        </Field>
        <Field label="Perfil">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="brand-input"
          >
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Mensaje">
        <textarea
          required
          minLength={5}
          maxLength={4000}
          rows={compact ? 3 : 5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="brand-input resize-y"
          placeholder="Cuéntanos sobre tu proyecto o necesidad."
        />
      </Field>

      {mut.isError && (
        <div className="text-sm text-red-600">
          {(mut.error as Error)?.message ?? "Error al enviar."}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-mono text-content-subtle">
          Tus datos se procesan bajo NDA implícito.
        </p>
        <BrandButton type="submit" size="sm" disabled={mut.isPending}>
          {mut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          Enviar mensaje
        </BrandButton>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
