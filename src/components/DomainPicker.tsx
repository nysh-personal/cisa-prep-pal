import { DOMAINS } from "@/lib/domains";
import { cn } from "@/lib/utils";

export function DomainPicker({ value, onChange }: { value: number | null; onChange: (d: number | null) => void }) {
  const opts = [{ id: null as number | null, short: "All" }, ...DOMAINS.map((d) => ({ id: d.id as number | null, short: `D${d.id} ${d.short}` }))];
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {opts.map((o) => (
        <button key={String(o.id)} onClick={() => onChange(o.id)}
          className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium", value === o.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
          {o.short}
        </button>
      ))}
    </div>
  );
}
