import { Check, X } from "lucide-react";
import type { FactValue } from "@/domain/types";

/** D12: el valor se pinta según su tipo real. El texto llega ya formateado por el dominio. */
export function FactValueView({ value }: { value: FactValue }) {
  switch (value.type) {
    case "list":
      return (
        <ul className="flex flex-wrap gap-1.5" aria-label="Valores">
          {value.items.map((item, i) => (
            <li key={`${item}-${i}`} className="rounded-full bg-muted px-2.5 py-0.5 text-sm">
              {item}
            </li>
          ))}
        </ul>
      );
    case "boolean":
      return (
        <span className="inline-flex items-center gap-1.5 font-medium">
          {value.value ? (
            <Check aria-hidden="true" className="size-4 text-success" />
          ) : (
            <X aria-hidden="true" className="size-4 text-muted-foreground" />
          )}
          {value.display}
        </span>
      );
    case "object":
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {value.entries.map((entry) => (
            <div key={entry.key} className="contents">
              <dt className="text-muted-foreground">{entry.label}</dt>
              <dd>
                <FactValueView value={entry.value} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "empty":
      return <span className="text-muted-foreground italic">{value.display}</span>;
    default:
      return <span className="font-medium tabular-nums break-words">{value.display}</span>;
  }
}
