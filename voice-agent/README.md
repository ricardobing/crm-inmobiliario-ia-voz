# Agente de voz de la agencia (bonus)

Agente de voz con [LiveKit Agents](https://docs.livekit.io/agents/) (Python) que atiende la llamada de la
agencia (Miralvento). Usa `../data/kb-propiedades-voz.json` como base de conocimiento: es **la misma fuente que
la web**, no una copia.

> Es mi primer agente de voz. Lo que sigue dice hasta dónde llegué, qué comprobé y qué no.

## Qué hace

- Saluda **identificándose como asistente de inteligencia artificial** de la agencia. El saludo es fijo
  (`session.say`), no lo improvisa el LLM, y el nombre de la agencia sale del JSON.
- Habla en castellano de España, con frases cortas y una pregunta por turno. Averigua operación, zona,
  presupuesto y habitaciones.
- Tools:
  - `buscar_propiedades(zona, presupuesto_max, operacion, habitaciones_min, admite_mascotas)`: filtra el
    catálogo y devuelve como mucho 3 resultados. Si no hay nada dentro del presupuesto, devuelve aparte los
    "más cercanos por encima", para que el agente lo diga con honestidad.
  - `detalle_propiedad(ref)`: ficha completa, con el horario de visitas.
  - `end_call` (`EndCallTool` de LiveKit): se despide y cuelga solo.
- Solo habla de inmuebles que devuelvan las tools. No inventa precios ni disponibilidad.
- Teléfono, horario de oficina y horarios de visita salen del JSON.
- Visitas: toma nombre y franja dentro del horario del inmueble y dice que un agente humano la confirma. No
  hay agenda, así que no promete la cita.
- Precios dichos como los diría una persona: la tool ya devuelve `precio_hablado` ("mil trescientos
  cincuenta euros al mes"). Así el LLM no tiene que pasar cifras a palabras y no puede equivocarse ahí.

## Estructura

| Archivo | Qué es |
|---|---|
| `src/catalog.py` | Carga tolerante del JSON y funciones puras: `buscar_propiedades`, `detalle_propiedad` y el formato para voz. No depende del SDK |
| `src/agent.py` | Agente de LiveKit: prompt, tools, `AgentSession` y `AgentServer`. Mismo layout que [agent-starter-python](https://github.com/livekit-examples/agent-starter-python) |
| `tests/` | pytest: catálogo (escenarios de prueba, tildes, null, precios hablados) y prompt/saludo sin credenciales |
| `scenarios.yaml` | 6 escenarios de prueba del bonus (búsqueda, fuera de catálogo, barge-in, despedida…) más uno extra de visita, para `lk agent simulate` |

Reglas del catálogo: la zona se compara sin mayúsculas ni tildes y por contención en los dos sentidos
("pozuelo" ↔ "Pozuelo de Alarcón"); "compra" equivale a venta; el precio tiene que ser ≤ presupuesto, sin
tolerancia; `null` es "no aplica" o "no consta", nunca `False` (la planta y el ascensor del chalet de Boadilla
salen como "no aplica").

## Requisitos

- [uv](https://docs.astral.sh/uv/). Python **3.12** (fijado en `pyproject.toml` y `.python-version`; uv lo
  instala si falta). El Python del sistema es 3.14 y alguna dependencia nativa podría no tener wheel.
- LiveKit CLI: `winget install LiveKit.LiveKitCLI` (en Windows).
- Cuenta de LiveKit Cloud en el plan gratuito (Build). Los modelos van por **LiveKit Inference**, así que no
  hacen falta claves de otros proveedores.

## Cómo correrlo

```powershell
cd voice-agent
uv sync
lk cloud auth
lk app env --write --destination .env.local   # o copiar .env.example a .env.local y completarlo
```

| Para | Comando |
|---|---|
| Hablarle por el micrófono, en la terminal | `lk agent console` |
| Lo mismo, por texto | `lk agent console --text` |
| Sin el CLI (el SDK lo marca como deprecado) | `uv run src/agent.py console` |
| Conectado a LiveKit Cloud (playground o frontend) | `lk agent dev` |
| Simular los escenarios | `lk agent simulate text --scenarios scenarios.yaml` |
| Tests | `uv run pytest -q` |

`.env.local` no se sube: está en `.gitignore`. El `.gitignore` de la raíz ignora `.env*`, así que el de esta
carpeta vuelve a incluir `.env.example`.

El agente se registra con nombre (`AGENT_NAME`, por defecto `miralvento-voz`). Según la documentación de
dispatch, con nombre el agente solo entra en una sala cuando se lo despacha de forma explícita. Si el
playground no lo encuentra, se puede despachar a mano con ese nombre o dejar `AGENT_NAME=` vacío, que vuelve
al despacho automático (esto último no lo probé).

### Variables de entorno opcionales

| Variable | Por defecto | Nota |
|---|---|---|
| `KB_PATH` | `../data/kb-propiedades-voz.json` | Si es relativa, se resuelve contra `voice-agent/`, no contra el directorio actual |
| `STT_MODEL` / `STT_LANGUAGE` | `assemblyai/universal-3-5-pro` / `es` | Alternativa documentada con español: `deepgram/nova-3` |
| `LLM_MODEL` | `google/gemma-4-31b-it` | El recomendado por LiveKit para voz, por latencia |
| `TTS_MODEL` / `TTS_VOICE` / `TTS_LANGUAGE` | `gradium/default` / `iTQW2xFICXk8riV4` / `es` | Voz "Vera", castellano (es-ES) |
| `TTS_FALLBACK` | `cartesia/sonic-3:5c5ad5e7-…` | Respaldo del lado del servidor: voz "Daniela", de México. Vacío para desactivarlo |
| `NOISE_CANCELLATION` | `1` | Cancelación de ruido ai-coustics, igual que en el template. `0` para quitarla |

## Qué está verificado

Sin credenciales, esto sí se pudo comprobar:

- `uv run pytest -q`: 46 tests en verde (catálogo, precios hablados, prompt y saludo tomados del JSON, y que
  `scenarios.yaml` sea válido).
- `agent.py` importa sin errores con `livekit-agents 1.8.3`. Con variables de entorno de mentira (no
  credenciales), se construyen `AgentSession`, `inference.STT/LLM/TTS` (con `fallback`), `TurnDetector`,
  `STTContextOptions`, `RoomOptions` con ai-coustics y el agente con sus 3 tools. El JSON schema que ve el LLM
  sale bien: `end_call`, `buscar_propiedades` (con `operacion` como enum `compra`/`alquiler`) y
  `detalle_propiedad`.
- Las tools devuelven lo esperado cuando se las llama directamente: Majadahonda → MIR-2050; Las Rozas ≤1300 →
  vacío + MIR-2044 "por encima"; Sabadell → vacío con nota de no inventar; ref inexistente → `encontrado: false`.
- `uv run src/agent.py --help` lista `console` (deprecado en favor de `lk agent console`), `dev`, `start`,
  `connect` y `download-files`.

Qué comprobé en la documentación, el 28/09/2026:

- [Voice AI quickstart](https://docs.livekit.io/agents/start/voice-ai-quickstart/): `AgentServer`,
  `@server.rtc_session`, `AgentSession`, `inference.STT/LLM/TTS`, `TurnHandlingOptions` y
  `inference.TurnDetector()`.
- [EndCallTool](https://docs.livekit.io/agents/prebuilt/tools/end-call-tool/): import, `tools=EndCallTool().tools`
  y los parámetros. También leí el código instalado: la despedida la genera el LLM **después** de llamar a
  `end_call`, a partir de `end_instructions`. Por eso el prompt dice que llame a `end_call` sin despedirse antes.
- [Function tools](https://docs.livekit.io/agents/logic/tools/definition/): `@function_tool`, `RunContext`,
  `ToolError` y los `Args:` del docstring.
- Modelos: [STT](https://docs.livekit.io/agents/models/stt/) (AssemblyAI Universal-3.5 Pro admite `es`),
  [LLM](https://docs.livekit.io/agents/models/llm/) y [TTS](https://docs.livekit.io/agents/models/tts/) /
  [Gradium](https://docs.livekit.io/agents/models/tts/gradium/) (Vera `iTQW2xFICXk8riV4`, es-ES).
- [Turn detector](https://docs.livekit.io/agents/logic/turns/turn-detector/): admite español y usa el idioma
  que informa el STT.
- [Startup modes](https://docs.livekit.io/agents/server/startup-modes/) (console, `--text`, dev, start),
  [simulaciones](https://docs.livekit.io/agents/start/testing/simulations/) y el
  [template](https://github.com/livekit-examples/agent-starter-python), de donde saqué `pyproject`,
  `.env.example` y el formato de `scenarios.yaml`.

## Simulaciones contra LiveKit Cloud (28/09/2026)

Con las credenciales ya configuradas, `lk agent simulate text --scenarios scenarios.yaml` ejecuta los 7
escenarios contra los modelos reales (LLM de LiveKit Inference). En modo texto no intervienen el STT ni el TTS.

| Corrida | Prompt | Resultado | Qué falló |
|---|---|---|---|
| 1 | Original | 5/7 | Con «¿tiene ascensor? Gracias, hasta luego» en un mismo turno, colgó sin responder |
| 2 | Original (mi edición del prompt falló sin que me diera cuenta) | 4/7 | Lo mismo. **El LLM no es determinista: una sola corrida no alcanza para evaluar** |
| 3 | + «si hay despedida y petición en el mismo turno, primero responde; al cambiar de operación o zona, busca enseguida» | **6/7** | Dijo que el chalet «no dispone de ascensor» cuando el dato es «no aplica» |

Comprobado en las simulaciones:
- se presenta como asistente de IA de la agencia;
- busca con los filtros correctos;
- no inventa (insistió en que el piso de la calle Sorolla no está en el catálogo);
- ofrece lo que queda por encima del presupuesto diciéndolo;
- trata la visita como pendiente de confirmar;
- **se despide y cuelga solo, y borra la sala**.

Pendiente (se cerró el timebox aquí): que el prompt obligue a decir «no aplica» sin convertirlo en un «no», y
volver a pasar las simulaciones varias veces para medir la tasa de acierto, no una sola ejecución.

## Prueba con micrófono (`lk agent console`, 28/09/2026)

Dos sesiones reales con micrófono y altavoz. Las métricas son las que muestra la consola en cada turno.

| Pieza | Resultado |
|---|---|
| Saludo | ✓ Se presenta como asistente de inteligencia artificial de Miralvento |
| STT en español | ✓ Entendió «Busco alquilar en Majadahonda», «Para comprar» y «Sí, dame más detalles». ✗ En una sesión, «perro» salió como «PER» y no se filtró por mascotas |
| Tools | ✓ `buscar_propiedades` → MIR-2050 y `detalle_propiedad` → ficha completa, con los datos correctos |
| Voz (TTS) | ✓ Se oye. Primer audio en **0,36–0,72 s** |
| LLM | ✓ Primer token en **0,38–0,48 s**. Respuestas en castellano de España, con el precio hablado y una pregunta por turno |
| **Latencia de extremo a extremo** | **0,7–2,9 s** por turno (métrica `e2e`), desde que el usuario deja de hablar hasta que el agente empieza a responder |
| Interrupciones (barge-in) | ✓ Si el usuario habla encima, el agente se calla (`Agent (interrupted)`) y retoma con cortesía |
| Ruido de conversación ajena | ✓ Cuando el usuario habló con otra persona, respondió «No se preocupe…» y volvió a preguntar por la zona |

> **Corrección de una medición.** En la primera sesión anoté «unos 10 s» de latencia y «no suena el TTS». Ninguna
> de las dos cosas era cierta:
> - el altavoz estaba en silencio;
> - leí mal el log: `conversation_item_added` se registra cuando el agente **termina** de hablar, así que esos 10 s
>   eran la duración de la respuesta, no la latencia.
>
> La métrica correcta es la `e2e` de la consola.

Pendiente:
- **«PER» por «perro»:** pasarle al STT palabras clave del dominio (mascota, perro, gato, las zonas del catálogo).
- **Latencia:** bajar el extremo alto (2,9 s), con un LLM más rápido o respuestas más cortas tras las tools.
- **«No aplica» → «no tiene»:** el fallo de la simulación con el chalet (ver arriba).
- **Cuelgue en `console`:** no está confirmado que borre la sala; `delete_room=True` es para salas reales y SIP. En
  las simulaciones sí la borró.

## Próximos pasos

1. **Telefonía real en España**: número SIP español con un trunk y una *dispatch rule* hacia `miralvento-voz`.
   El plan gratuito solo trae un número de EE. UU.
2. **Escribir la cualificación en el CRM con procedencia**: operación, zona, presupuesto, habitaciones,
   mascota y visita pedida, como hechos de la ficha con `source: explicit` y `sourceRef` a la llamada. Lo que
   extrae este agente es justo lo que la ficha pinta: voz → hechos con procedencia → ficha → siguiente mejor
   acción.
3. **Agenda real**: una tool que consulte y reserve huecos, para confirmar la visita en la misma llamada.
4. **Escenarios en CI**: `lk agent simulate` en cada merge, como hace el template.
