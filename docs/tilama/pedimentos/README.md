# Tilama: pedimentos LEONOR 1 al 13

Borrador del 14-11-2026. Uso interno.

Son 13 pedimentos de exploración que suman 6.400 ha. Cubren las cuatro zonas marcadas en el visor de SERNAGEOMIN: B2 (10,40 km²), C2 (10,58 km²), S (21,06 km²) y W (26,00 km²). Los bordes se apoyan en los de las concesiones vecinas y ningún pedimento solapa una concesión vigente; la única excepción es una esquina de 0,42 ha de LEONOR 4 sobre Pupio 19. El punto medio de los 13 pedimentos cae en la comuna de Los Vilos, por lo que el tribunal es el Juzgado de Letras y Garantía de Los Vilos (art. 231).

Archivos:

- `tilama_pedimentos_leonor.kmz`: mapa para Google Earth.
- `tilama_pedimentos_leonor.csv`: vértices, punto medio en WGS84 y en PSAD56, tasa y patente de cada pedimento.
- `tilama_pedimentos_leonor.png`: plano general.
- `tilama_pedimentos_leonor_escritos.docx`: hoja de control más un escrito por pedimento. Los datos marcados en amarillo hay que completarlos.
- `pedimentos_leonor.json`: los mismos datos en formato JSON.

## Cómo se tramita (Código de Minería)

1. **Presentación.** El escrito se presenta por la Oficina Judicial Virtual ante el juez de letras del lugar donde cae el punto medio. Debe incluir el titular, el nombre, el punto medio en UTM, las hectáreas y los lados (arts. 28 y 43). La primera presentación no exige abogado. Un error en el punto medio no se puede corregir después.
2. **Tasa (art. 51).** Se paga una sola vez por pedimento, dentro de 30 días desde la presentación. El monto por hectárea depende del tamaño:

   | Superficie del pedimento | UTM por hectárea |
   |---|---|
   | Hasta 300 ha | 0,005 |
   | Más de 300 ha y hasta 1.500 ha | 0,02 |
   | Más de 1.500 ha y hasta 3.000 ha | 0,03 |

   Para LEONOR 1 al 13 el total es unos $9,49 millones, con la UTM de noviembre de 2026 a $72.440.
3. **Inscripción y publicación.** Con la resolución del juez, el pedimento se inscribe en el Registro de Descubrimientos del Conservador de Minas y se publica en el Boletín Oficial de Minería.
4. **Solicitud de sentencia (art. 55).** Dentro de 90 días desde la resolución se pide la sentencia constitutiva. Esa solicitud acompaña los vértices, el plano firmado por un profesional, el comprobante de la tasa, el pago de la patente proporcional, la copia de la inscripción y el ejemplar del Boletín.
5. **Revisión técnica.** SERNAGEOMIN emite su informe y, si hace observaciones, se responden dentro del plazo que fije el tribunal.
6. **Sentencia constitutiva.** Su extracto se publica y la sentencia se inscribe. Desde ahí la concesión dura 4 años y se puede prorrogar una vez por otros 4 (art. 112).
7. **Patente anual.** Se estima en unos $27,8 millones al año por las 6.400 ha (3/50 UTM por hectárea).

**Datum.** El pedimento MIRANDA 29, presentado en enero de 2025, usó PSAD56 (La Canoa 1956). Antes de presentar hay que confirmar qué datum exige el Reglamento vigente. El CSV y los escritos traen el punto medio en ambos datums. Si se exige PSAD56, los bordes deben volver a apoyarse en los vértices PSAD56 de las concesiones vecinas, porque las distintas transformaciones entre datums difieren en unos 50 m.

## Screening Sentinel-2 (corrida 43592608299, 14-11-2026)

Se usaron 16 escenas de verano entre 2019 y 2026; el 97 % de la superficie se pudo interpretar. **La calibración no discrimina.** Las muestras con ley quedan en el percentil 67 (mediana) y las estériles en el 87. Hay muestras estériles con puntaje alto, como TOO-184 (percentil 97) y TOO-112 (percentil 93), mientras que muestras de 2,5–3,3 % Cu, como TOO-183, TOO-262 y 42516, quedan cerca del percentil 50–57. Solo TOO-220, M1/M2, TOO-255 y TOO-186 aparecen anómalas.

Por eso las manchas que caen dentro de los LEONOR (S2-02, S2-07, S2-11, S2-12, S2-13 y otras) **no confirman mineralización**. Indican alteración o suelo desnudo, nada más. Fuera de los LEONOR hay manchas libres al oeste y suroeste de LEONOR 10 y 13 (S2-14, S2-56, S2-107, S2-110, S2-116) y al este de LEONOR 4 (S2-75). Sobre esa sola base no conviene pedirlas: antes hay que revisarlas en terreno o con un índice que sí separe las muestras de Esterio.
