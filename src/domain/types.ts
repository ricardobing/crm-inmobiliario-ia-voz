/**
 * Tipos de vista que produce el dominio y que sirve la API.
 * El dato crudo nunca se modifica: cada vista conserva `raw` donde hace falta explicarlo en la UI.
 */

export type DateView = {
  /** Instante en UTC; null si no se pudo interpretar. */
  iso: string | null;
  precision: "datetime" | "date" | "unknown";
  /** true si el valor venía sin zona horaria y se asumió la de la organización (D06). */
  assumedTimezone: boolean;
  /** Texto listo para mostrar, ya en la zona horaria de la organización. */
  display: string;
  raw: string | number | null;
};

export type PhoneView = {
  raw: string;
  /** E.164 (+34612889034) para enlaces y comparación; null si no es válido. */
  e164: string | null;
  display: string;
  valid: boolean;
};

export type EmailView = {
  raw: string;
  valid: boolean;
};

export type ChannelKind =
  | "voice"
  | "whatsapp"
  | "web_form"
  | "email"
  | "meta_ads"
  | "import"
  | "manual"
  | "other"
  | "unknown";

export type ChannelView = {
  kind: ChannelKind;
  label: string;
  raw: string | null;
};

export type DisplayName = {
  text: string;
  /** De dónde sale el nombre mostrado (D03). */
  basis: "name" | "phone" | "email" | "none";
  raw: string | null;
  initials: string | null;
};

export type FactValue =
  | { type: "text"; value: string; display: string }
  | { type: "number"; value: number; display: string }
  | { type: "boolean"; value: boolean; display: string }
  | { type: "list"; items: string[]; display: string }
  | { type: "range"; min?: number; max?: number; display: string }
  | { type: "object"; entries: { key: string; label: string; value: FactValue }[]; display: string }
  | { type: "empty"; display: string };

export type Provenance =
  | { kind: "human"; label: string }
  | { kind: "conversation"; label: string; ref: string | null }
  | { kind: "import"; label: string; system: string }
  | { kind: "declared"; label: string; detail: string | null }
  | { kind: "legacy_preferences"; label: string }
  | { kind: "unknown"; label: string; raw: string | null };

export type Confidence = "high" | "medium" | "low";

export type Fact = {
  key: string;
  label: string;
  /** true si la etiqueta no está en el diccionario y se generó a partir de la clave (D11). */
  labelIsFallback: boolean;
  value: FactValue;
  provenance: Provenance;
  confidence: Confidence | null;
  /** Solo para datos que admiten verificación (p. ej., ingresos declarados). */
  verified: boolean | null;
  updatedAt: DateView;
};

export type FactGroup = {
  id: string;
  label: string;
  facts: Fact[];
};

export type OperationKind = "sale" | "rental";

export type QualificationView =
  | { status: "empty" }
  | { status: "unreadable"; raw: string }
  | {
      status: "ok";
      groups: FactGroup[];
      /** Cómo venía `qualification_data` en origen (D08). */
      sourceFormat: "object" | "json_string" | "legacy_preferences";
      lastSyncedAt: DateView | null;
      lastSource: string | null;
    };

export type TranscriptTurn = { speaker: string | null; text: string };

export type TimelineItem = {
  id: string;
  channel: ChannelView;
  direction: "inbound" | "outbound" | "unknown";
  at: DateView;
  content: string | null;
  call: {
    durationSec: number | null;
    audioUrl: string | null;
    transcript: TranscriptTurn[] | null;
  } | null;
  propertyRef: { ref: string; title: string | null } | null;
  /** Metadata sin tratamiento específico, como pares etiqueta/valor (D17). */
  extra: { label: string; value: string }[];
};

export type ContactTypeView = { raw: string; label: string } | null;

export type HandoffView = {
  reason: string | null;
  requestedAt: DateView;
};

/** Contacto normalizado: todo lo que sale del dato, sin reglas de negocio encima. */
export type ContactCore = {
  id: string;
  organizationId: string | null;
  name: DisplayName;
  phone: PhoneView | null;
  email: EmailView | null;
  source: ChannelView;
  contactType: ContactTypeView;
  createdAt: DateView;
  isTest: boolean;
  assignedAgentId: string | null;
  matchingEnabled: boolean | null;
  tags: string[];
  notes: string[];
  handoff: HandoffView | null;
  qualification: QualificationView;
  operations: { kind: OperationKind; label: string }[];
  timeline: TimelineItem[];
  /** Interacciones que no se pudieron leer y se omitieron. */
  skippedInteractions: number;
};

export type Permission = { allowed: boolean; reasons: string[] };

export type ContactPolicy = {
  call: Permission;
  whatsapp: Permission;
  email: Permission;
  /** Si la IA puede seguir atendiendo de forma automática (D21). */
  aiAutomation: Permission;
  consent: "registered" | "not_recorded";
  doNotCall: boolean;
};

export type DuplicateCandidate = {
  id: string;
  displayName: string;
  confidence: "high" | "medium";
  reasons: string[];
};

export type MergeField = {
  field: string;
  value: string;
  fromId: string | null;
  rule: string;
};

export type MergePreview = {
  survivorId: string;
  mergedId: string;
  fields: MergeField[];
};

export type ActionChannel = "call" | "whatsapp" | "email" | "none";

export type NextAction = {
  ruleId: string;
  priority: number;
  title: string;
  reason: string;
  channel: ActionChannel;
};

export type ContactDetail = ContactCore & {
  policy: ContactPolicy;
  duplicates: DuplicateCandidate[];
  mergePreview: MergePreview | null;
  nextActions: NextAction[];
};

export type ContactSummary = {
  id: string;
  name: DisplayName;
  phone: PhoneView | null;
  source: ChannelView;
  createdAt: DateView;
  lastInteraction: {
    at: DateView;
    channel: ChannelView;
    direction: TimelineItem["direction"];
    preview: string | null;
  } | null;
  flags: {
    handoff: boolean;
    doNotCall: boolean;
    possibleDuplicate: boolean;
  };
};

/** Configuración de la organización que necesita el dominio. Viene de src/server/config.ts. */
export type DomainContext = {
  timeZone: string;
  locale: string;
  currency: string;
  phoneRegion: string;
};

export type CatalogProperty = {
  ref: string;
  title: string;
};
