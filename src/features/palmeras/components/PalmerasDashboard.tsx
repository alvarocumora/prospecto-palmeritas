import { useCallback, useState } from "react";
import { toast } from "sonner";
import { OverviewTab } from "./OverviewTab";
import { PalmerasTabPlaceholder } from "./PalmerasTabPlaceholder";
import { PalmerasTopNav } from "./PalmerasTopNav";
import type { PalmerasTabId } from "../types";

export function PalmerasDashboard() {
  const [active, setActive] = useState<PalmerasTabId>("overview");
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { exportPalmerasPdf } = await import("./report/exportPalmerasPdf");
      await exportPalmerasPdf();
    } catch (error) {
      console.error("Failed to export Palmeras PDF", error);
      toast.error("No se pudo generar el PDF del prospecto");
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PalmerasTopNav
        active={active}
        setActive={setActive}
        onExport={handleExport}
        exporting={exporting}
      />
      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
        {active === "overview" ? <OverviewTab /> : <PalmerasTabPlaceholder tab={active} />}
      </main>
    </div>
  );
}
