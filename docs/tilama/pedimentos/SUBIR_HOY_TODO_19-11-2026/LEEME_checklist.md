# Todo lo que se sube hoy, 19-11-2026 (OJV, firma con Clave Única)

Versión revisada a las 17:30. Se suben 20 escritos dentro de causas existentes, 21 pedimentos y manifestaciones nuevos y 1 desistimiento. Hay 11 piezas postergadas en la carpeta C.

Cambio respecto de la versión anterior: MARTINA 15, ELARA 9 y ELARA 16 pasan a la carpeta C. Se pedían por una "señal de molibdeno" que resultó ser un error de transcripción (la columna era plomo), así que ya no tienen motivo.

Revisión hecha: los 41 escritos traen el RUT de Valle Escondido SpA y su nacionalidad chilena. Las superficies de cada escrito calzan con la tabla de costos. El datum es PSAD56 en Los Vilos y Petorca, y WGS84 en Illapel y Combarbalá. Las manifestaciones dicen que no se formulan en uso de una concesión de exploración. La única superposición entre piezas propias es MARTINA 32 dentro de MARTINA 33, y es intencional.

## A. En causas ya ingresadas (Juzgado de Letras y Garantía de Los Vilos)

Carpeta `A_causas_ya_ingresadas_cumple_art43_Los_Vilos`. Son 20 escritos de "Cumple lo ordenado", que agregan la nacionalidad de la sociedad. Cada uno se sube **dentro de su rol**: V-303 a V-317 y V-319 a V-323.

- En la OJV: Trámite fácil → Escrito → Civil → Juzgado de Los Vilos → rol V-xxx-2026.
- Plazo: 8 días desde la resolución del 16-11, o sea hasta alrededor del 24-11.
- Se suben todos, también los del grupo 3 del ranking: no cuesta nada y mantiene la opción hasta pagar la tasa (15-12).
- **No** subir nada en V-318 (duplicado, ya desistido) ni en V-328 (ELARA 15).

## B. Causas nuevas (21 escritos + 1 desistimiento)

Carpeta `B_causas_nuevas`. Sube en el orden de los números de cada subcarpeta. Los números que faltan corresponden a piezas que se movieron a la carpeta C.

| Juzgado | Subcarpeta | Escritos |
|---|---|---|
| Letras y Garantía de Los Vilos | 1_LOS_VILOS | 01 MARTINA 37 → **02 desistimiento: se sube DENTRO de la causa V-327-2026** → 03 MARTINA 32 (manifestación) → 04 MARTINA 33, 05 MARTINA 35, 06 MARTINA 12, 11 MARTINA 16 → 13 LEONOR SUR, 14 LEONOR CENTRO, 15 MARTINA NORTE OESTE y 16 MARTINA NORTE ESTE (manifestaciones) |
| Letras y Garantía de Petorca | 2_PETORCA | 01 MARTINA 47, 02 MARTINA 54, 03 MARTINA 55, 07 MARTINA 46, 11 MARTINA 69 |
| Letras de Illapel | 3_ILLAPEL_Cerro_Alto | LEONOR CERRO ALTO 1 a 4 → 05 LEONOR CERRO ALTO FAENA (manifestación), en WGS84 |
| Letras y Garantía de Combarbalá | 4_COMBARBALA | MARTINA 70, en WGS84 |

- Las manifestaciones van como Minero → Manifestación. Las demás, como Pedimento.
- En cada causa nueva se adjuntan los certificados de estatuto, vigencia y anotaciones de Valle Escondido SpA.
- Si alguna pieza de 1_LOS_VILOS ya se subió el 18-11, **no la repitas**.

### Prioridad al pagar (columna `prioridad` de `orden_y_costos.csv`)

- **A, 14 piezas: pagar tasa, inscribir y publicar.** MARTINA 37, 32, 33 y 35; LEONOR SUR, LEONOR CENTRO, MARTINA NORTE OESTE y ESTE; LEONOR CERRO ALTO 1, 4 y FAENA; MARTINA 47, 54 y 55. Costo: $3.083.621.
- **B, 7 piezas: se suben hoy para tener la prioridad y se decide después de terreno, antes de que venza la tasa (~19-12).** MARTINA 12, 16, 46, 69 y 70; LEONOR CERRO ALTO 2 y 3. Costo si se pagan todas: $1.708.423. La que no se pague, caduca.
- Total si se paga todo: **$4.792.044** ($1.731.315 de tasa y $3.060.729 de boletín).

## C. Postergadas: no se suben hoy

Carpeta `C_postergadas_no_subir`: ELARA 9, ELARA 16, ELARA 17, MARTINA 15, MARTINA 18, 38, 40, 41, 42, 44 y 49. No hay evidencia que las justifique. Se presentan después solo si el muestreo o un competidor lo justifican.

## Después de subir

1. Guardar el certificado de envío de cada causa y pasármelo para anotar rol, fecha y hora en el control.
2. Tasa: vence a 30 días de cada presentación. Las del 15-11 vencen el 15-12 y sus escritos de pago están en `presentado/escritos_tasa`.
3. Cuando salga cada resolución: inscribir en el Conservador y publicar en el Boletín dentro de 30 días, empezando por las de prioridad A.
4. Las causas del 17-11 que se dejan caducar no se contestan ni se pagan.
