
## Diagnóstico del mapa que no aparece

Inspección en el preview: el `<section id="catastro">` renderiza con `height: 0` aunque el canvas de MapLibre existe. Causa probable:

- El contenedor del mapa depende de `min-h-[440px]` en un grid de Tailwind dentro de un `<Reveal>` con `opacity/translate` iniciales. Si MapLibre monta antes de que el bloque tenga altura visible, el canvas queda a 0×0 hasta que se dispara `resize`, y como el `Reveal` puede quedar oculto en el primer intersection observer, nunca se llama a `map.resize()`.
- Además el CSS de `maplibre-gl/dist/maplibre-gl.css` se importa dentro de un `Promise.all` async: en producción con SSR el primer render no tiene los estilos, y el `.maplibregl-canvas-container` queda sin `position: absolute`, colapsando el alto.

## Cambios propuestos

### 1. Fix del mapa (`LandingCatastroBlock.tsx`)

- Importar `maplibre-gl/dist/maplibre-gl.css` de forma estática al tope del archivo (no dentro del `loadMaplibre()`), para que el CSS entre en el bundle desde el primer render.
- Dar altura fija al contenedor del mapa (`h-[440px] lg:h-[520px]`, no `min-h`), envuelto en un wrapper con `position: relative` explícito.
- Llamar `map.resize()` en un `ResizeObserver` sobre el contenedor y también en el `load` para cubrir el caso de que el `Reveal` cambie la geometría al hacerse visible.
- Añadir fallback visible cuando `heatPoints.length === 0` (estado de carga con skeleton mientras llega la server function).

### 2. Catastro mejorado en el landing

Ampliar `LandingCatastroBlock` para que muestre por qué Geocapitals es el mejor operador, no solo un mapa:

- Barra superior con: total nacional, % vigentes, top región (cuando `region` esté populada, mientras tanto fallback a `tipo`), última sync — todo en tokens Institutional Modernist.
- Toggle sobre el heatmap: `Densidad` (actual) · `Vigentes` · `En trámite` — cambia el filtro del sample sin recargar.
- Chip "actualizado hoy" enlazado a `/catastro/mapa` con el rango temporal del último sync run.
- Debajo del mapa, mini-cards de módulos avanzados que ya existen y la competencia no ofrece: Alertas de patente vencida, Monitoreo de titulares, Cruce con boletines/juicios, Vista 3D de proyecto, Reportes NI 43-101 pre-generados.

### 3. Tabla comparativa vs operadores (nuevo componente)

Nuevo bloque `CatastroComparison.tsx`, insertado en el landing dentro de la sección `#catastro` justo antes del bloque de planes:

```text
                    Geocapitals   PropiedadMineraDigital   Sernageomin (público)   Otros SaaS
Cobertura           11.7k live    Chile                    Chile                    Parcial
Multi-país          PE·BR·ZM·MW   No                       No                       Limitado
Mapa 3D + geología  Sí            No                       No                       No
Alertas boletín     Sí            Básico                   No                       Varía
Cruce juicios       Sí            No                       No                       No
NI 43-101           Sí            No                       No                       No
Trade & data room   Sí            No                       No                       No
API / exports       GeoJSON+CSV   PDF                      Descarga masiva          Varía
Precio entrada      Gratis        Pago                     Gratis (sin tools)       Pago
```

- Datos verificables solo del lado Geocapitals; para competidores se marca lo público sin afirmar precios exactos, con nota al pie: "Comparativa basada en información pública de los sitios oficiales al %fecha%. No incluye planes empresariales personalizados."
- CTAs: "Comparar planes" → `/catastro/precios`, "Ver mapa live" → `/catastro/mapa`.

### 4. Bloque de planes reforzado

El mini-plans actual muestra Free/Pro/Enterprise. Agregar:
- Etiqueta "Más popular" en Pro.
- Fila de features clave por plan (concesiones monitoreadas, países, alertas, exports, NI 43-101) para que la comparación con la tabla anterior sea directa.
- Enlace secundario "Concierge / Custom" para leads enterprise vía `/contacto`.

### Archivos

- `src/features/marketing/LandingCatastroBlock.tsx` — fix del mapa (CSS estático, altura fija, ResizeObserver), toggle de capas, cards de diferenciadores, refuerzo del bloque de planes.
- `src/features/marketing/CatastroComparison.tsx` — nuevo, tabla comparativa.
- `src/features/marketing/MarketingLanding.tsx` — insertar `<CatastroComparison />` dentro de `section#catastro`.

Nada de cambios de esquema, migraciones ni backend nuevo: se aprovechan `getLandingCatastroSnapshot` y `getPublicPlans` existentes.

## Verificación

Después de implementar, en `/#catastro`:
1. Screenshot con Playwright para confirmar que el canvas tiene altura > 0.
2. Verificar en el DOM que `.maplibregl-canvas-container` tiene `position: absolute` (indica que el CSS cargó).
3. Confirmar que la tabla comparativa renderiza con 4 columnas y ~9 filas.
