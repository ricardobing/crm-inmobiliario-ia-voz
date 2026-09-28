import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import type { PhoneView } from "./types";

// D04: la región por defecto sale de la organización (config), no del código.
export function normalizePhone(raw: unknown, defaultRegion: string): PhoneView | null {
  const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;

  const parsed = parsePhoneNumberFromString(value, defaultRegion as CountryCode);
  if (parsed?.isValid()) {
    return { raw: value, e164: parsed.number, display: parsed.formatInternational(), valid: true };
  }
  return { raw: value, e164: null, display: value, valid: false };
}

/** Número para https://wa.me/<número>: E.164 sin el "+". */
export function toWhatsAppNumber(phone: PhoneView): string | null {
  return phone.e164 ? phone.e164.replace(/^\+/, "") : null;
}
