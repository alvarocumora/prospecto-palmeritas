# Estado de la plataforma + simplificación del menú

> El menú tiene **48 ítems en 5 grupos** (NEGOCIO, OPERACIÓN, EXPLORACIÓN, GOBERNANZA,
> CUENTA): está muy fraccionado. Aquí: qué funciona / qué no, y un menú simplificado
> por módulos. La reorganización del menú es UI (Lovable, `/src`).

## 1. Qué funciona (backend verificado por tests) vs qué falta

| Área | Estado | Nota |
|---|---|---|
| **Operaciones de commodities (spine Trades)** | ✅ Backend completo (133 tests) | checklist multi-commodity, screening, gate de readiness, productos, negociación, margen/reparto, ficha pública, links por WhatsApp |
| **Margen y repartición** | ✅ | público solo ve venta; base/margen/reparto solo staff GC |
| **Catastro / tenencia** | ✅ | `cadastre_national` canónico, terreno franco (RPC), datum EPSG:1204 |
| **Documentos (plantillas)** | ✅ existen; ⏳ integración UI | NDA/NCNDA/MoU/LOI/SPA/JV + ICPO/FCO/IMFPA + catálogo REICON + bilingüe (handoffs listos) |
| **SaaS modular por planes** | ✅ backend (`get_my_modules`) ; ⏳ UI | 3 módulos: catastro / commodities / capital |
| **Cableado UI (paneles, ficha, correo)** | ⏳ Lovable trabajando | conecta los RPC ya listos |
| **Migraciones aplicadas en la cloud** | ⚠️ verificar | si el flujo real "falla", faltan aplicar migraciones nuevas |
| **Rutas duplicadas/huérfanas** | ❌ a consolidar | `operaciones`↔`trades`, `rfqs`↔`sourcing`, `proveedores`; invitaciones duplicadas |
| **Landing marketplace** | ❌ link roto | apunta a ruta gateada; va a `/marketplace` |
| **Datos que faltan (no inventados)** | ⛔ pendientes | radar de caducidades (año de vigencia), litología/DEM para prospectividad, endpoint del Boletín |

**Resumen:** el **backend del negocio está listo y probado**; lo que falta es
**cableado de UI** (Lovable, en curso), **aplicar migraciones** en la base real, y
**consolidar la fragmentación** (rutas y menú).

## 2. El problema del menú: 48 ítems, 5 grupos

NEGOCIO mezcla proyectos/inversión con trading; OPERACIÓN mezcla catastro con
proyectos; hay sub-vistas técnicas como ítems de primer nivel (Geofísica, Sondajes,
Muestreo, QA/QC, Targets, Sección 3D, Estimación… todos sueltos). Se lee como una
lista infinita, no como un producto.

## 3. Menú simplificado (48 → ~18), por módulos

**Principios:** (a) 3 módulos arriba (`get_my_modules`), el usuario ve solo los de su
plan; (b) máx. 5–7 entradas por módulo; (c) las sub-vistas técnicas se agrupan en
**tabs dentro de la página**, no como ítems de menú; (d) lo transversal
(analítica, equipo, plan, API, auditoría, HSE, costos, aprobaciones, validación) se
colapsa en **Administración** (o el perfil), fuera del rail principal.

### Módulo COMMODITIES & TRADING (6 entradas)
| Entrada | Absorbe (como tabs internas) |
|---|---|
| **Mesa de operaciones** | trades, trade-board, negociación, compliance, reparto |
| **Marketplace** | commodity-lots, marketplace |
| **Requerimientos** | sourcing, my-inquiries, rfqs |
| **Clientes & Proveedores** | clientes, proveedores, inscripción |
| **Documentos & Firmas** | documentos, firmas |
| **Finanzas & Logística** | cobranza, anticipos, envios, fletes · (Precios como widget) |

### Módulo CATASTRO & EXPLORACIÓN (5 entradas)
| Entrada | Absorbe (tabs) |
|---|---|
| **Catastro** | catastro, boletín, terreno franco |
| **Proyectos** | projects, mission, map, campaigns |
| **Exploración** | geofísica, sondajes, drones, muestreo, QA/QC, targets, sección 3D, estimación, inventario |
| **Reportes & 43-101** | ni43101, qps, reports, project-report, validación |
| **Inteligencia satelital** | satellite-intel, sat3d, revalidación MAG |

### Módulo CAPITAL & DEALS (3 entradas)
| Entrada | Absorbe |
|---|---|
| **Deals de Proyectos** | deals |
| **Inversiones** | investments |
| **Vender Proyecto** | listings, offerings |

### Transversal — "Administración" (colapsado, fuera del rail)
Analítica · Equipo · Plan y uso · API · Auditoría · HSE · Costos · Aprobaciones ·
Marketplace de Capas · Mi Perfil · Admin.

**Resultado:** ~14 entradas de negocio (en 3 módulos, mostrando solo el/los
contratados) + Administración colapsada, en vez de 48 sueltas. El usuario de Trading
ve 6 entradas; el de Catastro ve 5. Se lee como un producto.

## 4. Cómo llegar ahí (Lovable, `/src`)
1. Reagrupar el CommandRail por los 3 módulos (`get_my_modules`), con las entradas de
   arriba; mover las sub-vistas a **tabs** dentro de cada página.
2. Colapsar lo transversal en "Administración".
3. Mostrar solo los módulos del plan; gate de rutas por módulo.
4. Redirigir/retirar las rutas duplicadas (operaciones→trades, rfqs→sourcing).
