import type { NextRequest } from "next/server";
import { contactService } from "@/server/contact-service";
import { handle } from "@/server/http";

export async function GET(request: NextRequest) {
  return handle(request, async () => Response.json(await contactService.list()));
}
