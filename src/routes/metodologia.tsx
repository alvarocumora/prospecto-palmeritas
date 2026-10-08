import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Satellite,
  Mountain,
  Database,
  FlaskConical,
  FileSearch,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { VerificationBadge } from "@/components/brand";
import { VERIFICATION_META } from "@/lib/verification";

export const Route = createFileRoute("/metodologia")({
  head: () => ({
    meta: [
      { title: "Metodología y verificación de datos — Geocapitals" },
      {
        name: "description",
        content:
          "Cómo Geocapitals clasifica y verifica los datos de cada proyecto minero: fuentes satelitales, catastro, sondajes y los tres niveles de verificación (trazable y verificado QP).",
      },
      { property: "og:title", content: "Metodología y verificación de datos — Geocapitals" },
      {
        property: "og:description",
        content:
          "Transparencia sobre el origen de cada dato: Copernicus, Sentinel, catastro SERNAGEOMIN y niveles de verificación.",
      },
      { property: "og:url", content: "https://geocapitals.com/metodologia" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://geocapitals.com/metodologia" }],
  }),
  component: MetodologiaPage,
});

const LEVELS = [
  {
    level: "traceable" as const,
    icon: FileSearch,
    detail:
      "Información real cargada en la base de datos productiva con trazabilidad de origen: concesiones del catastro oficial, collares y desviaciones de sondaje con coordenadas UTM, intervalos de litología logueados, anomalías satelitales con fecha y escena de origen. Todavía no cuenta con la firma de una Qualified Person.",
  },
  {
    level: "qp_verified" as const,
    icon: ShieldCheck,
    detail:
      "El nivel máximo: datos revisados y firmados por una Qualified Person registrada, bajo estándar NI 43-101 / JORC, con audit-trail por campo y por documento. Este sello se habilita proyecto a proyecto a medida que se completa la revisión.",
  },
];

const SOURCES = [
  {
    icon: Mountain,
    name: "Copernicus DEM GLO-30",
    what: "Modelo de elevación digital global (~30 m/píxel) de la Agencia Espacial Europea, leído directamente desde AWS Open Data.",
    use: "Terreno real a escala 1:1 en el visor 3D.",
  },
  {
    icon: Satellite,
    name: "Sentinel-1 / Sentinel-2",
    what: "Radar (InSAR) e imágenes multiespectrales del programa Copernicus, procesadas para detectar deformación del terreno y firmas espectrales.",
    use: "Anomalías satelitales, series temporales de desplazamiento y alertas.",
  },
  {
    icon: Database,
    name: "Catastro minero oficial",
    what: "Concesiones, titulares y vencimientos del catastro nacional (SERNAGEOMIN en Chile), sincronizados periódicamente.",
    use: "Mapa catastral, alertas de superposición y compliance de patentes.",
  },
  {
    icon: FileSearch,
    name: "Datos de campo del proyecto",
    what: "Sondajes (collar UTM, azimuth, dip, profundidad), intervalos de litología y leyes, muestras y QA/QC cargados por cada proyecto.",
    use: "Visor 3D de sondajes, estimaciones y reportes NI 43-101 asistidos.",
  },
];

function MetodologiaPage() {
  return (
    <MarketingPage
      eyebrow="Metodología"
      title="De dónde sale cada dato que ves"
      intro="La transparencia sobre el origen de la información es la base de la confianza. Cada proyecto en Geocapitals lleva un sello visible que indica su nivel de verificación, y esta página explica exactamente qué significa cada uno."
    >
      {/* Niveles de verificación */}
      <section className="grid md:grid-cols-3 gap-5">
        {LEVELS.map(({ level, icon: Icon, detail }) => (
          <div
            key={level}
            className="rounded-2xl border border-hairline bg-white p-6 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="grid place-items-center w-10 h-10 rounded-lg bg-accent-brand-subtle text-accent-brand">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <VerificationBadge level={level} linked={false} />
            </div>
            <div className="font-display text-lg text-content">
              {VERIFICATION_META[level].label}
            </div>
            <p className="text-sm text-content-subtle leading-relaxed">{detail}</p>
          </div>
        ))}
      </section>

      {/* Fuentes */}
      <section className="mt-16">
        <h2 className="brand-display text-2xl md:text-3xl text-content mb-6">
          Fuentes de datos geocientíficos
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SOURCES.map(({ icon: Icon, name, what, use }) => (
            <div key={name} className="rounded-xl border border-hairline bg-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-accent-brand shrink-0" strokeWidth={1.75} />
                <span className="font-display text-[15px] text-content">{name}</span>
              </div>
              <p className="text-sm text-content-subtle leading-relaxed">{what}</p>
              <p className="text-xs font-mono text-accent-brand mt-3">→ {use}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Simulaciones */}
      <section className="mt-16 rounded-2xl border border-hairline bg-accent-brand-subtle p-6 md:p-8">
        <h2 className="brand-display text-xl md:text-2xl text-content mb-3">
          Sobre los simuladores de retorno
        </h2>
        <p className="text-sm text-content leading-relaxed max-w-3xl">
          Los simuladores de la plataforma (flujo de caja descontado, VPN, TIR, payback) son
          herramientas ilustrativas basadas en parámetros que tú controlas. Usan supuestos
          simplificados —throughput fijo, sin impuestos ni regalías, precios spot de referencia— y
          sus resultados{" "}
          <strong>no constituyen asesoría de inversión ni una proyección del proyecto</strong>. Toda
          decisión de inversión debe basarse en el data room completo del proyecto y en asesoría
          profesional independiente.
        </p>
      </section>

      {/* Verificación de inversionistas (KYC) */}
      <section className="mt-16">
        <h2 className="brand-display text-2xl md:text-3xl text-content mb-3">
          Verificación de inversionistas (KYC)
        </h2>
        <p className="text-sm text-content-subtle leading-relaxed max-w-3xl mb-6">
          El acceso a los data rooms bajo NDA requiere un perfil de inversionista aprobado. El
          proceso tiene tres pasos y el estado de tu perfil es visible en todo momento:
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              n: "1",
              t: "Registro",
              d: "Creas tu cuenta y completas el perfil de inversionista: tipo, jurisdicción, rango de ticket y commodities de interés.",
            },
            {
              n: "2",
              t: "Revisión",
              d: "Nuestro equipo revisa la información y la documentación de respaldo. El estado queda «en revisión» hasta resolverse.",
            },
            {
              n: "3",
              t: "Aprobación",
              d: "Con el perfil aprobado puedes solicitar acceso a data rooms, recibir el memorando de cada oportunidad y firmar NDAs.",
            },
          ].map(({ n, t, d }) => (
            <div key={n} className="rounded-xl border border-hairline bg-white p-5">
              <div className="font-mono text-xs text-accent-brand mb-2">Paso {n}</div>
              <div className="font-display text-[15px] text-content mb-2">{t}</div>
              <p className="text-sm text-content-subtle leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-accent-brand text-white px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition"
          >
            Iniciar verificación de inversionista <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Disclaimer + CTA */}
      <section className="mt-10 flex items-start gap-3 text-sm text-content-subtle">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
        <p className="leading-relaxed max-w-3xl">
          Geocapitals es una plataforma de información y conexión. No es un intermediario de valores
          registrado y no custodia fondos de inversionistas. Cada proyecto indica el origen y nivel
          de verificación de sus datos.
        </p>
      </section>

      <div className="mt-10">
        <Link
          to="/contacto"
          className="inline-flex items-center gap-2 text-accent-brand font-medium hover:underline"
        >
          ¿Dudas sobre la verificación de un proyecto? Escríbenos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </MarketingPage>
  );
}
