# Nahuelbuta REE / Arcillas 1-34 — reanálisis y control de evidencia

Fecha: 2026-10-27. Proyecto: `NHB-REE`. No es NI 43-101 ni estima recursos.

## Análisis geoespacial efectivamente ejecutado
Se volvió a clasificar/rankear el porcentaje de meseta del dataset
`src/data/geo/losalamos_panos_arcillas.geojson` (derivado anteriormente del DEM).
El resultado reproducible se registra en `reports/nahuelbuta/geomorfologia-screening-2026-10-27.json`.
Total: 34 paños x 300 ha nominales = 10.200 ha; promedio de meseta 9,63%;
9 paños con al menos 20% de meseta; equivalencia nominal 981,9 ha (no superficie
independiente validada). Mayores porcentajes: Arcillas 26 (45,4%), 34 (45,2%),
31 (39,1%), 27 (34,8%), 33 (33,4%). Todos son proxies geomorfológicos,
no geoquímica de tierras raras.

## Reproceso Sentinel-2 configurado en PR
El análisis histórico usaba un bbox de ~23.500 ha y no corresponde al
denominador nominal de los paños. El cálculo actualizado obtiene el AOI desde
el GeoJSON y rasteriza únicamente sus polígonos para la cobertura y candidatos.
No computa candidatos si la cobertura interpretable del AOI es menor a 15%.
La cifra histórica 0,53% NO debe reutilizarse como resultado poligonal.

Workflow: `.github/workflows/nahuelbuta-sentinel-rerun.yml`.
También puede ejecutarse desde un entorno con red y dependencias:
```bash
python -m pip install -e ./geocapitals-remote
python geocapitals-remote/scripts/run_project_targets.py \
  --aoi src/data/geo/losalamos_panos_arcillas.geojson \
  --name nahuelbuta --output-crs EPSG:32718 \
  --out geocapitals-remote/out/nahuelbuta
```
El artefacto GitHub Actions conserva `coverage.json`, escenas/manifiesto STAC,
GeoJSON de anomalías (vacío si se activa el gate), y grilla conceptual
(vacía si no hay cobertura suficiente). Ningún resultado se incorpora como
anomalía validada al PDF antes de revisar el artefacto y la metodología.

## Segundo reanálisis efectivamente ejecutado: lineamientos DEM
Se intersectaron geométricamente 1.852 segmentos interpretados a partir de
Copernicus DEM 30 m con cada uno de los 34 paños (longitudes aproximadas usando
proyección local). Resultado completo y SHA de los dos GeoJSON en
`reports/nahuelbuta/lineamientos-screening-2026-10-27.json`.
Todos los paños presentan segmentos superpuestos; los mayores valores de
densidad aproximada son Arcillas 7 (21,93), 24 (19,71), 16 (19,44),
6 (19,27), 20 (19,22) km/km². Estas trazas pueden ser drenajes,
infraestructura o artefactos del DEM y NO representan fallas confirmadas.
No unir la densidad automáticamente a la puntuación REE: inspección en
ortofoto/campo y validación estructural primero.

## Estado de ejecución remota al abrir el PR
El workflow de GitHub Actions fue iniciado pero falló antes de ejecutar pasos,
al igual que el CI general; no se dispone de un nuevo `coverage.json` verificado
ni de escenas Sentinel-2 reprocesadas. No sustituir el 0,53% histórico ni
publicar anomalías hasta que exista y se revise el artefacto de ejecución.
En el PR se conserva el workflow para volver a dispararlo cuando el entorno
de runners funcione.

## Pendientes para due diligence
Verificar los 34 paños y las coordenadas de siete polígonos del deal
`GEO-2026-004` (otra geometría de 49.000 ha, desplazada), corroborar
tenencia con SERNAGEOMIN, caracterizar regolito y geoquímica REE/TREO;
no mezclar los tres conjuntos de polígonos ni afirmar leyes por teledetección.
