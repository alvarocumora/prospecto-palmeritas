# Tilama: pedimentos LEONOR 1 al 16

Borrador del 14-11-2026. Uso interno. Titular: Valle Escondido SpA (Minera Valle Escondido SpA).

Son 16 pedimentos de exploración que suman 7.300 ha, y están **pegados entre sí**: los bordes comunes coinciden al metro. Se agregaron LEONOR 14 (franja libre al este de LEONOR 2), LEONOR 15 (el entrante bajo LEONOR 2) y LEONOR 16 (al norte de LEONOR 12). LEONOR 11 y LEONOR 13 se ajustaron para quedar en **cero hectáreas de solape**: LEONOR 11 va de 290.500 a 293.500 E, con 600 ha, y LEONOR 13 va de 291.825 a 294.825 E, con 300 ha, todavía con la anomalía T-01. Quedan dos solapes menores con terceros: 5 ha de Santa Carolina 2 en LEONOR 6 y 4,9 ha de Pupio 19 en LEONOR 4. Los 16 pedimentos tienen el punto medio en Los Vilos, así que corresponde el Juzgado de Letras y Garantía de Los Vilos (art. 231).

**Coordenadas.** Todo está en **PSAD56 (La Canoa 1956), Huso 19**, el sistema nativo del catastro SERNAGEOMIN y el que usan los pedimentos y manifestaciones presentados por la Oficina Judicial Virtual en 2024 y 2025 (Lechuza 1, Miranda 29, Golden Mine V, Viviana III). El visor dibuja ese catastro en WGS84 con un desfase fijo de +200 m Este y +325 m Norte, medido sobre 1.244 vértices vecinos con `scripts/tilama_datum_sngm.py`. pyproj da otro desfase (+183 / +374), así que no se debe usar para convertir.

**Manifestaciones LEONOR M1 a M13.** El terreno libre que queda contra concesiones de terceros, en franjas de menos de 1 km donde no cabe un pedimento, se cubre con 13 manifestaciones que suman 823 ha de pertenencias.

- **Pertenencias.** Hay 103 en total. Cada una mide 100 m o múltiplos por lado, con un máximo de 10 ha (art. 28). Sus bordes se apoyan en los de las concesiones vecinas y de los LEONOR. El solape total con terceros es menor a 0,2 ha.
- **Rectángulo manifestado.** Cada manifestación pide un rectángulo centrado en su punto de interés (art. 46), con una razón máxima de 5:1 y un tope de 1.000 ha (art. 44). En la mensura se ubican solo las pertenencias que calzan.
- **M1 (142 ha)** cubre el hueco entre LEONOR 6, LEONOR 7 y LEONOR 9.
- **M6 (66 ha)** cubre la anomalía T-03.
- **M13 (15 ha)** cubre TOO-255 (1,99 % CuT).

Archivos:

- `tilama_pedimentos_leonor.kmz`: mapa para Google Earth, con los pedimentos, sus puntos medios, las manifestaciones y sus pertenencias, y las zonas.
- `tilama_manifestaciones_leonor_m_escritos.docx`: hoja de control más un escrito por manifestación.
- `tilama_manifestaciones_leonor_m.csv`: las pertenencias de cada manifestación, con sus coordenadas PSAD56.
- `tilama_pedimentos_leonor.csv`: vértices y punto medio en PSAD56, el punto medio en WGS84 tal como lo dibuja el visor, y la tasa y la patente de cada pedimento.
- `tilama_pedimentos_leonor.png`: plano general en PSAD56.
- `tilama_pedimentos_leonor_escritos.docx`: hoja de control más un escrito por pedimento.
- `LEONOR_1_pedimento_escrito.docx`: el escrito prioritario.
- `pedimentos_leonor.json` y `manifestaciones_leonor_m.json`: los mismos datos en formato JSON.

## Cómo se tramita (Código de Minería)

1. **Presentación.** El escrito se presenta por la Oficina Judicial Virtual ante el juez de letras del lugar donde cae el punto medio. Debe incluir el titular, el nombre, el punto medio en UTM, las hectáreas y los lados (arts. 28 y 43). La primera presentación no exige abogado. Un error en el punto medio no se puede corregir después.
2. **Tasa (art. 51).** Se paga una sola vez por pedimento, dentro de 30 días desde la presentación. El monto por hectárea depende del tamaño:

   | Superficie del pedimento | UTM por hectárea |
   |---|---|
   | Hasta 300 ha | 0,005 |
   | Más de 300 ha y hasta 1.500 ha | 0,02 |
   | Más de 1.500 ha y hasta 3.000 ha | 0,03 |

   Para LEONOR 1 al 16 el total es unos $10,5 millones, con la UTM de noviembre de 2026 a $72.440.
3. **Inscripción y publicación.** Con la resolución del juez, el pedimento se inscribe en el Registro de Descubrimientos del Conservador de Minas y se publica en el Boletín Oficial de Minería.
4. **Solicitud de sentencia (art. 55).** Dentro de 90 días desde la resolución se pide la sentencia constitutiva. Esa solicitud acompaña los vértices, el plano firmado por un profesional, el comprobante de la tasa, el pago de la patente proporcional, la copia de la inscripción y el ejemplar del Boletín.
5. **Revisión técnica.** SERNAGEOMIN emite su informe y, si hace observaciones, se responden dentro del plazo que fije el tribunal.
6. **Sentencia constitutiva.** Su extracto se publica y la sentencia se inscribe. Desde ahí la concesión dura 4 años y se puede prorrogar una vez por otros 4 (art. 112).
7. **Patente anual.** Se estima en unos $31,7 millones al año por las 7.300 ha (3/50 UTM por hectárea).

## Screening Sentinel-2 (corrida 43592608299, 14-11-2026)

Se usaron 16 escenas de verano entre 2019 y 2026; el 97 % de la superficie se pudo interpretar. **La calibración no discrimina.** Las muestras con ley quedan en el percentil 67 (mediana) y las estériles en el 87. Hay muestras estériles con puntaje alto, como TOO-184 (percentil 97) y TOO-112 (percentil 93), mientras que muestras de 2,5–3,3 % Cu, como TOO-183, TOO-262 y 42516, quedan cerca del percentil 50–57. Solo TOO-220, M1/M2, TOO-255 y TOO-186 aparecen anómalas.

Por eso las manchas que caen dentro de los LEONOR (S2-02, S2-07, S2-11, S2-12, S2-13 y otras) **no confirman mineralización**. Indican alteración o suelo desnudo, nada más. Fuera de los LEONOR hay manchas libres al oeste y suroeste de LEONOR 10 y 13 (S2-14, S2-56, S2-107, S2-110, S2-116) y al este de LEONOR 4 (S2-75). Sobre esa sola base no conviene pedirlas: antes hay que revisarlas en terreno o con un índice que sí separe las muestras de Esterio.
