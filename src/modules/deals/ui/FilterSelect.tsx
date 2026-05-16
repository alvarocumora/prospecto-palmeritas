export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  labelMap,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labelMap?: Record<string, string>;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center">
      {icon && (
        <span className="absolute left-2 text-muted-foreground pointer-events-none">{icon}</span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none pr-6 py-1.5 text-xs font-mono rounded border border-border bg-background outline-none focus:border-gold cursor-pointer ${icon ? "pl-7" : "pl-2"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelMap?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}
