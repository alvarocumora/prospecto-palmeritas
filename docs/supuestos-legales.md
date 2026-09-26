# Supuestos legales — para revisión de abogado (B5)

> El módulo **asiste** el due diligence; no lo reemplaza. Los parámetros de abajo
> fueron **cargados por IA desde la fuente oficial**, NO son verificación legal.
> Viven en la tabla `reglas_codigo_minero` con `fecha_verificacion = NULL`; el
> motor los trata como **"parámetro no verificado"** hasta que un abogado los
> confirme y setee `verificado_por` + `fecha_verificacion`.

## Reglas geométricas del Código de Minería (motor B5)

Fuente: **Reglamento del Código de Minería**, Título II "De la forma, cabida y
dimensiones de las concesiones", **Art. 8** (que detalla el **Art. 28 del Código**).
URL: https://faolex.fao.org/docs/pdf/chi51004.pdf (texto oficial reproducido).

| Regla                | Exploración (pedimento)        | Explotación (pertenencia) | Artículo                    |
| -------------------- | ------------------------------ | ------------------------- | --------------------------- |
| Orientación de caras | N-S y E-O en proyección U.T.M. | N-S y E-O en U.T.M.       | Art. 28 Cód. / Art. 8 Regl. |
| Lado más largo       | ≤ 15.000 m                     | ≤ 1.000 m                 | Art. 8 Regl.                |
| Relación largo/ancho | ≤ 15 : 1                       | ≤ 10 : 1                  | Art. 8 Regl.                |
| Cara superior        | 100 – 5.000 ha                 | 1 – 10 ha                 | Art. 8 Regl.                |
| Lados múltiplos de   | 1.000 m                        | 100 m                     | Art. 8 Regl.                |

### Matices que DEBE revisar el abogado (no resueltos por IA)

- **Cara 1–10 ha en explotación es por PERTENENCIA (unidad), no por la concesión
  completa.** Una concesión de explotación agrupa varias pertenencias (p.ej.
  ROMERO I "1/40" ≈ 200 ha = ~20 pertenencias de 10 ha). El motor hoy aplica el
  límite a la cara del polígono entregado; para validar una manifestación/grupo
  hay que decidir si se valida por pertenencia, por grupo, o por la manifestación
  inicial (que tiene límites propios). **Pendiente de criterio legal.**
- El motor asume un cuadrilátero simple; concesiones en L (varias caras) requieren
  descomponer en rectángulos antes de validar cada uno.

## Patentes y carry (motor B5.2) — Ley 21.420

Fuente: Ley 21.420 (vigente desde 2024). Cargado por IA, **pendiente de abogado**
(`fecha_verificacion = NULL` en `patentes_escala`). Tablas: `patentes_escala` (escalas)
y `valores_utm` (valor UTM fechado del SII).

| Concesión                          | Tramo (años de vigencia)                         | UTM/ha (anual)                     |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------- |
| Explotación sin labores            | 1–5 · 6–10 · 11–15 · 16–20 · 21–25 · 26–30 · 31+ | 0,4 · 0,8 · 0,9 · 1,2 · 3 · 6 · 12 |
| Explotación con labores (rebajada) | todos                                            | 0,1                                |
| Exploración                        | todos                                            | 0,06 (3/50)                        |

- **Valor UTM cargado:** julio 2026 = **$71.649** (SII). El motor marca el resultado
  **desactualizado** si la UTM tiene más de 35 días.
- **DISCREPANCIA a resolver por el abogado:** la patente de exploración aparece como
  **3/50 (0,06)** en una fuente y **1/50 (0,02)** "para casos calificados" en otra.
- **Reforma en trámite (NO es ley):** proyecto 2026 (Boletín 18259-08) eliminaría la escala
  progresiva y fijaría 4/10 UTM/ha para explotación. Cuando sea ley, actualizar la tabla.
- "Carry prohibitivo sin labores" = umbral configurable (por defecto ≥ 3 UTM/ha, el salto del
  año 21); es una señal comercial, no una regla legal.

## Obligaciones y vencimientos (B6)

- **Vencimiento de la patente = 31 de marzo** de cada año (la patente se paga en marzo).
  Es un supuesto procesal de fuente conocida, **por confirmar con abogado**; hoy vive en
  `packages/reglas/obligaciones.py` (`marzo_31`). Las alertas se escalonan a 90/30/7 días y
  "vencido", de forma idempotente (no se reenvía la misma alerta).
- La obligación de patente usa el **año 1** de la escala por defecto (no hay dato de año de
  vigencia por concesión en la fuente); cuando exista, el generador debe usar el tramo real.

## Pendientes de verificación (valor NULL en la tabla)

- **Duración de la concesión de exploración y su prórroga / no renovación.** El
  texto base decía "2 años, prorrogable por 2", pero las **Leyes 21.420 (2022) y
  21.649** reformaron plazos — el valor vigente **no se cargó** (fila con `valor
NULL` y nota). Verificar el texto vigente.
- **Escalas de patente y valor UTM** (motor de patentes, B5.2) — pendientes.
- **Restricción de re-solicitud** sobre superficie de exploración extinguida.

## Encuadre ético (B7) — no negociable

- Sujetos institucionales solamente; prohibido perfilar personas/dirigentes/familias.
- Prohibido score de "facilidad de negociación" o mapa de vulnerabilidad social.
- La salida es "qué debemos cumplir y para cuándo", nunca "por dónde entrar más fácil".
