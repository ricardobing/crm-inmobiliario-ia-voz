"""Catálogo de inmuebles de la agencia para el agente de voz.

Lee `kb-propiedades-voz.json`, la misma fuente que usa la web (no se copia). Todo lo que hay
aquí son funciones puras sobre un `Catalogo` ya cargado, salvo `cargar_catalogo`, que lee el
fichero. Sin dependencias del SDK de LiveKit, para poder probarlo con pytest sin credenciales.
"""

from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger("catalog")

Operacion = Literal["venta", "alquiler"]

# Raíz de voice-agent/. Las rutas relativas de KB_PATH se resuelven contra ella, no contra el CWD.
PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_KB_PATH = "../data/kb-propiedades-voz.json"

MAX_RESULTADOS = 3
MAX_CERCANOS = 2

# Lo que el cliente puede decir → valor del catálogo. "compra" del cliente es "venta" en el catálogo.
_OPERACIONES: dict[str, Operacion] = {
    "compra": "venta",
    "comprar": "venta",
    "venta": "venta",
    "alquiler": "alquiler",
    "alquilar": "alquiler",
}

NO_APLICA = "no aplica"
NO_CONSTA = "no consta"


class CatalogoNoDisponible(RuntimeError):
    """El fichero del catálogo no existe o no es JSON válido."""


@dataclass(frozen=True)
class Agencia:
    """Datos de la agencia. Cualquier campo puede faltar en el JSON."""

    nombre: str | None = None
    telefono: str | None = None
    horario_oficina: str | None = None


@dataclass(frozen=True)
class Propiedad:
    """Un inmueble del catálogo. `None` significa "no aplica / no consta", nunca False."""

    ref: str
    titulo: str | None = None
    operacion: Operacion | None = None
    zona: str | None = None
    precio: int | None = None
    habitaciones: int | None = None
    banos: int | None = None
    m2: int | None = None
    planta: int | None = None
    ascensor: bool | None = None
    plaza_garaje: bool | None = None
    admite_mascotas: bool | None = None
    descripcion_corta: str | None = None
    horario_visitas: str | None = None


@dataclass(frozen=True)
class Catalogo:
    """Agencia más su lista de inmuebles válidos."""

    agencia: Agencia
    propiedades: tuple[Propiedad, ...]


@dataclass(frozen=True)
class ResultadoBusqueda:
    """Resultado de `buscar_propiedades`.

    `mas_cercanos_por_encima` solo se rellena si no hay resultados y se pasó presupuesto: son
    inmuebles que cumplen el resto de filtros pero cuestan más. Van aparte para que el agente
    diga con honestidad que se salen del presupuesto.
    """

    resultados: list[Propiedad] = field(default_factory=list)
    mas_cercanos_por_encima: list[Propiedad] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Carga tolerante
# ---------------------------------------------------------------------------


def _str_o_none(valor: Any) -> str | None:
    """Texto no vacío o None."""
    if isinstance(valor, str) and valor.strip():
        return valor.strip()
    return None


def _int_o_none(valor: Any) -> int | None:
    """Entero o None. Acepta float entero; nunca parsea texto ni acepta bool."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int):
        return valor
    if isinstance(valor, float) and valor.is_integer():
        return int(valor)
    return None


def _bool_o_none(valor: Any) -> bool | None:
    """Booleano o None (null = no aplica/no consta)."""
    return valor if isinstance(valor, bool) else None


def _operacion_catalogo(valor: Any) -> Operacion | None:
    """Operación del catálogo normalizada ("venta" | "alquiler") o None."""
    if not isinstance(valor, str):
        return None
    return _OPERACIONES.get(_normalizar(valor))


def _propiedad_desde_dict(dato: Any) -> Propiedad | None:
    """Construye una Propiedad; devuelve None (y avisa en el log) si no tiene ref."""
    if not isinstance(dato, dict):
        logger.warning("inmueble ignorado: no es un objeto JSON")
        return None
    ref = _str_o_none(dato.get("ref"))
    if ref is None:
        logger.warning("inmueble ignorado: sin ref")
        return None
    return Propiedad(
        ref=ref,
        titulo=_str_o_none(dato.get("titulo")),
        operacion=_operacion_catalogo(dato.get("operacion")),
        zona=_str_o_none(dato.get("zona")),
        precio=_int_o_none(dato.get("precio")),
        habitaciones=_int_o_none(dato.get("habitaciones")),
        banos=_int_o_none(dato.get("banos")),
        m2=_int_o_none(dato.get("m2")),
        planta=_int_o_none(dato.get("planta")),
        ascensor=_bool_o_none(dato.get("ascensor")),
        plaza_garaje=_bool_o_none(dato.get("plaza_garaje")),
        admite_mascotas=_bool_o_none(dato.get("admite_mascotas")),
        descripcion_corta=_str_o_none(dato.get("descripcion_corta")),
        horario_visitas=_str_o_none(dato.get("horario_visitas")),
    )


def catalogo_desde_dict(datos: Any) -> Catalogo:
    """Convierte el JSON ya parseado en un Catalogo, ignorando los registros inválidos."""
    if not isinstance(datos, dict):
        logger.warning("catálogo vacío: la raíz del JSON no es un objeto")
        return Catalogo(agencia=Agencia(), propiedades=())

    agencia_raw = datos.get("agency")
    agencia_raw = agencia_raw if isinstance(agencia_raw, dict) else {}
    agencia = Agencia(
        nombre=_str_o_none(agencia_raw.get("name")),
        telefono=_str_o_none(agencia_raw.get("phone")),
        horario_oficina=_str_o_none(agencia_raw.get("horario_oficina")),
    )

    lista = datos.get("properties")
    lista = lista if isinstance(lista, list) else []
    propiedades: list[Propiedad] = []
    refs_vistas: set[str] = set()
    for item in lista:
        prop = _propiedad_desde_dict(item)
        if prop is None:
            continue
        if prop.ref in refs_vistas:
            logger.warning("inmueble duplicado ignorado: %s", prop.ref)
            continue
        refs_vistas.add(prop.ref)
        propiedades.append(prop)
    return Catalogo(agencia=agencia, propiedades=tuple(propiedades))


def ruta_catalogo() -> Path:
    """Ruta del JSON: KB_PATH si existe; si no, ../data/kb-propiedades-voz.json (relativa a voice-agent/)."""
    ruta = Path(os.environ.get("KB_PATH") or DEFAULT_KB_PATH)
    return ruta if ruta.is_absolute() else (PROJECT_DIR / ruta).resolve()


def cargar_catalogo(ruta: str | Path | None = None) -> Catalogo:
    """Lee y valida el catálogo. Lanza CatalogoNoDisponible si el fichero falta o no es JSON."""
    ruta_final = Path(ruta) if ruta is not None else ruta_catalogo()
    try:
        texto = ruta_final.read_text(encoding="utf-8")
    except OSError as exc:
        raise CatalogoNoDisponible(f"No se pudo leer el catálogo en {ruta_final}: {exc}") from exc
    try:
        datos = json.loads(texto)
    except json.JSONDecodeError as exc:
        raise CatalogoNoDisponible(f"El catálogo en {ruta_final} no es JSON válido: {exc}") from exc
    return catalogo_desde_dict(datos)


@lru_cache(maxsize=1)
def catalogo_por_defecto() -> Catalogo:
    """Catálogo de `ruta_catalogo()`, cacheado para no releer el fichero en cada tool call."""
    return cargar_catalogo()


# ---------------------------------------------------------------------------
# Búsqueda
# ---------------------------------------------------------------------------


def _normalizar(texto: str) -> str:
    """Minúsculas, sin tildes y sin signos: "Pozuelo de Alarcón" → "pozuelo de alarcon"."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )
    solo_alfanum = re.sub(r"[^a-z0-9]+", " ", sin_tildes.lower())
    return " ".join(solo_alfanum.split())


def normalizar_operacion(operacion: str | None) -> Operacion | None:
    """ "compra"/"comprar"/"venta" → "venta"; "alquiler"/"alquilar" → "alquiler". ValueError si no."""
    if operacion is None or not operacion.strip():
        return None
    valor = _OPERACIONES.get(_normalizar(operacion))
    if valor is None:
        raise ValueError(f"Operación no reconocida: {operacion!r} (usa compra o alquiler)")
    return valor


def coincide_zona(consulta: str, zona: str | None) -> bool:
    """Contención en los dos sentidos, sin mayúsculas ni tildes ("pozuelo" ↔ "Pozuelo de Alarcón")."""
    if zona is None:
        return False
    a, b = _normalizar(consulta), _normalizar(zona)
    if not a or not b:
        return False
    return a in b or b in a


def buscar_propiedades(
    zona: str | None = None,
    presupuesto_max: int | float | None = None,
    operacion: str | None = None,
    habitaciones_min: int | None = None,
    admite_mascotas: bool | None = None,
    *,
    catalogo: Catalogo | None = None,
) -> ResultadoBusqueda:
    """Filtra el catálogo. Devuelve como máximo 3 resultados, del más barato al más caro.

    - zona: sin mayúsculas ni tildes, por contención en los dos sentidos.
    - presupuesto_max: precio <= presupuesto, sin tolerancia. Sin precio conocido no entra.
    - operacion: "compra" → venta, "alquiler" → alquiler (también "venta" y "alquilar").
    - habitaciones_min: habitaciones >= mínimo. Sin dato no entra.
    - admite_mascotas: solo excluye si el catálogo dice lo contrario; null = no consta, pasa.
    Si no hay resultados y hay presupuesto, añade aparte los más cercanos por encima.
    """
    cat = catalogo if catalogo is not None else catalogo_por_defecto()
    op = normalizar_operacion(operacion)
    zona_q = zona if zona is not None and zona.strip() else None
    if presupuesto_max is not None and presupuesto_max <= 0:
        raise ValueError("El presupuesto tiene que ser positivo")

    def cumple_sin_presupuesto(p: Propiedad) -> bool:
        if zona_q is not None and not coincide_zona(zona_q, p.zona):
            return False
        if op is not None and p.operacion != op:
            return False
        if habitaciones_min is not None and (
            p.habitaciones is None or p.habitaciones < habitaciones_min
        ):
            return False
        # null no es False: solo se descarta si el catálogo contradice lo pedido.
        return not (
            admite_mascotas is not None
            and p.admite_mascotas is not None
            and p.admite_mascotas != admite_mascotas
        )

    def por_precio(p: Propiedad) -> tuple[bool, int]:
        return (p.precio is None, p.precio or 0)

    candidatos = [p for p in cat.propiedades if cumple_sin_presupuesto(p)]
    if presupuesto_max is None:
        resultados = sorted(candidatos, key=por_precio)
        return ResultadoBusqueda(resultados=resultados[:MAX_RESULTADOS])

    resultados = sorted(
        (p for p in candidatos if p.precio is not None and p.precio <= presupuesto_max),
        key=por_precio,
    )
    if resultados:
        return ResultadoBusqueda(resultados=resultados[:MAX_RESULTADOS])

    por_encima = sorted(
        (p for p in candidatos if p.precio is not None and p.precio > presupuesto_max),
        key=por_precio,
    )
    return ResultadoBusqueda(resultados=[], mas_cercanos_por_encima=por_encima[:MAX_CERCANOS])


def _normalizar_ref(ref: str) -> str:
    """ "mir 2041", "MIR-2041" → "MIR2041"."""
    return re.sub(r"[^A-Z0-9]", "", ref.upper())


def detalle_propiedad(ref: str, *, catalogo: Catalogo | None = None) -> Propiedad | None:
    """Ficha de un inmueble por referencia (tolerante a mayúsculas y guiones), o None."""
    cat = catalogo if catalogo is not None else catalogo_por_defecto()
    buscada = _normalizar_ref(ref or "")
    if not buscada:
        return None
    for p in cat.propiedades:
        if _normalizar_ref(p.ref) == buscada:
            return p
    return None


# ---------------------------------------------------------------------------
# Formato para voz
# ---------------------------------------------------------------------------

_BASICOS = [
    "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
    "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
    "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
]  # fmt: skip
_DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]  # fmt: skip
_CENTENAS = [
    "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
    "seiscientos", "setecientos", "ochocientos", "novecientos",
]  # fmt: skip


def _hasta_99(n: int, apocope: bool) -> str:
    if n < 30:
        palabra = _BASICOS[n]
        if apocope and palabra == "uno":
            return "un"
        if apocope and palabra == "veintiuno":
            return "veintiún"
        return palabra
    decena, unidad = divmod(n, 10)
    if unidad == 0:
        return _DECENAS[decena]
    return f"{_DECENAS[decena]} y {'un' if apocope and unidad == 1 else _BASICOS[unidad]}"


def _hasta_999(n: int, apocope: bool) -> str:
    if n == 100:
        return "cien"
    centena, resto = divmod(n, 100)
    partes = [_CENTENAS[centena]] if centena else []
    if resto:
        partes.append(_hasta_99(resto, apocope))
    return " ".join(partes)


def numero_en_letras(n: int, *, apocope: bool = False) -> str:
    """Entero (0 a 999.999.999) en letras en castellano. `apocope` da "un"/"veintiún" ante sustantivo."""
    if n < 0 or n >= 1_000_000_000:
        return str(n)
    if n == 0:
        return "cero"
    millones, resto = divmod(n, 1_000_000)
    miles, unidades = divmod(resto, 1000)
    partes: list[str] = []
    if millones:
        partes.append("un millón" if millones == 1 else f"{_hasta_999(millones, True)} millones")
    if miles:
        partes.append("mil" if miles == 1 else f"{_hasta_999(miles, True)} mil")
    if unidades:
        partes.append(_hasta_999(unidades, apocope))
    return " ".join(partes)


def precio_hablado(precio: int | None, operacion: Operacion | None) -> str | None:
    """Precio como lo diría una persona: "mil trescientos cincuenta euros al mes"."""
    if precio is None:
        return None
    if precio == 1:
        texto = "un euro"
    else:
        cifra = numero_en_letras(precio, apocope=True)
        # "un millón de euros", pero "un millón doscientos mil euros".
        de = " de" if precio >= 1_000_000 and precio % 1_000_000 == 0 else ""
        texto = f"{cifra}{de} euros"
    return f"{texto} al mes" if operacion == "alquiler" else texto


def telefono_hablado(telefono: str | None) -> str | None:
    """ "+34 916 000 000" → "nueve uno seis, cero cero cero, cero cero cero" (sin prefijo de España)."""
    if telefono is None:
        return None
    digitos = re.sub(r"\D", "", telefono)
    if telefono.strip().startswith("+34") and len(digitos) == 11:
        digitos = digitos[2:]
    if not digitos:
        return None
    grupos = [digitos[i : i + 3] for i in range(0, len(digitos), 3)]
    return ", ".join(" ".join(_BASICOS[int(d)] for d in grupo) for grupo in grupos)


def _si_no(valor: bool | None, si_null: str) -> str:
    if valor is None:
        return si_null
    return "sí" if valor else "no"


def resumen_para_voz(p: Propiedad) -> dict[str, Any]:
    """Campos justos para hablar de un inmueble en una lista de resultados."""
    return {
        "ref": p.ref,
        "titulo": p.titulo,
        "zona": p.zona,
        "operacion": p.operacion,
        "precio_hablado": precio_hablado(p.precio, p.operacion) or NO_CONSTA,
        "habitaciones": p.habitaciones if p.habitaciones is not None else NO_CONSTA,
        "admite_mascotas": _si_no(p.admite_mascotas, NO_CONSTA),
        "descripcion_corta": p.descripcion_corta,
    }


def ficha_para_voz(p: Propiedad) -> dict[str, Any]:
    """Ficha completa para voz. Planta y ascensor null → "no aplica" (p. ej. un chalet), nunca "no"."""
    return {
        "ref": p.ref,
        "titulo": p.titulo,
        "zona": p.zona,
        "operacion": p.operacion,
        "precio_hablado": precio_hablado(p.precio, p.operacion) or NO_CONSTA,
        "habitaciones": p.habitaciones if p.habitaciones is not None else NO_CONSTA,
        "banos": p.banos if p.banos is not None else NO_CONSTA,
        "metros_cuadrados": p.m2 if p.m2 is not None else NO_CONSTA,
        "planta": p.planta if p.planta is not None else NO_APLICA,
        "ascensor": _si_no(p.ascensor, NO_APLICA),
        "plaza_garaje": _si_no(p.plaza_garaje, NO_CONSTA),
        "admite_mascotas": _si_no(p.admite_mascotas, NO_CONSTA),
        "descripcion_corta": p.descripcion_corta,
        "horario_visitas": p.horario_visitas or NO_CONSTA,
    }


def busqueda_para_voz(resultado: ResultadoBusqueda) -> dict[str, Any]:
    """Resultado de búsqueda listo para la tool: resultados y, aparte, los que se pasan de precio."""
    salida: dict[str, Any] = {
        "total": len(resultado.resultados),
        "resultados": [resumen_para_voz(p) for p in resultado.resultados],
    }
    if resultado.mas_cercanos_por_encima:
        salida["mas_cercanos_por_encima"] = [
            resumen_para_voz(p) for p in resultado.mas_cercanos_por_encima
        ]
        salida["nota"] = (
            "Ninguno entra en el presupuesto. Los de mas_cercanos_por_encima cuestan más: "
            "dilo así y pregunta si le interesan igualmente."
        )
    elif not resultado.resultados:
        salida["nota"] = (
            "No hay inmuebles en el catálogo con esos criterios. No inventes ninguno: "
            "ofrece que le llame un agente de la oficina."
        )
    return salida
