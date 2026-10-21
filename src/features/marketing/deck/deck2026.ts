import hero from '@/assets/hero-mining.jpg';
import cholquiPert from '@/assets/deck/cholqui-pertenencias.jpg.asset.json';
import losverdesPert from '@/assets/deck/losverdes-pertenencias.jpg.asset.json';
import plataforma from '@/assets/deck/plataforma-wallet.jpg.asset.json';
import hualane from '@/assets/colateral/hualane-satelite.jpg';
import type { InvestorVisualSlide, ProjectDoc } from '@/lib/pdf/model';
import { publicUrl } from '@/lib/publicUrl';

export const DECK_TERMS = { roundUsd: 1500000, shares: 15000, shareUsd: 100, minUsd: 15000, minShares: 150, cholquiPlacement: 47, tilamaPlacement: 65, collateralMinClp: 15000000, collateralRate: 12 } as const;
export const DECK_RISKS = [
  'Documento comercial · Octubre 2026 · No constituye oferta pública de valores',
  'Las cifras operativas, leyes y valorizaciones son declaradas por la operadora o referenciales; no son proyecciones auditadas ni garantía de resultados',
  'Sin recursos ni reservas certificados NI 43-101/JORC',
  'Acciones no transables en bolsa. Salidas potenciales, no garantizadas. Colocación declarada no equivale a recaudo ni capital liquidado.',
  'La garantía mitiga, pero no elimina, el riesgo de pérdida',
];
const pertCholqui = 'Cholqui · 20 pertenencias del titular sobre imagen satelital (Esri World Imagery)';
const pertLv = 'Los Verdes – Tilama · 22 pertenencias integradas sobre imagen satelital (Esri World Imagery)';
const fn = 'Cifras operativas y valorizaciones declaradas por la operadora (dossier comercial oct. 2026), no auditadas.';
export const DECK_SLIDES: InvestorVisualSlide[] = [
  { title: 'Cobre chileno en producción, desde USD 15.000.', kicker: 'Ronda Serie A · 2026', lead: 'Dos proyectos mineros en explotación, una plataforma digital para invertir, firmar y seguir cada acción.', image: hero, imageLabel: 'Imagen ilustrativa', hero: true,
    stats: [{ label: 'Ronda por proyecto', value: 'USD 1,5 M' }, { label: 'Ticket de entrada', value: 'USD 15.000' }, { label: 'Producción por proyecto', value: '5–15 kt/mes' }],
    items: [{ title: 'Cholqui', body: 'Cu–Au–Ag · Melipilla, Región Metropolitana' }, { title: 'Los Verdes – Tilama', body: 'Cu–Mo · Los Vilos, Choapa, Región de Coquimbo' }], note: `Emisor: Valle Escondido SpA · RUT 78.524.757-4. ${fn} Documento comercial, no constituye oferta pública de valores.` },
  { title: 'El momento del cobre.', kicker: '01 / Tesis de inversión', lead: 'La electrificación global eleva la demanda de cobre. Nuestros proyectos ya extraen y venden mineral: el capital acelera producción, no exploración.', image: losverdesPert.url, imageLabel: pertLv,
    stats: [{ label: 'Capacidad por proyecto', value: '5.000–15.000', note: 't/mes' }, { label: 'Comprador principal', value: 'ENAMI' }],
    items: [{ title: 'Producción, no promesas de descubrimiento', body: 'Vetas y mantos oxidados con faenas activas en dos regiones mineras con caminos, energía y poder de compra cercano.' }, { title: 'Dos activos, riesgo diversificado', body: 'Cholqui en la Región Metropolitana y el distrito integrado Los Verdes – Tilama en Coquimbo, cada uno en su propia sociedad.' }], note: `${fn} Sin recursos ni reservas certificados NI 43-101/JORC.` },
  { title: 'Una ronda clara, acción por acción.', kicker: '02 / Estructura de inversión', lead: 'Cada proyecto tiene su sociedad (SPV). Compras acciones directamente en la que elijas, con contrato y registro en tu wallet.', image: plataforma.url, imageLabel: 'Vista ilustrativa de la plataforma GeoCapitals',
    stats: [{ label: 'Acciones por ronda', value: '15.000' }, { label: 'Precio por acción', value: 'USD 100' }, { label: 'Mínimo', value: '150 acciones' }],
    items: [{ title: 'La ronda avanza: 47% Cholqui · 65% Tilama', body: 'Los cupos disponibles se reducen. Reserva tu ticket hoy y firma en línea.' }], note: 'Colocación declarada por la operadora; no equivale a capital liquidado. Términos sujetos a documentación definitiva y KYC.' },
  { title: 'Cholqui: leyes de hasta 16% Cu.', kicker: '03 / Cu–Au–Ag · Melipilla, RM', lead: 'A una hora de Santiago, con 20 pertenencias delimitadas y un programa de validación en marcha.', image: cholquiPert.url, imageLabel: pertCholqui,
    stats: [{ label: 'Superficie', value: '~5.000 ha' }, { label: 'Valorización', value: 'USD 4–6 M' }, { label: 'Horizonte', value: '4 años' }],
    items: [{ title: 'Mineral de alta ley en superficie', body: 'Análisis de 0,96 a 16,23% Cu total, oro hasta 1,00 g/t y plata hasta 118 g/t.' }, { title: 'Logística inmejorable', body: 'Cercanía a Santiago, puertos y plantas de compra: menor costo de transporte por tonelada.' }], note: `Superficie incluye 20 pedimentos + 15 pertenencias. Leyes: 7 muestras puntuales superficiales, no leyes medias. Valorización referencial (comparables + tarifa ENAMI). ${fn}` },
  { title: 'Los Verdes – Tilama: un distrito completo.', kicker: '04 / Cu–Mo · Los Vilos, Coquimbo', lead: '22 pertenencias integradas bajo un contrato marco, con base de venta pactada y renta a titulares alineada con producción.', image: losverdesPert.url, imageLabel: pertLv,
    stats: [{ label: 'Superficie integrada', value: '3.303 ha' }, { label: 'Valorización', value: 'USD 8–12 M' }, { label: 'Horizonte', value: '5 años' }],
    items: [{ title: 'Venta integral pactada en USD 8 M', body: 'Una salida contractual ya definida para el distrito consolidado.' }, { title: 'Titulares alineados', body: 'Renta minera del 10% del valor líquido pagado por el comprador: ganan cuando el proyecto produce.' }], note: `Superficie según polígonos del catastro del proyecto. Base de venta = monto contractual, no tasación. La renta a titulares no es rentabilidad del accionista. ${fn}` },
  { title: 'Del frente de mina a la caja.', kicker: '05 / Modelo de negocio', lead: 'Un ciclo corto y probado en la pequeña y mediana minería chilena.', image: hero, imageLabel: 'Imagen ilustrativa', stats: [],
    items: [{ title: '01 / Extracción', body: 'Vetas y mantos oxidados, 5.000–15.000 t/mes por proyecto.' }, { title: '02 / Calidad', body: 'Muestreo con laboratorio certificado y QA/QC antes de cada despacho.' }, { title: '03 / Venta', body: 'ENAMI u otro poder de compra. Referencia CLP 89.571/tms a 1,5% Cu soluble.' }, { title: '04 / Retorno', body: 'Flujos a accionistas y opción de consolidación, venta o socio estratégico.' }], note: `Tarifa: Circular ENAMI N°27, julio 2026, citada en el dossier. ${fn} Retornos y salidas no garantizados.` },
  { title: 'Tu inversión, en tu bolsillo.', kicker: '06 / GeoCapitals Investment OS', lead: 'Perfil verificado, ronda en vivo, firma digital y cartola con QR: todo desde el teléfono.', image: plataforma.url, imageLabel: 'Vista ilustrativa de la plataforma GeoCapitals', stats: [],
    items: [{ title: 'Perfil e identidad', body: 'KYC y NCNDA en línea, perfil de riesgo y firma digital habilitada.' }, { title: 'Ronda y simulador', body: 'Ve el avance de cada ronda, simula tu ticket y reserva acciones en minutos.' }, { title: 'Wallet institucional', body: 'Tickets, contratos firmados, pagos liquidados y posiciones SPV con cartola PDF verificable.' }, { title: 'Visor satelital 3D', body: 'Recorre pertenencias, relieve y análisis satelital de cada proyecto.' }], note: 'Pantallas ilustrativas. Las posiciones se registran solo tras liquidación verificada por el equipo GeoCapitals.' },
  { title: 'Valor con horizonte definido.', kicker: '07 / Escenarios de valor', lead: 'Dos activos con valorización referencial y plazos de negocio concretos de 4 y 5 años.', image: cholquiPert.url, imageLabel: pertCholqui,
    stats: [{ label: 'Cholqui · 4 años', value: 'USD 4–6 M' }, { label: 'Tilama · 5 años', value: 'USD 8–12 M' }],
    items: [{ title: 'Tres rutas de salida', body: 'Flujos operacionales, venta del activo consolidado o ingreso de un socio estratégico.' }, { title: 'Primeros 90 días', body: 'Saneamiento legal, topografía y QA/QC, sondajes prioritarios, lote piloto ENAMI y plan minero auditado.' }], note: `Rangos referenciales: no son precio de la ronda ni valoración certificada. Acciones no transables en bolsa. ${fn}` },
  { title: 'Renta fija con garantía real.', kicker: '08 / Alternativa con colateral', lead: 'Mutuo UF + 12% anual con intereses mensuales, garantizado con una parcela inscrita a tu favor.', image: hualane, imageLabel: 'Imagen satelital · Hualañé',
    stats: [{ label: 'Tasa contractual', value: 'UF + 12%' }, { label: 'Desde', value: 'CLP 15 M' }, { label: 'Renta mensual', value: 'CLP 150.000' }],
    items: [{ title: '116 parcelas · 85,75 ha de respaldo', body: 'Hualañé (Caone) y Licantén, región del Maule. Cada mutuo queda garantizado con una parcela de 5.000 m² a 1 ha.' }, { title: 'Garantía inscrita', body: 'KYC → eliges parcela → mutuo notarial e inscripción CBR a tu favor → transfieres → recibes intereses.' }], note: 'Instrumento distinto de las acciones. Renta: ejemplo nominal sobre CLP 15 M, más reajuste UF. Propietario declarado: Forestal Valle Escondido SpA; precios de lista, no tasación; deslindes comerciales, no plano inscrito. La garantía mitiga, no elimina, el riesgo.' },
  { title: 'Reserva tu participación.', kicker: '09 / Próximo paso', lead: 'Crea tu cuenta, verifica tu identidad y emite tu ticket en geocapitals.com. Nuestro equipo te acompaña en cada firma.', image: plataforma.url, imageLabel: 'Vista ilustrativa de la plataforma GeoCapitals', stats: [{ label: 'Ticket mínimo', value: 'USD 15.000' }],
    items: [{ title: '1 · Regístrate', body: 'Perfil y KYC en línea.' }, { title: '2 · Elige y firma', body: 'Proyecto, monto y contrato digital con QR.' }, { title: '3 · Sigue tu inversión', body: 'Wallet con posición SPV y cartola.' }, { title: 'Contacto', body: 'contacto@geocapitals.com · +56 9 6218 4071' }], note: `${DECK_RISKS[0]}. ${DECK_RISKS[1]}. ${DECK_RISKS[2]}. Inversión ilíquida con posibilidad de pérdida.` },
];
export function deckSlideIndex(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= DECK_SLIDES.length ? n : 1;
}
export function buildMarketingDeck(): ProjectDoc {
  return { code: 'INVESTOR_2026', name: 'GeoCapitals · Serie A 2026', subtitle: 'Portafolio minero y alternativa de colateral', reportProfile: 'investment', commodity: 'Cu–Au–Ag / Cu–Mo', stage: 'En explotación · declarada', location: 'Chile', liveUrl: publicUrl('/inversion/deck'), docVersion: '2026.10', tags: [], kpis: [], thesis: [], sections: [], disclaimers: DECK_RISKS, visualSlides: DECK_SLIDES, contact: { email: 'contacto@geocapitals.com' } };
}
