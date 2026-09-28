import type { Metadata } from "next";
import { AppHeader } from "@/features/shell/app-header";
import { inter, jetbrainsMono, outfit } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Contactos · Kontaktu", template: "%s · Kontaktu" },
  description: "Ficha de contacto del CRM inmobiliario de Kontaktu",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
