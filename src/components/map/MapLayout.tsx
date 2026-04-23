import type { ReactNode } from "react";

/**
 * MapLayout — Sistema de zonas para `/dashboard/map`.
 *
 * Define 5 zonas con z-index y pointer-events controlados, evitando
 * que paneles flotantes se tapen entre sí.
 *
 * Z-index reservados (Leaflet usa 200-700 internamente):
 *  - Mapa (Leaflet)              :   0  – 700  (manejado por Leaflet)
 *  - actionCluster                : 720         (botones flotantes sobre mapa)
 *  - rightDock                    : 740         (dock acordeón derecho)
 *  - leftRail                     : 740         (rail izquierdo de íconos)
 *  - topBar                       : 760         (barra superior)
 *  - bottomBar                    : 760         (barra inferior)
 *  - overlay (drawers, modales)   : 900+
 *
 * Las zonas top/bottom son sticky y no consumen pointer-events fuera de su contenido.
 * El `mapArea` recibe pointer-events siempre (necesario para Leaflet).
 */
export function MapLayout({
  topBar,
  leftRail,
  rightDock,
  bottomBar,
  actionCluster,
  children,
}: {
  topBar?: ReactNode;
  leftRail?: ReactNode;
  rightDock?: ReactNode;
  bottomBar?: ReactNode;
  /** Cluster flotante en esquina sup-der DEL MAPA (no del viewport) */
  actionCluster?: ReactNode;
  /** Mapa en sí (Leaflet, deck.gl, etc.) */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* ── Top bar ─────────────────────────────────────────── */}
      {topBar && (
        <div
          className="relative shrink-0 border-b border-border bg-bg-secondary"
          style={{ zIndex: 760 }}
        >
          {topBar}
        </div>
      )}

      {/* ── Middle band: rail | mapa | dock ─────────────────── */}
      <div className="relative flex-1 min-h-0 flex">
        {/* Left rail (opcional, hueco si no se pasa) */}
        {leftRail && (
          <aside
            className="shrink-0 border-r border-border bg-bg-secondary"
            style={{ zIndex: 740 }}
          >
            {leftRail}
          </aside>
        )}

        {/* Map area — siempre llena el resto */}
        <div className="relative flex-1 min-w-0 min-h-0">
          {children}

          {/* Action cluster flotante DENTRO del área de mapa */}
          {actionCluster && (
            <div
              className="absolute top-3 right-3 pointer-events-none"
              style={{ zIndex: 720 }}
            >
              <div className="pointer-events-auto">{actionCluster}</div>
            </div>
          )}
        </div>

        {/* Right dock */}
        {rightDock && (
          <aside
            className="shrink-0 border-l border-border bg-bg-secondary overflow-hidden"
            style={{ zIndex: 740 }}
          >
            {rightDock}
          </aside>
        )}
      </div>

      {/* ── Bottom bar ──────────────────────────────────────── */}
      {bottomBar && (
        <div
          className="relative shrink-0 border-t border-border bg-bg-secondary"
          style={{ zIndex: 760 }}
        >
          {bottomBar}
        </div>
      )}
    </div>
  );
}
