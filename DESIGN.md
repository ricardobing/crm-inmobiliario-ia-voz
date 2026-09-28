# Design

Sistema visual de la ficha de contactos. Todos los valores viven en `src/app/globals.css`: este documento explica el
porqué; el CSS es la fuente de verdad.

## Mundo visual
Heredado de kontaktuai.com: fondo cálido casi blanco, tarjetas blancas con borde fino, tinta casi negra, naranja de marca
usado con moderación y botones primarios negros. Es una pantalla **operativa**: la marca vive en los detalles (foco
naranja, chips de marca, tipografía de titulares), no en la decoración.

## Color
| Rol | Token | Uso |
|---|---|---|
| Fondo / superficie | `background` `#FAFAF7` · `card` `#FFFFFF` · `muted` `#F4F4EE` | Página, tarjetas, segunda capa |
| Tinta | `foreground` `#0A0A0A` · `muted-foreground` `#5E5D57` | Texto; el secundario cumple 4,5:1 |
| Primario | `primary` `#0A0A0A` | Acción principal (llamar) |
| Marca | `brand` `#FF6B00` · `brand-ink` `#B34700` · `brand-soft` | Foco, acento e indicadores. `brand-ink` para texto naranja: el `#E25C00` de la web no llega a 4,5:1 en tamaños pequeños |
| Estados | `danger` · `warning` · `success` · `info` (+ `-soft`, `-line`) | Siempre con icono y texto |

## Tipografía
- **Outfit** (600): nombre del contacto y títulos de página, como los titulares de la web.
- **Inter**: todo lo demás (etiquetas, datos, botones).
- **JetBrains Mono**: solo para identificadores (ids, referencias de inmueble y de conversación).
- Escala fija en rem (12 / 14 / 16 / 20 / 28), ratio ~1,2. Números tabulares en datos.

## Forma y profundidad
- Radio de 12px en tarjetas; píldoras solo en chips y badges.
- Elevación declarada una vez: borde de 1px, sin sombra.
- Movimiento: solo de estado (plegables y hover, 150–200 ms).

## Componentes
shadcn/ui (Radix) reestilado con los tokens: `Button`, `Card`, `Tooltip`, `Collapsible` y `Skeleton`. Los avisos
(`StatusBanner`) y los estados vacíos son componentes propios en `src/features/shared`.
Los componentes de producto están en `src/features/*` y no llevan colores sueltos.

## Cómo cambiar el diseño
1. Editar los valores de `:root` en `src/app/globals.css`.
2. Si cambian las fuentes, editar `src/app/fonts.ts`.
3. Nada más: los componentes solo referencian tokens.
