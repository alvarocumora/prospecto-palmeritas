import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { CheckCircle2, Droplets, XCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { fmtCLPFull, fmtFlow, useWaterAssets, EXERCISE_LABEL } from "@/features/water/data";

export const Route = createFileRoute("/agua/verificar/$assetId")({
  head: () => ({
    meta: [
      { title: "Verificación de ficha — Geocapitals Water Assets" },
      {
        name: "description",
        content:
          "Verificación pública de una ficha de derecho de aprovechamiento de aguas emitida por Geocapitals.",
      },
      { property: "og:title", content: "Verificación de ficha hídrica — Geocapitals" },
      {
        property: "og:description",
        content: "Contrasta el PDF descargado con el registro vigente en Geocapitals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyWaterFicha,
});

function VerifyWaterFicha() {
  const { assetId } = useParams({ from: "/agua/verificar/$assetId" });
  const { data: assets = [], isLoading } = useWaterAssets();
  const asset = assets.find((a) => a.asset_id.toLowerCase() === assetId.toLowerCase());

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo size={18} />
        <div className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center gap-3 bg-[#04122a] px-6 py-5 text-white">
            <Droplets className="h-5 w-5 text-sky-400" />
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-sky-300">
                WATER ASSET VERIFICATION
              </div>
              <h1 className="text-lg font-semibold">{assetId.toUpperCase()}</h1>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <p className="text-[13px] text-slate-500">Verificando…</p>
            ) : asset ? (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Ficha vigente en el registro Geocapitals
                </div>
                <dl className="text-[13px]">
                  {[
                    ["Activo", asset.name],
                    ["Fuente hídrica", asset.river],
                    ["Ubicación", `${asset.commune} · ${asset.province} · ${asset.region}`],
                    ["Caudal permanente", fmtFlow(asset.flow_permanent_ls)],
                    ["Ejercicio", EXERCISE_LABEL[asset.exercise] ?? asset.exercise],
                    ["Resolución DGA", `${asset.dga_resolution ?? "—"} (${asset.dga_resolution_date ?? "s/f"})`],
                    ["Valor referencial", fmtCLPFull(asset.reference_value_clp)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-slate-100 py-2">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="text-right font-medium text-slate-900">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[11px] italic text-slate-500">
                  La información legal se clasifica como Declarada, Documentada o Verificada. Esta
                  verificación confirma la vigencia de la ficha, no la validez registral del derecho.
                </p>
                <Link
                  to="/agua"
                  className="mt-5 inline-block rounded bg-[#04122a] px-4 py-2 text-[12px] font-medium text-white"
                >
                  Abrir Live Map
                </Link>
              </>
            ) : (
              <div className="inline-flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] text-rose-700">
                <XCircle className="h-4 w-4" /> No existe una ficha publicada con este Asset ID.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
