# Consolidar Proyecto Cholqui (ex Gianfranco) en Geocapitals

Hoy los datos de Cholqui están repartidos en tres lugares que no se hablan: la ficha de inversión (`fichas.ts`), la ficha del dashboard (`franco/data/project.ts`, con "datos por cargar") y el deck PDF generado fuera de la app con las planillas de flujo (escenarios 1,5 / 2,0 / 2,5 / 3,0 % Cu). El plan unifica todo en una sola fuente dentro de la plataforma y de ahí alimenta el live view y el PDF.

## 1. Una sola fuente de verdad

Crear un módulo de datos de Cholqui con todo lo verificado del prospecto:
- Identidad: código CHOLQUI, Cu-Au-Ag, ~5.000 ha (20 pedimentos + 15 pertenencias), Volcania Minerals SpA, Melipilla / R.M.
- Ubicación y CRS: UTM PSAD'56 19H reproyectado a WGS84.
- Puntos de muestreo/observación del prospecto, con su procedencia (Declarado / A verificar / Certificado).
- Vecindad: Mina Las Minitas (~15.000 t/mes, ~40 ha) y pertenencias colindantes de Yamana Gold.
- Escenarios económicos 1,5 / 2,0 / 2,5 / 3,0 % Cu con ingresos, costos, utilidad acumulada y payback por período — marcados como **ilustrativos**, sin VAN/TIR (no existen en la fuente).
- Términos de la ronda (valorización, ticket, instrumento, uso de fondos, hitos) tomados de la ficha existente para que no queden dos cifras distintas.

La ficha de inversión y el dashboard pasan a leer de aquí; se eliminan los duplicados y el texto "datos por cargar".

## 2. Live view real en `/live/franco`

Reemplazar el placeholder por una vista pública con la colorimetría Geocapitals (papel hueso, tinta, cobalto, serif display):
- Hero con estado, superficie, commodity y coordenadas.
- Mapa con el polígono de pertenencias, Las Minitas destacada y los puntos de muestreo clicables (ficha por punto con procedencia).
- Panel de evidencia geológica (litología, estilo de mineralización, observaciones de los geólogos).
- Panel de escenarios económicos con selector 1,5 / 2,0 / 2,5 / 3,0 % Cu: ingresos, costos, utilidad acumulada, payback y curva acumulada.
- Bloque de caveats siempre visible: sin recursos ni reservas certificadas; producción vecina no es propia; dominio a verificar.
- Botones: descargar PDF de inversión y contacto.

## 3. PDF de inversión + flujo, con marca y QR

Generar el PDF **dentro de la app** (mismo motor de las fichas actuales, no un script externo), con la identidad Geocapitals:
- Portada con logo, código CHOLQUI, sello de estado y fecha de emisión.
- Resumen ejecutivo, ubicación y propiedad, evidencia de mineralización, actividad vecina, upside de exploración.
- Tabla y gráfico de los cuatro escenarios + curva de flujo acumulado y payback.
- Estructura de la inversión: valorización, ronda, ticket mínimo, uso de fondos, hitos.
- Riesgos y plan de de-risking.
- Pie institucional con QR de verificación que apunta al live view público, contacto (correo y WhatsApp) y hash de versión del documento.
- Disclaimers: escenarios ilustrativos, sin recursos/reservas certificadas.

El mismo PDF queda disponible desde el live view, desde la ficha de inversión y desde el expediente del proyecto en el dashboard.

## 4. Consolidación de rutas

- `/live/franco` sigue como URL pública (no rompe enlaces) y muestra "Proyecto Cholqui".
- La ficha `/proyectos/ficha/franco` y el panel del dashboard usan los mismos números que el live view y el PDF.
- Se retira el contenido duplicado de Gianfranco que no coincida con la fuente única.

## Detalles técnicos

- Nuevo `src/features/franco/data/cholqui.ts` (datos + escenarios tipados) consumido por `fichas.ts`, `FrancoDashboard` y el generador PDF.
- Live view en `src/features/franco/*` reescrito sobre tokens semánticos del sistema Institutional Modernist (sin hex hardcodeados); mapa reutilizando `FrancoPertenenciasMap` y el GeoJSON de `src/data/geo/franco_pertenencias.geojson`.
- PDF con jsPDF siguiendo el patrón de `src/lib/tilama-pdf.ts`, más QR generado en cliente hacia la URL pública de verificación.
- Sin cambios de base de datos ni de RLS; todo el contenido es estático y verificable.
