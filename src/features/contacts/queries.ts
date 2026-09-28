"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api/client";
import type { ContactDetailResponse, ContactListResponse } from "@/lib/api/contracts";

// R8: la UI siempre pasa por la API; nunca importa el JSON.

export const contactKeys = {
  list: ["contacts"] as const,
  detail: (id: string, simulateError: boolean) => ["contacts", id, { simulateError }] as const,
};

export function useContactList() {
  return useQuery({
    queryKey: contactKeys.list,
    queryFn: () => fetchJson<ContactListResponse>("/api/contacts"),
  });
}

/** `simulateError` reenvía `?simular=error` a la API para poder ver el estado de error. */
export function useContactDetail(id: string, simulateError = false) {
  const query = simulateError ? "?simular=error" : "";
  return useQuery({
    queryKey: contactKeys.detail(id, simulateError),
    queryFn: () => fetchJson<ContactDetailResponse>(`/api/contacts/${encodeURIComponent(id)}${query}`),
  });
}
