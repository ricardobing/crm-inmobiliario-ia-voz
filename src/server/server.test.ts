import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEST_CONTEXT } from "@/domain/test-support";
import { loadCatalog } from "./catalog-repository";
import { parseConfig } from "./config";
import { ContactService } from "./contact-service";
import { JsonContactRepository } from "./contacts-repository";

const DATA_DIR = path.join(process.cwd(), "data");
const serviceFor = (organizationId: string | null, dataDir = DATA_DIR) =>
  new ContactService(new JsonContactRepository(dataDir, organizationId), dataDir, TEST_CONTEXT);

function tempDataDir(contactsJson: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "kontaktu-"));
  writeFileSync(path.join(dir, "contactos.json"), JSON.stringify(contactsJson));
  return dir;
}

describe("parseConfig", () => {
  it("valores por defecto sin .env", () => {
    const config = parseConfig({}, "development");
    expect(config.domain).toEqual({ timeZone: "Europe/Madrid", locale: "es-ES", currency: "EUR", phoneRegion: "ES" });
    expect(config.apiLatencyMs).toBe(400);
    expect(config.organizationIdOverride).toBeNull();
    expect(config.allowFaultInjection).toBe(true);
  });

  it("en producción el error simulado está desactivado salvo que se permita", () => {
    expect(parseConfig({}, "production").allowFaultInjection).toBe(false);
    expect(parseConfig({ ALLOW_FAULT_INJECTION: "true" }, "production").allowFaultInjection).toBe(true);
  });

  it("rechaza una zona horaria o una latencia no válidas", () => {
    expect(() => parseConfig({ DISPLAY_TIMEZONE: "Madrid/Centro" })).toThrow();
    expect(() => parseConfig({ API_LATENCY_MS: "-1" })).toThrow();
  });

  it("lee las variables de entorno", () => {
    const config = parseConfig({ KONTAKTU_ORG_ID: "ORG-0047", API_LATENCY_MS: "0", DEFAULT_PHONE_REGION: "ar" });
    expect(config.organizationIdOverride).toBe("ORG-0047");
    expect(config.apiLatencyMs).toBe(0);
    expect(config.domain.phoneRegion).toBe("AR");
  });
});

describe("JsonContactRepository (D01)", () => {
  it("por defecto sirve solo la organización dueña del export", async () => {
    const snapshot = await new JsonContactRepository(DATA_DIR, null).snapshot();
    expect(snapshot.organization).toEqual({ id: "ORG-0031", name: "Miralvento Gestión Inmobiliaria" });
    expect(snapshot.contacts.map((c) => c.id)).not.toEqual(expect.arrayContaining(["c-010"]));
    expect(snapshot.contacts.every((c) => c.organization_id === "ORG-0031")).toBe(true);
    expect(snapshot.contacts).toHaveLength(14);
  });

  it("con otra organización configurada sirve solo esa", async () => {
    const snapshot = await new JsonContactRepository(DATA_DIR, "ORG-0047").snapshot();
    expect(snapshot.contacts.map((c) => c.id)).toEqual(["c-010", "c-011"]);
    expect(snapshot.organization).toEqual({ id: "ORG-0047", name: null });
  });

  it("un contacto sin organization_id no se sirve; uno ilegible se cuenta", async () => {
    const dir = tempDataDir({
      organization: { id: "ORG-1", name: "Test" },
      contacts: [
        { id: "a", organization_id: "ORG-1" },
        { id: "b", organization_id: null },
        { organization_id: "ORG-1" },
      ],
    });
    const snapshot = await new JsonContactRepository(dir, null).snapshot();
    expect(snapshot.contacts.map((c) => c.id)).toEqual(["a"]);
    expect(snapshot.unreadableCount).toBe(1);
  });

  it("sin organización en el export ni en la config, falla con un mensaje claro", async () => {
    const dir = tempDataDir({ contacts: [] });
    await expect(new JsonContactRepository(dir, null).snapshot()).rejects.toThrow(/organización activa/);
  });
});

describe("loadCatalog", () => {
  it("lee el catálogo real", async () => {
    const catalog = await loadCatalog(DATA_DIR);
    expect(catalog.size).toBe(6);
    expect(catalog.get("MIR-2041")).toEqual({ ref: "MIR-2041", title: "Piso con terraza en Majadahonda" });
  });

  it("sin catálogo devuelve vacío y la ficha sigue funcionando", async () => {
    const catalog = await loadCatalog(path.join(tmpdir(), "no-existe-kontaktu"));
    expect(catalog.size).toBe(0);
  });
});

describe("ContactService", () => {
  it("listado: 13 visibles, 1 de prueba oculto, ninguno de otra organización (D01, D02)", async () => {
    const list = await serviceFor(null).list();
    expect(list.contacts).toHaveLength(13);
    expect(list.hiddenTestCount).toBe(1);
    const ids = list.contacts.map((c) => c.id);
    expect(ids).not.toContain("c-014");
    expect(ids).not.toContain("c-010");
    expect(ids).not.toContain("c-011");
  });

  it("detalle: el de prueba se abre por URL marcado como prueba; otra organización → null", async () => {
    const service = serviceFor(null);
    expect((await service.get("c-014"))?.contact.isTest).toBe(true);
    expect(await service.get("c-010")).toBeNull();
    expect(await service.get("no-existe")).toBeNull();
  });

  it("resumen del listado con la última interacción", async () => {
    const list = await serviceFor(null).list();
    const c016 = list.contacts.find((c) => c.id === "c-016");
    expect(c016?.lastInteraction?.channel.label).toBe("WhatsApp");
    expect(c016?.flags.handoff).toBe(true);
    const c012 = list.contacts.find((c) => c.id === "c-012");
    expect(c012?.lastInteraction).toBeNull();
  });
});

describe("ContactService: stories (#10, #2, #4)", () => {
  it("la ficha incluye política, duplicados, propuesta de fusión y siguiente acción", async () => {
    const detail = (await serviceFor(null).get("c-009"))?.contact;
    expect(detail?.policy.call.allowed).toBe(true);
    expect(detail?.duplicates.map((d) => d.id)).toEqual(["c-001"]);
    expect(detail?.mergePreview?.survivorId).toBe("c-001");
    expect(detail?.nextActions[0]?.ruleId).toBe("possible-duplicate");
  });

  it("los flags del listado salen de las reglas", async () => {
    const list = await serviceFor(null).list();
    const flags = Object.fromEntries(list.contacts.map((c) => [c.id, c.flags]));
    expect(flags["c-013"]).toMatchObject({ doNotCall: true });
    expect(flags["c-001"]).toMatchObject({ possibleDuplicate: true });
    expect(flags["c-009"]).toMatchObject({ possibleDuplicate: true });
    expect(flags["c-016"]).toMatchObject({ handoff: true });
    expect(Object.values(flags).filter((f) => f.possibleDuplicate)).toHaveLength(2);
  });
});
