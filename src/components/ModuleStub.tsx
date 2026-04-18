import { Construction } from "lucide-react";

export function ModuleStub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-20 md:pb-8">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <div className="rounded border border-dashed border-border p-12 text-center mt-6">
        <Construction className="w-8 h-8 text-gold mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{desc}</p>
        <p className="text-[11px] font-mono text-muted-foreground mt-2">Próximamente.</p>
      </div>
    </div>
  );
}
