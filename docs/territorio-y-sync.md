# Territorio del repositorio y protección frente al sync de Lovable

> **Por qué existe este documento.** El PR #188 (reconciliación de terreno franco),
> ya **mergeado**, desapareció de `main`: un sync posterior de Lovable regeneró el
> repo desde su espejo cloud y **podó** la migración y su test. Se restauró en el PR
> #191. Este documento fija la frontera de territorio y los mecanismos para que no
> vuelva a pasar.

## Mapa de propiedad (regla v2, inviolable)

| Ruta | Dueño | Regla |
|---|---|---|
| `/src` | **Lovable** | **No editar.** Claude Code solo lo lee, para conocer los contratos de datos. |
| `/supabase/migrations` | **Claude Code** | Migraciones versionadas. |
| `/etl` | **Claude Code** | Pipelines de ingesta. |
| `/packages/reglas` | **Claude Code** | Motores de cálculo (librerías). |
| `/tests` | **Claude Code** | Suite de pruebas. |
| `/docs` | **Claude Code** | Fuentes y supuestos. |
| `/supabase/functions` | Lovable | Edge functions (TypeScript/Deno). |

Excepción conocida: los tipos generados `src/integrations/supabase/types.ts` son la
**fuente autoritativa** del esquema cloud de Lovable — Claude Code los lee (nunca los
edita) para reconstruir migraciones drifteadas.

## Qué pasó y por qué

Lovable no aplica las migraciones del repo en orden; administra su base **cloud** por
su cuenta y **regenera** el árbol del repo desde ese espejo. Cuando regenera, puede
**eliminar archivos que su espejo no conoce** —justo los que Claude Code agrega bajo
`supabase/migrations` y `tests`. El commit del PR sigue en la historia (`git
merge-base --is-ancestor` da verdadero), pero el **árbol** de `main` ya no tiene los
archivos. Por eso `git log --diff-filter=D` no muestra un "delete" normal: no fue un
borrado en un commit, fue una regeneración del árbol.

## Mecanismos de protección (de más a menos efectivo)

1. **Branch protection en `main` (GitHub, lo configura el admin del repo).** Es el
   candado real:
   - Requerir Pull Request para mergear a `main` (prohibir push directo).
   - **Prohibir force-push** a `main`.
   - Requerir revisión de **CODEOWNERS** (ver abajo).
   Con esto, un sync que intente pisar `main` por fuera de un PR queda **bloqueado**.
2. **`.github/CODEOWNERS` (en este repo).** Hace la propiedad **visible y exigible**:
   todo PR que toque rutas de Claude Code requiere la aprobación del dueño humano
   (`@alvarocumora`). No frena un force-push, pero sí un merge por PR sin revisión.
3. **Configuración del sync de Lovable.** En el proyecto de Lovable, **excluir** de su
   regeneración las rutas de Claude Code (`supabase/migrations`, `etl`,
   `packages/reglas`, `tests`, `docs`). El mecanismo exacto (lista de exclusión /
   ignore) debe verificarse en la configuración de Lovable — **no** se asume aquí un
   archivo mágico que no esté confirmado.
4. **Playbook de restauración.** Si un PR de Claude Code mergeado vuelve a
   desaparecer: el contenido sigue en la historia de git; se recrea el archivo y se
   re-PRea (como en el PR #191). Verificación rápida de integridad del backend:

   ```sh
   for f in supabase/migrations/2026072*_*.sql \
            packages/reglas/*.py etl/*.py tests/**/test_*.py; do
     git cat-file -e HEAD:"$f" 2>/dev/null || echo "FALTA EN MAIN: $f"
   done
   ```

## Acciones que NO puede hacer Claude Code desde el repo

Configurar branch protection y el sync de Lovable son ajustes de **plataforma**
(GitHub y Lovable), no archivos del repo. Los debe aplicar el admin (`@alvarocumora`).
Lo que sí vive en el repo —y se entrega aquí— es este documento, el `CODEOWNERS` y los
marcadores `README` en los directorios de Claude Code.
