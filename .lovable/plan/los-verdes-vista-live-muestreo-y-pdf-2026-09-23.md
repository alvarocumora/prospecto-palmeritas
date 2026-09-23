# Los Verdes: vista live, muestreo y PDF

## Objetivo
Convertir la ficha de Los Verdes–Tilama en una presentación pública equivalente a Cholqui, usando exclusivamente los antecedentes ya cargados y manteniendo trazabilidad entre mapa, indicadores y PDF.

## Implementación
1. **Fuente pública unificada**
   - Extender la lectura pública acotada al proyecto `LV-TIL-001` con sus 190 resultados de muestreo.
   - Convertir las coordenadas UTM 19S a WGS84 para presentar cada punto en el mapa.
   - Exponer solo campos técnicos seguros: código, ubicación, tipo, laboratorio, certificado, estado y leyes Cu/Au/Ag.

2. **Mapa interactivo**
   - Añadir una capa conmutable “Muestras” al visor existente de Los Verdes.
   - Diferenciar visualmente las muestras por ley de cobre y mostrar una ficha al seleccionar cada punto.
   - Mantener catastro, targets, anomalías satelitales y magnéticas en el mismo visor.

3. **Ficha live para inversionistas**
   - Reordenar `/live/losverdes` con portada institucional, indicadores verificables, enlace copiable y acceso al PDF.
   - Incorporar resumen de muestreo: cantidad total, promedio y máximos de Cu, Au y Ag.
   - Mantener advertencias claras sobre datos en borrador, estimaciones conceptuales y ausencia de recursos o reservas certificados.

4. **PDF estandarizado**
   - Actualizar el informe Los Verdes con identidad GeoCapitals, versión documental, QR y enlace a la vista live.
   - Agregar resumen estadístico y tabla de las muestras más relevantes, identificadas como antecedentes cargados y no como recursos minerales.
   - Mantener catastro, anomalías, targets, metodología y próximos pasos sin inventar cifras.

5. **Verificación**
   - Comprobar la vista pública en escritorio y móvil.
   - Descargar el PDF desde la vista y revisar visualmente todas sus páginas.
   - Confirmar que el mapa, los indicadores y el documento usan la misma fuente.

## Resultado esperado
Una URL pública única (`/live/losverdes`) con mapa, 190 puntos de muestreo y PDF descargable con QR, coherente con la presentación de Cholqui y sin requerir autenticación.
