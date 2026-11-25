# Sentinel-2 por pieza (19-11-2026)

Este análisis cubre 84 piezas: las presentadas, las que se suben hoy, las pendientes y ELARA CALIFORNIA. Usa mosaicos de mediana Sentinel-2 L2A de verano, 2024-2026 contra 2018-2020, generados con `scripts/satelite_piezas.py`.

Es un resultado DERIVADO / INTERPRETADO. Sentinel-2 no identifica minerales ni mide ley.

## Calibración en Tilama

Se comparó el puntaje con la mineralización conocida:

| Muestras | Percentil mediano |
|---|---|
| Con ley | p47 |
| Estériles | p56 |

El índice **no separa** lo mineralizado de lo estéril, igual que en la corrida del 15-11. El núcleo con desmontes de 7-10 % CuT (MARTINA 1, LEONOR 1, MARTINA 3) da puntajes negativos. Por eso el puntaje espectral **no sirve para priorizar** en este distrito. Las vetas de sulfuro en roca intrusiva no dejan un halo de alteración que Sentinel-2 alcance a ver a 20 m.

En Cerro Alto, Petorca y Limache no hay muestras, así que no se pudo calibrar.

## Suelo removido reciente

Ninguna pieza muestra movimiento de tierra nuevo importante entre 2018-20 y 2024-26:

- El máximo es 1,2 ha, en MARTINA 22.
- Hay rastros menores en MARTINA 20, 48 y 57.

No se ven faenas nuevas de terceros dentro de lo que se pide.

## Archivos

- `piezas_satelite.csv`: una fila por pieza con los siguientes campos:
  - porcentaje interpretable
  - hectáreas sobre el p95 de la zona
  - hectáreas removidas en forma reciente
  - z medio y z p90 de cada índice: Al-OH, óxidos de Fe, gossan y ferroso
- `*_puntaje.png` y `*_removido.png`: mapas por zona. En verde lo que se sube hoy, en azul lo ya presentado y en blanco lo que va después.
