import {
  CHOLQUI_ARIDOS,
  CHOLQUI_BASE_CASE,
  CHOLQUI_ENAMI,
  CHOLQUI_FACTS,
  CHOLQUI_GUARANTEES,
  CHOLQUI_GUARANTEE_TOTALS,
  CHOLQUI_ROUND,
  CHOLQUI_SCENARIOS,
  fmtClp,
  fmtClpM,
  fmtUsd,
} from "@/features/franco/data/cholqui";
import {
  CONTINGENCY_PCT,
  RATE_STEPS,
  fleetForRate,
  projectCashflow,
  unitCosts,
} from "@/features/franco/data/minePlan";
import type { DocSection, ProjectDoc } from "../model";
import { buildCholquiDoc } from "./cholqui";

export const CHOLQUI_INVESTMENT_VERSION = "v4.0";
export const CHOLQUI_INVESTMENT_TEASER_VERSION = "v3.0";

const num = (value: number) => value.toLocaleString("es-CL", { maximumFractionDigits: 0 });

export function buildCholquiInvestmentDoc(teaser = false): ProjectDoc {
  const base = buildCholquiDoc();
  const plans = [15_000, 20_000].map((plateau) => projectCashflow({ plateau }));
  const financial: DocSection[] = [
    {
      eyebrow: "Economía preliminar",
      title: "Escenarios separados de la evidencia mineral",
      deck: true,
      lead: "Las toneladas y leyes de estos escenarios son supuestos de sensibilidad; la disponibilidad de inventario y la aceptación comercial siguen pendientes.",
      blocks: [
        {
          kind: "narrative",
          body:
            "Se distinguen el plan entregado de " +
            num(CHOLQUI_BASE_CASE.tonnes) +
            " t y las rampas escalables del modelo operativo. No se mezclan sus resultados. La tarifa corresponde a " +
            CHOLQUI_ENAMI.circular +
            "; no se presenta como una cotización vigente ni liquidación efectiva.",
          provenance: "SCENARIO",
          source: "CHOLQUI_BASE_CASE / CHOLQUI_ENAMI / projectCashflow",
          confidence: "low",
        },
        {
          kind: "appendixTable",
          title: "Sensibilidad tarifaria del plan entregado",
          head: ["Cu soluble", "CLP/tms", "Ingresos", "Costos", "Superávit"],
          widths: [0.16, 0.17, 0.23, 0.22, 0.22],
          provenance: "SCENARIO",
          source: "CHOLQUI_SCENARIOS · plan entregado de 166.500 t",
          rows: CHOLQUI_SCENARIOS.map((scenario) => [
            scenario.label,
            num(scenario.tariffClpTms),
            fmtClpM(scenario.revenueClp),
            fmtClpM(scenario.costClp),
            fmtClpM(scenario.marginClp),
          ]),
        },
        {
          kind: "gap",
          title: "Retorno de inversión pendiente",
          body: "El payback matemático de un escenario no acredita retorno invertible. No se publican VAN/TIR ni payback de decisión hasta validar inventario, metalurgia, aceptación ENAMI, distancia, flete, liquidación, impuestos, financiamiento y cierre.",
          action:
            "Cerrar la matriz comercial y revisar un flujo financiero auditable antes de comprometer capital.",
        },
      ],
    },
    {
      eyebrow: "Operación",
      title: "Flota, costos y escalamiento",
      blocks: [
        {
          kind: "narrative",
          body:
            "La ingeniería preliminar dimensiona unidades operativas y respaldo según capacidad efectiva. Considera contingencia de " +
            CONTINGENCY_PCT +
            " %. La meseta de 20.000 t/mes requiere revisión de permisos y regulación; arriendos y productividad no son cotizaciones cerradas.",
          provenance: "SCENARIO",
          source: "GeoCapitals · minePlan.ts",
        },
        {
          kind: "appendixTable",
          title: "Flota y costo unitario por ritmo",
          head: ["t/mes", "Unidades", "Flota CLP/mes", "Total CLP/t"],
          widths: [0.18, 0.18, 0.34, 0.3],
          provenance: "SCENARIO",
          source: "fleetForRate / unitCosts",
          rows: RATE_STEPS.map((rate) => {
            const fleet = fleetForRate(rate);
            return [
              num(rate),
              String(fleet.lines.reduce((sum, line) => sum + line.units, 0)),
              fmtClp(fleet.monthlyClp),
              num(unitCosts(rate).totalClpT),
            ];
          }),
        },
        ...plans.map((plan): Extract<DocSection["blocks"][number], { kind: "appendixTable" }> => ({
          kind: "appendixTable",
          title: "Flujo mensual de escenario · " + num(plan.params.plateau) + " t/mes",
          head: ["Mes", "t/mes", "Ingresos CLP", "Costos CLP", "Margen CLP", "Caja CLP"],
          widths: [0.08, 0.12, 0.2, 0.2, 0.2, 0.2],
          provenance: "SCENARIO",
          source: "projectCashflow · 24 meses / 1,5 % Cu soluble",
          rows: plan.months.map((month) => [
            String(month.month),
            num(month.rate),
            fmtClpM(month.revenueClp),
            fmtClpM(month.costClp),
            fmtClpM(month.marginClp),
            fmtClpM(month.cumulativeCashflowClp),
          ]),
        })),
        {
          kind: "appendixTable",
          title: "Sensibilidad del modelo escalable",
          head: ["Meseta", "Cu sol. %", "Mineral t", "Ingresos", "Costos", "Caja neta"],
          widths: [0.17, 0.12, 0.17, 0.18, 0.18, 0.18],
          provenance: "SCENARIO",
          source: "projectCashflow · combinación de meseta y ley tarifaria",
          rows: [15_000, 20_000].flatMap((plateau) =>
            CHOLQUI_SCENARIOS.map((scenario) => {
              const plan = projectCashflow({ plateau, gradePct: scenario.grade });
              return [
                num(plateau),
                String(scenario.grade),
                num(plan.totalTonnes),
                fmtClpM(plan.totalRevenueClp),
                fmtClpM(plan.totalCostClp),
                fmtClpM(plan.netAfterCapexClp),
              ];
            }),
          ),
        },
      ],
    },
    {
      eyebrow: "Capital",
      title: "Ronda, garantías y antecedentes complementarios",
      deck: true,
      lead: "Términos referenciales sujetos a due diligence y acuerdo definitivo.",
      blocks: [
        {
          kind: "narrative",
          body:
            "Ronda " +
            fmtUsd(CHOLQUI_ROUND.roundSizeUsd) +
            " por " +
            CHOLQUI_ROUND.equityOfferedPct +
            " %; ticket mínimo " +
            fmtUsd(CHOLQUI_ROUND.minTicketUsd) +
            ". Instrumento: " +
            CHOLQUI_ROUND.instrument +
            ". Valorización referencial " +
            fmtUsd(CHOLQUI_ROUND.valuationLowUsd) +
            "–" +
            fmtUsd(CHOLQUI_ROUND.valuationHighUsd) +
            ".",
          provenance: "DECLARED",
          source: "CHOLQUI_ROUND · términos de conversación, no oferta pública",
        },
        {
          kind: "appendixTable",
          title: "Uso de fondos",
          head: ["Destino", "% de la ronda"],
          widths: [0.75, 0.25],
          provenance: "DECLARED",
          source: "CHOLQUI_ROUND",
          rows: CHOLQUI_ROUND.useOfFunds.map((item) => [item.label, item.pct + " %"]),
        },
        {
          kind: "appendixTable",
          title: "Garantías documentadas",
          head: ["Activo", "Titular", "Avalúo fiscal", "Estado"],
          widths: [0.32, 0.22, 0.22, 0.24],
          provenance: "DOCUMENTARY",
          source: "CHOLQUI_GUARANTEES",
          rows: CHOLQUI_GUARANTEES.map((item) => [
            item.asset,
            item.holder,
            item.appraisalClp ? fmtClp(item.appraisalClp) : "Sin tasación",
            item.status,
          ]),
        },
        {
          kind: "narrative",
          body:
            "Avalúo documentado " +
            fmtClp(CHOLQUI_GUARANTEE_TOTALS.documentedClp) +
            "; libre de embargo " +
            fmtClp(CHOLQUI_GUARANTEE_TOTALS.freeOfLiensClp) +
            ". No equivale a tasación comercial ni valor de realización. Contrato de áridos: " +
            num(CHOLQUI_ARIDOS.minVolumeM3Month) +
            " m³/mes a " +
            fmtClp(CHOLQUI_ARIDOS.priceClpM3) +
            "/m³ + IVA. " +
            CHOLQUI_ARIDOS.caveat,
          provenance: "DOCUMENTARY",
          source: "Antecedentes de garantías y contrato complementario del titular",
        },
        {
          kind: "appendixTable",
          title: "Inventario de hechos, declaraciones y verificaciones",
          head: ["Sección", "Dato", "Valor", "Procedencia", "Fuente"],
          widths: [0.15, 0.2, 0.2, 0.15, 0.3],
          provenance: "DOCUMENTARY",
          source: "CHOLQUI_FACTS",
          rows: CHOLQUI_FACTS.map((item) => [
            item.section,
            item.label,
            item.value,
            item.provenance,
            item.source,
          ]),
        },
      ],
    },
  ];
  return {
    ...base,
    reportProfile: "investment",
    subtitle: "Memorando de inversión preliminar · evidencia, escenarios y brechas",
    docVersion: teaser ? CHOLQUI_INVESTMENT_TEASER_VERSION : CHOLQUI_INVESTMENT_VERSION,
    sections: [...base.sections, ...financial],
    disclaimers: [
      ...base.disclaimers,
      "Tarifas y supuestos fechados según fuente; no son cotización vigente ni presupuesto aprobado.",
      "La ingeniería y los flujos son escenarios: no acreditan recursos, reservas ni rentabilidad.",
    ],
  };
}
