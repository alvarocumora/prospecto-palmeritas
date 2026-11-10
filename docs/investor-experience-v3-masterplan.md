# GeoCapitals · Investment Experience 3.0 — Plan maestro UI/UX

Estado: **diseño para implementación; no implica que las pantallas ya estén construidas**.

## Principios

GeoCapitals combina inteligencia geoespacial minera, inversión privada y operación documental. Deben existir **dos journeys distintos**:
- **Inversión en participación minera/SPV**: simulación, solicitud de ticket, KYC, contrato, pago/verificación, liquidación y posición confirmada. Nunca confundir estos estados.
- **Financiamiento con garantía inmobiliaria**: producto, promesa de renta y documentos separados de acciones mineras. Nunca sumar ambas carteras como si fueran una misma clase de activo.

El lenguaje comercial debe distinguir hechos verificados, datos declarados por el titular, interpretaciones, escenarios y documentación pendiente. No presentar índices espectrales como recursos certificados, ni rentabilidad estimada como garantizada.

Conservar el **design system** existente (Institutional Modernist), shell y rutas TanStack Start + React, MapLibre + deck.gl, Supabase/RLS. No migrar a Next.js o crear un segundo mapa/portal.

## Arquitectura de información

### Público
1. **Landing** \`/\`: propuesta de valor, selector de producto, evidencia, oportunidades, proceso, FAQs, riesgos, contacto.
2. **Explorar proyectos** \`/proyectos\` o \`/inversionistas\`: filtros por commodity, región, estado de ronda, nivel de evidencia, tipo de instrumento. Todas las cifras dinámicas desde fuentes canónicas.
3. **Proyecto** \`/terminal/$slug\`: pestañas Resumen/Mapa-Satélite/Tesis y riesgos/Simulador/Documentos. No perder slug al cambiar de pestaña.
4. **Kit público del proyecto**: versión descargable de ficha y documento comercial, inventario de evidencia pública, glosario/riesgos y un resumen de la simulación si el usuario lo genera. Documentos restringidos aparecen con requisito de acceso; no simular descargas.

### Con sesión
5. **Mi solicitud**: secuencia verificable KYC → aprobación contractual → firma → instrucción/validación de pago → liquidación → participación registrada. La UI usa el estado remoto, no una barra ficticia.
6. **Investor Home** \`/dashboard\`: resumen, siguiente acción real, proyectos seguidos, solicitudes, eventos documentales.
7. **Wallet & cartola** \`/dashboard/investments?vista=wallet\`: posiciones liquidadas y confirmadas por moneda y SPV, tickets por estado, documentos, histórico. No indicar cotización o disponibilidad de retirada si no existe.
8. **Centro documental del inversionista**: vista consolidada del kit por proyecto, solicitud o posición; clasificación público / autorizado / NDA-KYC / firmado / custodia.

## Wireframes funcionales

### Landing desktop

\`\`\`text
┌───────────────────────────────────────────────────────────────────────────────┐
│ GEOCAPITALS   Proyectos   Cómo funciona   Inteligencia   Ingresar / Mi cuenta│
├───────────────────────────────────────────────────────────────────────────────┤
│ [Información geoespacial + inversión responsable]    [Imagen terreno 3D]    │
│ Inversión minera con evidencia trazable.                                   │
│ Riesgos y oportunidades, visibles antes de iniciar una solicitud.            │
│ [Explorar proyectos] [Cómo funciona]                                        │
├───────────────────────────────────────────────────────────────────────────────┤
│ [Minera / acciones SPV]      [Financiamiento con garantía]                   │
│ Oportunidades dinámicas · riesgo y proveniencia en cada tarjeta              │
│ 2–3 cartas con mapa/commodity/ubicación/etapa/ticket real / ficha             │
├───────────────────────────────────────────────────────────────────────────────┤
│ Cómo inviertes: explora → simula → verifica → firma → seguimiento             │
│ Confianza: catastro, estándares usados por reporte, fecha y estado de QA     │
│ FAQs · Riesgos · Documentación · Contacto                                   │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

En móvil: hero con CTA visible sin scroll excesivo; imagen de terreno estática si WebGL es costoso; menú accesible de 44 px; cards de una columna; barra inferior solo si aporta a navegación real.

### Proyecto + Kit

\`\`\`text
┌ Proyecto Los Verdes–Tilama  / Región, commodity / Ronda declarada ──────────┐
│ Resumen | Mapa/3D | Satélite | Tesis/Riesgos | Simulador | Documentos          │
├─────────────────────────────┬─────────────────────────────────────────────────┤
│ Visor/imagen real           │ Ticket desde [fuente] · estado de ronda [fecha] │
│ Concesiones + evidencia     │ Inversión estimada USD ___ / Acciones estimadas │
│ por fuente y fecha          │ [Simular solicitud]                             │
│                             │ [Ver kit de inversión]                          │
├─────────────────────────────┴─────────────────────────────────────────────────┤
│ Tesis de inversión + riesgos + indicadores de procedencia                   │
│ Paquete público: ficha / mapa / fuentes / riesgos                           │
│ Restrictos: NDA / KYC / contrato — explicar requisito, no inventar archivos │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

Móvil: nav horizontal desplazable con label visible, CTA persistente **sin tapar el visor**, toggle 2D/3D, estados de carga/error claros.

### Ticket + seguimiento

\`\`\`text
[ Proyecto seleccionado ]                 [ Resumen inmovilizado ]
01 Simular          ✔ o pendiente          Monto referencial USD ...
02 Crear solicitud  ●                      Acciones estimadas ...
03 KYC/validación   ○                      Comisión/condiciones: según fuente
04 Contrato y firma ○                      Riesgos / versión de documento
05 Pago y revisión  ○                      [Continuar] (solo acción habilitada)
06 Posición SPV      ○
\`\`\`

No llamar «emitir acciones» a crear un ticket. Tras solicitar, mostrar código/fecha y siguiente acción. El usuario puede tener varios tickets, cada uno con estado autónomo.

### Wallet del inversionista

\`\`\`text
Investor Wallet     [Descargar cartola]      [Documentos]
[Capital confirmado por moneda]  [Acciones confirmadas] [Solicitudes en curso]
──────────────────────────────────────────────────────────────────────────────
Mis participaciones (solo settled + posiciones confirmadas)
 Proyecto / SPV / serie / número de acciones / fecha / documento emitido
──────────────────────────────────────────────────────────────────────────────
Mis solicitudes (draft, pending_kyc, contract_pending, signed, payment_pending)
 Ticket / proyecto / monto / estado / fecha / próxima acción / ver documentos
──────────────────────────────────────────────────────────────────────────────
Actividad + cartolas y certificados verificables / estados vacíos y errores
\`\`\`

No presentar «valor de mercado», «retorno acumulado», «saldo disponible» o botón «Retirar» sin datos autorizados reales. Si hay CLP y USD, desglosar por moneda; nunca sumar directamente ni convertir sin fecha/tipo de cambio.

## Sistema visual

- **Light (inversión y documentos):** fondo marfil #F7F6F2, tinta azul-negra #1B2031, superficies blancas, bordes grises tenues.
- **Dark (visor profesional):** #10141F y #1B2031; superposición geográfica y colores científicos con leyenda.
- **Acción primaria:** azul #3154BD; **acento editorial:** cobre/dorado #C97B47. Colores reservados para estados semánticos claros.
- Tipografía: serif editorial para titulares; sans legible para producto; mono para identificadores, cifras y metadatos.
- Escala: espacios 8/12/16/24/32; targets 44px; cards con radius 8–12; sin fondos de alerta decorativos.
- Cada pantalla mantiene los mismos nombres de proyecto/SPV, breadcrumbs, versión de documentos, privacidad y contexto.

## Estado de datos y confianza

| Concepto | Se muestra como | Fuente esperada |
| --- | --- | --- |
| Ronda, precio y mínimo | Datos con sello de actualización | SPV y \`getPublicRounds\`, no hardcode de marketing |
| Simulación | Referencial / no crea posición | \`simulateInvestment\`, monto vigente |
| Solicitud/ticket | Estado real, siguiente acción | \`investment_tickets\` y RPC autorizados |
| KYC | Incompleto / en revisión / aprobado / rechazado | Perfil autorizado |
| Posición SPV | Solo confirmada/liquidada | \`spv_positions\` |
| Cartola | Histórica, no cotización | \`getMyWallet\` + PDF autorizado |
| Documento | Identidad, clase, versión, fecha, hash, requisito | Centro documental con ACL desde servidor |
| Geología, satélite, geofísica | Medido/declarado/interpretado; fuente y resolución | Registro de datasets + visor |

Cada botón debe tener consecuencias transparentes, estados \`loading/error/empty/success\`, prevención de doble envío e idempotencia en operaciones financieras.

## Componentes/rutas existentes para reutilizar

- \`src/features/marketing/MarketingLanding.tsx\`, \`MiningInvestShowcase.tsx\`, \`/inversionistas\`.
- \`src/features/terminal/ProjectTerminalShell.tsx\`, \`TerminalSimulator.tsx\`, \`TicketPanel.tsx\`.
- \`src/features/home/InvestorHome.tsx\`, \`src/features/investor/InvestorWallet.tsx\`, \`PendingTicketBanner.tsx\`.
- \`src/lib/tickets.functions.ts\`, \`wallet.functions.ts\`, \`investors.functions.ts\`.
- \`src/components/documents/ProjectDocsMenu.tsx\`, \`src/lib/documents/\`, \`src/lib/pdf/\`.
- **No reutilizar el editor administrativo** \`/dashboard/documentos\` como si fuera por defecto un portal de documentos privados de un inversionista.

## Entregas GitHub propuestas

- **PR UX-I1 — Landing y fichas:** navegación, selección entre inversiones en SPV vs colateral, estado verificable, mobile CTA, documentación pública y riesgos.
- **PR UX-I2 — Ticket y onboarding:** wizard contextual sobre \`TicketPanel\`, simulación conservada, review KYC, copia de riesgo, estado real, tests.
- **PR UX-I3 — Investor Wallet:** resumen, actividades, separación de moneda, próximo paso, cartola, empty/loading/error, seguimiento y accesibilidad.
- **PR UX-I4 — Kit/documentos:** manifiesto versionado, permisos y data room, solicitudes NDA/KYC, integridad SHA256, PDF/ZIP solo de archivos realmente autorizados.
- **PR UX-I5 — QA E2E:** Chromium público + cuentas QA autorizadas con datos sintéticos; iOS Safari, seguridad documental, accesibilidad WCAG, rendimiento PWA.

## Criterios de aceptación

1. Móvil 390 y escritorio 1440: cero overflow; CTA y navegación visibles; texto de inversión legible.
2. Una simulación no figura como dinero invertido ni como reserva confirmada.
3. Al registrar/editar un ticket, no se pierden \`slug\`, monto, moneda ni contexto.
4. La wallet muestra cero posiciones cuando aún no hay liquidaciones confirmadas.
5. Un usuario sin KYC/NDA no puede descargar un archivo restringido aunque conozca URL o ID.
6. Documentos borrador, disponibles, firmados, obsoletos, solicitados y restringidos se diferencian.
7. Contrato y comprobante provienen de fuentes autorizadas; sin PDF ficticio o QR falso.
8. Reintento de API, doble clic, expiración de sesión y errores de carga manejados.
9. No se modifica motor geoespacial, normativa minera ni RLS sin revisión por separado.
10. El código se integra por PR y no se hace despliegue antes de pruebas.

## No implementado por este documento

No se han creado nuevas rutas, tokens, permisos, estados bancarios, documentos, firmas ni archivos de clientes. Este documento es el contrato de diseño para preparar PRs incrementales sin gastar créditos de Lovable.
