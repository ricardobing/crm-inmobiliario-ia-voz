import type { ContactDetail, ContactSummary } from "@/domain/types";

/** Contrato HTTP entre los route handlers y la UI. */

export type OrganizationDto = { id: string; name: string | null };

export type ContactListResponse = {
  organization: OrganizationDto;
  contacts: ContactSummary[];
  /** D02: contactos de prueba que no se listan. */
  hiddenTestCount: number;
  unreadableCount: number;
};

export type ContactDetailResponse = {
  organization: OrganizationDto;
  contact: ContactDetail;
};

export type ApiErrorCode = "not_found" | "internal" | "simulated";

export type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string };
};
