/** Heurística compartida: ¿este error viene de un chunk/módulo lazy que ya no existe
 * (deploy nuevo invalidó el manifest viejo)? Usada tanto por el error boundary raíz del
 * router (que hace el auto-reload) como por boundaries internos que deben dejarlo pasar
 * en vez de atraparlo, porque React cachea la promesa rechazada del import() y un
 * "Reintentar" local jamás vuelve a pedir el chunk. */
export function isChunkLoadError(error: Error | null | undefined): boolean {
  const msg = (error?.message || "").toLowerCase();
  const name = (error?.name || "").toLowerCase();
  return (
    msg.includes("importing a module script failed") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    name === "chunkloaderror"
  );
}
