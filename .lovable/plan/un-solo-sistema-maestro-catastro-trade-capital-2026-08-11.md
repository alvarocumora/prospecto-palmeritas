# Un solo sistema maestro: Catastro · Trade · Capital

Hoy hay 162 archivos de ruta, un rail de ~48 entradas en 5 grupos que mezclan dominios, y varios pares de pantallas que hacen lo mismo (operaciones vs trades, portal buyer/seller vs war room, rfqs vs sourcing, proveedores vs clientes, visor-3d / 3d-pro / geology3d, field-map vs map, marketplace interno vs público). El resultado se lee como muchas apps sueltas.

La meta: **un shell maestro** con tres espacios de trabajo (Catastro & Exploración, Trade & Commodities, Capital & Deals) y **una sola pantalla canónica por concepto**, con pestañas internas en vez de decenas de entradas de menú.

## 1. Shell maestro y navegación

- Un único rail con selector de espacio arriba (ya existe `ModuleSwitcher` + `get_my_modules`); el usuario ve solo los espacios de su plan.
- De ~48 entradas a ~14 + "Administración" colapsada:

```text
CATASTRO & EXPLORACIÓN     TRADE & COMMODITIES        CAPITAL & DEALS
  Catastro                   Mesa de operaciones        Deals de proyectos
  Proyectos                  Marketplace                Inversiones
  Exploración                Requerimientos             Vender proyecto
  Reportes & 43-101          Clientes & Proveedores
  Inteligencia satelital     Documentos & Firmas
                             Finanzas & Logística

ADMINISTRACIÓN (colapsado): Analítica · Equipo · Plan · API · Auditoría ·
HSE · Costos · Aprobaciones · Validación · Perfil · Admin
```

- "Inicio" queda transversal y el dashboard inicial sigue siendo module-aware.

## 2. Fusión de pantallas (una canónica por concepto)

| Canónica | Absorbe como pestañas |
|---|---|
| Mesa de operaciones (`/dashboard/trades`) | tablero kanban, negociación, compliance, productos, accesos, reparto |
| Requerimientos (`/dashboard/sourcing`) | rfqs, my-inquiries |
| Clientes & Proveedores (`/dashboard/clientes`) | proveedores, proveedor, inscripción, invitaciones, enlaces |
| Documentos & Firmas (`/dashboard/documentos`) | firmas, plantillas |
| Finanzas & Logística (`/dashboard/finance`) | cobranza, anticipos, envíos, fletes, precios |
| Catastro (`/catastro/proyecto`) | boletín, terreno franco, watchlist |
| Proyectos (`/dashboard/projects`) | mission control, mapa táctico, campañas |
| Exploración (`/dashboard/exploration`) | geofísica, sondajes, drones, muestreo, QA/QC, targets, sección, estimación, inventario |
| Reportes & 43-101 (`/dashboard/ni43101`) | reports, project-report, qps, validación |
| Inteligencia satelital (`/dashboard/satellite-intel`) | sat3d, mag-revalidations |
| Visor 3D (`/dashboard/geology3d`) | visor-3d, 3d-pro |

Las pestañas se implementan con estado en query param (`?tab=`) para que los enlaces profundos sigan funcionando y no se pierda SEO/compartibilidad interna.

## 3. Rutas: limpiar internas, redirigir públicas

- **Internas duplicadas (se eliminan):** `dashboard.operaciones.*`, `dashboard.rfqs.*`, `dashboard.proveedor(es).*`, `dashboard.invitaciones`, `dashboard.enlaces`, `dashboard.fletes`, `dashboard.field-map`, `dashboard.3d-pro`, `dashboard.marketplace`, `dashboard.trade-board`, `dashboard.catastro`, más las sub-vistas que pasan a pestaña. Se actualizan todos los `<Link to=...>` que las apuntan.
- **Públicas (se mantienen con redirect permanente):** `portal.buyer.$token` y `portal.seller.$token` → `/operacion/$token`; `visor-3d`, `terminal*`, `rfqs`, `proveedor.$token`, `oportunidades` → su equivalente canónica. Nadie con un link enviado por correo se queda fuera.
- Rutas públicas de negocio (`/marketplace`, `/ficha/$token`, `/operacion/$token`, `/firmar/*`, `/verificar/*`, `/live/*`, landing) no se tocan.

## 4. Gate por módulo

Cada ruta del dashboard declara su espacio (`src/lib/modules.ts` ampliado con las nuevas canónicas) y el layout `_authenticated` redirige si el plan no lo incluye — ya existe, solo hay que actualizar el mapeo tras la fusión.

## Detalles técnicos

- No se toca backend ni RPCs: la fusión es de presentación. Los paneles ya construidos (`TradeComplianceChecklist`, `TradeProductsPanel`, `TradeNegotiationPanel`, `TradeAccessLinksPanel`, `TradeMarginPanel`, `TradeKycPanel`) se montan como pestañas dentro de la pantalla canónica.
- Diseño Institutional Modernist en todas las pantallas fusionadas: solo tokens semánticos, sin hex hardcodeado; las pantallas oscuras heredadas se envuelven con `data-theme="im-light"`.
- Nada de hooks después de returns condicionales al mover paneles a pestañas; lint `react-hooks/rules-of-hooks` como verificación final.
- Verificación: navegar cada entrada del rail nuevo y cada redirect en el navegador, sin errores de consola.

## Orden de ejecución

1. Rail maestro + selector de espacio + grupo Administración.
2. Fusión Trade (mesa de operaciones, requerimientos, clientes/proveedores, documentos, finanzas).
3. Fusión Catastro/Exploración (catastro, proyectos, exploración, reportes, satelital, 3D).
4. Capital & Deals (3 entradas, sin fusión mayor).
5. Borrado de internas + redirects públicos + actualización de enlaces.
6. Gate por módulo y verificación en navegador.
