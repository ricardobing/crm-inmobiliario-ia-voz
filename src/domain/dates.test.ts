import { describe, expect, it } from "vitest";
import { compareDateViewsDesc, parseDate, UNKNOWN_DATE_LABEL } from "./dates";

const TZ = "Europe/Madrid";
const LOCALE = "es-ES";
const parse = (raw: unknown) => parseDate(raw, TZ, LOCALE);

describe("parseDate (D06)", () => {
  it("ISO con Z se muestra en hora de Madrid (CEST, +2 en julio)", () => {
    const view = parse("2026-07-08T10:28:00Z");
    expect(view.iso).toBe("2026-07-08T10:28:00.000Z");
    expect(view.display).toBe("08/07/2026 · 12:28");
    expect(view.precision).toBe("datetime");
    expect(view.assumedTimezone).toBe(false);
  });

  it("DD/MM/AAAA es día/mes, no mes/día: 11/07/2026 es 11 de julio (c-005)", () => {
    const view = parse("11/07/2026");
    expect(view.display).toBe("11/07/2026");
    expect(view.precision).toBe("date");
    expect(view.assumedTimezone).toBe(true);
    // Medianoche en Madrid = 22:00 UTC del día anterior.
    expect(view.iso).toBe("2026-07-10T22:00:00.000Z");
  });

  it("DD/MM/AAAA HH:mm sin zona se interpreta en Madrid (c-005, c-015)", () => {
    const view = parse("11/07/2026 18:42");
    expect(view.iso).toBe("2026-07-11T16:42:00.000Z");
    expect(view.display).toBe("11/07/2026 · 18:42");
    expect(view.assumedTimezone).toBe(true);
  });

  it("epoch numérico en segundos, no milisegundos (c-012)", () => {
    const view = parse(1782259200);
    expect(view.iso).toBe("2026-06-24T00:00:00.000Z");
    expect(view.display).toBe("24/06/2026 · 02:00");
  });

  it("epoch en milisegundos también se acepta", () => {
    expect(parse(1782259200000).iso).toBe("2026-06-24T00:00:00.000Z");
  });

  it("valores ilegibles no rompen: fecha desconocida", () => {
    for (const raw of [null, undefined, "", "ayer", "31/02/2026", "2026-13-01", {}, -5]) {
      const view = parse(raw);
      expect(view.iso).toBeNull();
      expect(view.precision).toBe("unknown");
      expect(view.display).toBe(UNKNOWN_DATE_LABEL);
    }
  });

  it("conserva el valor crudo", () => {
    expect(parse("05/07/2026").raw).toBe("05/07/2026");
    expect(parse(1782259200).raw).toBe(1782259200);
  });
});

describe("compareDateViewsDesc", () => {
  it("ordena de más reciente a más antiguo y deja las desconocidas al final, aunque mezcle formatos", () => {
    const dates = [parse("10/07/2026 18:42"), parse("ayer"), parse("2026-07-13T19:22:00Z"), parse(1782259200)];
    const sorted = [...dates].sort(compareDateViewsDesc).map((d) => d.display);
    expect(sorted).toEqual(["13/07/2026 · 21:22", "10/07/2026 · 18:42", "24/06/2026 · 02:00", UNKNOWN_DATE_LABEL]);
  });
});
