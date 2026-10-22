"""Lo que devuelve el análisis de foto se vuelve el inventario que ve el
transportista: una negativa del modelo no puede entrar como un objeto más."""
import pytest

from app.api.orders import recognized_items


def test_each_line_is_an_item():
    assert recognized_items('1 sofá grande\n2 sillas\n\n50 sacos de cemento\n') == [
        '1 sofá grande', '2 sillas', '50 sacos de cemento']


def test_list_bullets_are_dropped():
    assert recognized_items('- 1 cama\n• 2 veladores\n* 1 cómoda') == ['1 cama', '2 veladores', '1 cómoda']


@pytest.mark.parametrize('text', [
    'Lo siento, no puedo ayudar con eso.',
    'Lo siento, no puedo analizar imágenes.',
    'No puedo identificar objetos en esta imagen.',
    'NINGUNO',
    "I'm sorry, I can't help with that.",
])
def test_a_refusal_is_not_an_item(text):
    assert recognized_items(text) == []


def test_a_refusal_among_items_is_dropped():
    assert recognized_items('1 cama queen\nLo siento, no puedo ayudar con eso.\n1 refrigerador') == [
        '1 cama queen', '1 refrigerador']


def test_no_content_is_no_items():
    assert recognized_items(None) == []
