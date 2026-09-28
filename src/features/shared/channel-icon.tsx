import {
  CircleHelp,
  DatabaseZap,
  FileText,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  UserPlus,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { ChannelKind } from "@/domain/types";

const ICONS: Record<ChannelKind, LucideIcon> = {
  voice: Phone,
  whatsapp: MessageCircle,
  web_form: FileText,
  email: Mail,
  meta_ads: Megaphone,
  import: DatabaseZap,
  manual: UserPlus,
  other: CircleHelp,
  unknown: CircleHelp,
};

export function ChannelIcon({ kind, ...props }: { kind: ChannelKind } & LucideProps) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden="true" {...props} />;
}
