import "server-only";
import type { NextRequest } from "next/server";
import type { ApiErrorCode, ApiErrorResponse } from "@/lib/api/contracts";
import { config } from "./config";

/** R8: latencia simulada para que los estados de carga de la UI sean reales. */
export function simulateLatency(): Promise<void> {
  return config.apiLatencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, config.apiLatencyMs)) : Promise.resolve();
}

/** `?simular=error` fuerza un 500 para ver el estado de error. Desactivado en producción salvo que se permita. */
export function isFaultInjected(request: NextRequest): boolean {
  return config.allowFaultInjection && request.nextUrl.searchParams.get("simular") === "error";
}

export function apiError(status: number, code: ApiErrorCode, message: string): Response {
  const body: ApiErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
}

export async function handle(request: NextRequest, run: () => Promise<Response>): Promise<Response> {
  await simulateLatency();
  if (isFaultInjected(request)) return apiError(500, "simulated", "Error simulado (?simular=error)");
  try {
    return await run();
  } catch (error) {
    console.error(`[api] ${request.method} ${request.nextUrl.pathname}`, error);
    return apiError(500, "internal", "No se pudieron cargar los datos");
  }
}
