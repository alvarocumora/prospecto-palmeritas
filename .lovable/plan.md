## Objetivo
Ordenar y profesionalizar todos los documentos transaccionales generados por Geocapitals, usando la identidad Institutional Modernist y corrigiendo el contacto a `info@geocapitals.com`.

## Hallazgos verificados
- El PDF subido tiene buen avance de marca, pero la estructura sigue desbalanceada: portada con demasiados elementos compitiendo arriba, página 2 con mucho espacio vacío y firmas demasiado altas.
- El renderer actual en `src/lib/documents/pdf.ts` todavía usa constantes antiguas (`GOLD`, `INK`) y comentarios de branding previo.
- La vista de validación `/verificar/$ref` muestra `contacto@geocapitals.com`, no `info@geocapitals.com`.
- El PDF subido también contiene `contacto@geocapitals.com` en header/footer.

## Plan de implementación
1. **Unificar identidad visual del PDF**
   - Migrar el renderer a una paleta única tipo landing: papel hueso, tinta, cobalto, líneas suaves y tablas sobrias.
   - Reemplazar cualquier mención visual/contacto antigua por `info@geocapitals.com` y WhatsApp `+56 9 6218 4071`.

2. **Reestructurar portada del documento**
   - Crear una cabecera más limpia: logo + marca a la izquierda, QR en bloque reservado a la derecha, sin competir con el título.
   - Separar claramente: referencia, fecha, título, resumen legal, campos clave y cláusulas.
   - Reducir ruido visual en tablas/campos y mejorar jerarquía tipográfica.

3. **Mejorar paginación y flujo del contenido**
   - Ajustar saltos de página para que el bloque de firmas no quede aislado arriba con una página casi vacía cuando haya espacio útil.
   - Dar a firmas un bloque propio más equilibrado al final, con márgenes consistentes y sin superposición entre nombre, sello, hash y datos.

4. **Sistema QR más claro y verificable**
   - Mantener QR apuntando a `https://geocapitals.com/verificar/<referencia>`.
   - Añadir texto corto y legible: “Validar vigencia” + URL compacta.
   - Usar QR principal en portada y QR pequeño solo en la última página, evitando duplicación innecesaria.

5. **Actualizar vista pública de validación**
   - Cambiar emails de contacto a `info@geocapitals.com`.
   - Mejorar la estructura visual del bloque de estado para que se vea como certificado de validación, no como página genérica.
   - Mantener que no exponga contenido privado del documento, solo metadatos públicos.

6. **Verificación visual obligatoria**
   - Generar/revisar un NDA de prueba.
   - Convertir el PDF a imágenes y revisar portada + página de firmas.
   - Corregir cualquier solape, texto cortado, QR mal ubicado o contacto incorrecto antes de darlo por terminado.

## Archivos a tocar
- `src/lib/documents/pdf.ts`
- `src/routes/verificar.$ref.tsx`
- Si aparece el correo antiguo en la UI del módulo de documentos, ajustar también el componente correspondiente.

## Resultado esperado
Los PDFs de NDA/SPA/NDI y demás plantillas se verán consistentes con la plataforma, tendrán un flujo ordenado, QR de validación claro en geocapitals.com y contacto oficial `info@geocapitals.com`.