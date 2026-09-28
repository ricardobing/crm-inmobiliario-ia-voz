import { TZDate } from "@date-fns/tz";
import type { DateView } from "./types";

// D06: fechas en formatos mixtos. Nunca se usa `new Date(string)` con formatos no ISO:
// V8 lee "11/07/2026" como 7 de noviembre (MM/DD) y `new Date(1782259200)` como milisegundos (enero de 1970).

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
// Día/mes/año: la organización es española (y 11/07 como 7 de noviembre quedaría después de la exportación).
const DAY_MONTH_YEAR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const DIGITS_ONLY = /^\d{9,13}$/;
// Por debajo de este valor, un epoch numérico está en segundos (1e12 ms ≈ 2001-09-09).
const EPOCH_MS_THRESHOLD = 1e12;

export const UNKNOWN_DATE_LABEL = "Fecha desconocida";

type Parsed = { date: Date; precision: "datetime" | "date"; assumedTimezone: boolean };

export function parseDate(raw: unknown, timeZone: string, locale: string): DateView {
  const rawValue = typeof raw === "string" || typeof raw === "number" ? raw : null;
  const parsed = interpret(raw, timeZone);
  if (!parsed) {
    return { iso: null, precision: "unknown", assumedTimezone: false, display: UNKNOWN_DATE_LABEL, raw: rawValue };
  }
  return {
    iso: parsed.date.toISOString(),
    precision: parsed.precision,
    assumedTimezone: parsed.assumedTimezone,
    display: formatInstant(parsed.date, parsed.precision, timeZone, locale),
    raw: rawValue,
  };
}

function interpret(raw: unknown, timeZone: string): Parsed | null {
  if (typeof raw === "number") return fromEpoch(raw);
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;

  if (DIGITS_ONLY.test(value)) return fromEpoch(Number(value));

  if (ISO_WITH_ZONE.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : { date, precision: "datetime", assumedTimezone: false };
  }

  const iso = ISO_LOCAL.exec(value);
  if (iso) {
    const [, y, m, d, hh, mm, ss] = iso;
    return fromLocalParts(Number(y), Number(m), Number(d), hh, mm, ss, timeZone);
  }

  const dmy = DAY_MONTH_YEAR.exec(value);
  if (dmy) {
    const [, d, m, y, hh, mm, ss] = dmy;
    return fromLocalParts(Number(y), Number(m), Number(d), hh, mm, ss, timeZone);
  }

  return null;
}

function fromEpoch(value: number): Parsed | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const ms = value < EPOCH_MS_THRESHOLD ? value * 1000 : value;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : { date, precision: "datetime", assumedTimezone: false };
}

function fromLocalParts(
  year: number,
  month: number,
  day: number,
  hours: string | undefined,
  minutes: string | undefined,
  seconds: string | undefined,
  timeZone: string,
): Parsed | null {
  const h = hours === undefined ? 0 : Number(hours);
  const min = minutes === undefined ? 0 : Number(minutes);
  const s = seconds === undefined ? 0 : Number(seconds);
  if (month < 1 || month > 12 || day < 1 || h > 23 || min > 59 || s > 59) return null;

  const local = new TZDate(year, month - 1, day, h, min, s, timeZone);
  // Rechaza fechas que el constructor "desborda" (31/02 → 03/03).
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day) return null;

  return {
    date: new Date(local.getTime()),
    precision: hours === undefined ? "date" : "datetime",
    assumedTimezone: true,
  };
}

function formatInstant(date: Date, precision: "datetime" | "date", timeZone: string, locale: string): string {
  const day = new Intl.DateTimeFormat(locale, { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  if (precision === "date") return day;
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} · ${time}`;
}

/** Comparador para ordenar de más reciente a más antiguo; las fechas desconocidas van al final. */
export function compareDateViewsDesc(a: DateView, b: DateView): number {
  if (a.iso === null && b.iso === null) return 0;
  if (a.iso === null) return 1;
  if (b.iso === null) return -1;
  return b.iso.localeCompare(a.iso);
}
