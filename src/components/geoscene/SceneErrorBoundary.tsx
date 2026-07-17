import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * ErrorBoundary para visores 3D embebidos: un crash del canvas (geometría
 * malformada, WebGL, datos de un proyecto incompleto) muestra un fallback
 * inline en vez de tumbar la página completa del dashboard.
 */
export class SceneErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SceneErrorBoundary] visor 3D falló:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full min-h-[200px] flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
            <div className="text-sm text-foreground">
              {this.props.label ?? "Visor 3D"} no disponible para este proyecto
            </div>
            <div className="text-[10px] font-mono text-muted-foreground break-words">
              {this.state.error.message}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
