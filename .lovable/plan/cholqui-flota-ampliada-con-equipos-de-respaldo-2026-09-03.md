# Cholqui — Flota ampliada con equipos de respaldo

Hoy la flota del plan minero se dimensiona con una sola unidad por tipo de equipo por cada tramo de capacidad, sin disponibilidad mecánica ni unidades de respaldo: a 15.000 t/mes el modelo pide 1 excavadora, 1 cargador y 3 camiones, lo que deja la operación detenida ante cualquier falla. El objetivo es incorporar equipos adicionales de producción y de respaldo, y reflejarlos tanto en el live como en el PDF.

## Qué cambia

**1. Dimensionamiento con disponibilidad y respaldo**
- Cada equipo pasa a tener disponibilidad mecánica (ej. 80–85 % perforación y chancado, 85–88 % carguío y transporte). Las unidades operativas se calculan sobre capacidad efectiva, no nominal.
- Regla de respaldo por criticidad: los equipos críticos (excavadora, cargador frontal, chancador, perforadora) suman una unidad stand-by a partir de un ritmo umbral; el resto queda sin respaldo salvo que la redundancia ya venga de tener varias unidades.
- Resultado a 15.000 t/mes: 2 excavadoras (1 operativa + 1 respaldo), 2 cargadores, 2 chancadores; a 20.000 t/mes se agrega la segunda excavadora en producción más su respaldo.

**2. Flota ampliada**
Se agregan tipos de equipo hoy ausentes que la operación real necesita al escalar: retroexcavadora de apoyo, minicargador, motoniveladora, generador y grupo eléctrico del chancado, y camión de mantención/lubricación. Cada uno con capacidad de servicio, arriendo mensual y nota.

**3. Costos**
La tabla de flota separa costo de unidades operativas y costo de unidades de respaldo (el stand-by se tarifa a menor valor por no operar a plena carga). El costo unitario CLP/t sigue cayendo al escalar, ahora con el respaldo ya incluido — argumento más creíble frente a un inversionista que el modelo sin redundancia.

**4. Live (`/live/franco` y `/dashboard/cholqui`)**
El panel "Plan minero y escalamiento" incorpora en la tabla de flota:
- Columnas por escalón (1.000 / 3.000 / 5.000 / 10.000 / 15.000 / 20.000 t/mes) mostrando `operativas + respaldo`.
- Filas nuevas de los equipos agregados, marcadas como críticas cuando corresponde.
- Fila de disponibilidad usada y fila de costo de respaldo separada del costo operativo.
- Nota de la regla: "una unidad de respaldo por equipo crítico sobre el umbral de ritmo; estimación de ingeniería preliminar".

**5. PDF**
La sección de flota del brief y del teaser refleja la misma tabla ampliada, con la fila de respaldo y la nota metodológica, manteniendo numeración, QR, versión y disclaimers. Se sube la versión del documento.

## Honestidad de datos
Se mantienen los rótulos vigentes: 15.000 t/mes = plan declarado; 20.000 t/mes = hipótesis de ampliación sujeta al marco regulatorio y a permisos, por validar; flota, disponibilidad y costos = estimación de ingeniería preliminar, no cotizaciones cerradas. Sin recursos ni reservas certificados, sin VAN/TIR auditados.

## Detalle técnico
- `src/features/franco/data/minePlan.ts`: `EquipmentSpec` suma `availability`, `critical`, `standbyFromRate` y `standbyMonthlyClp`; `FleetLine` suma `operatingUnits` y `standbyUnits`; `fleetForRate` aplica capacidad efectiva y la regla de respaldo. `unitCosts` y `projectCashflow` no cambian de firma, sólo consumen el nuevo costo de flota.
- `src/features/franco/components/CholquiMinePlanPanel.tsx`: nuevas columnas/filas en la tabla de flota.
- `src/features/franco/cholquiPdf.ts`: misma tabla ampliada, bump de `CHOLQUI_DOC_VERSION` y `CHOLQUI_TEASER_VERSION`.
- `src/features/franco/data/minePlan.test.ts`: tests de respaldo (equipo crítico ≥ 2 unidades sobre el umbral), monotonía del costo unitario y coherencia de totales.
- Sin cambios de base de datos ni de permisos.
