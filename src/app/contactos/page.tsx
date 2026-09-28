import type { Metadata } from "next";
import { ContactListView } from "@/features/contact-list/contact-list-view";

export const metadata: Metadata = { title: "Contactos" };

export default function ContactsPage() {
  return <ContactListView />;
}
