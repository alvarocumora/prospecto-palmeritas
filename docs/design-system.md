# Geocapitals — Design System Unificado (RFC)

> Estado: **Borrador / Fase 0** · Owner: equipo plataforma · Última actualización: 2026-06

Este documento define el sistema de diseño unificado de Geocapitals: una sola
fuente de verdad de **tokens** y **primitivas**, con la identidad **light /
institucional** (navy · azul · oro) como lenguaje visual de toda la plataforma.

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

## 2. Principio rector

**Una base, una identidad.** La dirección elegida es unificar toda la
plataforma hacia la identidad **light / institucional**. No se mantienen dos
identidades: el dashboard migra progresivamente desde el dark "Operations
Console" hacia el lenguaje institucional claro.

Los visores especializados que requieren fondo oscuro por legibilidad
(MapLibre, deck.gl, three.js, terminal de mercado) se tratan como **superficies
de excepción** mediante un scope `[data-surface="canvas"]`, no como un segundo
sistema.

## 3. Arquitectura de tokens (3 capas)

```
Capa 1 — Primitivos          Capa 2 — Semánticos          Capa 3 — Componente
(valor crudo OKLCH)          (rol, theme-aware)           (consume semántico)
--navy-900  oklch(…)    →    --surface, --content    →    Button / Card / Badge
--blue-600  oklch(…)         --accent, --border            (sin valores crudos)
```

### Capa 1 — Primitivos

Paleta cruda, sin significado de uso. No se usan directamente en componentes.

### Capa 2 — Semánticos (el contrato)

Roles que cambian según el theme. **Aquí se elimina el 90% de los hex y las
arbitrary utilities.** Roles canónicos:

| Token                                 | Rol                     | Light (institucional) |
| ------------------------------------- | ----------------------- | --------------------- |
| `--surface`                           | fondo de página         | blanco / casi blanco  |
| `--surface-2`                         | panel                   | gris muy claro        |
| `--surface-3`                         | elevado / card          | blanco con sombra     |
| `--content`                           | texto primario          | navy tinta            |
| `--content-muted`                     | texto secundario        | gris medio            |
| `--content-subtle`                    | texto terciario / hints | gris claro            |
| `--accent`                            | acción primaria         | brand-blue            |
| `--accent-contrast`                   | texto sobre accent      | blanco                |
| `--brand-gold`                        | acento de marca         | oro (uso medido)      |
| `--border`                            | líneas                  | hairline gris         |
| `--border-strong`                     | líneas marcadas         | gris medio            |
| `--signal-{success,warn,danger,info}` | estados funcionales     | tuning institucional  |

### Capa 3 — Primitivas React

`Button`, `Card`, `Badge`, `Input`, `SectionHeading`, `Eyebrow`, `Stat`,
`Reveal`. Consumen **solo** tokens semánticos. Una sola implementación para
todo (marketing y app).

## 4. Utilidades Tailwind

Los tokens semánticos se registran en `@theme inline` para generar utilidades
de primera clase y **eliminar las arbitrary utilities**:

```
text-[var(--brand-navy-deep)]   →   text-content
bg-[var(--brand-blue)]          →   bg-accent
border-[var(--brand-hair)]      →   border-border
text-[var(--brand-mute)]        →   text-content-muted
```

## 5. Plan de migración (incremental, sin big-bang)

| Fase  | Entregable                                                                                                     | Riesgo |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------ |
| **0** | Este RFC + inventario de tokens                                                                                | nulo   |
| **1** | Capa semántica en `styles.css` + utilidades Tailwind (aditivo)                                                 | bajo   |
| **2** | Primitivas compartidas + migración de landing y páginas públicas (piloto)                                      | bajo   |
| **3** | Migración del app shell (dashboard/terminal) módulo a módulo al theme light; superficies canvas como excepción | medio  |
| **4** | Pulido sistémico: foco accesible, `prefers-reduced-motion`, densidad, contraste, espaciado                     | bajo   |

**Regla de oro de cada fase:** ningún cambio rompe lo existente. Las arbitrary
utilities y tokens legacy siguen compilando hasta que su módulo se migra.

## 6. Accesibilidad (transversal)

- Contraste mínimo AA (4.5:1 texto, 3:1 UI) verificado por token.
- `:focus-visible` consistente con anillo `--ring` en todas las primitivas.
- `prefers-reduced-motion`: detiene animaciones decorativas, revela contenido.
- Targets táctiles ≥ 44px en navegación móvil.

## 7. Checklist de migración por módulo

Se rastrea en cada PR de Fase 3:

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

_Las decisiones de este documento son el contrato. Cambios a la capa semántica
requieren actualizar este RFC._
