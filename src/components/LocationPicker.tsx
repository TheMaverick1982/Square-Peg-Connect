import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

/** Empty array = All locations. */
export function locationSummary(ids: string[]): string {
  if (!ids.length || ids.length === locations.length) return "All locations";
  if (ids.length === 1) return locations.find((l) => l.id === ids[0])?.name ?? "1 location";
  if (ids.length <= 2) return ids.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(", ");
  return `${ids.length} locations`;
}

export function LocationPicker({
  value, onChange, disabled, className,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const isAll = value.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}
          className={`w-full justify-between font-normal bg-background ${className ?? ""}`}>
          <span className="truncate">{locationSummary(value)}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" align="start">
        <DropdownMenuCheckboxItem
          checked={isAll}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onChange([])}
          className="font-medium"
        >
          All locations
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {locations.map((loc) => {
          const checked = !isAll && value.includes(loc.id);
          return (
            <DropdownMenuCheckboxItem
              key={loc.id}
              checked={checked}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) => {
                const next = on ? [...value, loc.id] : value.filter((id) => id !== loc.id);
                // Ticking every store is the same as "All locations".
                onChange(next.length === locations.length ? [] : next);
              }}
            >
              {loc.name}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
