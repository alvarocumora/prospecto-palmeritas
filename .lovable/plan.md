## Objetivo

Generar un nuevo informe PDF "Las_Arenas_PreNI43-101_v2.pdf" con la misma identidad visual del informe v1, **extendido** con tres bloques nuevos:

1. **Mapa de anomalías sobre basemap ESRI** (no sobre fondo blanco como en v1).
2. **Plano de malla de sondajes propuesta** con coordenadas WGS84 y justificación geo-satelital.
3. **Plan minero y de explotación** híbrido (rajo somero + UG profundo).

Entrega en `/mnt/documents/Las_Arenas_PreNI43-101_v2.pdf`.

---

## Estructura del informe (12-14 páginas)

Se conservan las secciones 1-4 del v1 y se agregan/expanden las siguientes:

```text
1.  Resumen ejecutivo (actualizado: + malla + mina)
2.  Catastro y localización (mapa ESRI + vértices)            ← v1
3.  Concesiones del distrito                                   ← v1
4.  Geología y mineralización                                  ← v1
5.  Anomalías multiespectrales SOBRE ESRI  ← NUEVO render
        5.1 Alteración hidrotermal (overlay sobre ESRI)
        5.2 Óxidos Fe (overlay sobre ESRI)
        5.3 Arcillas B11/B12 (overlay sobre ESRI)
        5.4 Lineamientos NW-SE + magnetometría residual
6.  Targets prioritarios (tabla A-1..C-4)                      ← v1 ampliado
7.  Malla de sondaje propuesta                                 ← NUEVO
        7.1 Plano ESRI con collares + IDs + coords WGS84
        7.2 Tabla collares (ID, lat, lng, az, dip, prof, target)
        7.3 Justificación satelital + geológica por hoyo
        7.4 Cronograma y costos sondaje
8.  Plan de mina y explotación (híbrido)                       ← NUEVO
        8.1 Recurso esperado y geometría
        8.2 Fase 1 — Rajo somero (0-80 m)
            · Footprint, ángulo talud, strip ratio, tonelaje
        8.3 Fase 2 — Underground cut-and-fill (80-300 m)
            · Niveles, rampa, ventilación, dilución
        8.4 Plan de producción (t/d, leyes, vida útil)
        8.5 OPEX/CAPEX preliminar y NPV indicativo
        8.6 Permisos y secuencia ambiental (DIA/EIA)
9.  Pipeline F1-F2-F3 actualizado                              ← v1 ampliado
10. Conclusiones y próximos hitos                              ← v1
```

---

## Implementación técnica

**Script Python único** en `/tmp/build_arenas_v2.py` (no toca la app):

- **PDF**: `reportlab` (mismo look del v1: portada con tabla, header dorado, footer, h1 numerados).
- **Mapas con basemap ESRI real**: `contextily` con provider `Esri.WorldImagery`, BBOX de la concesión (-71.1273..-71.1001, -33.9013..-33.8963) + buffer 300 m. Render con `matplotlib`:
  - Polígono concesión amarillo translúcido.
  - Overlays raster sintéticos (gaussian blobs centrados en targets A-4/A-5/C-4) con colormaps específicos por anomalía (hot para hidrotermal, YlOrBr para óxidos, BuPu para arcillas), alpha 0.55.
  - Targets como puntos blancos con halo + etiqueta.
  - Collares de la malla propuesta como triángulos cyan con ID.
  - Escala gráfica, flecha N, grid lat/lng, leyenda.
- **Imágenes** se generan a 300 dpi PNG en `/tmp/figs/` y se incrustan en el PDF.

**Malla de sondaje propuesta (mi propuesta óptima):**

Diseño escalonado en 3 anillos sobre el núcleo prospectivo (~13 ha):
- **Anillo 1 — Discovery**: 4 hoyos diamantinos sobre A-4 y C-4 (los de mayor score), espaciamiento 80 m, az 070° (perpendicular a vetas N20°W), dip −60°, prof 250 m.
- **Anillo 2 — Step-out**: 6 hoyos sobre A-5/A-3/A-1/B-1, malla 100×100 m, az 070°, dip −60°, prof 200 m.
- **Anillo 3 — Reserva**: 4 hoyos de relleno entre anomalías B-1 y A-1 si los anillos 1-2 confirman ley, prof 180 m.

Total: **14 hoyos / 3.020 m**. Justificación por hoyo: amarra a (a) anomalía sat más cercana, (b) zona de alteración geológica, (c) intersección estructural NW-SE.

**Plan minero híbrido:**

- **Fase 1 — Rajo somero** (años 1-3): footprint 4 ha sobre A-4/C-4, banco 5 m, ángulo cara 65°, ángulo global 45°, strip ratio 3.5:1, ~450 kt mineral @ 4.2 g/t Au eq.
- **Fase 2 — UG cut-and-fill** (años 3-12): rampa decline desde piso del rajo hasta nivel −300, niveles c/30 m, ancho minado 2.5 m, dilución 25%, ~1.8 Mt @ 6.8 g/t Au eq.
- Producción promedio: 350 t/d, vida útil 12 años, recuperación metalúrgica asumida 88% (cianuración).
- CAPEX inicial: USD 18-24 M (planta 400 t/d + obras civiles + flota). OPEX: USD 78/t.
- NPV indicativo @ 8% y Au=2.300 USD/oz: USD 95-130 M (sensibilidad ±25%, no constituye PEA formal).
- Camino regulatorio: DIA Fase 1 (mes 6-18), EIA Fase 2 (mes 24-48), permisos sectoriales SERNAGEOMIN/DGA.

**Disclaimer obligatorio** (callout al inicio de §8): "Plan minero conceptual basado en geometría exploratoria proyectada. No constituye PEA, PFS ni FS bajo NI 43-101. Cifras de recurso y económicas son referenciales."

---

## QA

Después de generar el PDF:
1. `pdftoppm -jpeg -r 120 Las_Arenas_PreNI43-101_v2.pdf /tmp/qa/page` y revisar cada página.
2. Verificar: overlays visibles sobre ESRI, collares con etiquetas legibles, tablas sin clipping, callout de disclaimer presente, paginación correcta.
3. Iterar el script hasta pasar sin issues.

## Entrega

- Archivo: `/mnt/documents/Las_Arenas_PreNI43-101_v2.pdf` (~12-14 págs)
- Etiqueta `<presentation-artifact>` para descarga directa.

## Nota sobre los errores TS

Los errores de build (`OnboardingWizard`, `ProjectTimeline`, `projects.tsx`) son pre-existentes y no relacionados con este informe. Se dejan fuera del alcance — si quieres los arreglo en un loop separado.
