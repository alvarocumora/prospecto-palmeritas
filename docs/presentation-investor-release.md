# Entrega para presentación: navegación e inversión

Base revisada: main@289733e52691b63f3e08126cec56025c8ce2e99a.

## Recorrido recomendado

1. /terminal: portada pública de activos y acceso al espacio de inversión.
2. /terminal/market: referencias externas con unidad, fecha de proveedor y estado no disponible.
3. /terminal/cholqui?tab=mapa: mapa; alternar 2D/3D sin perder activo.
4. Cambiar a tesis y simulador; mostrar supuestos referenciales y riesgos.
5. Documentos: PDFs públicos y oportunidades enlazadas por UUID, sin resolver por nombres.
6. /proyectos/:listingId: términos de oportunidad, simulador y data room privado.
7. Registro/login conserva oportunidad e inputs del simulador.
8. /dashboard: inicio específico del inversionista; solicitudes, pagos y participaciones.
9. /dashboard/investments y /dashboard/offerings: detalle del historial y suscripciones.

El listado de oportunidades del terminal usa únicamente el vínculo persistente project_id. Palmeras y Nahuelbuta todavía no tienen un UUID en el catálogo estático: se ofrece contacto, sin inventar vínculos.

## Correcciones

- Las páginas padre de catálogo y terminal ceden el render a sus rutas hijas.
- Mercado, capital y participaciones comparten navegación y estados visibles.
- El dashboard operativo conserva su implementación para los demás perfiles.
- La TIR simplificada deja de tener un piso artificial; gráfico y cobro final concuerdan.
- Evidencia desconocida queda pendiente; reportes genéricos se llaman reportes técnicos.
- Ofertas permite lectura del inversionista; escrituras conservan autorización/RLS del emisor.
- Permisos de módulo ausentes o malformados no conceden acceso.
- Metadatos confidenciales y URLs de descarga requieren NDA y grant vigente con scope.
- Firmar NDA otra vez no reactiva grants revocados o vencidos; los nuevos grants mantienen el acceso automático previamente existente, atribuido al usuario que lo solicita.
- Lecturas del data room no crean rooms ni carpetas.
- Las URLs de descarga emitidas antes de una revocación conservan su vencimiento actual de diez minutos.

## Pendientes explícitos

- Comprobar contra fuente oficial la discrepancia regional/coordenadas de Palmeras; no se sustituye su ubicación por una coordenada estimada.
- Unificar el contrato público y las fichas estáticas con rondas y ofertas, conservando instrumentos distintos.
- Publicación por dataset, trazabilidad y revisión QP persistidas en base.
- Grants con aprobación manual y KYC según política comercial, en una entrega posterior.
- Retiro de visores sólo después de demostrar equivalencia de capas y realizar QA visual.
- Revisar el borrador #310 para administración de firmas por operación.
- Checklist corporativo y técnico TSX/TSXV; no equivale a aprobación de bolsa.

## Validación

Pruebas de navegación con router real en memoria, reconciliación matemática/retorno de auth, matriz de permisos por recurso y llamadas directas a handlers del data room. Typecheck, lint, tests y build en CI. QA visual en navegador y publicación en el sitio deben comprobarse por separado; el conector de repositorio no valida un despliegue ni permite ver la interfaz.
