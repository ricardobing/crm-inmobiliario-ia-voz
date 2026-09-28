import type { Metadata } from "next";
import { ContactDetailView } from "@/features/contact-detail/contact-detail-view";

export const metadata: Metadata = { title: "Ficha de contacto" };

export default async function ContactPage(props: PageProps<"/contactos/[id]">) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  return <ContactDetailView id={id} simulateError={searchParams.simular === "error"} />;
}
