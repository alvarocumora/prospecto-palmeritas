# Prospectividad de arcillas iónicas REE (B5.3)

> **Priorización exploratoria, NO estimación de recursos.** Una estimación de
> recursos o reservas requiere una **Persona Competente** (Ley 20.235); este score
> no lo es y jamás debe presentarse como tal. La etiqueta
> `"priorización exploratoria, no estimación de recursos"` se adjunta a **cada**
> celda y los tests verifican que esté presente.

## Qué hace

Asigna a cada celda un **score 0–100** de favorabilidad para arcillas iónicas REE,
como suma ponderada y **explicable** de tres factores. Cada componente reporta su
aporte; no hay caja negra.

| Factor                     | Señal favorable                                      | Peso (editable) |
| -------------------------- | ---------------------------------------------------- | --------------- |
| **Litología**              | granitoides tipo I / tonalitas de biotita ± anfíbola | 0,50            |
| **Proximidad a contactos** | cerca de contacto intrusivo/basamento                | 0,30            |
| **Pendiente**              | suave (preserva el regolito/laterita)                | 0,20            |

- `score = 100 · Σ (peso_i · favorabilidad_i)`, pesos normalizados a suma 1.
- **Litología:** favorabilidad 0–1 por clase (tabla). Clase no tabulada → aporte 0
  y flag `litologia_desconocida` (no se inventa un valor).
- **Contacto / pendiente:** favorabilidad plena hasta el óptimo, decae lineal
  hasta el máximo, 0 más allá. Sin dato → aporte 0 y flag (nunca un default).

## Todo editable, todo marcado no-verificado

Pesos, favorabilidades y parámetros viven en `reglas_prospectividad`
(`grupo` = peso | litologia | param). **Nada va hardcodeado** en el motor
(`packages/reglas/prospectividad.py`). Todas las filas se sembraron con
`fecha_verificacion = NULL` y `verificado_por = 'IA — pendiente validación de
geólogo competente'`: mientras siga NULL, cada celda sale marcada
`no_verificado = true`. Son **heurísticas exploratorias**, no medidas.

## Integración con Lovable (no se duplica su sistema)

Lovable ya tiene `prospectivity_runs` / `prospectivity_cells` (+ edge function
`prospectivity-grid`, modelo de proximidad a targets) y renderiza celdas por
`score` (0–100) + `features` (jsonb). El motor B5.3 emite celdas con **esa misma
forma** vía `a_registro_celda()`:

```
{ cell_lat, cell_lng, cell_size_m, score,
  features: { modelo, etiqueta, no_verificado, flags, aporte, favorabilidad, peso } }
```

Así, cuando existan las capas de entrada, un ETL puede poblar `prospectivity_cells`
con el modelo geológico REE sin tocar el renderer. `prospectivity_runs.weights`
(jsonb) puede sembrarse desde `reglas_prospectividad` (grupo `peso`).

## Gate declarado — falta la ingesta de capas

El motor opera sobre **factores inyectados por celda** (clase litológica,
distancia a contacto en m, pendiente en grados). Aún **no** están en la base como
fuentes verificadas:

- **Mapa geológico** (litología + contactos intrusivo/basamento): fuente natural
  SERNAGEOMIN, pero **la URL/servicio y el EPSG no están confirmados** — no se
  inventan aquí.
- **DEM** (para derivar pendiente): fuente y resolución **por confirmar**.

La **ingesta y el muestreo por celda** de estas capas es un sub-bloque posterior,
con su endpoint/EPSG declarados y validados. Los tests de B5.3 usan **factores
sintéticos** (fixtures), no datos reales.
