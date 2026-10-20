# GeoCapitals · Plan Maestro UI/UX — PR 2 Capital

## Alcance
Segunda iteración en GitHub, construida sobre PR #334 ya fusionado a main.

### Portafolio y cartola
- Consume la primitiva compartida `PlatformPage` y `PageHeader`.
- Mantiene ruta `/dashboard/investments` y búsqueda `?vista=wallet`, incluido desplazamiento a `#cartola` existente.
- Unifica el título, contexto, acción recargar y navegación de retorno sin recrear otro AppShell.
- Errores y carga del historial usan `ContentState`; no confunde error de consulta con saldo cero.
- La cartola, KYC, NDAs, liquidaciones e historial de solicitudes conservan sus handlers.

### Wallet SPV
- Mantiene `getMyWallet`, `getPublicRounds`, ledger y estados de tickets.
- Unifica contenedor institucional y los tres estados de posiciones: cargando/error con retry/sin posiciones confirmadas.
- Ninguna cifra sintética: capital pagado no equivale a valor de mercado; no se introducen saldos ni retornos.

### Inversión con colateral
- Migra la cabecera a `PageHeader` con CTA de documentos legales y botón real de descarga de PDF.
- Conserva el simulador, programa de parcelas, imágenes ilustrativas, cláusulas y cálculos.
- Aclara que los términos y garantías dependen de documentación contractual.

## Fuera de alcance
Sin cambios a backend, autenticación, SQL, RLS, servicio PWA, motor 3D, geometrías, precios, emisión de posiciones, firmas y generación de documentos. No desplegar ni publicar automáticamente.

## Validación / acceptance
- GitHub Actions TypeScript, lint, Vitest, build; registrar por separado las fallas previas en la base.
- Recorrer `/dashboard/investments`, `?vista=wallet`, `/dashboard/inversion-colateral` a 390/1440 px y verificar foco/target táctil.
- Validar carga/error/vacío de las posiciones con mocks; con datos autorizados validar PDF, certificados y tickets de extremo a extremo.
- Verificar roles y no revelar datos por caché; el service worker no se cambia.
- Integrar tras revisión de diff. No mezclar PRs #331-#333.
