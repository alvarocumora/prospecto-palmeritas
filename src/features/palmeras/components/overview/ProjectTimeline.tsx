import { Calendar } from "lucide-react";
import { PALMERAS_PROJECT_PHASES } from "../../data/overview";
import { Badge, Card, SectionTitle } from "../primitives";

type ProjectTimelineProps = {
  className?: string;
};

export function ProjectTimeline({ className = "" }: ProjectTimelineProps) {
  return (
    <Card delay={100} className={`p-6 ${className}`}>
      <SectionTitle icon={Calendar} sub="Programa 12 meses">
        Timeline del Proyecto
      </SectionTitle>
      <ol className="relative border-l border-border ml-2 space-y-5 mt-2">
        {PALMERAS_PROJECT_PHASES.map((phase) => (
          <li key={phase.n} className="pl-6 relative">
            <span
              className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 ${
                phase.active ? "bg-gold border-gold animate-pulse-dot" : "bg-card border-hint"
              }`}
            />
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-mono text-sm">
                <span className={phase.active ? "text-gold" : "text-foreground"}>
                  FASE {phase.n}
                </span>
                <span className="text-hint mx-2">·</span>
                <span className="text-muted-foreground">{phase.range}</span>
              </div>
              {phase.active && <Badge tone="gold">En curso</Badge>}
            </div>
            <div className="text-sm text-foreground mt-1">{phase.title}</div>
            <div className="text-xs text-muted-foreground">{phase.desc}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
