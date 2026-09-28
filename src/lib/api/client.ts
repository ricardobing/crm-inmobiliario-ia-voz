import type { ApiErrorCode, ApiErrorResponse } from "./contracts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "network",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(0, "network", "No hay conexión con el servidor");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(response.status, body?.error.code ?? "internal", body?.error.message ?? `Error ${response.status}`);
  }
  return (await response.json()) as T;
}
