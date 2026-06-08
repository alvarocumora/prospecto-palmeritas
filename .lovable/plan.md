
# Rediseño Geocapitals — Landing institucional + Sistema UI

Adoptar la identidad visual del infográfico adjunto (navy corporativo `#0B2A5B`, blanco, azul vivo `#1E6BE6`, dorado fino como acento) para transmitir confianza tipo banca de inversión / Bloomberg + JP Morgan, y reemplazar el "Terminal" actual de `/` por una **landing institucional bilingüe**. El Terminal se preserva en `/terminal`.

## 1. Objetivos

- Landing `/` enfocada en captar **dueños de proyectos** e **inversionistas** (no operativa).
- Sistema de diseño unificado (tokens + componentes) reutilizable en Terminal, MissionControl, Dashboards y reportes NI 43-101.
- Bilingüe ES/EN nativo (no traducción posterior).
- Mantener stack actual (TanStack Start + Tailwind v4 + shadcn) sin romper rutas existentes.

## 2. Sistema de Diseño (fundación)

### Tokens nuevos en `src/styles.css`
```text
--brand-navy:        oklch(0.22 0.08 260)   /* #0B2A5B */
--brand-navy-deep:   oklch(0.16 0.07 260)   /* footer/header */
--brand-blue:        oklch(0.55 0.20 255)   /* #1E6BE6 CTA */
--brand-blue-soft:   oklch(0.95 0.04 255)   /* fondos secciones */
--brand-gold:        oklch(0.78 0.13 78)    /* acento fino, líneas */
--brand-ink:         oklch(0.18 0.02 260)   /* texto principal */
--brand-mute:        oklch(0.50 0.02 260)
--surface-card:      oklch(0.99 0.005 260)
--border-hair:       oklch(0.90 0.01 260)
```
- Tema **light por defecto** (la landing es light; Terminal sigue dark).
- Variante `data-theme="terminal"` mantiene tokens oscuros actuales.

### Tipografía
- Display: **Manrope** (700/800) — titulares institucionales.
- Body: **Inter** (400/500).
- Mono: **JetBrains Mono** — métricas (+124, +312, KPIs).
- Cargar vía `@import` en `styles.css`, sin `<link>` extra.

### Componentes nuevos (`src/components/brand/`)
- `BrandHeader` — nav sticky con logo G, menú (Proyectos · Inversionistas · Empresas · Recursos), switch ES/EN, "Iniciar sesión", "Registrarse" (botón azul).
- `BrandFooter` — navy profundo, contacto, redes, legal, ISO/seguridad.
- `SectionBand` — banda navy full-width con 4 íconos+títulos (Quality Projects, Global Investors, etc.).
- `FeatureRow` — fila ícono circular azul + título + bajada (para "Publica tu proyecto", etc.).
- `ProcessCircle` — diagrama circular Publica → Conecta → Negocia → Cierra (SVG).
- `StatBlock` — `+124` mono grande + label uppercase.
- `BilingualHeading` — H1 con bloque ES y EN lado a lado (replica el hero del infográfico).
- `CheckList` — bullets con check azul (Para Inversionistas).
- `CtaCard` / `LangToggle` / `QrJoinBlock`.

### Tipos visuales
- Esquinas suaves `rounded-2xl`, sombras muy sutiles (`shadow-[0_1px_2px_rgba(11,42,91,0.06)]`), líneas hair 1px en `--border-hair`, sin glassmorphism.
- Íconos: `lucide-react` en círculo azul sólido o navy con icono blanco.

## 3. Landing nueva `/` (estructura)

```text
1. BrandHeader (logo + nav + ES/EN + CTAs)
2. Hero bilingüe
   - Izq: H1 ES "Conectamos proyectos mineros con capital" + bajada
   - Centro/Der: H1 EN equivalente
   - Imagen mockup del Terminal (laptop) a la derecha (screenshot del /terminal)
3. SectionBand navy: 4 pilares (Quality / Investors / Opportunities / Secure)
4. Dos columnas "Para propietarios" / "For project owners" con 4 FeatureRow c/u y ProcessCircle al centro
5. Tipos de proyectos (Metales preciosos, base, litio, energía) + Red global (+124 / +312 / 18 países) — StatBlocks mono
6. Banda navy "Creamos valor para todos / We create value for everyone"
7. Dos tarjetas "Para inversionistas" / "For investors" con CheckList + ilustración globo
8. CTA final: QR + "Únete a Geocapitals hoy" + contacto
9. BrandFooter navy
```

Todo el contenido **estático y SSR** para SEO.

## 4. Rutas / IA

- `src/routes/index.tsx` → **nueva landing** (`<MarketingLanding />`).
- `src/routes/terminal.tsx` (nueva) + mover Terminal actual a `/terminal` (shell ya existe).
- `src/routes/proyectos.tsx`, `inversionistas.tsx`, `empresas.tsx`, `recursos.tsx` → placeholders con mismo sistema (head propio por SEO).
- Header CTA "Iniciar sesión" → `/auth`, "Registrarse" → `/auth?mode=signup`.
- Botón "Abrir Terminal" visible solo si `user` autenticado.

## 5. Bilingüe (sin i18n library en fase 1)

- Hero, bandas y secciones renderizan ES y EN en columnas paralelas (igual que infográfico).
- `LangToggle` controla `data-lang="es|en"` en `<html>` y CSS oculta el bloque inactivo en viewports < lg (mobile muestra solo idioma activo).
- Persistencia en `localStorage` + atributo `lang` dinámico para SEO.

## 6. SEO

- `head()` en `/`: title "Geocapitals — Plataforma de inversión en proyectos mineros", description bilingüe, `og:image` = render del hero (se genera con imagegen en build), JSON-LD `Organization` + `WebSite`.
- Sitemap actualizado con nuevas rutas.
- Canonical solo en hojas.

## 7. Migración Terminal

- Mover `TerminalShell` a ruta `/terminal` (sin cambios funcionales).
- Header del Terminal usa los mismos tokens nuevos en modo dark (`data-theme="terminal"`).
- Tokens `signal-green` / `signal-red` se conservan.

## 8. Assets

- Logo G: generar SVG inline (círculo azul con G blanca) en `src/components/brand/BrandMark.tsx` — fiel al infográfico.
- Ilustraciones (globo, lingotes, cristal litio): SVG inline livianos en `src/components/brand/illustrations/`.
- Screenshot Terminal para hero: generar con `imagegen` (mockup laptop con UI del Terminal real).

## 9. Archivos a crear/editar

**Crear**
- `src/components/brand/BrandHeader.tsx`, `BrandFooter.tsx`, `BrandMark.tsx`, `LangToggle.tsx`
- `src/components/brand/SectionBand.tsx`, `FeatureRow.tsx`, `ProcessCircle.tsx`, `StatBlock.tsx`, `BilingualHeading.tsx`, `CheckList.tsx`, `CtaCard.tsx`, `QrJoinBlock.tsx`
- `src/components/brand/illustrations/{Globe,Bullion,LithiumCrystal,EnergyIcon}.tsx`
- `src/features/marketing/MarketingLanding.tsx`
- `src/features/marketing/sections/{Hero,Pillars,ForOwners,ForInvestors,ProjectTypes,GlobalNetwork,ValueBand,Cta}.tsx`
- `src/lib/i18n/landing.ts` (diccionario ES/EN tipado)
- `src/routes/terminal.tsx` (nueva ruta para Terminal)
- `src/routes/proyectos.tsx`, `inversionistas.tsx`, `empresas.tsx`, `recursos.tsx`

**Editar**
- `src/styles.css` — tokens + fonts
- `src/routes/index.tsx` — render `MarketingLanding`
- `src/routes/__root.tsx` — atributo `lang` dinámico
- (auto) `src/routeTree.gen.ts`

## 10. Fuera de alcance Fase 1

- i18n completo con `i18next` (se evalúa si crece a 3+ idiomas).
- Animaciones complejas (solo fade/slide sutiles con Tailwind).
- Blog/Recursos con contenido real (queda como placeholder).
- Cambios en MissionControl o dashboards autenticados (heredarán tokens automáticamente).

## 11. Entregable

`/` renderiza la landing institucional bilingüe fiel al infográfico, con sistema de marca reutilizable. Terminal sigue accesible en `/terminal`. Sin regresiones en rutas autenticadas.
