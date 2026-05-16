import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIos(ios);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (isIos) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIosHint((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background/80 backdrop-blur text-[11px] font-mono text-foreground hover:bg-accent"
        >
          <Smartphone className="w-3.5 h-3.5 text-gold" />
          Instalar app
        </button>
        {showIosHint && (
          <div className="absolute top-12 right-3 z-[1100] max-w-[260px] p-3 rounded-md border border-border bg-bg-panel/95 backdrop-blur shadow-lg text-[11px] font-mono text-foreground">
            En Safari: toca <strong>Compartir</strong> ⬆️ y luego{" "}
            <strong>Añadir a pantalla de inicio</strong>.
            <button
              onClick={() => setShowIosHint(false)}
              className="block mt-2 text-gold underline text-[10px]"
            >
              Entendido
            </button>
          </div>
        )}
      </>
    );
  }

  if (!deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
        setDeferred(null);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gold bg-gold/15 text-[11px] font-mono text-gold hover:bg-gold/25"
    >
      <Download className="w-3.5 h-3.5" />
      Instalar app
    </button>
  );
}
