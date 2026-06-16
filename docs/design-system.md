# Geocapitals — Design System (RFC)

> Estado: **Borrador / Fase 0–1** · Owner: equipo plataforma · Última actualización: 2026-06

Este documento define el sistema de diseño de Geocapitals: una sola fuente de
verdad de **tokens** y **primitivas**. La dirección acordada es un **rediseño
total desde cero** bajo un lenguaje visual nuevo —**Institutional Modernist**—
que reemplaza a las dos identidades previas (dark "Operations Console" y la
landing navy/oro) en toda la plataforma, de forma incremental y sin big-bang.

---

## 1. Diagnóstico (estado previo)

La plataforma convivía con **dos sistemas de diseño desacoplados**:

|            | Operations Console (app)              | Brand Light (marketing)                        |
| ---------- | ------------------------------------- | ---------------------------------------------- |
| Scope      | global (dark)                         | `.brand-light`                                 |
| Tokens     | shadcn (`--background`, `--primary`…) | `--brand-navy`, `--brand-blue`, `--brand-gold` |
| Paleta     | cyan/amber/red "signal"               | navy/azul/oro institucional                    |
| Tipografía | mono en headings                      | Inter display                                  |
| Radio      | 2px                                   | redondeado                                     |
| Alcance    | ~238 archivos                         | ~12 archivos                                   |

**Deuda de diseño medida:**

- **608** colores hex hardcodeados en `.tsx` (saltan los tokens).
- Utilidades arbitrarias repetidas: `text-[var(--brand-navy-deep)]` 40×,
  `--brand-blue` 40×, `--brand-mute` 37×.
- **72** archivos con `style={{}}` inline.
- `Button` (shadcn) solo con variantes dark-ops; los botones de marketing
  están hechos a mano inline.
- Sin documentación de design system.

Ninguna de las dos identidades previas se conserva como destino: el rediseño
parte de cero.

## 2. Principio rector — Institutional Modernist

**Una base, una identidad nueva.** El lenguaje visual de toda la plataforma es
**Institutional Modernist**: editorial, sobrio y de confianza, con autoridad de
prensa financiera (FT / Stripe) más que de terminal técnica.

### Paleta

| Rol            | Hex       | OKLCH                  | Uso                            |
| -------------- | --------- | ---------------------- | ------------------------------ |
| Papel hueso    | `#F7F5F0` | `oklch(0.965 0.006 85)`| fondo de página (cálido)       |
| Tinta          | `#1A1A2E` | `oklch(0.23 0.03 285)` | texto primario                 |
| Cobalto        | `#2B4ACB` | `oklch(0.47 0.17 267)` | acento / acción primaria       |
| Gris cálido    | `#6B6B7B` | `oklch(0.52 0.012 285)`| texto sutil / terciario        |
| Línea arena    | `#E3E0D8` | `oklch(0.91 0.008 85)` | hairlines y bordes             |

El acento cobalto es **un único color de marca**, usado con medida. No hay oro
ni señales cromáticas decorativas: el color comunica acción y estado, no adorno.

### Tipografía

| Rol     | Familia                              | Uso                                           |
| ------- | ------------------------------------ | --------------------------------------------- |
| Display | **serif** (Lora / Tiempos / Source Serif) | titulares con autoridad editorial        |
| Cuerpo  | **Inter** (sans neutra)              | texto corrido, UI                             |
| Datos   | **mono** discreta (JetBrains Mono)   | cifras, tablas, etiquetas técnicas            |

La jerarquía se construye por **escala y aire**, no por peso ni mayúsculas
agresivas. El serif aparece solo en display; el cuerpo es siempre sans.

### Forma y espacio

- **Radio medio y generoso** (`--radius-brand-sm/md/lg` = 6/10/16px), frente al
  2px del Operations Console.
- **Mucho whitespace**; densidad calmada salvo en superficies de datos.
- Sombras sutiles y hairlines `línea arena` en lugar de bordes marcados.

### Superficies de excepción

Los visores que requieren fondo oscuro por legibilidad (MapLibre, deck.gl,
three.js, terminal de mercado) se tratan como **superficies de excepción** vía
`[data-surface="canvas"]`, no como un segundo sistema.

## 3. Arquitectura de tokens (3 capas)

```
Capa 1 — Primitivos          Capa 2 — Semánticos          Capa 3 — Componente
(valor crudo OKLCH)          (rol, theme-aware)           (consume semántico)
--im-paper   oklch(…)   →    --surface, --content    →    Button / Card / Badge
--im-cobalt  oklch(…)        --accent-brand, --hairline   (sin valores crudos)
```

### Capa 1 — Primitivos (`--im-*`)

Paleta cruda Institutional Modernist, sin significado de uso. No se usan
directamente en componentes. Los primitivos legacy `--brand-navy/blue/gold` se
conservan **solo** mientras la landing `.brand-light` los siga consumiendo; se
retiran al migrarla.

### Capa 2 — Semánticos (el contrato)

Roles que cambian según el contexto/theme. **Aquí se elimina el 90% de los hex y
las arbitrary utilities.** Apuntan a la paleta Institutional Modernist:

| Token                                 | Rol                     | Valor (Institutional Modernist) |
| ------------------------------------- | ----------------------- | ------------------------------- |
| `--surface`                           | fondo de página         | papel hueso                     |
| `--surface-2`                         | panel                   | papel cálido                    |
| `--surface-3`                         | elevado / card          | casi blanco + sombra            |
| `--content`                           | texto primario          | tinta                           |
| `--content-muted`                     | texto secundario        | tinta suave                     |
| `--content-subtle`                    | texto terciario / hints | gris cálido                     |
| `--accent-brand`                      | acción primaria         | cobalto                         |
| `--accent-brand-contrast`             | texto sobre accent      | blanco                          |
| `--hairline`                          | líneas                  | línea arena                     |
| `--hairline-strong`                   | líneas marcadas         | arena +1                        |
| `--brand-{success,warn,danger,info}`  | estados funcionales     | afinado para papel cálido       |

### Capa 3 — Primitivas React

`Button`, `Card`, `Badge`, `Input`, `SectionHeading`, `Eyebrow`, `Stat`,
`Reveal`. Consumen **solo** tokens semánticos. Una sola implementación para todo
(marketing y app).

## 4. Utilidades Tailwind

Los tokens semánticos y primitivos se registran en `@theme inline` para generar
utilidades de primera clase y **eliminar las arbitrary utilities**:

```
text-[var(--brand-navy-deep)]   →   text-content
bg-[var(--brand-blue)]          →   bg-accent-brand
border-[var(--brand-hair)]      →   border-hairline
text-[var(--brand-mute)]        →   text-content-muted
font-serif                      →   display editorial
```

## 5. Plan de migración (incremental, sin big-bang)

| Fase  | Entregable                                                                                                     | Riesgo |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------ |
| **0** | Este RFC + inventario de tokens + dirección Institutional Modernist                                            | nulo   |
| **1** | Capa 1 (primitivos `--im-*`) + Capa 2 semántica + utilidades Tailwind (aditivo)                                | bajo   |
| **2** | Primitivas compartidas + rediseño de landing y páginas públicas al lenguaje nuevo (piloto); retiro de `--brand-*` legacy | bajo |
| **3** | Migración del app shell (dashboard/terminal) módulo a módulo al lenguaje claro; superficies canvas como excepción | medio |
| **4** | Pulido sistémico: foco accesible, `prefers-reduced-motion`, densidad, contraste, espaciado                     | bajo   |

**Regla de oro de cada fase:** ningún cambio rompe lo existente. Las arbitrary
utilities y tokens legacy siguen compilando hasta que su módulo se migra. En
Fase 1 los nuevos tokens son aditivos y **ningún componente los consume todavía**
→ cero cambio visual.

## 6. Accesibilidad (transversal)

- Contraste mínimo AA (4.5:1 texto, 3:1 UI) verificado por token. Tinta sobre
  papel hueso y blanco sobre cobalto cumplen AA.
- `:focus-visible` consistente con anillo `--accent-brand` en todas las primitivas.
- `prefers-reduced-motion`: detiene animaciones decorativas, revela contenido.
- Targets táctiles ≥ 44px en navegación móvil.

## 7. Checklist de migración por módulo

Se rastrea en cada PR de Fase 2–3:

- [ ] marketing (landing + páginas internas)
- [ ] auth
- [ ] dashboard / command-center
- [ ] catastro
- [ ] geología 3D / engine3d _(canvas)_
- [ ] satélite / mag _(canvas)_
- [ ] reports / NI 43-101
- [ ] terminal / mercado _(canvas)_
- [ ] deals / finance
- [ ] admin / team / profile

---

_Las decisiones de este documento son el contrato. Cambios a la paleta, la
tipografía o la capa semántica requieren actualizar este RFC._
