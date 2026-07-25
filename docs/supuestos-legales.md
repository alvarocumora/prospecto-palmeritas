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

| Regla | Exploración (pedimento) | Explotación (pertenencia) | Artículo |
|---|---|---|---|
| Orientación de caras | N-S y E-O en proyección U.T.M. | N-S y E-O en U.T.M. | Art. 28 Cód. / Art. 8 Regl. |
| Lado más largo | ≤ 15.000 m | ≤ 1.000 m | Art. 8 Regl. |
| Relación largo/ancho | ≤ 15 : 1 | ≤ 10 : 1 | Art. 8 Regl. |
| Cara superior | 100 – 5.000 ha | 1 – 10 ha | Art. 8 Regl. |
| Lados múltiplos de | 1.000 m | 100 m | Art. 8 Regl. |

### Matices que DEBE revisar el abogado (no resueltos por IA)
- **Cara 1–10 ha en explotación es por PERTENENCIA (unidad), no por la concesión
  completa.** Una concesión de explotación agrupa varias pertenencias (p.ej.
  ROMERO I "1/40" ≈ 200 ha = ~20 pertenencias de 10 ha). El motor hoy aplica el
  límite a la cara del polígono entregado; para validar una manifestación/grupo
  hay que decidir si se valida por pertenencia, por grupo, o por la manifestación
  inicial (que tiene límites propios). **Pendiente de criterio legal.**
- El motor asume un cuadrilátero simple; concesiones en L (varias caras) requieren
  descomponer en rectángulos antes de validar cada uno.

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
