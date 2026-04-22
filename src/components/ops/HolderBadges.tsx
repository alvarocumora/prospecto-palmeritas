import { Paperclip, Newspaper, Scale } from "lucide-react";

type Counts = { files: number; bulletins: number; cases: number };

export function HolderBadges({ counts }: { counts: Counts }) {
  const items: Array<{ icon: typeof Paperclip; n: number; title: string; color: string }> = [
    { icon: Paperclip, n: counts.files, title: "Archivos", color: "text-text-secondary" },
    { icon: Newspaper, n: counts.bulletins, title: "Boletín minero", color: "text-signal-cyan" },
    { icon: Scale, n: counts.cases, title: "Causas PJUD", color: "text-amber-500" },
  ];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px]">
      {items.map((it) => {
        const Icon = it.icon;
        if (it.n === 0) return null;
        return (
          <span key={it.title} title={`${it.title}: ${it.n}`} className={`inline-flex items-center gap-0.5 ${it.color}`}>
            <Icon className="w-3 h-3" /> {it.n}
          </span>
        );
      })}
    </span>
  );
}
