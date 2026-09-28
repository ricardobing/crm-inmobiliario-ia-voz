# Decisiones: análisis del reto y del dataset

---

## 1. Alcance

- **Core:** R1–R9 de la spec.
- **User stories:** #10 Cumplimiento, #2 Duplicados y #4 Siguiente mejor acción. Por qué estas tres y no otras:
  ver el README.
- **Bonus:** agente de voz con LiveKit (`voice-agent/`).
- **Listado:** mínimo a propósito (sin búsqueda, filtros ni paginación): la protagonista es la ficha.

Este documento recoge el análisis del dataset y cada decisión tomada con los datos sucios (D01–D25), con la tabla
de resultados esperados que usan los tests (§5).

---

## 2. Material que falta

La spec lista 6 ficheros adjuntos; en el zip llegaron 3.

| Fichero | ¿Llegó? |
|---|---|
| `tech-spec-ficha-contactos.md` | Sí |
| `contactos.json` | Sí |
| `kb-propiedades-voz.json` | Sí |
| `guia-diseno-kontaktu.md` | **No** |
| `diseno-referencia-ficha-contacto.png` | **No** |
| `diseno-referencia-contactos.png` | **No** |
| `diseno-referencia-dashboard.png` | **No** |

**Qué se hizo:** se preguntó por email antes de empezar (28/09). Kontaktu confirmó que **la ausencia es intencionada**:
cada candidato elige el diseño, y usar su web pública como referencia les pareció la mejor opción.

**Decisión:**
- Los tokens visuales se sacan de kontaktuai.com (ver `arquitectura.md §7`).
- Todo el diseño vive en un único archivo de tokens (`src/app/globals.css`): cambiar de guía es tocar solo ese archivo.
- Los componentes no llevan colores a mano.

---

## 3. Auditoría del dataset, contacto por contacto

Export: `ORG-0031 · Miralvento Gestión Inmobiliaria`, `exported_at 2026-07-14T08:00:00Z`, 16 contactos.

| id | Qué trae de raro | Qué hay que hacer |
|---|---|---|
| c-001 Carmen Ruiz Delgado | Caso rico. `budget` como `{max}`, `zones` array, `confidence`, bloque `_meta` dentro de `qualification`. Además trae `interest_preferences`, que repite lo mismo en otro formato | `_meta` no es un grupo de hechos. `interest_preferences` es redundante. **Duplicado de c-009** |
| c-002 JOSÉ LUIS MARTÍN CABRERA | Nombre en mayúsculas. Teléfono `0034612889034`. Origen `llamada`. `budget` es el texto `"1.100 €"`, `zones` es el texto `"Las Rozas o Majadahonda"`, `has_pets` es texto. No trae `confidence` | Capitalizar al mostrar. `00` → `+34`. Mostrar el texto tal cual. **Ojo: `parseFloat("1.100")` da `1.1`** |
| c-003 Antonio Vidal | Teléfono sin prefijo (`699112233`). Origen `VOZ`. **`qualification_data` es un string JSON** (doble codificado). `budget` es número, no `{max}` | Parsear el string con try/catch. Si falla, avisar y mostrar el crudo plegado |
| c-004 (sin nombre) | `full_name` null, `contact_type` null, sin cualificación. En WhatsApp el bot ofreció "2 hab. en Majadahonda por 1.350 €/mes" (calle Sorolla), **que no está en el catálogo** | Nombre → teléfono formateado. Anotar la inconsistencia (ver D25) |
| c-005 Lucía Fernández | Sin teléfono, solo email. `created_at: "11/07/2026"`, interacción `"11/07/2026 18:42"` sin zona horaria. Canal `WEB_FORM` con `property_ref: MIR-2041`. Nota: prefiere email | **`new Date("11/07/2026")` en JS da 7 de noviembre (formato US).** Parsear DD/MM. Resolver MIR-2041 contra el catálogo |
| c-006 David P. | `META_LEAD_ADS`, tag `meta-ads`. Las respuestas del formulario de Meta vienen **en texto libre dentro de `notes`**. Sin cualificación | Mostrar notas legibles. No convertir texto libre en hechos (D18) |
| c-007 Marta Iglesias Peña | Claves que no están en otros contactos: `floor_pref`, `elevator` (`"imprescindible"`), `orientation`, `garage`, `accesibilidad_movilidad_reducida` (clave en español) | Prueba de fuego de R3: todas se pintan, con etiqueta legible |
| c-008 Roberto Sanz Oliva | `budget` con `source: "manual"` (350.000 €), cuando en la llamada dijo 300.000. Campos planos fuera de `qualification`: `net_income`, `income_verified`, `income_source`, `income_updated_at`. `assigned_agent_id` | Lo manual manda y la UI lo dice. Adaptador para campos planos (D15) |
| c-009 carmen ruiz | Minúsculas, `655123456` (**mismo número que c-001**), origen y canal `whatsapp` en minúscula. Dice "llamé la semana pasada por un piso en Majadahonda con terraza" | **El duplicado sembrado.** Detectar y proponer fusión |
| c-010 Isabel Torres Milán | **`organization_id: ORG-0047`**: es de otra organización | **No mostrar** (fuga entre inquilinos). 404 si se pide por URL |
| c-011 Pablo Herrero Gil | **`ORG-0047`** | Igual que c-010 |
| c-012 (sin nombre) | `lead_source` null, **`created_at` numérico `1782259200`** (epoch en segundos = 2026-06-24T00:00Z), sin interacciones ni cualificación | El contacto más vacío: ficha digna. **`new Date(1782259200)` da enero de 1970** (lo trata como ms) |
| c-013 Sofía Marín Costas | Origen `WITEI` (CRM anterior). Tag `no-llamar`, nota "contactar SOLO por email", `matching_enabled: false`. Canal `EMAIL` (R4 no lo menciona). Hechos con `sourceRef: import-witei` y fecha **anterior al alta** | Cumplimiento: bloquear llamada/WhatsApp. `EMAIL` se pinta. Procedencia "importado", no "dicho en conversación" |
| c-014 Prueba Prueba | `is_test: true`, `test@test.com`, `+34600000000`, origen `CRM` | Fuera del listado y de duplicados/acciones |
| c-015 MARÍA DOLORES GUTIÉRREZ SANTOS | Mayúsculas. Teléfono con guiones `+34-644-556-677`. **Email inválido `mdolores@@gmail.com`**. `created_at: "05/07/2026"`. Interacción `"10/07/2026 18:42"`. Import Witei | Validar email: aviso, sin `mailto`. No "corregirlo" adivinando |
| c-016 Álvaro Quintana Ros | **`ai_handoff: true`** con `handoff_reason` y `handoff_requested_at` (campos que solo trae este contacto). Cliente molesto: le cancelaron la visita sin avisar | Banner prioritario. Siguiente acción: llamada de una persona, disculpas |

### Formatos que aparecen

- **Teléfonos**: `+34 655 12 34 56` · `0034612889034` · `699112233` · `+34688456789` · `+34-644-556-677` · null.
- **Fechas**: ISO con `Z` · `DD/MM/AAAA` · `DD/MM/AAAA HH:mm` sin zona · epoch en segundos (número).
- **`lead_source`**: `VOICE_CALL`, `llamada`, `VOZ`, `WHATSAPP`, `whatsapp`, `WEBSITE`, `META_LEAD_ADS`, `WITEI`, `CRM`, null.
- **Canal de interacción**: `VOICE`, `WHATSAPP`, `whatsapp`, `WEB_FORM`, `EMAIL`.
- **`qualification_data`**: objeto · string JSON · null · objeto con campos planos además de `qualification`.
- **Valor de un hecho**: string · número · booleano · array · `{max}` (y `{min,max}` posible).
- **`source`**: `explicit`, `manual`. **`sourceRef`**: `conv-*`, `manual`, `import-witei`.
- **`confidence`**: `high` / `medium` / ausente.

---

## 4. Decisiones (D01–D25)

Cada decisión tiene un id para citarla desde el código (comentario corto), los tests y el README.

### Alcance y seguridad
- **D01 · Multi-organización.** Solo se sirven contactos de la organización activa (configurable; por defecto, la dueña
  del export, `ORG-0031`). c-010 y c-011 no aparecen. `GET /api/contacts/c-010` devuelve **404, no 403**, para no revelar
  que existe. Un contacto sin `organization_id` tampoco se sirve: no se puede probar que es de la organización. Los
  duplicados nunca cruzan organizaciones.
- **D02 · Contactos de prueba.** `is_test` queda fuera del listado (con un contador "1 contacto de prueba oculto"), fuera
  de duplicados y sin acciones. Por URL se ve con un banner "Contacto de prueba".

### Identidad (R2)
- **D03 · Nombre.** Fallback: nombre → teléfono formateado → email → "Contacto sin identificar". Solo se capitaliza si el
  nombre viene **todo en mayúsculas o todo en minúsculas** (se respetan mezclas deliberadas); las partículas (de, del, la,
  y…) van en minúscula. El valor crudo nunca se modifica y se ve en un tooltip. Avatar: iniciales; sin nombre → icono del
  canal por el que lo identificamos (teléfono/email), no un "?".
- **D04 · Teléfono.** `libphonenumber-js` con la región por defecto de la organización (ES, configurable). E.164 para
  enlaces y comparación, formato internacional para mostrar (`+34 612 88 90 34`). Si no se puede parsear: se muestra el
  crudo con aviso y sin enlaces.
- **D05 · Email.** Validación de formato. Si es inválido: aviso "formato no válido", sin `mailto:`, y la acción de email
  queda bloqueada. No se corrige solo (`mdolores@@gmail.com` → no se adivina).
- **D06 · Fechas.**
  - ISO: tal cual.
  - `DD/MM/AAAA[ HH:mm]`: día/mes. La organización es española y, además, leer `11/07/2026` como 7 de noviembre la
    pondría después de la exportación (14/07).
  - Sin zona horaria: `Europe/Madrid`.
  - Número: epoch en segundos si es < 10¹², en milisegundos si no.
  - Ilegible: "Fecha desconocida"; va al final del timeline y no rompe nada.
  - Todo se muestra en `Europe/Madrid` con zona explícita, esté donde esté el navegador o el servidor (evita errores de
    hidratación y horas corridas).
  - Se guarda la precisión: una fecha sin hora no se muestra como "00:00".
- **D07 · Origen y canal.** Tabla de alias sin distinguir mayúsculas → canal canónico con etiqueta.
  - `VOICE_CALL`/`VOICE`/`VOZ`/`llamada` → Llamada.
  - `WHATSAPP` → WhatsApp.
  - `WEBSITE`/`WEB_FORM` → Formulario web.
  - `META_LEAD_ADS` → Meta Ads.
  - `WITEI` → Importación · Witei.
  - `CRM` → Alta manual (**asunción**).
  - `EMAIL` → Email.
  - null → "Origen desconocido".
  - Cualquier valor nuevo se muestra humanizado con estilo neutro: nunca se rompe ni se mete en "Otros" en silencio.
  - No se etiqueta "Llamada IA" salvo que el dato lo diga: hay llamadas salientes hechas por personas (c-008, i-1071).

### Cualificación (R3)
- **D08 · Formas de `qualification_data`.** Objeto, string JSON (se parsea), null (estado vacío) o ilegible (aviso y
  crudo plegado).
- **D09 · Metadatos.** Las claves que empiezan por `_` (p. ej. `_meta`) no son hechos. `_meta.lastSyncedAt` se muestra
  como "Última sincronización".
- **D10 · Grupos.** `sale` → Compra, `rental` → Alquiler, `shared` → Comunes. Cualquier otro grupo se pinta con su nombre
  humanizado. Orden: operaciones primero, comunes al final.
- **D11 · Claves.** Diccionario de etiquetas conocidas en español más fallback humanizado (`snake_case` → "Frase"), con la
  clave cruda en un tooltip. **Nunca se descarta una clave.**
- **D12 · Valores.** Se pintan según su tipo real:
  - booleano → Sí/No;
  - número → formato es-ES;
  - array → chips;
  - `{min,max}` → rango;
  - otro objeto → pares clave/valor (con profundidad limitada);
  - null → "sin dato".

  **El texto se muestra tal cual** (`"1.100 €"`, `"tiene un perro pequeño"`): no reinterpretamos lo que dijo el
  cliente. El formato por clave es solo una pista (p. ej., `budget` → moneda; `/mes` si está en Alquiler), nunca un
  requisito.
- **D13 · Procedencia.**
  - `manual` → "Editado por una persona" (manda).
  - `explicit` + `sourceRef conv-*` → "Dicho por el cliente en conversación".
  - `explicit` + `sourceRef import-*` → "Importado de Witei": aunque diga *explicit*, no hay conversación que lo respalde.
  - Otro valor → se muestra el crudo.
  - `confidence` se muestra si viene y no se inventa si falta.
- **D14 · Precedencia ante conflicto.** manual > conversación > importación > otros; a igualdad, el más reciente. Es una
  función pura y testeada que usa la fusión de duplicados. En c-008 el presupuesto de 350.000 € (manual, 10/07) manda
  sobre los 300.000 € que se oyen en la llamada del 05/07, y la UI lo indica.
- **D15 · Campos planos antiguos** (`net_income`, `income_*` en c-008). Un adaptador explícito los convierte en el hecho
  "Ingresos netos" (Comunes), con procedencia "declarado en llamada" y la marca "no verificado". Cualquier otro campo
  plano desconocido va a un grupo genérico "Otros datos".
- **D16 · `interest_preferences`.** Es una estructura antigua y redundante. Si hay `qualification`, se ignora; si no, se
  usa de respaldo con procedencia "preferencias (sistema anterior)".

### Timeline (R4)
- **D17 · Timeline.**
  - Se pintan todos los canales, incluido `EMAIL` (que R4 no menciona) y cualquiera futuro (con render genérico).
  - Orden: **más reciente primero**, que es lo que mira un agente antes de llamar.
  - Llamada: resumen visible, duración y transcripción plegable, con turnos por hablante si el formato `NOMBRE: texto`
    lo permite.
  - Metadata desconocida → pares clave/valor; `audio_url` null no se muestra.
  - `property_ref` se resuelve contra el catálogo si existe (`MIR-2041 · Piso con terraza en Majadahonda`).
- **D18 · Notas.** Se muestran tal cual (partidas por ` · ` para leerlas mejor). **No se convierten en hechos**: parsear
  texto libre es frágil. En producción, la integración de Meta debería escribir hechos con procedencia "formulario".
- **D19 · Agente asignado.** Se muestra el id (`usr-mario-ortega`). El export no trae directorio de usuarios y no se
  adivina el nombre a partir del id.

### User stories elegidas
- **D20 · Cumplimiento (#10).**
  - Solo bloquean señales estructuradas: el tag `no-llamar` y sus variantes, configurables. No se interpreta texto libre
    para bloquear, pero las notas se muestran junto al bloqueo.
  - `no-llamar` bloquea llamada **y** WhatsApp. Es la opción conservadora: pidió "solo email", y bloquear de más cuesta
    poco, mientras que contactar a quien lo prohibió cuesta caro (RGPD/AEPD y reputación).
  - Consentimiento: el export no trae el campo → se muestra "no registrado", informativo y **sin bloquear** (si no,
    bloquearíamos a todos).
  - La detección automática de "no me llaméis" en conversaciones es un buen uso de LLM para el día siguiente: debe
    escribir un flag estructurado, no decidir en la UI.
- **D21 · Handoff.** `ai_handoff` → banner prioritario con motivo y hora. La IA no debe seguir respondiendo y la acción
  sugerida es que llame una persona.
- **D22 · Duplicados (#2).**
  - Solo dentro de la misma organización y sin contactos de prueba.
  - Hace falta **teléfono E.164 igual o email igual**. El nombre solo sube la confianza y la explicación: nunca basta
    solo (dos "Carmen Ruiz" en un CRM grande son normales).
  - La fusión es **solo una propuesta** (previsualización campo a campo con su regla), nunca automática ni irreversible
    sin una persona.
- **D23 · Siguiente mejor acción (#4).** Reglas deterministas, no LLM: explicables (cada sugerencia dice por qué), gratis,
  testeables y sin clave de API para quien evalúe. Siempre respetan cumplimiento: si el canal ideal está bloqueado, se
  cae al siguiente permitido; si ninguno lo está, la sugerencia lo dice en vez de proponer un canal bloqueado.
  "La IA entiende, el sistema decide."
- **D24 · "Ahora".** Ninguna regla depende de la fecha actual: el dataset es de julio y "hace 3 meses" no aportaría
  nada. Por eso no hizo falta un reloj; si una regla futura lo necesita, debe recibirlo como parámetro.
- **D25 · Inconsistencia del bot (c-004).** El bot de WhatsApp ofreció 2 habitaciones en Majadahonda por 1.350 €/mes
  (calle Sorolla). En el catálogo, MIR-2050 (Majadahonda) cuesta 1.100 € y MIR-2044 (1.350 €) está en Las Rozas. No se
  corrige nada: puede ser un inmueble fuera del catálogo o una alucinación. Es el argumento para que el agente de voz
  responda **solo** con lo que devuelve la tool.

---

## 5. Resultados esperados (oráculo para tests y verificación visual)

### Normalización

| id | Nombre mostrado | Teléfono | Origen | Alta (Madrid) |
|---|---|---|---|---|
| c-001 | Carmen Ruiz Delgado | +34 655 12 34 56 | Llamada | 08/07/2026 12:28 |
| c-002 | José Luis Martín Cabrera | +34 612 88 90 34 | Llamada | 09/07/2026 19:12 |
| c-003 | Antonio Vidal | +34 699 11 22 33 | Llamada | 10/07/2026 11:40 |
| c-004 | +34 688 45 67 89 *(sin nombre)* | +34 688 45 67 89 | WhatsApp | 11/07/2026 22:15 |
| c-005 | Lucía Fernández | — | Formulario web | 11/07/2026 *(sin hora)* |
| c-006 | David P. | +34 677 00 11 22 | Meta Ads | 12/07/2026 15:05 |
| c-007 | Marta Iglesias Peña | +34 622 90 11 30 | Llamada | 12/07/2026 18:30 |
| c-008 | Roberto Sanz Oliva | +34 633 44 55 66 | Llamada | 05/07/2026 13:20 |
| c-009 | Carmen Ruiz | +34 655 12 34 56 | WhatsApp | 13/07/2026 10:50 |
| c-012 | +34 611 22 33 44 *(sin nombre)* | +34 611 22 33 44 | Origen desconocido | 24/06/2026 02:00 |
| c-013 | Sofía Marín Costas | +34 644 78 12 90 | Importación · Witei | 06/07/2026 11:00 |
| c-014 | Prueba Prueba *(oculto)* | +34 600 00 00 00 | Alta manual | 02/06/2026 17:00 |
| c-015 | María Dolores Gutiérrez Santos | +34 644 55 66 77 | Importación · Witei | 05/07/2026 *(sin hora)* |
| c-016 | Álvaro Quintana Ros | +34 688 11 22 33 | WhatsApp | 02/07/2026 12:00 |
| c-010, c-011 | *(404, otra organización)* | | | |

> Horas: el ISO en UTC pasa a Madrid (CEST, +2 en julio). Teléfonos verificados el 28/09/2026 con libphonenumber-js
> (`parsePhoneNumberFromString(raw, 'ES').formatInternational()`): los 13 coinciden con esta tabla. También se
> comprobaron los errores típicos de JS: `new Date("11/07/2026")` → 7 de noviembre; `new Date(1782259200)` → 21 de enero de
> 1970; `parseFloat("1.100 €")` → 1.1.

### Siguiente mejor acción

Resultado real del motor de reglas (`src/domain/stories.test.ts` lo verifica, contacto por contacto).

| id | Principal | Después | Canal |
|---|---|---|---|
| c-001 | Revisar el posible duplicado antes de contactar (c-009) | Proponer inmuebles y agendar visita | — · llamada |
| c-002 | Proponer inmuebles y agendar visita | — | llamada |
| c-003 | Proponer inmuebles y agendar visita | — | llamada |
| c-004 | Responder a su último mensaje | Llamar para cualificar | WhatsApp · llamada |
| c-005 | Responder a su último mensaje (formulario de MIR-2041) | Llamar para cualificar | **email** · email (no hay teléfono) |
| c-006 | Llamar para cualificar (se le propuso por WhatsApp y no contestó) | — | llamada |
| c-007 | Proponer inmuebles y agendar visita | — | llamada |
| c-008 | Proponer inmuebles y agendar visita | — | llamada |
| c-009 | Revisar el posible duplicado (c-001) | Responder a su último mensaje · Llamar para cualificar | — · WhatsApp · llamada |
| c-012 | Llamar para cualificar (nunca se habló con él) | — | llamada |
| c-013 | Contactar solo por email (pidió que no la llamen) | Responder a su último mensaje · Completar la cualificación (falta presupuesto) | **email** en las tres |
| c-014 | Sin acción: es un contacto de prueba | — | — |
| c-015 | Proponer inmuebles y agendar visita | Corregir el email | llamada · — |
| c-016 | **Llamar ya: pidió hablar con una persona** | Proponer inmuebles y agendar visita | llamada · llamada |

Reglas, por prioridad:
1. prueba (exclusiva);
2. handoff (sustituye a "responder");
3. posible duplicado;
4. no llamar;
5. sin canal utilizable;
6. mensaje sin responder;
7. cualificar;
8. completar la cualificación;
9. proponer inmuebles;
10. corregir el email.

Una **llamada entrante no cuenta como mensaje sin responder**: es una conversación que ya se atendió. Solo
cuentan WhatsApp, email y formulario.

### Cumplimiento

| id | Llamar | WhatsApp | Email | Motivo |
|---|---|---|---|---|
| c-013 | ✗ | ✗ | ✓ | Tag `no-llamar` |
| c-015 | ✓ | ✓ | ✗ | Email con formato no válido |
| c-005 | ✗ | ✗ | ✓ | Sin teléfono |
| c-016 | ✓ | ✓ (solo humano) | ✓ | Handoff: automatismos de IA en pausa |
| c-014 | ✗ | ✗ | ✗ | Contacto de prueba |

### Duplicados

- **c-001 ↔ c-009**: confianza alta. Motivo: mismo teléfono (+34 655 12 34 56); el nombre "carmen ruiz" está contenido en
  "Carmen Ruiz Delgado"; el mensaje de c-009 alude a la llamada de c-001.
- Ningún otro par dentro de ORG-0031.
- La propuesta de fusión:
  - sobrevive c-001 (más antiguo y con más información);
  - nombre "Carmen Ruiz Delgado";
  - origen original Llamada, más WhatsApp como canal adicional;
  - alta el 08/07;
  - hechos de c-001 (c-009 no trae);
  - timeline unido (3 interacciones).
