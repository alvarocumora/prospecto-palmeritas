## Objetivo

Generar un informe PDF en calidad de pre-feasibility (estilo NI 43-101 sección "Mining Operations + Economic Analysis") para el activo **Los Verdes 5 – Distrito Tilama**, descompuesto por los tres frentes identificados en la imagen:

- **Frente 1 – La Guanaca** (prioridad alta, leyes 1.76 – 4.34 % Cu)
- **Frente 2 – Los Verdes** (acceso actual, leyes 0.38 – 1.07 % Cu)
- **Frente 3 – Castellana** (zona norte, leyes 3.24 – 6.83 % Cu)

## Estructura del PDF (15-18 páginas, formato Letter)

1. **Portada ejecutiva** — branding Geocapitals, mapa de frentes (la imagen adjunta), ubicación regional, sello "Pre-NI 43-101 – Informe Interno".
2. **Resumen ejecutivo** — recursos inferidos por frente, capex inicial, opex/t, payback estimado.
3. **Marco geológico** — Cretácico Inferior, vetas epi-mesotermales Cu-Au, mineralogía (calcopirita, bornita, óxidos verdes).
4. **Catastro minero** — tabla de concesiones (`mining_concessions`) que cubren cada frente, hectáreas, holder, vigencia.
5. **Anomalías satelitales** — Sentinel-2 (clay, iron, hydroxyl) por frente, top 10 anomalías con score, severidad y área.
6. **Sistema de vetas** — ficha por veta (V-LG-01, V-LG-02, V-CS-01, V-CS-02, V-TM-01, V-ES-01) con strike/dip/potencia/longitud/commodity.
7. **Modelo 3D — snapshot del visor MapLibre** — render PNG del viewer `/live/losverdes` con DEM, drape satelital, vetas 3D y anomalías extruidas, capturado server-side.
8. **Plan de explotación por frente** — método (rajo abierto pequeño / pirquén mecanizado / underground selectivo), fases de la BD `mine_plan_phases`, secuencia 24 meses, cubicación (tonelaje × ley × densidad 2.7 t/m³), strip ratio, recuperación esperada (chancado + venta directa a planta ENAMI).
9. **Programa de producción** — t/mes por frente, tCu fino, leyes promedio mezcladas, calendario Year 1 / Year 2.
10. **Plan OPEX – Comparativa 3 plantas ENAMI**:
    - Planta Delta (Ovalle) ~155 km
    - Planta Manuel A. Matta (Cabildo) ~135 km
    - Planta Vallenar ~370 km
    - Para cada una: distancia, costo transporte (USD/t·km × t), tarifa maquila ENAMI, regalía, PMP cobre (fórmula tarifario ENAMI 2025), pago neto al productor (USD/t).
    - Tabla resumen con ganador y recomendación.
11. **OPEX detallado USD/t** — perforación, tronadura (factor carga ~0.35 kg/t), carguío (cargador frontal 3 m³), chancado primario (móvil mandíbula), transporte interno, transporte camión 30 t a planta, administración, contingencia 15 %.
12. **Análisis económico** — flujo de caja simplificado 24 meses, NPV (8 %), IRR, break-even ley Cu por frente.
13. **Riesgos & mitigaciones** — geotécnicos, hídricos, sociales (comunidades Tilama), permisos sectoriales (DGA, Sernageomin).
14. **Disclaimer & QP** — JORC/NI 43-101 disclaimer estándar, alcance del informe.

## Datos a usar (ya en BD para project_id Tilama)

- `projects`, `mining_concessions` (catastro)
- `satellite_anomalies` (60 top score)
- `exploration_targets` (anomalías TOO + clusters)
- `veins` (6 estructuras)
- `mine_plan_phases` (3 fases cargadas)
- Muestras destacadas de la imagen: TOO-126, 155, 156 (La Guanaca); TOO-103, 105, 124 (Los Verdes); TOO-183, 184, 210 (Castellana).

## Implementación técnica

### 1. Server function `getLosVerdes5Report` (`src/lib/losverdes5.functions.ts`)
- Agrega data Tilama + asocia anomalías / vetas / fases a cada uno de los 3 frentes vía bounding box (centro La Guanaca −32.044/−71.115, Los Verdes −32.049/−71.105, Castellana −32.027/−71.099).
- Calcula KPIs por frente: nº muestras, ley Cu promedio/máx, área anomalía, tCu fino in-situ estimado (largo×potencia×alto×densidad×ley).

### 2. Server function `captureLosVerdes3D` (`src/lib/losverdes5-snapshot.server.ts`)
- Renderiza headless el visor `/live/losverdes` (usando puppeteer/playwright si disponible — fallback: compone PNG estático con DEM tile + overlays SVG de vetas/frentes usando `sharp`-less canvas API ya disponible en el server).
- **Plan B (más robusto en worker runtime)**: construir la figura 3D como **SVG isométrico** server-side con elevación sintética + polígonos de los 3 frentes + trazas de vetas, embebido como vector en el PDF (sin dependencia de browser headless).

### 3. Módulo de cálculo `src/lib/mining-economics.ts`
- `enamiPayment(ton, leyCu, lme, plant)` aplicando tarifario público ENAMI (PMP, maquila, créditos Au/Ag, descuentos por humedad/impurezas, regalía).
- `transportCost(km, tons, rate=0.18 USD/t·km)`.
- `phaseOpex(phase)` desglose por partida.

### 4. Generador PDF `src/lib/losverdes5-pdf.ts`
- Basado en `tilama-pdf.ts` pero modular: helpers `coverPage`, `frenteSection`, `enamiCompareTable`, `cashflowTable`, `risksSection`.
- Embebe la imagen adjunta del usuario como figura principal de portada (subida a `src/assets/losverdes5-frentes.jpg`).
- Embebe el snapshot/SVG 3D.

### 5. Route `src/routes/live.losverdes5.tsx`
- Página ligera con botón "Descargar Informe PDF Los Verdes 5" que invoca la server fn, recibe blob y dispara descarga.
- Vista previa de KPIs por frente y mini-mapa de ubicación.

### 6. Activos
- Copiar imagen adjunta a `src/assets/losverdes5-frentes.jpg`.

## Supuestos económicos (parametrizables en `mining-economics.ts`)

| Parámetro | Valor base |
|---|---|
| LME Cu | 9 200 USD/t (4.17 USD/lb) |
| Tarifa transporte camión 30 t | 0.18 USD/t·km |
| Maquila ENAMI tarifa pequeña minería | 95 USD/t mineral |
| Recuperación planta | 85 % Cu |
| Densidad mineral in-situ | 2.7 t/m³ |
| Cut-off económico | 0.8 % Cu |
| Factor carga explosivo | 0.35 kg/t |
| Strip ratio asumido | 2.5:1 rajo, 0:1 underground |
| Tasa descuento NPV | 8 % |

## Entregables

- Nuevo archivo PDF descargable desde `/live/losverdes5`.
- Código modular reutilizable (`mining-economics.ts`) para futuros informes de otros prospectos.
- Sin cambios destructivos a `tilama-pdf.ts` existente (queda como informe distrital general).

## Validación

- `tsc --noEmit` limpio.
- Render del PDF en sandbox vía script de prueba, conversión a imágenes con `pdftoppm` y revisión QA visual página a página antes de entregar.
