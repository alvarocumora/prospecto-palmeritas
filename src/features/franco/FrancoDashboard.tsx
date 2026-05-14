import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { PalmerasTabId } from "@/features/palmeras/types";
import { FrancoTopNav } from "./components/FrancoTopNav";
import { FrancoTabPlaceholder } from "./components/FrancoTabPlaceholder";
import { FrancoHero } from "./components/FrancoHero";

export function FrancoDashboard() {
  const [active, setActive] = useState<PalmerasTabId>("overview");
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      toast.info("Borrador pre NI 43-101 de Franco aún no tiene datos cargados.");
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FrancoTopNav active={active} setActive={setActive} onExport={handleExport} exporting={exporting} />
      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {active === "overview" ? <FrancoHero /> : null}
        <FrancoTabPlaceholder tab={active} />
      </main>
    </div>
  );
}
