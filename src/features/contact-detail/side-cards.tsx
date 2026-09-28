import { NotebookText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ContactDetail } from "@/domain/types";

/** D18: las notas se muestran tal cual, una por línea. */
export function NotesCard({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <Card size="sm" aria-labelledby="notes-title">
      <CardHeader>
        <h2 id="notes-title" className="flex items-center gap-2 text-sm font-semibold">
          <NotebookText aria-hidden="true" className="size-4 text-muted-foreground" />
          Notas
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1.5 text-sm">
          {notes.map((note, i) => (
            <li key={i} className="break-words">
              {note}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function RecordCard({ contact }: { contact: ContactDetail }) {
  const matching =
    contact.matchingEnabled === null ? "Sin dato" : contact.matchingEnabled ? "Activado" : "Desactivado";
  return (
    <Card size="sm" aria-labelledby="record-title">
      <CardHeader>
        <h2 id="record-title" className="text-sm font-semibold">
          Registro
        </h2>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono text-xs leading-5">{contact.id}</dd>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd>{contact.contactType?.label ?? "Sin clasificar"}</dd>
          <dt className="text-muted-foreground">Matching automático</dt>
          <dd>{matching}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
