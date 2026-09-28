import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/contactos" className="flex items-center gap-2 rounded-md font-heading text-lg font-semibold tracking-tight">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-full bg-brand" />
          kontaktu
          <span className="font-sans text-sm font-medium text-muted-foreground">CRM</span>
        </Link>
        <nav aria-label="Principal">
          <Link href="/contactos" className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            Contactos
          </Link>
        </nav>
      </div>
    </header>
  );
}
