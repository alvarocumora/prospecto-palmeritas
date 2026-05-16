import { AlertTriangle } from "lucide-react";
import { PALMERAS_OPERATIONAL_ALERTS } from "../../data/overview";
import { Card, SectionTitle, SignalDot } from "../primitives";

type OperationalAlertsProps = {
  className?: string;
};

function alertToneToSignal(tone: string) {
  if (tone === "alert") return "alert";
  if (tone === "gold") return "gold";
  return "teal";
}

export function OperationalAlerts({ className = "" }: OperationalAlertsProps) {
  return (
    <Card delay={200} className={`p-6 ${className}`}>
      <SectionTitle icon={AlertTriangle} sub="Acciones requeridas">
        Alertas Operativas
      </SectionTitle>
      <ul className="space-y-2 mt-2">
        {PALMERAS_OPERATIONAL_ALERTS.map((alert, index) => (
          <li
            key={`${alert.level}-${index}`}
            className="flex items-start gap-3 p-3 rounded border border-border bg-bg-secondary card-hover"
          >
            <SignalDot tone={alertToneToSignal(alert.tone)} />
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-widest text-hint">
                {alert.level}
              </div>
              <div className="text-sm text-foreground">{alert.text}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
