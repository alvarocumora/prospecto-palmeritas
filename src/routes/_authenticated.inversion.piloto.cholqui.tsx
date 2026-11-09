import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  PILOT_MAX_CLP,
  PILOT_MIN_CLP,
  PILOT_SHARE_PRICE_CLP,
  pilotAmount,
} from "@/lib/investor/cholquiPilot";
import { confirmCholquiPilot, getCholquiPilot } from "@/lib/investor/cholquiPilot.functions";

export const Route = createFileRoute("/_authenticated/inversion/piloto/cholqui")({
  head: () => ({
    meta: [
      { title: "Piloto de inversión Cholqui — GeoCapitals" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CholquiPilotRoute,
});

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function CholquiPilotRoute() {
  const { user } = useAuth();
  return user ? <CholquiPilot key={user.id} userId={user.id} /> : null;
}

function CholquiPilot({ userId }: { userId: string }) {
  const read = useServerFn(getCholquiPilot);
  const confirm = useServerFn(confirmCholquiPilot);
  const queryClient = useQueryClient();
  const queryKey = ["cholqui-pilot", userId];
  const pilot = useQuery({
    queryKey,
    queryFn: () => read(),
    gcTime: 0,
  });
  const completion = useMutation({
    mutationFn: (amountClp: number) => confirm({ data: { amountClp, acceptedSimulation: true } }),
    onSuccess: (result) => queryClient.setQueryData(queryKey, result),
  });
  const [amount, setAmount] = useState(String(PILOT_MIN_CLP));
  const [review, setReview] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const quote = pilotAmount.safeParse(Number(amount));

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-content">
      <header className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-accent-brand">
          Acceso por invitación · Simulación
        </p>
        <h1 className="font-display text-3xl">Piloto de inversión · Cholqui</h1>
        <p className="text-sm text-content-subtle">
          Recorrido de prueba. Los montos y participaciones son ilustrativos y carecen de efecto
          contractual. Este piloto opera sin transferencias.
        </p>
        <Link
          to="/terminal/$slug"
          params={{ slug: "cholqui" }}
          search={{ tab: "mapa", view: "2d" }}
          className="inline-block text-sm font-medium text-accent-brand underline"
        >
          Consultar el mapa público de Cholqui
        </Link>
      </header>

      {pilot.isPending ? (
        <p role="status">Comprobando invitación…</p>
      ) : pilot.isError ? (
        <div role="alert" className="space-y-2">
          <p>El piloto no está disponible en este entorno o no pudo cargar.</p>
          <button type="button" className="underline" onClick={() => void pilot.refetch()}>
            Reintentar
          </button>
        </div>
      ) : pilot.data === null ? (
        <p role="status">Esta cuenta no tiene una invitación activa.</p>
      ) : pilot.data.orderId !== null ? (
        <div className="space-y-3 border border-hairline bg-surface p-5">
          <h2 className="font-display text-2xl">Cartola de prueba</h2>
          <p role="status">Orden simulada completada</p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-semibold">Referencia de prueba</dt>
              <dd className="break-all font-mono">{pilot.data.orderId}</dd>
            </div>
            <div>
              <dt className="font-semibold">Monto simulado</dt>
              <dd>{money.format(pilot.data.amountClp)} CLP</dd>
            </div>
            <div>
              <dt className="font-semibold">Participaciones simuladas</dt>
              <dd>{pilot.data.amountClp / PILOT_SHARE_PRICE_CLP}</dd>
            </div>
            <div>
              <dt className="font-semibold">Fecha de simulación</dt>
              <dd>
                {new Date(pilot.data.issuedAt).toLocaleDateString("es-CL", {
                  timeZone: "America/Santiago",
                })}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <form
          className="space-y-4 border border-hairline bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!quote.success || completion.isPending) return;
            if (!review) setReview(true);
            else if (accepted) completion.mutate(quote.data);
          }}
        >
          <h2 className="font-display text-2xl">
            {review ? "Revisar la orden de prueba" : "Definir un monto de prueba"}
          </h2>
          <p className="text-sm text-content-subtle">
            Caso de prueba con hitos ilustrativos de revisión de datos, campaña de terreno y
            evaluación de resultados.
          </p>
          <label className="block space-y-2 text-sm font-medium">
            <span>Monto simulado en CLP</span>
            <input
              type="number"
              required
              min={PILOT_MIN_CLP}
              max={PILOT_MAX_CLP}
              step={PILOT_SHARE_PRICE_CLP}
              value={amount}
              disabled={review}
              onChange={(event) => setAmount(event.target.value)}
              className="block w-full max-w-xs border border-hairline bg-surface px-3 py-2"
            />
          </label>
          <p className="text-sm text-content-subtle">
            Valor ilustrativo por participación {money.format(PILOT_SHARE_PRICE_CLP)} CLP.
            {quote.success && ` Participaciones simuladas: ${quote.data / PILOT_SHARE_PRICE_CLP}.`}
          </p>
          {review && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              Entiendo que esta confirmación simula una orden y no genera obligaciones.
            </label>
          )}
          {completion.isError && (
            <p role="alert">No pudimos confirmar la simulación. Puedes reintentar.</p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!quote.success || (review && !accepted) || completion.isPending}
              className="min-h-11 bg-surface-inverse px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {completion.isPending
                ? "Registrando…"
                : review
                  ? "Confirmar simulación"
                  : "Revisar orden"}
            </button>
            {review && (
              <button
                type="button"
                disabled={completion.isPending}
                className="text-sm underline"
                onClick={() => {
                  setAccepted(false);
                  setReview(false);
                  completion.reset();
                }}
              >
                Editar monto
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
