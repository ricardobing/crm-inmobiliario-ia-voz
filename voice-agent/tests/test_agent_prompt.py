"""Tests sin credenciales: el prompt y el saludo salen del JSON, y scenarios.yaml es válido.

Importar agent.py también comprueba que las APIs del SDK que usa existen de verdad.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

import agent
import catalog


@pytest.fixture(scope="module")
def cat() -> catalog.Catalogo:
    return catalog.cargar_catalogo()


def test_saludo_se_identifica_como_ia_con_el_nombre_del_json(cat: catalog.Catalogo) -> None:
    texto = agent.saludo(cat.agencia)
    assert cat.agencia.nombre is not None
    assert cat.agencia.nombre in texto
    assert "inteligencia artificial" in texto
    assert texto.count("?") == 1  # una sola pregunta


def test_saludo_sin_nombre_no_inventa() -> None:
    assert "la agencia" in agent.saludo(catalog.Agencia())


def test_instrucciones_usan_datos_del_json(cat: catalog.Catalogo) -> None:
    texto = agent.instrucciones(cat)
    assert cat.agencia.nombre is not None and cat.agencia.nombre in texto
    assert cat.agencia.horario_oficina is not None and cat.agencia.horario_oficina in texto
    assert "nueve uno seis, cero cero cero, cero cero cero" in texto
    assert "end_call" in texto
    assert "Nunca" in texto and "inventes" in texto


def test_instrucciones_sin_telefono_ni_horario() -> None:
    texto = agent.instrucciones(catalog.Catalogo(agencia=catalog.Agencia(), propiedades=()))
    assert "no lo inventes" in texto
    assert "No lo inventes" in texto


def test_scenarios_yaml() -> None:
    ruta = Path(__file__).resolve().parent.parent / "scenarios.yaml"
    datos = yaml.safe_load(ruta.read_text(encoding="utf-8"))
    escenarios = datos["scenarios"]
    assert len(escenarios) >= 6
    for e in escenarios:
        assert e["label"] and e["instructions"] and e["agent_expectations"]
