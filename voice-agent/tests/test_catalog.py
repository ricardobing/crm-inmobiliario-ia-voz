"""Tests de catalog.py contra el JSON real (el mismo que usa la web) y contra datos sintéticos."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import catalog
from catalog import (
    Catalogo,
    CatalogoNoDisponible,
    buscar_propiedades,
    busqueda_para_voz,
    cargar_catalogo,
    catalogo_desde_dict,
    detalle_propiedad,
    ficha_para_voz,
    numero_en_letras,
    precio_hablado,
    telefono_hablado,
)


@pytest.fixture(scope="module")
def cat() -> Catalogo:
    """Catálogo real: ../data/kb-propiedades-voz.json."""
    return cargar_catalogo()


def refs(props: list[catalog.Propiedad]) -> list[str]:
    return [p.ref for p in props]


# --- Carga -----------------------------------------------------------------


def test_lee_la_misma_fuente_que_la_web(cat: Catalogo) -> None:
    assert catalog.ruta_catalogo().parts[-2:] == ("data", "kb-propiedades-voz.json")
    assert cat.agencia.nombre == "Miralvento Gestión Inmobiliaria"
    assert len(cat.propiedades) == 6


def test_kb_path_por_variable_de_entorno(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fichero = tmp_path / "kb.json"
    fichero.write_text(json.dumps({"agency": {"name": "Otra"}, "properties": []}), encoding="utf-8")
    monkeypatch.setenv("KB_PATH", str(fichero))
    assert catalog.ruta_catalogo() == fichero
    assert cargar_catalogo().agencia.nombre == "Otra"


def test_fichero_inexistente_o_invalido(tmp_path: Path) -> None:
    with pytest.raises(CatalogoNoDisponible):
        cargar_catalogo(tmp_path / "no-existe.json")
    roto = tmp_path / "roto.json"
    roto.write_text("{no es json", encoding="utf-8")
    with pytest.raises(CatalogoNoDisponible):
        cargar_catalogo(roto)


def test_carga_tolerante_ignora_registros_invalidos() -> None:
    datos = {
        "agency": "no es un objeto",
        "properties": [
            {"ref": "OK-1", "precio": "465.000", "ascensor": "sí", "operacion": "Venta"},
            {"titulo": "sin ref"},
            "basura",
            {"ref": "OK-1", "titulo": "duplicado"},
        ],
    }
    cat = catalogo_desde_dict(datos)
    assert cat.agencia.nombre is None
    assert refs(list(cat.propiedades)) == ["OK-1"]
    p = cat.propiedades[0]
    # Texto con formato es-ES no se parsea; un "sí" no es un booleano.
    assert p.precio is None
    assert p.ascensor is None
    assert p.operacion == "venta"


# --- Búsqueda: escenarios del plan ------------------------------------------


def test_alquiler_majadahonda_1200_con_mascotas(cat: Catalogo) -> None:
    r = buscar_propiedades(
        zona="Majadahonda",
        presupuesto_max=1200,
        operacion="alquiler",
        admite_mascotas=True,
        catalogo=cat,
    )
    assert refs(r.resultados) == ["MIR-2050"]
    assert r.mas_cercanos_por_encima == []


def test_compra_majadahonda_500000_tres_habitaciones(cat: Catalogo) -> None:
    r = buscar_propiedades(
        zona="Majadahonda",
        presupuesto_max=500000,
        operacion="compra",
        habitaciones_min=3,
        catalogo=cat,
    )
    assert refs(r.resultados) == ["MIR-2041"]
    # 520.000 > 500.000: sin tolerancia oculta.
    assert "MIR-2057" not in refs(r.resultados)
    assert r.mas_cercanos_por_encima == []


def test_pozuelo_en_minusculas(cat: Catalogo) -> None:
    assert refs(buscar_propiedades(zona="pozuelo", catalogo=cat).resultados) == ["MIR-2052"]


def test_sabadell_vacio(cat: Catalogo) -> None:
    r = buscar_propiedades(zona="Sabadell", presupuesto_max=300000, catalogo=cat)
    assert r.resultados == []
    assert r.mas_cercanos_por_encima == []
    assert buscar_propiedades(zona="Sabadell", catalogo=cat).resultados == []
    assert "No inventes" in busqueda_para_voz(r)["nota"]


def test_alquiler_las_rozas_1300_mas_cercano_por_encima(cat: Catalogo) -> None:
    r = buscar_propiedades(
        zona="Las Rozas", presupuesto_max=1300, operacion="alquiler", catalogo=cat
    )
    assert r.resultados == []
    assert refs(r.mas_cercanos_por_encima) == ["MIR-2044"]
    voz = busqueda_para_voz(r)
    assert voz["total"] == 0
    assert voz["mas_cercanos_por_encima"][0]["precio_hablado"] == (
        "mil trescientos cincuenta euros al mes"
    )


def test_boadilla_con_planta_y_ascensor_null(cat: Catalogo) -> None:
    r = buscar_propiedades(zona="boadilla", catalogo=cat)
    assert refs(r.resultados) == ["MIR-2060"]
    chalet = r.resultados[0]
    assert chalet.planta is None
    assert chalet.ascensor is None  # null, no False
    ficha = ficha_para_voz(chalet)
    assert ficha["planta"] == "no aplica"
    assert ficha["ascensor"] == "no aplica"


def test_detalle_ref_inexistente(cat: Catalogo) -> None:
    assert detalle_propiedad("MIR-9999", catalogo=cat) is None
    assert detalle_propiedad("", catalogo=cat) is None


def test_detalle_ref_tolerante(cat: Catalogo) -> None:
    for ref in ("MIR-2041", "mir-2041", "MIR 2041", " mir2041 "):
        p = detalle_propiedad(ref, catalogo=cat)
        assert p is not None and p.ref == "MIR-2041"


@pytest.mark.parametrize(
    ("zona", "esperado"),
    [
        ("MAJADAHONDA", {"MIR-2041", "MIR-2050", "MIR-2057"}),
        ("Pozuelo de Alarcon", {"MIR-2052"}),
        ("pozuelo de alarcón", {"MIR-2052"}),
        ("  Boadilla  del Monte ", {"MIR-2060"}),
        # contención en el otro sentido: la consulta es más larga que la zona
        ("Las Rozas de Madrid", {"MIR-2044"}),
    ],
)
def test_zona_sin_mayusculas_ni_tildes(cat: Catalogo, zona: str, esperado: set[str]) -> None:
    assert set(refs(buscar_propiedades(zona=zona, catalogo=cat).resultados)) == esperado


# --- Búsqueda: reglas ---------------------------------------------------------


@pytest.mark.parametrize("operacion", ["compra", "comprar", "venta", "Venta"])
def test_operacion_compra_es_venta(cat: Catalogo, operacion: str) -> None:
    r = buscar_propiedades(operacion=operacion, catalogo=cat)
    assert r.resultados and all(p.operacion == "venta" for p in r.resultados)


@pytest.mark.parametrize("operacion", ["alquiler", "alquilar"])
def test_operacion_alquiler(cat: Catalogo, operacion: str) -> None:
    r = buscar_propiedades(operacion=operacion, catalogo=cat)
    assert r.resultados and all(p.operacion == "alquiler" for p in r.resultados)


def test_operacion_desconocida(cat: Catalogo) -> None:
    with pytest.raises(ValueError):
        buscar_propiedades(operacion="permuta", catalogo=cat)


def test_presupuesto_exacto_entra_y_uno_menos_no(cat: Catalogo) -> None:
    assert refs(
        buscar_propiedades(zona="pozuelo", presupuesto_max=380000, catalogo=cat).resultados
    ) == ["MIR-2052"]
    r = buscar_propiedades(zona="pozuelo", presupuesto_max=379999, catalogo=cat)
    assert r.resultados == []
    assert refs(r.mas_cercanos_por_encima) == ["MIR-2052"]


def test_maximo_tres_resultados_ordenados_por_precio(cat: Catalogo) -> None:
    r = buscar_propiedades(catalogo=cat)
    assert len(r.resultados) == 3
    precios = [p.precio for p in r.resultados]
    assert precios == sorted(precios)


def test_presupuesto_no_positivo(cat: Catalogo) -> None:
    with pytest.raises(ValueError):
        buscar_propiedades(presupuesto_max=0, catalogo=cat)


def test_null_en_mascotas_no_es_false() -> None:
    cat = catalogo_desde_dict(
        {
            "properties": [
                {"ref": "A", "zona": "X", "precio": 100, "admite_mascotas": None},
                {"ref": "B", "zona": "X", "precio": 100, "admite_mascotas": False},
            ]
        }
    )
    r = buscar_propiedades(admite_mascotas=True, catalogo=cat)
    assert refs(r.resultados) == ["A"]
    assert busqueda_para_voz(r)["resultados"][0]["admite_mascotas"] == "no consta"


# --- Formato para voz --------------------------------------------------------


@pytest.mark.parametrize(
    ("precio", "operacion", "esperado"),
    [
        (465000, "venta", "cuatrocientos sesenta y cinco mil euros"),
        (380000, "venta", "trescientos ochenta mil euros"),
        (520000, "venta", "quinientos veinte mil euros"),
        (1350, "alquiler", "mil trescientos cincuenta euros al mes"),
        (1100, "alquiler", "mil cien euros al mes"),
        (1500, "alquiler", "mil quinientos euros al mes"),
        (21000, "venta", "veintiún mil euros"),
        (501000, "venta", "quinientos un mil euros"),
        (1000000, "venta", "un millón de euros"),
        (1250000, "venta", "un millón doscientos cincuenta mil euros"),
        (None, "venta", None),
    ],
)
def test_precio_hablado(
    precio: int | None, operacion: catalog.Operacion, esperado: str | None
) -> None:
    assert precio_hablado(precio, operacion) == esperado


def test_numero_en_letras() -> None:
    assert numero_en_letras(0) == "cero"
    assert numero_en_letras(100) == "cien"
    assert numero_en_letras(101) == "ciento uno"
    assert numero_en_letras(16) == "dieciséis"
    assert numero_en_letras(2_000_000) == "dos millones"


def test_telefono_hablado(cat: Catalogo) -> None:
    assert (
        telefono_hablado(cat.agencia.telefono) == "nueve uno seis, cero cero cero, cero cero cero"
    )
    assert telefono_hablado(None) is None
