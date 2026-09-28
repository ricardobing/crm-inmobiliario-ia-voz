import { AlertTriangle, RotateCw, SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/features/shared/status-banner";

/** R5: esqueleto con la forma real de la ficha, para que la carga no "salte". */
export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando ficha" className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-border lg:flex-row lg:justify-between">
        <div className="flex gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-7 w-64" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function NotFoundState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
        <SearchX aria-hidden="true" className="size-6" />
      </span>
      <h1 className="font-heading text-2xl font-semibold">No encontramos este contacto</h1>
      <p className="text-sm text-muted-foreground">No existe o no tienes acceso a él.</p>
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/contactos">Volver a contactos</Link>
      </Button>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retrying,
  simulated,
  cleanHref,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
  simulated: boolean;
  cleanHref: string;
}) {
  return (
    <StatusBanner
      tone="danger"
      icon={AlertTriangle}
      title="No se pudo cargar la ficha"
      action={
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RotateCw aria-hidden="true" className={retrying ? "animate-spin" : undefined} />
          Reintentar
        </Button>
      }
    >
      <p>{message}</p>
      {simulated ? (
        <p className="mt-1">
          Es un error forzado para la demo.{" "}
          <Link href={cleanHref} className="font-medium underline underline-offset-2">
            Ver la ficha sin error
          </Link>
        </p>
      ) : null}
    </StatusBanner>
  );
}
