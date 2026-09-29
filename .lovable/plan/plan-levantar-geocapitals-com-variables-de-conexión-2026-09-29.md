# Plan: levantar geocapitals.com (variables de conexión)

## Diagnóstico

- Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` **sí existen** en el proyecto (verificado en `.env` y en el entorno del sandbox).
- El build local compila limpio (`build OK`, 57 s) y el `vite.config.ts` ya inyecta esas variables como literales en el bundle vía `define`.
- El sitio publicado en geocapitals.com sigue sirviendo el **build anterior** al arreglo, que salió sin las variables y por eso cae con "Missing Supabase environment variables".
- Adicional: hay un error de typecheck Deno en `supabase/functions/prospectivity-grid/index.ts` (tipado de `requireProjectMember`) que puede bloquear el deploy de funciones.

## Qué vamos a hacer

1. **Verificar la inyección en el artefacto**: correr `bun run build` y confirmar con `grep` que la URL del backend quedó embebida en `dist/client/assets/*.js`. Si no está, ajustar el `define` de `vite.config.ts`.
2. **Blindar el arranque de la app**: aunque falten las variables, la app no debe caer en pantalla blanca — `AuthProvider` ya degrada a "sin sesión"; extender ese mismo patrón a cualquier otro punto que toque el cliente de Supabase en el arranque, para que la portada y el terminal carguen siempre.
3. **Corregir el typecheck de `prospectivity-grid`**: ajustar la firma de `requireProjectMember` en `supabase/functions/_shared/auth.ts` para que acepte el cliente admin sin choque de tipos.
4. **Publicar**: con el build verificado, el usuario pulsa **Publicar** para que geocapitals.com tome la versión reparada. No hace falta configurar nada extra en Lovable: las variables ya están en el proyecto.

## Verificación

- `bun run build` exit 0 y URL del backend presente en el bundle.
- Playwright contra la preview: portada y `/terminal/cholqui` cargan sin errores de consola.
- Tras publicar, comprobar geocapitals.com responde sin la pantalla de error.

## Nota

La cuota de GitHub Actions es externa a Lovable; no afecta al despliegue del sitio. Se puede revisar aparte si los workflows de CI empiezan a fallar.
