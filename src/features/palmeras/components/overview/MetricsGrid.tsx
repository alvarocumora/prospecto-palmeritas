import { PALMERAS_OVERVIEW_METRICS } from "../../data/overview";
import { Card } from "../primitives";

type MetricsGridProps = {
  className?: string;
};

export function MetricsGrid({ className = "" }: MetricsGridProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 ${className}`}>
      {PALMERAS_OVERVIEW_METRICS.map((metric, index) => (
        <Card key={metric.label} delay={index * 100} className="p-4" accent="gold">
          <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-2">
            {metric.label}
          </div>
          <div className="font-mono text-2xl text-foreground font-semibold">{metric.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{metric.sub}</div>
        </Card>
      ))}
    </div>
  );
}
