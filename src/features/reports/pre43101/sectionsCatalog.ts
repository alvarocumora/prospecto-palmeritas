// Catálogo de las 17 secciones del informe pre-NI 43-101 / JORC.
// Cada sección define si depende de IA, si es "preliminar" cuando no hay datos
// reales, y un breve prompt-context que se manda al modelo.
import type { Pre43101Data } from "./data/pre43101Data.types";

export type SectionDef = {
  id: string;
  number: string;
  title: string;
  needsAI: boolean;
  preliminaryWhen: (d: Pre43101Data) => boolean;
  contextForAI: (d: Pre43101Data) => string;
};

const baseCtx = (d: Pre43101Data) => {
  const p = d.project;
  return `Proyecto: ${p?.name ?? "—"} (código ${p?.code ?? "—"}). Commodity: ${p?.commodity ?? "—"}. Región: ${p?.region ?? "—"}, ${p?.country ?? "—"}. Centroide: ${p?.center_lat}, ${p?.center_lng}. Datos disponibles: ${d.counts.concessions} concesiones, ${d.counts.satAnomalies} anomalías satelitales, ${d.counts.veins} vetas modeladas, ${d.counts.targets} targets de exploración, ${d.counts.magTargets} mag targets, ${d.counts.drillHoles} sondajes, ${d.counts.geophysicsSurveys} campañas geofísicas, ${d.counts.qaqcResults} QAQC. Resource model: ${d.counts.hasResourceModel ? "sí" : "no"}.`;
};

export const SECTIONS: SectionDef[] = [
  {
    id: "summary",
    number: "1",
    title: "Resumen Ejecutivo",
    needsAI: true,
    preliminaryWhen: () => false,
    contextForAI: (d) =>
      `${baseCtx(d)} Genera resumen ejecutivo con KPIs principales, hallazgos y recomendación.`,
  },
  {
    id: "property",
    number: "2",
    title: "Propiedad y Catastro Minero",
    needsAI: true,
    preliminaryWhen: (d) => d.counts.concessions === 0,
    contextForAI: (d) =>
      `${baseCtx(d)} Concesiones reales: ${JSON.stringify(d.concessions.slice(0, 30))}. Describe título minero, área total, vigencia, patentes.`,
  },
  {
    id: "access",
    number: "3",
    title: "Accesibilidad, Clima e Infraestructura",
    needsAI: true,
    preliminaryWhen: () => true,
    contextForAI: (d) =>
      `${baseCtx(d)} Describe accesibilidad desde Santiago/La Serena hasta Tilama, ruta D-71, clima semiárido andino, infraestructura cercana (caminos, energía, agua, puertos).`,
  },
  {
    id: "history",
    number: "4",
    title: "Historia del Proyecto",
    needsAI: true,
    preliminaryWhen: () => true,
    contextForAI: (d) =>
      `${baseCtx(d)} Resume historia minera del distrito Tilama y faja IOCG chilena.`,
  },
  {
    id: "geology",
    number: "5",
    title: "Geología Regional y Local",
    needsAI: true,
    preliminaryWhen: (d) => d.counts.veins === 0,
    contextForAI: (d) =>
      `${baseCtx(d)} Vetas modeladas: ${JSON.stringify(d.veins)}. Describe geología regional (Franja Cretácica Cu-Au), estructuras, alteración hidrotermal, mineralogía.`,
  },
  {
    id: "deposit",
    number: "6",
    title: "Tipos de Depósito",
    needsAI: true,
    preliminaryWhen: () => true,
    contextForAI: (d) =>
      `${baseCtx(d)} Discute modelos genéticos aplicables: IOCG, pórfido Cu-Au, vetas mesotermales Cu-Au-Ag. Compara con análogos chilenos.`,
  },
  {
    id: "exploration",
    number: "7",
    title: "Exploración (Satelital + Geofísica)",
    needsAI: true,
    preliminaryWhen: (d) => d.counts.geophysicsSurveys === 0,
    contextForAI: (d) =>
      `${baseCtx(d)} ${d.satAnomalies.length} anomalías satelitales detectadas. Top 5: ${JSON.stringify(d.satAnomalies.slice(0, 5))}. Mag targets: ${JSON.stringify(d.magTargets.slice(0, 5))}. Geofísica: ${d.counts.geophysicsSurveys === 0 ? "PENDIENTE — recomendar campaña IP/Mag/CSAMT" : JSON.stringify(d.geophysicsSurveys)}.`,
  },
  {
    id: "drilling",
    number: "8",
    title: "Sondajes",
    needsAI: true,
    preliminaryWhen: (d) => d.counts.drillHoles === 0,
    contextForAI: (d) =>
      `${baseCtx(d)} Sondajes históricos: ${d.counts.drillHoles}. Plan de targets: ${d.counts.targets} ubicaciones priorizadas. ${d.counts.drillHoles === 0 ? "MODELO PRELIMINAR — describe la campaña planificada y la justificación geológica." : `Muestra: ${JSON.stringify(d.drillHoles.slice(0, 10))}.`}`,
  },
  {
    id: "qaqc",
    number: "9",
    title: "Preparación de Muestras y QA/QC",
    needsAI: true,
    preliminaryWhen: (d) => d.counts.qaqcResults === 0,
    contextForAI: (d) =>
      `${baseCtx(d)} QAQC en sistema: ${d.counts.qaqcResults}. ${d.counts.qaqcResults === 0 ? "MODELO PRELIMINAR — describe protocolo recomendado (blancos, estándares CRM, duplicados, laboratorio ALS/SGS, frecuencia)." : ""}`,
  },
  {
    id: "verification",
    number: "10",
    title: "Verificación de Datos",
    needsAI: true,
    preliminaryWhen: (d) => d.counts.drillHoles === 0,
    contextForAI: (d) =>
      `${baseCtx(d)} Resume estado de verificación: catastro sincronizado SERNAGEOMIN, anomalías sat con confidence promedio, sondajes pendientes.`,
  },
  {
    id: "processing",
    number: "11",
    title: "Procesamiento Mineral",
    needsAI: true,
    preliminaryWhen: () => true,
    contextForAI: (d) =>
      `${baseCtx(d)} Discute rutas metalúrgicas preliminares para Cu-Au-Ag: flotación, lixiviación, recuperaciones esperables.`,
  },
  {
    id: "resource",
    number: "12",
    title: "Estimación de Recursos Minerales",
    needsAI: true,
    preliminaryWhen: (d) => !d.counts.hasResourceModel,
    contextForAI: (d) =>
      `${baseCtx(d)} Resource model: ${d.resourceModel ? JSON.stringify(d.resourceModel) : "PENDIENTE"}. Vetas: ${JSON.stringify(d.veins)}. Describe metodología, tonelaje/ley, clasificación.`,
  },
  {
    id: "adjacent",
    number: "13",
    title: "Propiedades Adyacentes",
    needsAI: true,
    preliminaryWhen: () => true,
    contextForAI: (d) =>
      `${baseCtx(d)} Describe minas y propiedades vecinas conocidas en distrito Tilama y faja regional. Nota: información de terceros, no garantía de extrapolación.`,
  },
  {
    id: "viewer3d",
    number: "14",
    title: "Visor 3D Tipo Datamine",
    needsAI: false,
    preliminaryWhen: () => false,
    contextForAI: () => "",
  },
  {
    id: "interpretation",
    number: "15",
    title: "Interpretación y Conclusiones",
    needsAI: true,
    preliminaryWhen: () => false,
    contextForAI: (d) =>
      `${baseCtx(d)} Sintetiza interpretación geológica integrada: anomalías sat (${d.counts.satAnomalies}), vetas (${d.counts.veins}), targets prioritarios (${d.counts.targets}), zonas de mineralización probable.`,
  },
  {
    id: "recommendations",
    number: "16",
    title: "Recomendaciones y Presupuesto",
    needsAI: true,
    preliminaryWhen: () => false,
    contextForAI: (d) =>
      `${baseCtx(d)} Define plan de exploración en 3 fases con presupuesto USD: Fase 1 (mapeo + geofísica + geoquímica), Fase 2 (sondajes diamantina), Fase 3 (PEA). Incluye targets prioritarios.`,
  },
  {
    id: "qp",
    number: "17",
    title: "Declaración del Qualified Person",
    needsAI: false,
    preliminaryWhen: () => false,
    contextForAI: () => "",
  },
];
