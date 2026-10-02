import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { submitCollateralLead } from "@/lib/investor/collateral.functions";
import { fmtClp } from "@/lib/investor/collateralProgram";
import { BrandButton } from "@/components/brand";

type Pref = "hualane" | "valle-escondido" | "indiferente";

export function CollateralLeadForm({ amount, months }: { amount: number; months: number }) {
  const submit = useServerFn(submitCollateralLead);
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    pref: "indiferente" as Pref,
    message: "",
  });
  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          name: f.name,
          email: f.email,
          phone: f.phone || null,
          amountClp: amount,
          months,
          projectPref: f.pref,
          message: f.message || null,
        },
      }),
  });

  if (mut.isSuccess) {
    return (
      <div className="border border-hairline bg-surface p-6 flex gap-3">
        <CheckCircle2 className="w-6 h-6 text-accent-brand shrink-0" />
        <div>
          <div className="font-serif text-xl">Solicitud recibida</div>
          <p className="text-sm text-content-subtle mt-1">
            Te contactamos en menos de 24 horas hábiles con el deck y las parcelas disponibles.
            Cuando tu perfil quede aprobado, podrás ver los documentos legales de los valles en tu
            cuenta, registrándote con este mismo email.
          </p>
        </div>
      </div>
    );
  }

  const cls = "brand-input";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
      className="border border-hairline bg-surface p-5 md:p-6 space-y-4"
    >
      <div className="bg-accent-brand-subtle px-4 py-3 text-sm flex flex-wrap justify-between gap-2">
        <span>
          Monto simulado: <b className="font-mono">{fmtClp(amount)}</b>
        </span>
        <span>
          Plazo: <b className="font-mono">{months} meses</b>
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <L t="Nombre">
          <input
            required
            minLength={2}
            maxLength={200}
            className={cls}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </L>
        <L t="Email">
          <input
            required
            type="email"
            maxLength={320}
            className={cls}
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </L>
        <L t="WhatsApp / teléfono">
          <input
            maxLength={40}
            className={cls}
            placeholder="(opcional)"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
        </L>
        <L t="Valle de preferencia">
          <select
            className={cls}
            value={f.pref}
            onChange={(e) => setF({ ...f, pref: e.target.value as Pref })}
          >
            <option value="indiferente">Indiferente</option>
            <option value="hualane">Valle de Hualañé</option>
            <option value="valle-escondido">Valle Escondido Licantén</option>
          </select>
        </L>
      </div>
      <L t="Comentario">
        <textarea
          rows={3}
          maxLength={2000}
          className={`${cls} resize-y`}
          placeholder="(opcional)"
          value={f.message}
          onChange={(e) => setF({ ...f, message: e.target.value })}
        />
      </L>
      {mut.isError && <p className="text-sm text-destructive">{(mut.error as Error).message}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-content-subtle">
          Sin compromiso. Tus datos solo los ve el equipo Geocapitals.
        </p>
        <BrandButton type="submit" size="sm" disabled={mut.isPending}>
          {mut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          Solicitar deck y reunión
        </BrandButton>
      </div>
    </form>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-content-subtle block mb-1.5">
        {t}
      </span>
      {children}
    </label>
  );
}
