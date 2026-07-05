# Plan — Homepage con más densidad visual y narrativa

El homepage actual tiene un hero fuerte pero cae en secciones planas: cards estáticas, mucho whitespace vacío entre bloques, poca jerarquía visual y ninguna prueba social real. Este plan añade **densidad, movimiento sutil y contenido nuevo** sin romper el lenguaje Institutional Modernist / Industrialism ya acordado.

## Cambios por sección

### 1. Hero — anclar con métricas vivas
- Añadir una **barra de KPIs animados** (count-up) justo bajo los CTAs: proyectos activos, capital gestionado, países, anomalías detectadas. Datos ya existen vía `getPlatformStats`.
- Fondo: reemplazar el grid estático por **líneas topográficas SVG animadas** (drift lento) + partículas de "escaneo satelital" en el mapa.
- Añadir badge lateral "Última anomalía detectada · hace 3 min" con feed real de `satellite_anomalies`.

### 2. Nueva sección — Logos & prueba social
Banda inmediatamente después del hero: logos de socios/geólogos calificados / medios ("Sernageomin", "NI 43-101 registered", universidades, prensa). Marquee horizontal lento en escala de grises.

### 3. Dual paths (Inversionistas / Marketplace)
- Añadir **preview visual** dentro de cada card: mini-chart de deal-flow para Inversionistas, mini-grid de commodities con precios live para Marketplace.
- Hover: revelar 3 métricas rápidas con transición.

### 4. Nueva sección — "Cómo funciona" con visual paso a paso
Reemplazar el actual highlight rotatorio plano por un **timeline horizontal interactivo** con:
- Ilustraciones SVG por paso (Publica → Conecta → Negocia → Cierra).
- Screenshot/mockup real de la plataforma a la derecha que cambia según el paso activo.
- Progreso animado con línea que se llena.

### 5. Regiones — mapa protagonista
- Reemplazar las 3 cards tipo "sparkline" por un **mapa LatAm interactivo** con hotspots pulsantes por país. Hover muestra IRR, focus y ticket promedio en un panel lateral.
- Mantener FlagChips como leyenda.

### 6. Nueva sección — Testimonios / casos
Grid tipo bento (2 grandes + 3 chicos) con:
- Cita de inversionista/geólogo (real o placeholder marcado).
- Foto/avatar + rol + proyecto.
- Un caso con métrica destacada tipo "USD 4.2M levantados en 90 días".

### 7. Nueva sección — Data & tecnología
Bloque oscuro (variante hero) mostrando el stack diferenciador:
- Visor 3D (loop de video/GIF corto del engine3d ya existente).
- Detección satelital (SatAnomalyMiniMap ya está).
- IA geológica (badge + snippet).
Layout asimétrico 60/40 con cifras grandes tipo "12M km² escaneados".

### 8. FAQ colapsable
Accordion con 6-8 preguntas frecuentes (inversión mínima, países, custodia, KYC, cómo publica un titular, etc.). Cierra la fricción antes del CTA final.

### 9. CTA final — full-bleed
Reemplazar el footer-cta plano por sección full-width con:
- Fondo dark + textura topográfica.
- Titular grande editorial + dos CTAs contrastados.
- Contador "324 inversionistas activos esta semana" en tiempo real.

## Sistema transversal
- **Motion**: usar Motion for React con `useInView` para revelar cada sección al scroll (fade + translateY 12px, respetando `prefers-reduced-motion`).
- **Tokens**: sin nuevos colores; usar `--accent-brand`, `--gold`, `--content-*`, `--hairline`. Nada hardcoded nuevo.
- **Componentes reutilizables** nuevos en `src/features/marketing/`:
  - `AnimatedCounter.tsx`
  - `LogoMarquee.tsx`
  - `HowItWorksTimeline.tsx`
  - `RegionHotspotMap.tsx`
  - `TestimonialsBento.tsx`
  - `TechStackShowcase.tsx`
  - `FaqAccordion.tsx`
  - `FinalCta.tsx`
- **Reveal** on scroll compartido: extender el `Reveal` mencionado en el design-system doc o crear uno mínimo si no existe.

## Orden de implementación (para acotar riesgo)
1. Hero KPIs animados + topografía SVG.
2. LogoMarquee + FinalCta (impacto rápido, bajo riesgo).
3. HowItWorksTimeline (reemplaza bloque plano existente).
4. TestimonialsBento + FaqAccordion (llenan el vacío principal).
5. RegionHotspotMap (reemplaza cards actuales).
6. TechStackShowcase (cierra la narrativa técnica).
7. Reveal-on-scroll aplicado a todo.

## Fuera de alcance
- No se toca lógica de negocio ni hooks de datos existentes salvo lectura de `platformStats` y `satellite_anomalies`.
- No se cambia el header/footer.
- No se rediseña Marketplace ni páginas internas.
- No se añaden dependencias pesadas (mapa se hace con SVG, no MapLibre extra).
