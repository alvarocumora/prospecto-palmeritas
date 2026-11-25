# Paquete para subir el 19-11-2026

Titular: Valle Escondido SpA. Contiene 64 escritos (PDF y DOCX): 62 pedimentos, 1 manifestación y 1 desistimiento. Cerro Alto se presenta en WGS84; todo lo demás va en PSAD56 H19, en el marco del catastro.

## Validación de hoy (19-11-2026, 07:10)

- **Catastro SERNAGEOMIN bajado esta mañana**: 1.982 concesiones en Tilama y Petorca y 2.864 en Cerro Alto.
  - No apareció **ninguna concesión nueva** sobre las piezas desde el catastro del 18-11.
  - Todas las superposiciones con terceros ya se conocían. El detalle está en `validacion_catastro_19-11-2026.csv`.
  - Nuestros pedimentos del 15 y 17-11 (V-303 a V-328) todavía no figuran en el catastro, lo que es normal.
- **Revisión de escritos**: se revisó que cada PDF tenga los mismos vértices que la pieza diseñada, lados de 1.000 m o múltiplos (art. 28), la superficie y el juzgado. 62 de 62 están bien.
- **Satélite**: hay un recorte por pieza en `fichas_satelite/`. Colores: verde, la pieza; rojo, concesiones de terceros vigentes o en trámite; amarillo, explotaciones eliminadas; azul, lo nuestro ya presentado; celeste, las otras piezas del paquete.

## Carpetas y orden de subida

| Carpeta | Juzgado | Piezas | ha | Tasa art. 51 | Boletín e inscripción | Total |
|---|---|---|---|---|---|---|
| 01_LOS_VILOS_paquete_18-11 | Los Vilos | 11 + desistimiento | 2.311 | $841.028 | $1.603.239 | $2.444.267 |
| 02_LOS_VILOS_nuevas | Los Vilos | 21 | 5.000 | $1.811.000 | $3.060.729 | $4.871.729 |
| 03_PETORCA | Petorca | 18 | 4.300 | $1.557.460 | $2.623.482 | $4.180.942 |
| 04_ILLAPEL_Cerro_Alto | Illapel | 4 | 1.100 | $398.420 | $582.996 | $981.416 |
| **Subtotal recomendado** | | **54** | **12.711** | **$4.607.908** | **$7.870.446** | **$12.478.354** |
| 05_OPCIONALES_Los_Vilos | Los Vilos | 9 | 2.400 | $869.280 | $1.311.741 | $2.181.021 |

La tasa se paga dentro de 30 días desde la presentación. El boletín y la inscripción se pagan después. Se usó la UTM de noviembre: $72.440.

### 01: el paquete del 18-11 (subir solo si no se subió ayer)

Son los mismos 12 escritos del 18-11, sin cambios:

- **01 MARTINA 37**: causa nueva. Reemplaza a MARTINA 13.
- **02 Desistimiento**: se sube **dentro de la causa V-327-2026**, después de ingresar MARTINA 37.
- **03 MARTINA 32**: manifestación de 11 ha sobre EL ZORRO.
- **04 a 12**: MARTINA 33, MARTINA 12, MARTINA 14, MARTINA 15, ELARA 9, ELARA 16, ELARA 17, MARTINA 16 y MARTINA 18.

Si alguna de estas piezas ya se subió, **no la subas de nuevo**: quedaría duplicada, como pasó con MARTINA 2 (V-318).

### 02: Los Vilos, lo nuevo

- **01 a 13**: MARTINA 17, 19 y 20 a 30, el resto de la fase 2 (cierre sur, hasta el límite regional).
  - MARTINA 17, 19, 26, 27 y 29 tienen parte de su superficie en Petorca, y el escrito lo indica.
- **14 y 15**: MARTINA 34 y 35 (Chele).
- **16 a 21**: MARTINA 56 a 61 (núcleo de Hoyada–Leones).

### 03: Petorca (Juzgado de Letras y Garantía de Petorca)

- **01 a 18**: MARTINA 38 a 55.
- Ese juzgado tramita pedimentos con rol V; por ejemplo, DURAZNO O, causa V-255-2022.
- MARTINA 55 tiene 37 ha en La Ligua, y el escrito lo indica.

### 04: Illapel (Cerro Alto)

- LEONOR CERRO ALTO 1 a 4, en WGS84. Al 19-11 no hay concesiones de terceros sobre ninguna.
- **Pendiente**: confirmar con el perito que el datum WGS84 corre en ese tribunal.

### 05: opcionales (no subir sin decidirlo)

- **MARTINA 31**: 43 ha libres de 100.
- **MARTINA 36**: 69 ha libres de 200. El rajo del Chele queda en terceros.
- **MARTINA 62 a 68**: extensión de Hoyada. Están 100 % libres, pero en la imagen no se ven labores, solo laderas y huellas tenues.

## Antes de presentar

1. Confirmar si el paquete 01 se subió ayer.
2. En la OJV, revisar el visor del catastro **el mismo día**, sobre todo en las piezas con mucha superposición: MARTINA 14, 24, 25, 35, 53 y 55.
3. Adjuntar en cada causa los certificados de estatuto, vigencia y anotaciones de Valle Escondido SpA (primer otrosí).
4. Anotar el rol y la fecha de cada causa en `presentado/control_causas_15-11-2026.csv`.
5. En los sectores con casas o cultivos (MARTINA 14, 20 a 25, 38 y 39), las labores de exploración requieren permiso del dueño del suelo (art. 17).

## Archivos

- `indice_y_costos.csv`: orden, archivo, superficie, área libre, tasa, boletín y lo que se ve en el satélite.
- `validacion_catastro_19-11-2026.csv`: superposiciones con terceros (nombre, situación y titular), comuna del punto medio y otras comunas.
- `paquete_19-11-2026.kmz`: todas las piezas por carpeta.
- `fichas_satelite/`: 63 recortes.
