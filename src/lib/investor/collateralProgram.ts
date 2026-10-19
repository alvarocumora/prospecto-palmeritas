/**
 * Programa "Inversión con colateral inmobiliario".
 * Fuente única de términos para la página del módulo de inversión y el deck PDF.
 * Términos entregados por Geocapitals; las parcelas concretas se completan
 * cuando se carguen sus antecedentes (nunca se inventa tasación ni rol).
 */
import { publicUrl } from "@/lib/publicUrl";
import type { ProjectDoc } from "@/lib/pdf/model";

export const COLLATERAL_DOC_VERSION = "v1.0";

export const COLLATERAL_TERMS = {
  minTicketClp: 15_000_000,
  annualRatePct: 12,
  indexation: "UF",
  interestPayment: "Mensual",
  reinvestEveryMonths: 12,
  collateralRegion: "Región del Maule",
  collateralSizes: ["5.000 m²", "1 hectárea"],
  collateralRol: "Rol de avalúo individual (SII)",
} as const;

export type CollateralParcel = {
  code: string;
  project: string;
  commune: string | null;
  surface: string;
  rol: string | null;
  appraisalUf: number | null;
};

/** Parcelas disponibles. Pendiente: antecedentes reales a entregar por Geocapitals. */
export const COLLATERAL_PARCELS: CollateralParcel[] = [];

/**
 * Cartera de proyectos elegibles como colateral (fuente: plataforma Oferta Terrenos).
 * Datos registrales/comerciales tal como figuran en esa plataforma; la parcela
 * concreta, su rol individual y tasación se fijan en cada contrato.
 */
export type CollateralProject = {
  key: "hualane" | "valle-escondido";
  name: string;
  owner: string;
  commune: string;
  region: string;
  areaHa: number;
  lots: number;
  lotSize: string;
  priceRange: string;
  registry: string;
  status: string;
};

export const COLLATERAL_PROJECTS: CollateralProject[] = [
  {
    key: "hualane",
    name: "Valle de Hualañé (Sector Caone)",
    owner: "Forestal Valle Escondido SpA",
    commune: "Hualañé",
    region: "Región del Maule",
    areaHa: 41.75,
    lots: 40,
    lotSize: "1 ha (lotes 0,75 a 2 ha)",
    priceRange: "$12.990.000 a $25.980.000",
    registry: "Rol matriz SII 168-921 (Hijuela 10)",
    status: "Rol individual por parcela: por verificar",
  },
  {
    key: "valle-escondido",
    name: "Valle Escondido Licantén",
    owner: "Forestal Valle Escondido SpA",
    commune: "Licantén",
    region: "Región del Maule",
    areaHa: 44,
    lots: 76,
    lotSize: "5.789 m2 promedio",
    priceRange: "$19.990.000 a $42.990.000",
    registry: "Insc. Fs. 243 N 133 (2012), Plano N 192 (2023), CBR Licantén",
    status: "70 de 76 parcelas disponibles",
  },
];

export type CollateralDeckImages = Partial<{
  cover: string;
  hualanePlan: string;
  valleEscondido: string;
  valleEscondido2: string;
  hualaneSat: string;
  valleEscondidoSat: string;
}>;

export const fmtClp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Interés mensual nominal sobre el capital en UF (antes del reajuste UF). */
export function monthlyInterestClp(amountClp: number): number {
  return (amountClp * COLLATERAL_TERMS.annualRatePct) / 100 / 12;
}

export const COLLATERAL_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "1. Conversación y perfil",
    body: "Reunión con el equipo Geocapitals, revisión del portafolio minero y validación del perfil del inversionista (KYC).",
  },
  {
    title: "2. Elección del colateral",
    body: "El inversionista elige una parcela de 5.000 m² o 1 ha con rol individual en uno de nuestros proyectos de la Región del Maule.",
  },
  {
    title: "3. Firma ante notario",
    body: "Contrato de mutuo reajustable en UF y constitución de la garantía sobre la parcela, inscrita en el Conservador de Bienes Raíces.",
  },
  {
    title: "4. Transferencia del capital",
    body: "Desde $15.000.000. El capital se destina a los proyectos mineros del portafolio Geocapitals.",
  },
  {
    title: "5. Pago mensual de intereses",
    body: "Liquidación mensual del interés (UF + 12 % anual) directo a la cuenta del inversionista.",
  },
  {
    title: "6. Renovación o salida",
    body: "Cada 12 meses el inversionista decide reinvertir o retirar su capital; al pagarse, se alza la garantía.",
  },
];

export const COLLATERAL_DISCLAIMERS = [
  "Documento informativo. No constituye oferta pública de valores ni asesoría financiera, legal o tributaria.",
  "La tasa UF + 12 % anual es la tasa ofrecida por contrato; no es una proyección de resultados de los proyectos mineros.",
  "Los proyectos mineros del portafolio no tienen recursos ni reservas certificados (CH 20235, NI 43-101 o JORC).",
  "La figura legal de la garantía, la tasación y el rol de cada parcela se definen y verifican en el contrato definitivo, ante notario.",
  "Toda inversión está sujeta a due diligence, validación KYC y firma de documentación definitiva.",
];

export function buildCollateralDeck(img: CollateralDeckImages = {}): ProjectDoc {
  const t = COLLATERAL_TERMS;
  const example = monthlyInterestClp(t.minTicketClp);
  const parcelRows = COLLATERAL_PARCELS.length
    ? COLLATERAL_PARCELS.map((p) => [
        p.code,
        p.project,
        p.commune ?? "Por confirmar",
        p.surface,
        p.rol ?? "Por confirmar",
        p.appraisalUf != null ? `UF ${p.appraisalUf.toLocaleString("es-CL")}` : "Por confirmar",
      ])
    : [
        [
          "[Por completar]",
          "Proyecto Maule",
          "Por confirmar",
          "5.000 m2 / 1 ha",
          "Por confirmar",
          "Por confirmar",
        ],
      ];

  return {
    reportProfile: "investment",
    code: "GC-COLATERAL",
    name: "Inversión con colateral",
    subtitle: "Financia el portafolio minero Geocapitals y recibe una parcela en garantía",
    commodity: "Portafolio",
    stage: "Programa de inversión",
    location: "Chile · colateral en Hualañé y Licantén, Maule",
    liveUrl: publicUrl("/proyectos"),
    docVersion: COLLATERAL_DOC_VERSION,
    tags: ["UF + 12 % anual", "Interés mensual", "Desde $15 MM", "Parcela en garantía"],
    kpis: [
      { label: "Inversión mínima", value: "$15 MM", note: "Pesos chilenos" },
      { label: "Tasa", value: "UF + 12 %", note: "Anual, capital reajustable en UF" },
      {
        label: "Pago de intereses",
        value: "Mensual",
        note: `Ej.: ${fmtClp(example)}/mes sobre $15 MM + UF`,
      },
      { label: "Colateral", value: "5.000 m2 - 1 ha", note: "Parcela con rol individual, Maule" },
    ],
    thesis: [
      "Tu capital financia proyectos de pequeña y mediana minería en Chile del portafolio Geocapitals.",
      "Recibes intereses todos los meses: UF + 12 % anual, liquidados mensualmente a tu cuenta.",
      "Tu inversión queda respaldada por un activo real: una parcela con rol individual en la Región del Maule.",
      "Cada 12 meses decides: reinviertes o retiras tu capital.",
    ],
    milestones: COLLATERAL_STEPS.map((s, i) => ({
      when: `Paso ${i + 1}`,
      what: s.title.replace(/^\d+\.\s*/, ""),
    })),
    sections: [
      ...(img.cover
        ? [
            {
              eyebrow: "Respaldo real",
              title: "Activos inmobiliarios en el Maule",
              lead: "Tu inversión minera queda respaldada por tierra con inscripción y plano.",
              deck: true,
              blocks: [
                {
                  kind: "figure" as const,
                  title: "Valle rural, Región del Maule",
                  imageDataUrl: img.cover,
                  caption:
                    "Imagen ilustrativa de ambientación. No corresponde a un predio específico.",
                },
              ],
            },
          ]
        : []),
      {
        eyebrow: "El modelo",
        title: "Cómo funciona",
        lead: "Un mutuo reajustable en UF, con interés mensual y una garantía inmobiliaria inscrita.",
        deck: true,
        blocks: [{ kind: "bullets", items: COLLATERAL_STEPS.map((s) => `${s.title}: ${s.body}`) }],
      },
      {
        eyebrow: "Términos",
        title: "Condiciones de la inversión",
        deck: true,
        blocks: [
          {
            kind: "kv",
            items: [
              ["Monto mínimo", fmtClp(t.minTicketClp)],
              ["Tasa", "UF + 12 % anual"],
              ["Liquidación de intereses", "Mensual, al inversionista"],
              ["Ejemplo sobre el mínimo", `${fmtClp(example)} al mes, más reajuste UF del capital`],
              ["Reinversión", "Opcional, cada 12 meses"],
              ["Colateral", "Parcela de 5.000 m2 o 1 ha, rol individual"],
              ["Ubicación del colateral", "Proyectos Geocapitals, Región del Maule"],
            ],
          },
        ],
      },
      {
        eyebrow: "Cartera de colateral",
        title: "Dos proyectos elegibles",
        lead: "116 parcelas sobre 85,75 ha en Hualañé y Licantén, Región del Maule.",
        deck: true,
        blocks: [
          {
            kind: "table",
            head: ["Proyecto", "Comuna", "Superficie", "Parcelas", "Precio lista", "Registro"],
            rows: COLLATERAL_PROJECTS.map((p) => [
              p.name,
              p.commune,
              `${p.areaHa.toLocaleString("es-CL")} ha`,
              String(p.lots),
              p.priceRange,
              p.registry,
            ]),
          },
          {
            kind: "text",
            body: "Titular: Forestal Valle Escondido SpA. Precios de lista publicados, no tasaciones. La parcela, su rol individual y su tasación se fijan en cada contrato.",
          },
        ],
      },
      ...(img.hualanePlan
        ? [
            {
              eyebrow: "Colateral 01",
              title: "Valle de Hualañé",
              lead: "40 parcelas desde 1 ha sobre 41,75 ha. Rol matriz 168-921, sector Caone.",
              deck: true,
              blocks: [
                {
                  kind: "figure" as const,
                  title: "Plano maestro, rol 168-921",
                  imageDataUrl: img.hualanePlan,
                  caption:
                    "Plano comercial del proyecto. Valores y disponibilidad sujetos a confirmación.",
                },
              ],
            },
          ]
        : []),
      ...(img.valleEscondido
        ? [
            {
              eyebrow: "Colateral 02",
              title: "Valle Escondido Licantén",
              lead: "76 parcelas sobre 44 ha. Inscripción Fs. 243 N 133 (2012), plano N 192 (2023), CBR Licantén.",
              deck: true,
              blocks: [
                {
                  kind: "figure" as const,
                  title: "Valle Escondido Licantén",
                  imageDataUrl: img.valleEscondido,
                  caption:
                    "IMAGEN REFERENCIAL / ILUSTRATIVA del material comercial del proyecto; puede no corresponder a una fotografía del predio.",
                },
              ],
            },
          ]
        : []),
      ...(img.hualaneSat
        ? [
            {
              eyebrow: "Imagen real 01",
              title: "Hualañé desde el satélite",
              lead: "Fotografía satelital real del terreno con los 40 lotes del plano 168-921 dibujados encima.",
              deck: true,
              blocks: [
                {
                  kind: "figure" as const,
                  title: "Imagen satelital real, sector Caone (Hualañé)",
                  imageDataUrl: img.hualaneSat,
                  caption:
                    "IMAGEN REAL: Esri World Imagery (Maxar y otros). Las líneas amarillas son los deslindes del plano comercial superpuestos por Geocapitals; no reemplazan el plano inscrito.",
                },
              ],
            },
          ]
        : []),
      ...(img.valleEscondidoSat
        ? [
            {
              eyebrow: "Imagen real 02",
              title: "Licantén desde el satélite",
              lead: "Fotografía satelital real del sector del proyecto Valle Escondido, al oriente de Licantén.",
              deck: true,
              blocks: [
                {
                  kind: "figure" as const,
                  title: "Imagen satelital real, sector Valle Escondido (Licantén)",
                  imageDataUrl: img.valleEscondidoSat,
                  caption:
                    "IMAGEN REAL: Esri World Imagery (Maxar y otros). Encuadre aproximado del sector; los deslindes exactos son los del plano N 192 (2023) del CBR Licantén.",
                },
              ],
            },
          ]
        : []),
      {
        eyebrow: "Respaldo",
        title: "Tu parcela en garantía",
        lead: "Cada inversión queda asociada a una parcela individualizada por su rol y su inscripción.",
        deck: true,
        blocks: [
          {
            kind: "table",
            head: ["Parcela", "Proyecto", "Comuna", "Superficie", "Rol", "Tasación"],
            rows: parcelRows,
          },
          {
            kind: "text",
            body: "La garantía se alza cuando se devuelve el capital. Antecedentes de cada parcela (rol, inscripción y tasación) disponibles para revisión antes de firmar.",
          },
        ],
      },
      {
        eyebrow: "Destino",
        title: "Dónde va tu capital",
        deck: true,
        blocks: [
          {
            kind: "bullets",
            items: [
              "Proyectos de explotación y pequeña minería del portafolio Geocapitals (Cholqui, Los Verdes y otros activos publicados).",
              "Cada proyecto tiene su terminal con mapa, ensayes, catastro y data room en geocapitals.com.",
              "Reporte periódico del avance de los proyectos al inversionista.",
            ],
          },
        ],
      },
    ],
    disclaimers: COLLATERAL_DISCLAIMERS,
    contact: { name: "Geocapitals", email: "contacto@geocapitals.com" },
  };
}
