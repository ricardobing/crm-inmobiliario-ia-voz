import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import type { ApiErrorResponse, ContactDetailResponse, ContactListResponse } from "@/lib/api/contracts";
import { GET as getContact } from "./[id]/route";
import { GET as listContacts } from "./route";

const request = (url: string) => new NextRequest(new URL(url, "http://localhost"));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as RouteContext<"/api/contacts/[id]">;

describe("GET /api/contacts", () => {
  it("200 con el listado de la organización", async () => {
    const response = await listContacts(request("/api/contacts"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ContactListResponse;
    expect(body.organization.id).toBe("ORG-0031");
    expect(body.contacts).toHaveLength(13);
    expect(body.hiddenTestCount).toBe(1);
  });

  it("500 con ?simular=error", async () => {
    const response = await listContacts(request("/api/contacts?simular=error"));
    expect(response.status).toBe(500);
    expect(((await response.json()) as ApiErrorResponse).error.code).toBe("simulated");
  });
});

describe("GET /api/contacts/[id]", () => {
  it("200 con la ficha", async () => {
    const response = await getContact(request("/api/contacts/c-001"), ctx("c-001"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ContactDetailResponse;
    expect(body.contact.name.text).toBe("Carmen Ruiz Delgado");
  });

  it("otra organización e inexistente responden igual: 404 con el mismo cuerpo (D01)", async () => {
    const other = await getContact(request("/api/contacts/c-010"), ctx("c-010"));
    const missing = await getContact(request("/api/contacts/c-999"), ctx("c-999"));
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await other.json()).toEqual(await missing.json());
  });

  it("500 con ?simular=error", async () => {
    const response = await getContact(request("/api/contacts/c-001?simular=error"), ctx("c-001"));
    expect(response.status).toBe(500);
  });
});
