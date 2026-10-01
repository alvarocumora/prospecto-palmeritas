import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  FileDown,
  Loader2,
  ShieldCheck,
  Landmark,
  CalendarClock,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  COLLATERAL_DISCLAIMERS,
  COLLATERAL_PARCELS,
  COLLATERAL_PROJECTS,
  COLLATERAL_STEPS,
  COLLATERAL_TERMS,
  buildCollateralDeck,
  fmtClp,
  monthlyInterestClp,
} from "@/lib/investor/collateralProgram";
import coverImg from "@/assets/colateral/cover-maule.jpg";
import hualanePlan from "@/assets/colateral/hualane-og.png";
import velValle from "@/assets/colateral/vel-valle.jpg";
import velLago from "@/assets/colateral/vel-lago.jpg";

/** Carga una imagen y la reduce a JPEG data URL para el PDF. */
async function toDataUrl(src: string, maxW = 1400): Promise<string | undefined> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/_authenticated/dashboard/inversion-colateral")({
  head: () => ({
    meta: [
      { title: "Inversión con colateral inmobiliario — Geocapitals" },
      {
        name: "description",
        content:
          "Invierte en minería con UF + 12 % anual e interés mensual, respaldado por una parcela en garantía.",
      },
      { property: "og:title", content: "Inversión con colateral inmobiliario — Geocapitals" },
      {
        property: "og:description",
        content: "UF + 12 % anual, interés mensual y parcela en garantía en el Maule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollateralPage,
});

function CollateralPage() {
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState<number>(COLLATERAL_TERMS.minTicketClp);
  const monthly = monthlyInterestClp(amount);

  const download = async () => {
    setBusy(true);
    const id = toast.loading("Generando deck…");
    try {
      const { downloadProjectDoc } = await import("@/lib/pdf/generateProjectDoc");
      const [cover, plan, ve, ve2] = await Promise.all([coverImg, hualanePlan, velValle, velLago].map((u) => toDataUrl(u)));
      await downloadProjectDoc(
        buildCollateralDeck({ cover, hualanePlan: plan, valleEscondido: ve, valleEscondido2: ve2 }),
        "deck",
      );
      toast.success("Deck generado", { id });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el deck", { id });
    } finally {
      setBusy(false);
    }
  };

  const highlights = [
    { icon: Landmark, label: "Inversión mínima", value: "$25 MM" },
    { icon: CalendarClock, label: "Tasa · pago mensual", value: "UF + 12 %" },
    { icon: ShieldCheck, label: "Colateral", value: "5.000 m² – 1 ha" },
    { icon: Repeat, label: "Reinversión", value: "Cada 12 meses" },
  ];

  return (
    <div data-theme="im-light" className="min-h-screen bg-surface text-content">
      <div className="container mx-auto max-w-6xl p-4 md:p-8">
        <Link
          to="/dashboard/investments"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-content-subtle hover:text-content"
        >
          <ArrowLeft className="w-3 h-3" /> Mis inversiones
        </Link>

        <header className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-end border-b border-hairline pb-8">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">
              Programa de inversión con colateral
            </p>
            <h1 className="mt-3 font-serif text-3xl md:text-5xl leading-tight">
              Invierte en minería chilena, respaldado por una parcela.
            </h1>
            <p className="mt-4 max-w-2xl text-content-subtle">
              Tu capital financia el portafolio minero Geocapitals. Recibes UF + 12 % anual con pago
              mensual de intereses, y te entregamos en garantía una parcela con rol individual en la
              Región del Maule.
            </p>
          </div>
          <Button onClick={download} disabled={busy} size="lg">
            {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
            Descargar deck (PDF)
          </Button>
        </header>

        <figure className="mt-8 relative overflow-hidden border border-hairline">
          <img src={coverImg} alt="Valle rural de la Región del Maule" width={1600} height={912} className="w-full h-56 md:h-80 object-cover" />
          <figcaption className="absolute bottom-0 left-0 right-0 bg-surface/85 px-4 py-2 text-[11px] font-mono text-content-subtle">
            Imagen ilustrativa · colateral en Hualañé y Licantén, Región del Maule
          </figcaption>
        </figure>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline mt-8">
          {highlights.map((h) => (
            <div key={h.label} className="bg-surface p-5">
              <h.icon className="w-4 h-4 text-accent-brand" />
              <div className="mt-3 font-mono text-2xl">{h.value}</div>
              <div className="text-xs text-content-subtle mt-1">{h.label}</div>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-brand">Cartera de colateral</p>
          <h2 className="font-serif text-2xl mt-2">Dos proyectos elegibles · 116 parcelas · 85,75 ha</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {COLLATERAL_PROJECTS.map((p) => (
              <article key={p.key} className="border border-hairline overflow-hidden">
                <img
                  src={p.key === "hualane" ? hualanePlan : velValle}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-56 object-cover"
                />
                <div className="p-5">
                  <h3 className="font-serif text-xl">{p.name}</h3>
                  <p className="text-xs text-content-subtle mt-1">{p.commune} · {p.region} · {p.owner}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-px bg-hairline border border-hairline text-center">
                    <div className="bg-surface p-3"><dt className="text-[10px] text-content-subtle">Superficie</dt><dd className="font-mono">{p.areaHa.toLocaleString("es-CL")} ha</dd></div>
                    <div className="bg-surface p-3"><dt className="text-[10px] text-content-subtle">Parcelas</dt><dd className="font-mono">{p.lots}</dd></div>
                    <div className="bg-surface p-3"><dt className="text-[10px] text-content-subtle">Tamaño</dt><dd className="font-mono text-xs">{p.lotSize}</dd></div>
                  </dl>
                  <p className="text-xs mt-3"><span className="text-content-subtle">Precio lista:</span> {p.priceRange}</p>
                  <p className="text-xs mt-1"><span className="text-content-subtle">Registro:</span> {p.registry}</p>
                  <p className="text-xs mt-1 text-content-subtle">{p.status}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-content-subtle">Precios de lista publicados, no tasaciones. Rol individual y tasación se fijan en cada contrato.</p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Cómo funciona</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {COLLATERAL_STEPS.map((s) => (
              <li key={s.title} className="border border-hairline p-5">
                <div className="font-medium">{s.title}</div>
                <p className="text-sm text-content-subtle mt-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="border border-hairline p-6">
            <h2 className="font-serif text-2xl">Calcula tu interés mensual</h2>
            <label htmlFor="col-amount" className="block text-xs text-content-subtle mt-4">
              Monto a invertir (CLP)
            </label>
            <input
              id="col-amount"
              type="range"
              min={COLLATERAL_TERMS.minTicketClp}
              max={250_000_000}
              step={5_000_000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full mt-2 accent-current text-accent-brand"
            />
            <div className="font-mono text-2xl mt-2">{fmtClp(amount)}</div>
            <div className="mt-4 bg-accent-brand-subtle p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-accent-brand">
                Interés mensual estimado
              </div>
              <div className="font-mono text-2xl mt-1">{fmtClp(monthly)}</div>
              <div className="text-xs text-content-subtle">
                12 % anual / 12, más el reajuste UF del capital. {fmtClp(monthly * 12)} al año.
              </div>
            </div>
          </div>

          <div className="border border-hairline p-6">
            <h2 className="font-serif text-2xl">Tu parcela en garantía</h2>
            <p className="text-sm text-content-subtle mt-2">
              5.000 m² o 1 hectárea, con rol individual, en nuestros proyectos de la Región del
              Maule. La garantía se inscribe en el Conservador y se alza al devolverse el capital.
            </p>
            {COLLATERAL_PARCELS.length === 0 ? (
              <p className="mt-4 text-sm border border-dashed border-hairline p-4 text-content-subtle">
                Parcelas disponibles por cargar (rol, comuna, superficie y tasación).
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline text-sm">
                {COLLATERAL_PARCELS.map((p) => (
                  <li key={p.code} className="py-2 flex justify-between gap-3">
                    <span>
                      {p.code} · {p.project}
                    </span>
                    <span className="font-mono">{p.surface}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="mt-12 border-t border-hairline pt-4 text-[11px] leading-relaxed text-content-subtle space-y-1">
          {COLLATERAL_DISCLAIMERS.map((d) => (
            <p key={d}>{d}</p>
          ))}
        </footer>
      </div>
    </div>
  );
}
