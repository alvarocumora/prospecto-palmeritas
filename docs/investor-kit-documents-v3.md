# GeoCapitals · Kit de inversión, ticket y documentación

Contrato de UX y producto; **no es un mecanismo de autorización** ni reemplaza validación legal.

## Qué significa «kit de inversión»

Una carpeta contextual **por proyecto y, cuando corresponda, por ticket**, no un botón que descarga documentos indiscriminadamente. El kit proporciona una respuesta concreta a tres preguntas:
1. ¿En qué invertiría y cuáles son los riesgos/limitaciones?
2. ¿Qué evidencia y documentos puedo consultar ahora?
3. ¿Qué requisitos debo completar para solicitar, firmar y recibir constancia de mi posición?

### Portada del kit (web)

\`\`\`text
GEOCAPITALS  /  INVERSIÓN  /  [PROYECTO]  /  KIT
Proyecto [ficha canónica]            [Estado de actualización: dd/mm/aaaa]
[Resumen] [Tesis] [Datos y mapas] [Riesgos] [Documentos] [Mi solicitud]
Monto simulado ...  Acciones estimadas ...  Participación [condicionada]
[Descargar kit disponible] [Continuar solicitud]
Documento            Acceso           Versión/fuente        Acción
Ficha de proyecto    Público          proyecto v#          [Ver] [PDF]
Mapa / ubicación     Público          dataset+fecha        [Ver]
Resumen de riesgos   Público          responsable+fecha    [Ver]
Deck comercial       Público/ACL      v#                   [Ver] [PDF]
Modelo financiero    NDA + permiso    v#                   [Solicitar acceso]
Data room técnico    NDA + permiso    v# / fuente          [Solicitar acceso]
Contrato SPV         Ticket/KYC       ticket+versión       [Ver cuando se emita]
Contrato firmado     Titular          hash+fecha           [Descargar]
Certificado/Cartola  Posición         hash+fecha           [Descargar]
\`\`\`

La versión pública no incluye evidencia privada ni inferencias inventadas. Un estado **«No disponible»** es diferente de «Restringido».

## Matriz de acceso conceptual

| Documento | Invitado | Cuenta | KYC aprobado | NDA + acceso por proyecto | Titular de ticket/posición |
| --- | --- | --- | --- | --- | --- |
| Ficha, commodity, ubicación y fuentes públicas | Ver | Ver | Ver | Ver | Ver |
| Resumen de riesgos y términos no vinculantes | Ver | Ver | Ver | Ver | Ver |
| Simulación personalizada | Generar local / PDF si existe | Guardar a cuenta | Guardar | Guardar | Guardar |
| Teaser/deck autorizado público | Si publicado | Si publicado | Si publicado | Si publicado | Si publicado |
| Informes técnicos/confidenciales | No | No | No por sí solo | Según permiso específico | Según permiso específico |
| Modelo económico no público | No | No | No por sí solo | Según permiso específico | Según permiso específico |
| Contrato editable por ticket | No | No | Según estado y titularidad | Según estado y titularidad | Si emitido para ese ticket |
| Documento firmado con prueba de integridad | No | No | No | No salvo titularidad | Sí, para ticket propio |
| Comprobantes, certificados y cartolas | No | No | No | No salvo titularidad | Sí, para posición/ticket propio |

La matriz guía el copy. **La API debe volver a comprobar** tenant, proyecto, ticket, rol y ACL de cada archivo. No exponer URLs S3 públicas o IDs utilizables sin permiso; entregar descargas mediante URLs firmadas de corta duración y auditoría. La aprobación KYC no otorga automáticamente acceso a todo el data room.

## Contenido del paquete descargable

**Kit público (ZIP o PDF combinado si hay archivos autorizados):**
- \`00-manifest.json\`: producto, proyecto, código, fecha UTC, ID de versión, estado de la fuente y lista de assets.
- \`01-ficha-del-proyecto.pdf\`: solo datos autorizados; fuente y fecha visibles.
- \`02-tesis-y-riesgos.pdf\`: descripción de hipótesis, riesgos mineros, regulatorios, financieros, liquidez y fuentes.
- \`03-mapa-y-contexto.pdf\`: imagen con atribución, coordenadas, CRS y fecha; nunca presentar como levantamiento topográfico validado si no lo es.
- \`04-simulacion.pdf\` **solo** si el usuario la generó con parámetros reproducibles (monto/moneda/fecha).
- \`05-indice-documental.pdf\`: inventario con estados y razones de restricción; no copias ficticias.

**Kit privado del inversionista:**
- Los documentos restringidos realmente autorizados y versionados.
- Copia original del ticket/solicitud con estado y hora.
- Contrato emitido y, al firmarse, su versión firmada y hash.
- Comprobante de pago solo del titular y únicamente si ya existe.
- Constancias de participación/certificados/cartola solo después de liquidación.

No mezclar kit de **acciones SPV** y carpeta de **renta fija con garantía inmobiliaria**: sus disclosures, contratos, riesgos, monedas y garantías son distintos. Para colateral ya existe \`CollateralOneClickPack\`; ese código no equivale al kit de inversión minera.

## Modelo de manifiesto propuesto

\`\`\`typescript
type KitAssetState =
  | "available"           // descarga autorizada y archivo existente
  | "restricted"          // existe, pero falta requisito de acceso
  | "requested"           // solicitud de autorización pendiente
  | "pending_generation"  // PDF se emitirá con operación confirmada
  | "superseded"          // versión histórica
  | "unavailable";        // no existe una fuente aprobada

type KitEvidence = "measured" | "declared" | "interpreted" | "estimated" | "unverified";

interface KitDocument {
  id: string;
  projectId: string;
  ticketId?: string;
  category: "factsheet" | "thesis" | "risk" | "map" | "deck" | "model"
          | "technical" | "nda" | "contract" | "payment" | "certificate" | "statement";
  state: KitAssetState;
  title: string;
  version: string | null;
  source: string | null;
  preparedAt: string | null;
  reviewedAt: string | null;
  sha256: string | null;
  evidence: KitEvidence | null;
  restrictionReason?: string;
  /** Download URLs are resolved by authenticated server actions at click time. */
}
\`\`\`

El manifiesto serializado jamás debe incluir secretos ni URLs de acceso permanente.

## Ticket de inversión — transiciones reales

\`\`\`text
Simulación local (NO ticket)
    ↓ solicitud enviada → ticket draft / pending_kyc
    ↓ KYC revisado y aprobado por equipo, si corresponde
contract_pending (contrato emitido por staff)
    ↓ firma del titular + integridad del documento
signed / payment_pending (según RPC)
    ↓ comprobante e inspección de fondos por staff
settled → spv_positions confirmadas
  ↳ cancelled / rejected: sin posición
\`\`\`

Los estados que actualmente se presentan en \`TICKET_STATUS_LABEL\` son \`draft\`, \`pending_kyc\`, \`contract_pending\`, \`signed\`, \`payment_pending\`, \`settled\` y \`cancelled\`. El frontend debe tolerar estados adicionales explícitos, sin inferir una liquidación a partir de un pago autodeclarado.

Una simulación de acciones y % SPV es **estimación**; el precio final, asignación, documentos y custodia pertenecen al contrato/emisor registrado y al procesamiento posterior.

## Document center UX y validaciones

- Vista por proyecto y por ticket, con búsqueda, categorías, estado, fuente, fecha y versión.
- Botón «Descargar kit disponible» usa selección acotada a archivos accesibles y produce manifiesto con errores por documento; nunca imprime un éxito si falló una parte.
- Vista «Solicitar acceso» solo si existe un workflow real; hasta entonces mostrar motivo y contacto/canal aprobado sin simular una aprobación.
- Firmar debe mostrar versión congelada, partes, resumen, hash y consentimiento; no habilitar sin permiso.
- No presentar QR como verificable si el endpoint de comprobación no funciona.
- Server-side: enforce RLS/ACL, signed URLs de corta vida, no cache compartida de respuestas privadas, auditoría de acceso y revocación, revisión de antivirus para uploads.
- Estado de load/empty/error con texto utilizable y reintento; prohibido usar valores 0 para fallos de datos.
- Etiquetas accesibles y descarga por teclado; móvil 390px sin scroll horizontal de tablas/documentos.

## PRs posteriores

1. Catálogo tipado de documentos públicos/restringidos + componente de inventario, sin acceso nuevo.
2. Manifest endpoint autorizado y filtros de assets por identidad/proyecto; tests de RLS y documentos de terceros.
3. Generador PDF/ZIP reproducible con bitácora, integridad e idempotencia; storage seguro.
4. Integración en \`TicketPanel\`, \`InvestorWallet\` y proyecto; E2E en cuentas de prueba.
5. Revisar contrato, marketing financiero, gestión de riesgo y data room con asesoría legal y geológica previa a publicación.

## Definición de terminado

Un cliente puede encontrar el mismo proyecto en landing, terminal, ticket, wallet y kit sin cambiar nombre/código/estado; descargar solo archivos autorizados y existentes; y comprender en todo momento qué es simulación, solicitud o posición confirmada.
