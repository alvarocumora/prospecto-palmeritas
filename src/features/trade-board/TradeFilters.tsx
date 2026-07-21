// Barra de filtros del tablero. Estado en URL via navigate({ search }).
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BoardSearch = {
  q: string;
  role: "all" | "buyer" | "seller" | "desk";
  commodity: string;
  min: number | null;
  max: number | null;
};

export function TradeFilters({
  search,
  commodities,
  onChange,
  total,
}: {
  search: BoardSearch;
  commodities: string[];
  onChange: (patch: Partial<BoardSearch>) => void;
  total: { filtered: number; all: number };
}) {
  const dirty =
    search.q !== "" ||
    search.role !== "all" ||
    search.commodity !== "all" ||
    search.min != null ||
    search.max != null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Referencia, contraparte, commodity…"
          className="pl-7 h-8 w-64 text-xs"
        />
      </div>
      <Select value={search.role} onValueChange={(v) => onChange({ role: v as BoardSearch["role"] })}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los roles</SelectItem>
          <SelectItem value="buyer">Compra</SelectItem>
          <SelectItem value="seller">Venta</SelectItem>
          <SelectItem value="desk">Desk</SelectItem>
        </SelectContent>
      </Select>
      <Select value={search.commodity} onValueChange={(v) => onChange({ commodity: v })}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los commodities</SelectItem>
          {commodities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        inputMode="numeric"
        value={search.min ?? ""}
        onChange={(e) => onChange({ min: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="USD min"
        className="h-8 w-24 text-xs"
      />
      <Input
        type="number"
        inputMode="numeric"
        value={search.max ?? ""}
        onChange={(e) => onChange({ max: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="USD max"
        className="h-8 w-24 text-xs"
      />
      {dirty && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() =>
            onChange({ q: "", role: "all", commodity: "all", min: null, max: null })
          }
        >
          <X className="w-3 h-3 mr-1" /> Limpiar
        </Button>
      )}
      <div className="text-[10px] font-mono text-muted-foreground ml-auto">
        {total.filtered} / {total.all}
      </div>
    </div>
  );
}
