
# Láminas 3D estilo Leapfrog / Datamine — Los Verdes 5

Voy a regenerar el anexo visual del PDF (`Geocapitals-LosVerdes5-PreNI43101_v4.pdf`) reemplazando las láminas 3D actuales por renders al nivel de las referencias que enviaste (Leapfrog Geo + Datamine + Wolfpass scene view).

## Láminas a producir

1. **L3D-1 · Scene View tipo Wolfpass (sección oblicua con shells de ley)**
   - DEM Copernicus drapeado con hillshade verde-oscuro semitransparente (terreno "flotante").
   - Shells anidados de pórfido tipo isosurfaces de ley: núcleo naranja (>0.6 % Cu eq), halo amarillo (0.3–0.6), envoltura verde (0.1–0.3), exterior azul (<0.1).
   - Vetas como planos translúcidos lila/cian con dip real (75–85°).
   - Sondajes propuestos como cilindros verticales/inclinados magenta + verde (priorizados).
   - Eje Z (Elev) lateral con tics +2400 a +3400, grilla de coordenadas UTM en el piso, escala gráfica y rosa de plunge/azimuth.

2. **L3D-2 · Leapfrog Geological Model (mapa geológico drapeado en 3D)**
   - Hillshade alta resolución + capas litológicas Fm. Lo Prado / intrusivos / cuaternario con colores estándar de carta geológica.
   - Sistemas de fallas (Uniseason, Coldgleam, Throt) trazados sobre el terreno con simbología de strike-dip.
   - Pliegues y contactos como líneas vectoriales nítidas.
   - Panel lateral simulado con árbol de proyecto (Topografía / Drillholes / Designs / Geophysical Data / Structural Modelling / Geological Model) — sólo decorativo, estilo screenshot.

3. **L3D-3 · Vein + Block model + Geofísica (diptico tipo IMG_0026)**
   - Izquierda: panel de veta La Guanaca como wireframe magenta con malla de sondajes verticales cotados (−50, −100, −150, −200, −250 m), plano de sección verde translúcido y traza A-A' punteada azul.
   - Derecha: ortofoto drapeada con anomalía magnetométrica/gravimétrica como volumen voxelizado (azul→verde→amarillo→rojo) en profundidad, targets como cubos rojos sobre superficie, sondajes propuestos como líneas verdes.

4. **L3D-4 · Plan minero 3D (vista isométrica)**
   - Mismo DEM con pit conceptual escalonado (bancos 10 m) en F1, galerías subterráneas como tubos cian en F2, footprint de planta 2 500 t/d y depósito de relaves en F3.
   - Etiquetas de fase y flujo de mineral con flechas 3D.

## Implementación técnica

- Script Python `/tmp/build_figs_v4.py` usando:
  - `pyvista` (render off-screen vía xvfb) para escenas 3D reales con shells, mallas y cilindros → exporta PNG 300 dpi.
  - Fallback `matplotlib` 3D + `Poly3DCollection` para shells anidados si pyvista no compila en sandbox.
  - `rasterio` + tiles ESRI World Imagery (z14) ya cacheados para drapear textura sobre DEM Copernicus.
  - `Pillow` para componer leyendas, ejes Z laterales, rosas de orientación y barras de escala estilo Leapfrog.
- Datos reales del proyecto LV-TIL-001: 6 vetas (strike/dip), 108 targets, 45 anomalías sat, DEM real ya en `scene3d.server`.
- Composición final con `reportlab` + `pypdf` → merge con el informe base.
- QA: convertir cada lámina a JPEG y revisar visualmente (overlap, recortes, leyendas legibles) antes de entregar.

## Entregable

`Geocapitals-LosVerdes5-PreNI43101_v4.pdf` con las 4 nuevas láminas 3D reemplazando las actuales L3 y L4, manteniendo L1 (ortofoto) y L2 (estructural) sin cambios.

¿Procedo?
