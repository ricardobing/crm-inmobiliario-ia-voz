# Arquitectura y stack


---

## 1. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js** (última estable, App Router) + **React** + **TypeScript `strict`** | Lo pide la spec y es el stack del puesto |
| Estilos | **Tailwind v4** + **shadcn/ui** (solo los componentes necesarios) | Recomendados por la spec. Los tokens de Kontaktu van en `@theme`, en un solo archivo |
| Datos | **JSON en disco servido por route handlers** detrás de un repositorio | R8 lo pide literalmente. Ver §2 |
| Fetch en cliente | **TanStack Query** | Estados de carga y error reales (R5), reintento controlado y caché entre listado y ficha |
| Validación | **zod**, en modo tolerante para la entrada | Un contacto roto no tumba el listado: se lee lo que se puede y se reporta lo que no |
| Teléfonos | **libphonenumber-js** | No reinventar la normalización (D04) |
| Fechas | **date-fns** + **@date-fns/tz** | Parseo de formatos mixtos e interpretación en `Europe/Madrid` (D06) |
| Iconos | **lucide-react** (viene con shadcn) | — |
| Tests | **Vitest** para el dominio (funciones puras) | Rápido. Verifica cada decisión con los datos reales |
| Tipos/lint | `tsc --noEmit` + ESLint de Next | — |
| Gestor | **pnpm** | Ya instalado (10.18) |
| Deploy (opcional) | **Vercel** | El plan free sobra, según la spec |
| Voz (bonus) | **LiveKit Agents (Python) + uv**, en una carpeta aparte (`voice-agent/`) | Ver `voice-agent/README.md` |

**Sin librerías extra "por si acaso".** Cada dependencia tiene que responder a una decisión de `docs/decisiones.md`.

## 2. ¿Base de datos local o solo JSON?

**Solo JSON, detrás de una interfaz de repositorio.**

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| JSON + route handler | Es lo que pide R8; quien evalúa lo corre con `pnpm dev` sin instalar nada; cabe en 2 h | No persiste ediciones | **Elegida** |
| SQLite / Postgres local (Docker) | Muestra SQL | Setup para quien evalúa, migraciones, seed, tiempo que no va a la ficha, y la spec no lo pide | Descartada |
| Supabase | Stack del puesto | Cuenta, claves, red, y lo mismo que arriba | Descartada |

**Cómo se deja preparado:** `ContactRepository` es una interfaz con una implementación `JsonContactRepository`. Pasar a
Postgres es escribir `PgContactRepository` y cambiar una línea de wiring.

En el README, "con un día más": Postgres con los hechos en JSONB, una tabla `fact_history` para auditar ediciones
manuales (necesaria para la story #5) y RLS por `organization_id`.

## 3. Flujo de datos

```
data/contactos.json
      │  (fs, solo en servidor)
      ▼
server/contacts-repository.ts   ← filtra por organización (D01) y lee de forma tolerante (zod)
      │
      ▼
server/contact-service.ts       ← compone: normalizar + duplicados + política + siguiente acción
      │   (usa domain/*, que son funciones puras)
      ▼
app/api/contacts/route.ts            GET  → ContactSummary[]  (+ recuento de ocultos)
app/api/contacts/[id]/route.ts       GET  → ContactDetail | 404
      │   (latencia simulada por env; fallo forzado con ?simular=error, solo si está permitido)
      ▼
features/*/hooks (TanStack Query)
      │
      ▼
features/*/components           ← solo pintan; sin lógica de negocio ni normalización
```

**Regla:** la UI nunca ve el dato crudo "a pelo". Recibe un DTO normalizado que conserva el `raw` donde hace falta
mostrarlo (tooltips y avisos).

**Alternativa considerada:** Server Components con `loading.tsx` llamando al servicio directamente. Es idiomático, pero
la spec pide que el JSON "se sirva como una API"; con fetch en cliente al route handler, el contrato HTTP es explícito y
los estados son reales.

## 4. Estructura de carpetas

```
kontaktu-ficha-contactos/
├── CLAUDE.md                     reglas para la IA
├── README.md
├── .env.example
├── data/
│   ├── contactos.json            copia sin tocar del adjunto
│   └── kb-propiedades-voz.json   fuente única: la usan la web y el agente de voz
├── docs/
│   ├── decisiones.md             D01–D25
│   ├── arquitectura.md           este documento
│   ├── bitacora-ia.md            qué se le pidió a la IA y dónde falló
│   └── capturas/                 verificación visual
├── scripts/
│   └── inspect-data.ts           tabla crudo → normalizado, para revisarla a ojo
├── src/
│   ├── app/
│   │   ├── layout.tsx            fuentes (next/font) + providers
│   │   ├── globals.css           tokens Kontaktu (@theme)
│   │   ├── page.tsx              redirige a /contactos
│   │   ├── contactos/page.tsx
│   │   ├── contactos/[id]/page.tsx
│   │   └── api/contacts/{route.ts, [id]/route.ts}
│   ├── server/                   solo servidor (`import 'server-only'`)
│   │   ├── config.ts             env validado con zod y valores por defecto
│   │   ├── contacts-repository.ts
│   │   ├── catalog-repository.ts
│   │   └── contact-service.ts
│   ├── domain/                   puro: sin React, sin Next, sin fs → 100 % testeable
│   │   ├── types.ts              DTOs y uniones discriminadas
│   │   ├── raw-schema.ts         zod tolerante para la entrada
│   │   ├── dates.ts              D06
│   │   ├── phones.ts             D04
│   │   ├── names.ts              D03
│   │   ├── email.ts              D05
│   │   ├── channels.ts           D07 (catálogo de alias)
│   │   ├── qualification/
│   │   │   ├── parse.ts          D08–D10, D15, D16
│   │   │   ├── labels.ts         D11 (diccionario + humanizar)
│   │   │   ├── values.ts         D12 (tipo de valor)
│   │   │   └── precedence.ts     D14
│   │   ├── timeline.ts           D17
│   │   ├── compliance.ts         D20, D21 (#10)
│   │   ├── duplicates.ts         D22 (#2) + propuesta de fusión
│   │   ├── next-action/          D23 (#4)
│   │   │   ├── rules.ts          lista de reglas (datos + función)
│   │   │   └── engine.ts
│   │   └── normalize-contact.ts  crudo → vista
│   ├── features/
│   │   ├── contact-list/         componentes + hook del listado
│   │   └── contact-detail/       cabecera, cualificación, timeline, cumplimiento, duplicados, acción, estados
│   ├── components/ui/            shadcn
│   └── lib/                      cn(), cliente HTTP, formateadores de UI
└── voice-agent/                  bonus (Python, independiente)
```

Los tests van junto al código: `src/domain/**/*.test.ts`, más `src/domain/dataset.contract.test.ts`, que normaliza el
dataset real completo.

## 5. Modelo de dominio (tipos clave)

```ts
// Fechas: conservar crudo y precisión (D06)
type DateView = {
  iso: string | null;              // instante en UTC, o null si es ilegible
  precision: 'datetime' | 'date' | 'unknown';
  assumedTimezone: boolean;        // true si venía sin zona y se asumió Europe/Madrid
  raw: string | number | null;
};

type PhoneView = { raw: string; e164: string | null; display: string; valid: boolean };
type EmailView = { raw: string; valid: boolean };

type ChannelKind = 'voice' | 'whatsapp' | 'web_form' | 'email' | 'meta_ads' | 'import' | 'manual' | 'other' | 'unknown';
type ChannelView = { kind: ChannelKind; label: string; system?: string; raw: string | null };

type DisplayName = { text: string; basis: 'name' | 'phone' | 'email' | 'none'; raw: string | null; initials: string | null };

// Cualificación (R3): el render depende del TIPO del valor, no de la clave
type FactValue =
  | { type: 'text'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'list'; items: string[] }
  | { type: 'range'; min?: number; max?: number }
  | { type: 'object'; entries: [string, FactValue][] }
  | { type: 'empty' };

type Provenance =
  | { kind: 'human' }                         // source: manual → manda
  | { kind: 'conversation'; ref: string }     // explicit + conv-*
  | { kind: 'import'; system: string }        // explicit + import-*
  | { kind: 'declared'; detail: string }      // campos planos antiguos (D15)
  | { kind: 'legacy_preferences' }            // D16
  | { kind: 'unknown'; raw: string | null };

type Fact = {
  key: string; label: string; labelIsFallback: boolean;
  value: FactValue; format?: 'money' | 'money_monthly';   // pista, nunca requisito
  provenance: Provenance; confidence?: 'high' | 'medium' | 'low'; verified?: boolean;
  updatedAt: DateView;
};
type FactGroup = { id: string; label: string; facts: Fact[] };
type QualificationView =
  | { status: 'empty' }
  | { status: 'unreadable'; raw: string }
  | { status: 'ok'; groups: FactGroup[]; lastSyncedAt?: DateView; lastSource?: string };

type TimelineItem = {
  id: string; channel: ChannelView; direction: 'inbound' | 'outbound' | 'unknown'; at: DateView;
  content: string | null;
  call?: { durationSec?: number; audioUrl?: string; transcript?: { speaker: string | null; text: string }[] };
  propertyRef?: { ref: string; title?: string };
  extra: [string, string][];                  // metadata desconocida (D17)
};

type ContactPolicy = {
  call: Permission; whatsapp: Permission; email: Permission; aiAutomation: Permission;
  consent: 'registered' | 'not_recorded';
};
type Permission = { allowed: boolean; reasons: string[] };

type DuplicateCandidate = { id: string; displayName: string; confidence: 'high' | 'medium'; reasons: string[] };
type MergePreview = { survivorId: string; fields: { field: string; value: string; fromId: string; rule: string }[] };

type NextAction = {
  ruleId: string; priority: number; title: string; reason: string;
  channel: 'call' | 'whatsapp' | 'email' | 'none';
};

type ContactSummary = {
  id: string; name: DisplayName; phone: PhoneView | null; source: ChannelView;
  lastInteraction: { at: DateView; channel: ChannelView; preview: string } | null;
  flags: { handoff: boolean; doNotCall: boolean; possibleDuplicate: boolean };
};
type ContactDetail = ContactSummary & {
  email: EmailView | null; createdAt: DateView; contactType: string | null; assignedAgentId: string | null;
  tags: string[]; notes: string[]; isTest: boolean;
  handoff: { reason: string | null; requestedAt: DateView } | null;
  qualification: QualificationView; timeline: TimelineItem[];
  policy: ContactPolicy; duplicates: DuplicateCandidate[]; mergePreview: MergePreview | null;
  nextActions: NextAction[];
};
```

## 6. Reglas anti-hardcode

1. **Ningún id de contacto en el código de producción.** Solo en tests y fixtures.
2. **Catálogos como datos, con fallback.** Alias de canal, etiquetas de claves, nombres de grupos, tags de "no llamar" y
   partículas de nombres son tablas en su módulo. Cada lookup tiene rama "desconocido" que pinta algo digno.
3. **La UI no ramifica por claves concretas de cualificación.** Pinta según `FactValue.type`. El diccionario de
   etiquetas y formatos mejora el resultado; si no existiera, todo seguiría viéndose.
4. **Configuración por entorno**, validada con zod y con valores por defecto: `KONTAKTU_ORG_ID` (por defecto, la
   organización del export), `DEFAULT_PHONE_REGION=ES`, `DISPLAY_TIMEZONE=Europe/Madrid`, `LOCALE=es-ES`,
   `API_LATENCY_MS=400`, `ALLOW_FAULT_INJECTION=true` (false en producción).
5. **Reglas de siguiente acción como lista de objetos** `{ id, priority, applies(ctx), build(ctx) }`. Añadir una regla =
   añadir un objeto con su test. No un `if/else` gigante.
6. **Textos de UI centralizados por feature** (constantes), no desperdigados.
7. **Fechas siempre formateadas con `timeZone` explícita.** Nunca `toLocaleString()` sin zona.

## 7. Diseño: tokens

Kontaktu confirmó que la guía de diseño no se adjunta a propósito y que su web es una buena referencia.

- **Base:** shadcn/ui (Radix), reestilado con tokens de marca.
- **Dónde viven:** todos los valores están en `src/app/globals.css` (variables CSS + `@theme`). Los componentes solo
  usan clases semánticas (`bg-card`, `text-muted-foreground`, `bg-brand-soft`…), nunca colores sueltos.
- **Cambiar de diseño** = editar ese archivo.

Valores, sacados de kontaktuai.com el 28/09/2026:

| Token | Valor | De dónde sale |
|---|---|---|
| `--k-bg` | `#FAFAF7` | Fondo de página |
| `--k-surface` | `#FFFFFF` | Tarjetas |
| `--k-surface-2` | `#F4F4EE` | Secciones alternas |
| `--k-ink` | `#0A0A0A` | Texto y botón primario |
| `--k-ink-muted` | `rgb(10 10 10 / .55)` | Texto secundario |
| `--k-border` | `rgb(0 0 0 / .05–.08)` | Borde de tarjeta, 1px |
| `--k-accent` | `#FF6B00` | Naranja de marca |
| `--k-accent-strong` | `#E25C00` | Texto naranja sobre fondo claro (chips) |
| `--k-accent-soft` | `#FF6B00` al 10 % y borde al 15 % | Fondo de chip |
| `--k-slate` | `#94A3B8` | Etiqueta de canal secundaria |
| Radios | tarjeta 12px · panel 20px · botones y chips en píldora | — |
| Fuentes | **Outfit** (titulares, 600) · **Inter** (texto) · **JetBrains Mono** (ids y rutas) | — |
| Eyebrow | Outfit 10.5px, 600, mayúsculas, tracking ~0.18em, naranja | Etiquetas de sección |
| Chip | Inter 10.5–12px, 600, `accent-strong` sobre `accent-soft`, píldora | Etiquetas |
| Etiqueta de canal | Inter 8.5–10px, 700, mayúsculas, tracking 0.05em | Tarjetas del pipeline |

Colores de estado (éxito, aviso, peligro): la web no los define. Hasta tener la guía, verde/ámbar/rojo sobrios, **siempre
con icono y texto** (nunca el color solo, por accesibilidad).

## 8. Layout de la ficha

```
← Contactos
┌──────────────────────────── Cabecera (R2) ───────────────────────────────┐
│ [Avatar] Nombre (fallback)                   [Llamar] [WhatsApp] [Email] │ ← botones según política (#10)
│ Origen · Tipo · Compra/Alquiler · tags                                   │
│ +34 … · email (⚠ si no es válido) · Alta 08/07/2026 · Asignado: …        │
└──────────────────────────────────────────────────────────────────────────┘
[Banner] handoff (rojo) / no llamar (rojo) / duplicado (ámbar) / prueba (neutro), solo si aplica
┌──────── Principal (2/3) ─────────┐ ┌──── Lateral (1/3) ─────────┐
│ Cualificación (R3), por grupos    │ │ Siguiente mejor acción (#4) │
│ Timeline (R4)                     │ │ Posibles duplicados (#2)    │
│                                   │ │ Cumplimiento (#10)          │
│                                   │ │ Notas                       │
└───────────────────────────────────┘ └─────────────────────────────┘
```

En móvil va en una sola columna, con la siguiente acción arriba.
