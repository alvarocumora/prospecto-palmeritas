# Vigilancia del Boletín Oficial de Minería (B3)

> **La pieza más frágil.** Un boletín mal parseado puede inventar un solape que no
> existe, o callar uno real. Por eso el diseño es **conservador**: nada se
> auto-aprueba sin superar un umbral de confianza, y un registro sin coordenadas
> verificables **nunca** recibe una ubicación por defecto — va a revisión humana.

## Qué hace

1. **Extrae** el texto del PDF de la edición (con **OCR de respaldo** si es escaneo).
2. **Parsea** cada registro (pedimento / manifestación / mensura / sentencia),
   normaliza coordenadas **PSAD56 → WGS84** con el mismo juego que el catastro
   oficial (**EPSG:1204**, `-288,175,-376`, ver `docs/datums.md`).
3. Asigna **confianza** (0–1) por completitud y consistencia.
4. **Ingiere** de forma idempotente (hash por edición y por registro).
5. **Cruza** cada registro geolocalizado contra `catastro_concesiones` (+buffer):
   - punto dentro de un polígono vigente → alerta `dentro_de_concesion`;
   - punto dentro del buffer (por defecto 500 m) → alerta `proximidad`.
6. Los registros bajo el umbral quedan en la vista **`boletin_cola_revision`**.

## Modelo de confianza (pesos editables)

`packages/reglas/boletin_parser.py` · `PESOS` (suman 1,0):

| Factor                 | Peso | Señal                                            |
| ---------------------- | ---- | ------------------------------------------------ |
| `tipo_acto` reconocido | 0,20 | pedimento/manifestación/mensura/sentencia        |
| `rol` presente         | 0,15 | rol de la concesión                              |
| `coords_validas`       | 0,30 | Este/Norte en rango UTM plausible de Chile       |
| `huso` (18/19)         | 0,10 | huso declarado                                   |
| `comuna` presente      | 0,10 |                                                  |
| `titular` presente     | 0,15 | solicitante publicado (dato de registro público) |

- **Umbral de auto-aprobación:** `UMBRAL_AUTO = 0.75`. Bajo eso → cola de revisión.
- **Geolocalización:** solo si hay coords válidas **y** huso. Si no, `geom` queda
  `NULL` y se marca `no_geolocalizable`. **Nunca** una coordenada por defecto.
- **Rangos plausibles** (marcan `coordenada_fuera_de_rango` si se salen):
  Este 90.000–910.000 m; Norte 5.600.000–7.720.000 m.

## Gate declarado — NO se inventa

- **Endpoint del Boletín (URL, login, periodicidad): SIN VERIFICAR.** El módulo no
  descarga nada por su cuenta; `run()` recibe el texto ya obtenido. La descarga
  real es una sub-tarea a definir con el endpoint que confirme el equipo.
- **Formato exacto del boletín (etiquetas, separador de registros): SUPUESTO.** El
  parser asume un bloque por registro con líneas `CAMPO: valor` y separador
  `---`/`===`/`***`. Cuando se confirme el formato real de una edición, ajustar
  `SEP_REGISTRO` y los patrones de campos en el parser. Las fixtures de los tests
  (`tests/boletin/`) son **sintéticas**: casos de prueba, no datos reales.
- **OCR:** el respaldo usa `pdf2image` + `pytesseract` (+ binario `tesseract`).
  No son dependencias de la suite de CI; se instalan en el runner del job.

## Tablas (migración `20260725000000_b3_boletin.sql`)

- `boletin_ediciones` — una fila por publicación; `origen_hash` da idempotencia.
- `boletin_registros` — registros con `confianza`, `estado_revision`, `flags`,
  crudos PSAD56 + `geom` (Point 4326, o NULL).
- `boletin_alertas` — cruce espacial (`dentro_de_concesion` / `proximidad`),
  idempotente por `(registro_id, concesion_external_id)`.
- `boletin_cola_revision` — vista de los registros pendientes de revisión humana.
