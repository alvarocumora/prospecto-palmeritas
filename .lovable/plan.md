

# Plan: Versión móvil "Command Platform Mobile"

Auditoría del viewport actual (440×688): TopBar denso, drawer hamburguesa funcional pero lento de alcanzar, StatusBar consume 24px sin valor accionable, tab bar de Catastro requiere scroll lateral sin indicador, perfil de Titular con stats `grid-cols-4` ilegibles, dashboard sin acceso rápido al mapa. La base es sólida (cards móviles ya existen, `pb-20` reserva espacio) — falta una **capa de navegación móvil nativa**.

---

## 1. Bottom Navigation Bar (NUEVO — `<MobileBottomNav />`)

Reemplaza la dependencia del hamburger. Barra fija inferior con 5 destinos críticos siempre a un toque.

```text
┌─────────────────────────────────────┐
│  ⌂      🧭     ⛏      📋     ☰    │
│ Home   Mapa  Campo Catastro  Más   │
└─────────────────────────────────────┘
```

- 5 slots fijos: Mission Control · Centro Op. · Campo (drilling/sampling) · Catastro · Más (abre drawer)
- 56px alto, safe-area inset bottom (iOS notch)
- Badge cyan/ámbar sobre Catastro cuando hay alertas
- Active state: dot superior cyan + icono cyan
- Render solo `md:hidden`, sustituye `pb-20` por safe-area dinámico
- **StatusBar oculto en móvil** (`hidden md:flex`) — su info crítica (online, alerts) migra al bottom nav y al TopBar

## 2. TopBar móvil compacto

- Hamburguesa ya existe ✓
- **Project selector colapsa a chip de código** (sólo `PLM-001 ▾`, no texto largo)
- Botón **⌘K → 🔍 search icon** (abre command palette o búsqueda contextual)
- Online badge → migra a bottom nav
- Salir → migra a drawer footer (ya está)
- Resultado: 3 elementos en topbar móvil (☰ · Logo · Project chip · 🔍)

## 3. Drawer móvil — mejoras

- Búsqueda en top del drawer (filtra items)
- Project selector arriba (cambiar proyecto sin cerrar drawer)
- Sticky header con logo + cerrar
- Items con altura 44px (target táctil iOS HIG)
- Animación slide-in suave 200ms

## 4. Catastro móvil — rediseño de tabs

- Tab bar actual: 6 items con scroll horizontal sin indicación → **convertir a `<select>` segmented o Sheet picker**
  - Opción elegida: **chip primario + sheet de selección** (`Concesiones ▾` → bottom sheet con los 6 tabs)
- Stats `grid-cols-2` ✓ pero achicar de 5 a 3 stats clave en móvil (Vigentes · Vence <90d · Vencidas), resto colapsable
- Filter chips `expired/critical/...` → wrap mejor con scroll horizontal indicado (gradient fade en bordes)
- Cards de concesión: agregar tap → drawer detalle (no sólo botones edit/delete)
- FAB "Nueva concesión" flotante bottom-right (encima del bottom nav, 16px gap)

## 5. HolderProfile móvil

- Stats `grid-cols-4` → `grid-cols-2` en móvil con tipografía mayor (24px valor)
- Botones Editar/PDF → **icon-only en móvil** + label en `sm:`
- Identity grid: collapsible "Más datos" en móvil para ahorrar scroll
- Concesiones del titular: card layout con tap completo (no fila densa de 1 línea)
- HolderLinksPanel y FilesPanel: secciones collapsibles tipo accordion

## 6. Dashboard home móvil

- KPIs `grid-cols-2` ✓, pero priorizar 4 críticos (m perforados · Au promedio · Pendientes · Alertas catastro)
- Card "Acción rápida" con shortcuts a Mapa / Nueva muestra / Captura GPS
- "Gobernanza & calidad" colapsable

## 7. Mapa móvil (`/dashboard/map`)

- Verificar que ProjectMap ocupa `100dvh - topbar - bottom-nav`
- Sheet inferior arrastrable para Herramientas (ya existe parcialmente)
- Botones flotantes: capa, ubicación GPS, snapshot — esquina derecha vertical
- Inspector de feature: bottom sheet, no drawer lateral

## 8. Diálogos y formularios

- `ConcessionDialog`, `HolderEditDialog`: ya full-screen en móvil. Asegurar:
  - Sticky header con título + ✕
  - Sticky footer con acciones (Cancelar · Guardar)
  - Body con `overflow-y-auto` y safe-area padding
  - Campos full-width, labels arriba (no inline)
- Inputs: altura mínima 44px, font-size 16px (evita zoom iOS)

## 9. Gestos y feedback

- Swipe-from-left edge en cualquier ruta → abre drawer
- Pull-to-refresh en listas (Catastro, Holders, Dashboard)
- Haptic-ready (clases `active:scale-95`) en botones primarios
- Toast position `bottom-center` en móvil (no top-right que choca con TopBar)

## 10. Tipografía y densidad responsiva

Densidad actual está pensada desktop (text-[10-11px]). En móvil:
- Body mínimo `text-[12px]`, headings `text-[14-16px]`
- Tablas convertidas a cards (ya hecho en Catastro ✓ — auditar resto: drilling, sampling, qaqc)
- Spacing: `gap-2 md:gap-1`, `p-3 md:p-2`

---

## Componentes nuevos

- `src/components/ops/MobileBottomNav.tsx` — barra inferior 5 slots
- `src/components/ops/MobileTabPicker.tsx` — chip + bottom sheet para tabs largos
- `src/components/ops/MobileFAB.tsx` — botón flotante reutilizable
- `src/components/ops/CollapsibleSection.tsx` — accordion ligero para móvil

## Archivos a modificar

- `src/routes/_authenticated.tsx` — montar `MobileBottomNav`, ajustar padding main
- `src/components/ops/TopBar.tsx` — versión compacta móvil
- `src/components/ops/StatusBar.tsx` — `hidden md:flex`
- `src/routes/_authenticated.dashboard.catastro.tsx` — tab picker, stats reducidas, FAB
- `src/components/ops/HolderProfile.tsx` — stats 2 cols, botones icon-only, accordion
- `src/components/ops/HoldersTab.tsx` — search sticky, FAB
- `src/routes/_authenticated.dashboard.index.tsx` — KPIs priorizados
- `src/styles.css` — `safe-area-inset-bottom`, `.mobile-tap` (44px target)

## Orden de ejecución

**Fase A — Navegación base** (crítico)
1. `MobileBottomNav` + integrar en layout
2. TopBar compacto + StatusBar oculto en móvil
3. Drawer mejorado (search + project switcher)

**Fase B — Catastro mobile-first**
4. Tab picker + FAB + stats reducidas en `/catastro`
5. HolderProfile rediseño (stats 2-col, accordions)
6. Cards tappables con detalle drawer

**Fase C — Resto del dashboard**
7. Dashboard home priorizado
8. Mapa: bottom sheet tools + FAB stack vertical
9. Dialogs sticky header/footer + safe-area
10. Auditar drilling/sampling/qaqc (convertir tablas residuales a cards)

## Resultado

Una experiencia móvil donde **todo destino crítico está a un toque** (bottom nav), **Catastro se explora sin scroll lateral** (tab picker), **el perfil del titular es legible** (stats grandes, accordions), y **los gestos nativos funcionan** (swipe drawer, pull-refresh, safe areas). Pasa de "responsive forzado" a **mobile-first command platform** sin sacrificar la densidad desktop.

