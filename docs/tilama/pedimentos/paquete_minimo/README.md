# Tilama: presentación por prioridad

Borrador del 15-11-2026. Titular: Valle Escondido SpA (Minera Valle Escondido SpA). Juzgado de Letras y Garantía de Los Vilos. Todas las coordenadas están en PSAD56 (La Canoa 1956), Huso 19, en el marco del catastro SERNAGEOMIN.

Esta es la base de trabajo al menor costo. Protege la faena de LEONOR 1, las leyes conocidas en terreno pedible y la tendencia mineralizada libre del noreste. Lo que no tiene ensayes (el resto de LEONOR, las anomalías SWIR y el borde ELARA) sigue disponible en `../presentacion/`, por si después se quiere ampliar.

## Corrección del 15-11-2026: ubicación de las muestras

Las coordenadas de `src/data/geo/tilama/geochem_core.json` vienen de la transcripción del Anexo B de EMT y están en el PSAD56 de Esterio. La versión del 14-11 les sumó por error el desfase del visor (+200 / +325), lo que dejaba todas las muestras corridas unos 416 m al nor-noreste. La conversión correcta al marco del catastro es **+17 m Este, −49 m Norte**. Se comprobó con TOO-220 y TOO-255, que con esa conversión coinciden al metro con la columna WGS84 de Esterio más el desfase del visor.

Con la ubicación corregida:

- **TOO-211 queda dentro de Los Verdes 5**, que es de terceros. Por eso se eliminó la antigua MARTINA 1, la de la franja libre junto a Expancion.
- **La zona del noreste ahora se cubre con exploración** (MARTINA 2, 3 y 4).
- **TOO-273 cae en Yendrick A5**, también de terceros.
- **Aparece libre TOO-256 (4,89 % Cu)**, pegada al este de LEONOR 1.
- **LEONOR 3, 5 y 2 siguen conteniendo sus muestras.** TOO-233 queda en Las Trancas y TOO-238 queda 30 m al sur de LEONOR 3.

El archivo de muestras trae además errores de transcripción documentados en `../../revision-informe-esterio-2026-11-13.md`: filas desplazadas, coordenadas repetidas y TOO-270 con 45,6 % Cu. Hay que cotejarlo con el original de EMT.

## Estructura: explotación en las faenas, exploración en las zonas de interés

**Explotación (2 manifestaciones):**
- **LEONOR 1, 1 al 208.** Cubre la faena de los desmontes M1/M2 (7,7 y 10,65 % CuT) y TOO-255 (1,99 %). En la mensura se ubican 5 pertenencias clave de 5 ha, y hasta 33 si el terreno lo justifica.
- **MARTINA 1, 1 al 35.** Punto de interés: N 6.453.950 / E 303.250. Se mensuran 2 pertenencias (11 ha): una sobre TOO-256 (4,89 % Cu) y otra en el libre al norte de TOO-255. TOO-256 queda a 38 m de Yendrick A4, así que hay que confirmarla con GPS.

**Exploración prioritaria (6 pedimentos, 1.100 ha):**
- **LEONOR 3 (200 ha).** TOO-237 (5,04 %), TOO-262 (2,48 %), TOO-234 (2,40 %), TOO-258 (1,99 %) y otras ocho muestras de 0,5 a 0,9 %. Queda al sur de la faena.
- **LEONOR 5 (100 ha).** TOO-240 (4,69 %). Da el corredor sur hacia la faena.
- **LEONOR 2 (200 ha).** TOO-253 (3,62 %). Queda al este de la faena.
- **MARTINA 2, 3 y 4 (600 ha).** Cubren la zona de interés del noreste: una franja de afloramientos de unos 2,5 km, toda en terreno libre y sin camino. MARTINA 2 tiene TOO-276 y 277 (2,04 %); MARTINA 3, TOO-280 (6,10 %); MARTINA 4, TOO-286 y 287 (3,50 %). Antes se llamaban LEONOR 9, ELARA 1 y ELARA 2. Si el terreno confirma, se manifiesta dentro de ellos con preferencia, porque solo el titular de la exploración puede manifestar en su interior.

**Resto de la exploración (28 pedimentos, 6.700 ha):** LEONOR 4, 6 a 8 y 10 a 14, y ELARA 3 a 21. Con ellos queda cubierto todo el sector. En el orden de subida van después de los prioritarios: primero nivel A, luego B y al final C. Observaciones de la imagen: en LEONOR 13 la anomalía es agrícola, LEONOR 14 toca el pueblo de Tilama (art. 17) y ELARA 19 tiene los caminos antiguos en zigzag.

## Accesos

El acceso no depende de estas concesiones. Depende de una servidumbre de tránsito sobre el suelo del dueño superficial, que se puede pedir por la vía legal una vez constituida la concesión. Hay dos caminos posibles:

- **Por el norte:** la huella a 150–350 m de LEONOR 1, por terreno Fernández.
- **Por el sur:** el camino en zigzag y luego 1,5 a 3 km por dentro de LEONOR 5 y 3.

## Costos (UTM noviembre 2026: $72.440)

El detalle está en `orden_y_costos.csv` y en `tilama_minimo_costos.csv`.

- **Prioritarios (01 a 08):** tasa de $0,73 M y unos $1,4 M entre Boletín e inscripción. Si todos llegan a sentencia y mensura, la patente suma $5,8 M al año, con LEONOR 1 en 5 pertenencias.
- **Resto (09 a 36):** tasa de $2,4 M y unos $4,1 M entre Boletín e inscripción. La patente sería de $29,1 M al año si todos llegaran a sentencia. Lo normal es pedir sentencia solo de los que muestren algo en terreno y dejar caducar el resto.
- **Falta cotizar el perito.**

## Orden de presentación

1. **Día 0.** Revisar el catastro y confirmar TOO-256 con GPS. Subir 01 y 02 (manifestaciones), luego 03 a 08 (exploración prioritaria) y después 09 a 36.
2. **Dentro de 30 días.** Pagar las tasas. Si hay defectos, corregirlos dentro de 8 días.
3. **Dentro de 30 días desde la resolución.** Inscribir y publicar en el Boletín, guardando el PDF original de la edición.
4. **Entre los días 91 y 120 desde la presentación.** Pedir la mensura de LEONOR 1 y MARTINA 1.
5. **Hasta el día 90 desde la resolución.** Pedir la sentencia de los pedimentos que valgan la pena.

## Archivos

- `para_subir/`: los 36 escritos en PDF, numerados en el orden de subida. Vienen también en `tilama_todo_para_subir.zip` (los 36) y en `tilama_prioritario_para_subir.zip` (01 a 08).
- `orden_y_costos.csv`: orden de subida y costos por pieza.
- `tilama_minimo_manifestaciones.docx` y `tilama_minimo_pedimentos.docx`: hojas de control y escritos de lo prioritario.
- `tilama_minimo.kmz` y `tilama_minimo.png`: mapa y plano de lo prioritario.
- `manifestaciones_minimo.json` y `pedimentos_minimo.json`: datos fuente. El plan completo está en `../presentacion/pedimentos_exploracion.json`.
