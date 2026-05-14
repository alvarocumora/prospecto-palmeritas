export const PALMERAS_OVERVIEW_METRICS = [
  { label: "Tipo Depósito", value: "Epit–Meso", sub: "Au–Cu vetas" },
  { label: "Edad Roca Caja", value: "Cret. Sup.", sub: "Fm. Lo Valle" },
  { label: "Palmeras Proxy", value: "12+", sub: "J. chilensis marcadores" },
  { label: "Labores Antiguas", value: "3+", sub: "piques + socavones" },
  { label: "Presupuesto", value: "USD 211K", sub: "Programa 12 meses" },
] as const;

export const PALMERAS_PROJECT_PHASES = [
  { n: 1, range: "Meses 1–2", title: "Muestreo superficial", desc: "chip + canal + grab", active: true },
  { n: 2, range: "Meses 3–4", title: "Geofísica IP", desc: "lineamientos + targets drill", active: false },
  { n: 3, range: "Meses 5–8", title: "Sondajes DDH", desc: "4 perforaciones 1,030 m", active: false },
  { n: 4, range: "Meses 9–12", title: "Análisis + reporte", desc: "estimación recursos 43-101", active: false },
] as const;

export const PALMERAS_OPERATIONAL_ALERTS = [
  { tone: "alert", level: "INMEDIATA", text: "Chip sampling veta aflorante — sin costo análisis aún" },
  { tone: "alert", level: "INMEDIATA", text: "Canal sampling labores antiguas — geometría pendiente" },
  { tone: "gold", level: "ALTA", text: "Verificar concesiones SERNAGEOMIN — Portal Geomin" },
  { tone: "gold", level: "ALTA", text: "Notificar CMN — labores prehispánicas en predio" },
  { tone: "teal", level: "MEDIA", text: "Contratar geólogo QP para supervisión DDH" },
  { tone: "teal", level: "MEDIA", text: "Cotizar laboratorio certificado ISO 17025 (ALS / Bureau Veritas)" },
] as const;
