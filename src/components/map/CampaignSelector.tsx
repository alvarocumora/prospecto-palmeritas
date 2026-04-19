import { Calendar } from "lucide-react";
import type { ExplorationCampaign } from "@/hooks/useExplorationCampaigns";
import { PHASE_LABELS } from "@/hooks/useExplorationCampaigns";

interface Props {
  campaigns: ExplorationCampaign[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function CampaignSelector({ campaigns, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
      <Calendar className="w-3 h-3" />
      <span>Campaña:</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-gold"
      >
        <option value="">— Todas —</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {PHASE_LABELS[c.phase] ?? c.phase}
          </option>
        ))}
      </select>
    </label>
  );
}
