import type { NextRequest } from "next/server";
import { contactService } from "@/server/contact-service";
import { apiError, handle } from "@/server/http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/contacts/[id]">) {
  return handle(request, async () => {
    const { id } = await ctx.params;
    const result = await contactService.get(id);
    // D01: un id de otra organización responde igual que uno inexistente (404, no 403).
    if (!result) return apiError(404, "not_found", "Contacto no encontrado");
    return Response.json(result);
  });
}
