import { cn } from "cn";
import { Mail, Phone, User } from "lucide-react";
import type { DisplayName } from "@/domain/types";

const SIZES = {
  sm: "size-9 text-xs [&_svg]:size-4",
  lg: "size-14 text-lg [&_svg]:size-6",
} as const;

/** R2: iniciales si hay nombre; si no, el icono de cómo lo identificamos (teléfono o email), nunca un "?". */
export function ContactAvatar({ name, size = "sm" }: { name: DisplayName; size?: keyof typeof SIZES }) {
  const Fallback = name.basis === "phone" ? Phone : name.basis === "email" ? Mail : User;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-heading font-semibold",
        name.initials ? "bg-brand-soft text-brand-ink" : "bg-muted text-muted-foreground",
        SIZES[size],
      )}
    >
      {name.initials ?? <Fallback />}
    </span>
  );
}
