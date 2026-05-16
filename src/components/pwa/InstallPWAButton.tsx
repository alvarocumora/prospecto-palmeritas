import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPWAButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    setIsIOS(iOS);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari proprietary flag
      window.navigator.standalone === true;
    setInstalled(standalone);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("App instalada");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function onClick() {
    if (isIOS && !deferred) {
      toast.info("En iPhone: toca 'Compartir' y luego 'Agregar a inicio'", { duration: 7000 });
      return;
    }
    if (!deferred) {
      toast.info("La instalación estará disponible al visitar el sitio publicado");
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") toast.success("Instalando…");
    setDeferred(null);
  }

  // On Android/desktop Chrome we only show when prompt available.
  // On iOS we always show the share-to-install tooltip.
  if (!deferred && !isIOS) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-mono rounded border border-sky-500/40 text-sky-300 bg-sky-500/5 hover:bg-sky-500/10 inline-flex items-center gap-1.5 ${className}`}
      title="Instala Geocapitals como app para usar en terreno"
    >
      {isIOS ? <Smartphone className="w-3 h-3" /> : <Download className="w-3 h-3" />}
      Instalar app
    </button>
  );
}
