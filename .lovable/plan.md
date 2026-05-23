## Problema

En `/live/losverdes` ingresas `losverdes5` y sale **"Error de red"** en vez de entrar al mapa. La PWA carga la página, pero el POST al server function `verifyLosVerdesLiveMapPassword` falla.

## Causa más probable

`Importing a module script failed` en consola (visto en logs previos): el bundle cliente intenta cargar un chunk dinámico (el del server fn) cuyo hash ya no existe en el servidor porque hubo un rebuild entre la carga del HTML y el click. El `catch` del formulario lo reporta como "Error de red".

Ya quedó en código un guard que detecta este error y hace `window.location.reload()` automáticamente — pero **solo aplica después de cargar una vez la nueva versión**. La sesión actual del usuario sigue con el bundle viejo.

## Plan de verificación (3 pasos, sin tocar código todavía)

### 1. Forzar recarga dura del cliente
- Pedirte que hagas **hard refresh** en la preview (botón ⟳ del editor o `Cmd+Shift+R`) sobre `/live/losverdes`.
- Esto baja el nuevo `index.html` + el chunk actualizado del server fn.

### 2. Probar el flujo end-to-end
- Ingresar `losverdes5`.
- Resultados esperados:
  - **Si entra al mapa** → el problema era 100% chunk obsoleto, ya resuelto por el guard. Se cierra el ticket.
  - **Si vuelve a salir "Error de red"** → el server fn no responde, hay que ir al paso 3.
  - **Si sale "Contraseña incorrecta"** → el secret `LIVE_MAP_LOSVERDES_PASSWORD` en Cloud no es `losverdes5`; lo actualizamos.

### 3. Diagnóstico server-side (solo si paso 2 falla con "Error de red")
- Revisar Worker logs publicados filtrando por `verifyLosVerdesLiveMapPassword`.
- Invocar el server fn vía `stack_modern--invoke-server-function` con `losverdes5` y mirar status real.
- Confirmar que `LIVE_MAP_LOSVERDES_PASSWORD` y `LIVE_MAP_SESSION_SECRET` están provisionados (ya verifiqué que sí existen como secrets de proyecto).

## Plan de build

- Correr `bunx tsc --noEmit` para confirmar 0 errores (ya verifiqué hace minutos: limpio).
- Si tras el hard refresh la app entra al mapa, **publicar** desde el botón Publish para que el nuevo bundle quede como versión estable en `prospecto-palmeritas.lovable.app` y la PWA en terreno tome los chunks frescos.

## Mejora opcional (si querés que la apruebe en otro turno)

Hacer el handler del gate más robusto reintentando el `verify()` una vez si el primer intento falla por chunk obsoleto, sin necesidad de reload manual. Útil para terreno con conexión intermitente. No es bloqueante para usar la app hoy.

## Entregable inmediato

Hacé el hard refresh y volvé a probar `losverdes5`. Decime qué mensaje sale exactamente y desde ahí ajustamos.
