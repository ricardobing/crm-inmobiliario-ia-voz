@AGENTS.md

# Ficha de contactos: reglas del proyecto

Spec: `docs/decisiones.md` (D01–D25) y `docs/arquitectura.md`. Si algo no está ahí, preguntar antes de inventar.

## Reglas
- UI en castellano de España (es una decisión de producto: la usan agentes en España). Código e identificadores en
  inglés.
- TypeScript strict. Nada de `any`: si el dato es desconocido, `unknown`, y se estrecha con zod o con guards.
- `src/domain` es puro: sin React, sin Next, sin fs. Todo lo que está ahí lleva test.
- El JSON solo se lee en `src/server` (`server-only`). Los componentes nunca lo importan (R8).
- Sin hardcodear:
  - ni ids de contacto (salvo en tests);
  - ni ramas por una clave concreta de cualificación;
  - los catálogos van como datos, con fallback para "desconocido".
- Diseño: los componentes usan solo tokens semánticos de `src/app/globals.css`. Nada de colores sueltos
  (`#hex`, `orange-500`, etc.) en componentes.
- Fechas:
  - siempre con zona horaria explícita (config `DISPLAY_TIMEZONE`);
  - nunca `new Date("dd/mm/aaaa")` ni `new Date(epochSeconds)`.
- Los números que vienen como texto (`"1.100 €"`) se muestran tal cual. Nunca `parseFloat` sobre texto en formato
  es-ES.
- Nunca se modifica el dato crudo: la normalización produce una vista y conserva `raw`.
- User stories: SOLO #10 Cumplimiento, #2 Duplicados y #4 Siguiente mejor acción. No añadir otras.
- Listado mínimo (R1): sin búsqueda, filtros ni paginación.
- Cada decisión no obvia lleva un comentario corto con su id: `// D06`.
- Antes de dar algo por terminado: `pnpm test && pnpm typecheck && pnpm lint`.
