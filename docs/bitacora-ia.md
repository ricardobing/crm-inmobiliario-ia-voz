# Bitácora de trabajo con la IA

Registro hecho **durante** el trabajo con Claude Code (28/09/2026), no reconstruido al final. Solo cosas que
pasaron.

## Cómo la dirigí

1. **Spec antes que código.** Le pedí leer el enunciado, el dataset y la web de Kontaktu, y auditar el dataset
   contacto por contacto. Salieron `docs/decisiones.md` (D01–D25, con una tabla de resultados esperados) y
   `docs/arquitectura.md`, que después fueron la spec de cada etapa.
2. **Reglas en `CLAUDE.md`:** sin `any`, dominio puro, sin hardcodear ids ni claves, fechas con zona explícita,
   nada de `parseFloat` sobre texto es-ES, solo 3 user stories y listado mínimo.
3. **Tests primero, con los datos reales:** la tabla de `decisiones.md §5` es el oráculo de los tests.
4. **Verificación en capas:** Vitest (dominio, servidor y API), Playwright (todas las fichas × escritorio y móvil,
   sin errores de consola), capturas revisadas a mano y `pnpm inspect:data` para leer crudo → normalizado.
5. **Etapas con commit propio y timebox:** el historial de git muestra el orden real.
6. **El bonus de voz, en paralelo**, con un subagente al que le pedí leer primero la documentación actual de
   LiveKit y no usar la API de memoria.

## Dónde se equivocó la IA y cómo lo cacé

| # | Qué pasó | Cómo lo detecté | Qué cambié |
|---|---|---|---|
| 1 | **zod 4:** declaró `qualification_data: z.unknown()` asumiendo que la clave era opcional, como en zod 3. En zod 4 es **obligatoria**: un contacto sin esa clave se descartaba entero. El dataset real no lo mostraba porque todos la traen | Test del repositorio con un contacto mínimo `{ id, organization_id }` → `[]`. Lo aislé con un test de depuración que mostraba los issues de zod | `.optional()` y 3 tests de lectura tolerante |
| 2 | **Regla de negocio mal planteada:** "responder a su último mensaje" saltaba cuando lo último era una **llamada entrante**, pero una llamada ya es una conversación atendida | El test parametrizado con la tabla esperada falló en c-002, c-003 y c-007 | La regla solo aplica a canales asíncronos (WhatsApp, email y formulario), más un test específico |
| 3 | **Accesibilidad:** usó `CardTitle` de shadcn para los títulos de sección, pero renderiza un `div`: "Cualificación" y "Actividad" no eran encabezados | E2E con `getByRole("heading", { name: "Cualificación" })`: fallaba en las 14 fichas | `h2` reales con `aria-labelledby` |
| 4 | **Formato de moneda:** asumió que `Intl` en es-ES da "1.400 €"; da "1400 €" (CLDR no agrupa 4 cifras), mientras que el sector y el dataset escriben "1.400 €" | Lo comprobé en Node antes de escribir el test | `useGrouping: "always"`, con comentario y test |
| 5 | **Texto de marca:** pasó a minúsculas la etiqueta del canal en un motivo: "Escribió por whatsapp" | Revisión visual de las capturas de móvil | Una frase por canal ("por WhatsApp", "por email", "envió el formulario web") y un test |
| 6 | **Next.js 16:** trae un `AGENTS.md` que avisa que su API difiere de lo que conoce la IA | Lo leí al crear el proyecto | Antes de escribir rutas leí la documentación local: `params` es una promesa (`RouteContext`, `PageProps`) |
| 7 | **Voz, prompt:** mi script para editar el prompt falló (error de Python) y volví a correr las simulaciones creyendo que el cambio estaba aplicado | Vi el traceback en la salida: 4/7 con el mismo prompt que antes había dado 5/7 | Edición con el editor y nueva corrida: 6/7. Aprendizaje: **una sola ejecución de un LLM no es una medida** |
| 8 | **Voz, subagente:** según su propio informe, al leer el código del SDK encontró que una tool que devuelve un dict le llega al LLM como repr de Python, y que `EndCallTool` genera la despedida *después* de colgar | Lectura del código instalado de `livekit-agents` 1.8.3 | Las tools devuelven JSON y el prompt pide llamar a `end_call` sin despedirse antes |

### Los tests también se equivocaron (y conviene contarlo)
- Selectores ambiguos: al agregar los paneles de las stories, textos como "Sin email" o "1.400 €/mes" aparecían dos
  veces y el modo estricto de Playwright fallaba. Eran errores del test, no de la app: acoté cada selector a su
  sección.
- Un test del motor de reglas usaba c-009 (sin email) para comprobar un canal de email. El motor hizo bien en decir
  "no hay canal permitido": corregí el test, no el código.
- El test de "error de red" no tenía en cuenta el reintento automático de React Query en los 5xx.

## Cronología

Horas reales, según el historial de git.

| Hora | Etapa | Resultado |
|---|---|---|
| 14:50 | E0 · Setup | Next.js 16, shadcn/ui, datos copiados sin modificar y comparados byte a byte, docs y `CLAUDE.md` |
| 15:09 | E1 · Dominio | 91 tests a la primera, contra la tabla de resultados esperados; `inspect:data` revisado a mano |
| 15:12 | E2 · API | Route handlers; c-010 (otra organización) → 404 idéntico a un id inexistente |
| 15:36 | E3 · UI + pruebas | Ficha completa; tests de servidor/API y 50 E2E × 2 viewports; bugs 1, 3 y 4 |
| 15:56 | E4 · Stories | #10, #2 y #4 con 157 tests y 128 E2E; bug 2 |
| 16:05 | Bonus voz | 46 tests del catálogo; simulaciones contra LiveKit Cloud 5/7 → 6/7; bug 7 |
| 16:11 | Cierre | Arreglos de la revisión visual (bug 5) |
