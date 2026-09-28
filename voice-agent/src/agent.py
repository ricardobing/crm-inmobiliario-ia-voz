"""Agente de voz de la agencia (LiveKit Agents, Python).

Atiende la llamada, busca en el catálogo `kb-propiedades-voz.json` con tools y cuelga solo al
despedirse (EndCallTool). Estructura basada en el template oficial `agent-starter-python`.
"""

from __future__ import annotations

import json
import logging
import os
import textwrap
from typing import Any, Literal

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    STTContextOptions,
    TurnHandlingOptions,
    cli,
    function_tool,
    inference,
    room_io,
)
from livekit.agents.beta.tools import EndCallTool
from livekit.agents.llm import ToolError
from livekit.plugins import ai_coustics

import catalog

logger = logging.getLogger("agent")

load_dotenv(".env.local")

# Modelos de LiveKit Inference (sin claves de otros proveedores). Configurables por entorno.
# Ver README: qué está verificado en la documentación y qué no.
STT_MODEL = os.environ.get("STT_MODEL", "assemblyai/universal-3-5-pro")
STT_LANGUAGE = os.environ.get("STT_LANGUAGE", "es")
LLM_MODEL = os.environ.get("LLM_MODEL", "google/gemma-4-31b-it")
TTS_MODEL = os.environ.get("TTS_MODEL", "gradium/default")
TTS_VOICE = os.environ.get("TTS_VOICE", "iTQW2xFICXk8riV4")  # "Vera", castellano (es-ES)
TTS_LANGUAGE = os.environ.get("TTS_LANGUAGE", "es")
# Respaldo en el servidor de Inference si falla el TTS principal. "Daniela" es es-MX: mejor que
# quedarse mudo. Cadena vacía para desactivarlo.
TTS_FALLBACK = os.environ.get(
    "TTS_FALLBACK", "cartesia/sonic-3:5c5ad5e7-1020-476b-8b91-fdcbe9cc313c"
)
NOISE_CANCELLATION = os.environ.get("NOISE_CANCELLATION", "1") not in ("0", "false", "False", "")
AGENT_NAME = os.environ.get("AGENT_NAME", "miralvento-voz")


def _json(datos: Any) -> str:
    """JSON compacto en UTF-8 para el LLM (el SDK haría str(dict), con True/None de Python)."""
    return json.dumps(datos, ensure_ascii=False, separators=(",", ":"))


def saludo(agencia: catalog.Agencia) -> str:
    """Saludo fijo (no lo genera el LLM): siempre se identifica como asistente de IA."""
    nombre = agencia.nombre or "la agencia"
    return (
        f"Hola, ha llamado a {nombre}. Le atiende el asistente de inteligencia artificial "
        "de la agencia. ¿Busca vivienda para comprar o para alquilar?"
    )


def instrucciones(cat: catalog.Catalogo) -> str:
    """Prompt de sistema. Nombre, teléfono, horario y zonas salen del JSON, no están escritos a mano."""
    agencia = cat.agencia
    nombre = agencia.nombre or "la agencia"
    telefono = catalog.telefono_hablado(agencia.telefono)
    linea_telefono = (
        f"- Teléfono de la oficina: {telefono}."
        if telefono
        else "- No tienes el teléfono de la oficina. Si lo piden, di que no lo tienes a mano; no lo inventes."
    )
    linea_horario = (
        f"- Horario de la oficina: {agencia.horario_oficina}."
        if agencia.horario_oficina
        else "- No tienes el horario de la oficina. No lo inventes."
    )
    zonas = sorted({p.zona for p in cat.propiedades if p.zona})
    linea_zonas = (
        f"- Zonas con inmuebles en el catálogo ahora mismo: {', '.join(zonas)}."
        if zonas
        else "- El catálogo está vacío ahora mismo."
    )

    return textwrap.dedent(
        f"""\
        Eres el asistente de inteligencia artificial de {nombre}, una agencia inmobiliaria.
        Atiendes por teléfono a personas que quieren comprar o alquilar vivienda.

        # Cómo hablas
        - Castellano de España. Trata al cliente de usted, con amabilidad y sin rodeos.
        - Es una llamada de voz: frases cortas, una o dos por turno. Una sola pregunta por turno.
        - Solo texto plano. Nada de listas, markdown, emojis, asteriscos ni símbolos.
        - Escribe los números con letras. Los precios, dilos exactamente como vienen en el campo
          precio_hablado de las herramientas, por ejemplo "cuatrocientos sesenta y cinco mil euros"
          o "mil trescientos cincuenta euros al mes". Las horas, como se dicen: "de diez a dos".
        - No leas referencias internas como "MIR-2041" salvo que el cliente la pida: nombra el
          inmueble por cómo es y dónde está. No menciones herramientas ni detalles técnicos.
        - Ya te has presentado como asistente de inteligencia artificial. Si preguntan si eres una
          persona, di con naturalidad que no, que eres el asistente de inteligencia artificial.

        # Qué haces
        - Averigua sin interrogar lo que falte de esto: comprar o alquilar, zona, presupuesto
          máximo y habitaciones. Pregunta una cosa cada vez.
        - En cuanto tengas la zona o la operación, llama a buscar_propiedades con lo que sepas.
          El presupuesto va en euros, como número entero; en alquiler, euros al mes.
          Si tiene mascota, pasa admite_mascotas a verdadero.
        - Presenta como mucho dos inmuebles por turno, con lo esencial, y pregunta si quiere
          más detalles de alguno. Para detalles o visitas, usa detalle_propiedad.

        # Veracidad: lo más importante
        - Solo hablas de inmuebles que te devuelvan las herramientas en esta llamada. Nunca
          inventes inmuebles, precios, direcciones, disponibilidad ni características.
        - Si preguntan por un inmueble concreto, una calle o un anuncio que no aparece en las
          herramientas, di que no lo tienes en el catálogo y no des ningún precio. Ofrece que un
          agente de la oficina le llame.
        - Si la búsqueda no devuelve nada, dilo con claridad y ofrece que le llame un agente.
        - Si llegan inmuebles en mas_cercanos_por_encima, di con honestidad que se salen de su
          presupuesto, di cuánto cuestan y pregunta si le interesan igualmente.
        - Si un dato viene como "no aplica" o "no consta", no lo conviertas en un no.

        # Visitas
        - Si quiere visitar un inmueble, mira su horario_visitas con detalle_propiedad.
        - Pide su nombre y la franja que prefiere dentro de ese horario. Si propone una franja
          fuera del horario, díselo y ofrécele las franjas disponibles.
        - No tienes agenda: no confirmes la cita. Di que tomas nota y que un agente de la oficina
          le llamará para confirmarla.

        # Datos de la oficina
        {linea_telefono}
        {linea_horario}
        {linea_zonas}

        # Final de la llamada
        - Cuando el cliente se despida o diga que no necesita nada más, llama a end_call sin decir
          nada antes: la despedida la dices justo después de llamarla.
        - No cuelgues si el cliente pide esperar, duda o aún tiene preguntas.
        - Si en el mismo mensaje hay una despedida y además una pregunta, una corrección o una petición
          («¿no tendría algo de cuatro habitaciones? Gracias, adiós»), primero busca y responde. No
          llames a end_call en ese turno: cuelga solo cuando ya no quede nada pendiente.
        - Si el cliente cambia de operación o de zona, llama a buscar_propiedades enseguida con lo que ya
          sabes y responde con el resultado antes de pedir más datos.
        """
    )


class AsistenteInmobiliaria(Agent):
    """Agente de la agencia con las tools del catálogo y la de colgar."""

    def __init__(self, cat: catalog.Catalogo) -> None:
        self._catalogo = cat
        nombre = cat.agencia.nombre or "la agencia"
        end_call = EndCallTool(
            extra_description=(
                "Úsala cuando el cliente se despida (por ejemplo: 'vale, gracias, adiós') "
                "o confirme que no necesita nada más. Nunca en un turno que todavía contiene "
                "una pregunta o una petición sin responder: primero respóndela."
            ),
            end_instructions=(
                f"Despídete en una sola frase corta, en castellano de España, dando las gracias "
                f"por llamar a {nombre}. No hagas ninguna pregunta más."
            ),
        )
        super().__init__(
            instructions=instrucciones(cat),
            llm=inference.LLM(model=LLM_MODEL),
            tools=end_call.tools,
        )

    @function_tool()
    async def buscar_propiedades(
        self,
        context: RunContext,
        zona: str | None = None,
        presupuesto_max: int | None = None,
        operacion: Literal["compra", "alquiler"] | None = None,
        habitaciones_min: int | None = None,
        admite_mascotas: bool | None = None,
    ) -> str:
        """Busca inmuebles en el catálogo de la agencia. Úsala antes de hablar de cualquier inmueble.

        Devuelve como máximo tres resultados. Si no hay ninguno dentro del presupuesto, puede
        devolver aparte los más cercanos por encima, que no entran en el presupuesto.

        Args:
            zona: Municipio o zona que pide el cliente, por ejemplo "Majadahonda". Omitir si no lo ha dicho.
            presupuesto_max: Presupuesto máximo en euros, número entero. En alquiler, euros al mes.
            operacion: "compra" si quiere comprar, "alquiler" si quiere alquilar.
            habitaciones_min: Número mínimo de habitaciones que necesita.
            admite_mascotas: true si tiene mascota y necesita que se admitan.
        """
        logger.info(
            "buscar_propiedades zona=%r presupuesto_max=%r operacion=%r habitaciones_min=%r mascotas=%r",
            zona,
            presupuesto_max,
            operacion,
            habitaciones_min,
            admite_mascotas,
        )
        try:
            resultado = catalog.buscar_propiedades(
                zona=zona,
                presupuesto_max=presupuesto_max,
                operacion=operacion,
                habitaciones_min=habitaciones_min,
                admite_mascotas=admite_mascotas,
                catalogo=self._catalogo,
            )
        except ValueError as exc:
            raise ToolError(str(exc)) from exc
        return _json(catalog.busqueda_para_voz(resultado))

    @function_tool()
    async def detalle_propiedad(self, context: RunContext, ref: str) -> str:
        """Ficha completa de un inmueble: habitaciones, baños, metros, planta, ascensor, garaje, mascotas y horario de visitas.

        Args:
            ref: Referencia del inmueble tal como la devolvió buscar_propiedades, por ejemplo "MIR-2041".
        """
        logger.info("detalle_propiedad ref=%r", ref)
        propiedad = catalog.detalle_propiedad(ref, catalogo=self._catalogo)
        if propiedad is None:
            return _json(
                {
                    "encontrado": False,
                    "nota": "Esa referencia no está en el catálogo. No inventes datos.",
                }
            )
        return _json({"encontrado": True, **catalog.ficha_para_voz(propiedad)})


# En Windows, arrancar cada proceso del agente (carga de plugins y modelos locales) puede pasar de los 10 s por
# defecto y la simulación falla por timeout: margen configurable y un solo proceso en reserva.
server = AgentServer(
    initialize_process_timeout=float(os.getenv("AGENT_INIT_TIMEOUT", "60")),
    num_idle_processes=int(os.getenv("AGENT_IDLE_PROCESSES", "1")),
)


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}

    # Falla pronto y con un mensaje claro si el JSON no está: sin catálogo no hay agente.
    cat = catalog.cargar_catalogo()
    logger.info(
        "catálogo cargado: %s, %d inmuebles (%s)",
        cat.agencia.nombre,
        len(cat.propiedades),
        catalog.ruta_catalogo(),
    )

    # Nombres propios del catálogo para que el STT no los destroce ("Majadahonda", "Boadilla"...).
    keyterms = sorted({p.zona for p in cat.propiedades if p.zona})
    if cat.agencia.nombre:
        keyterms.append(cat.agencia.nombre)

    tts_kwargs: dict[str, Any] = {"voice": TTS_VOICE, "language": TTS_LANGUAGE}
    if TTS_FALLBACK:
        tts_kwargs["fallback"] = TTS_FALLBACK

    session = AgentSession(
        stt=inference.STT(model=STT_MODEL, language=STT_LANGUAGE),
        stt_context_options=STTContextOptions(keyterms=keyterms),
        tts=inference.TTS(model=TTS_MODEL, **tts_kwargs),
        turn_handling=TurnHandlingOptions(
            # Detector de fin de turno por audio; admite español (docs: turn-detector).
            turn_detection=inference.TurnDetector(),
            # Barge-in: si el cliente habla encima, el agente se calla y atiende.
            interruption={"mode": "adaptive"},
            preemptive_generation={"enabled": True},
        ),
    )

    room_options = (
        room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        )
        if NOISE_CANCELLATION
        else room_io.RoomOptions()
    )

    await session.start(agent=AsistenteInmobiliaria(cat), room=ctx.room, room_options=room_options)
    await ctx.connect()

    # Saludo fijo: la identificación como IA no depende de lo que decida el LLM.
    session.say(saludo(cat.agencia))


if __name__ == "__main__":
    cli.run_app(server)
