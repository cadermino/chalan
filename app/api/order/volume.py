"""Cuántos m³ lleva una mudanza, a partir de su lista de cosas (`orders.comments`).

En Lima el precio de una mudanza sigue a lo que se lleva, no a la distancia, así
que es el dato principal para calcularla con las tarifas de una empresa
(`rates_formula.py`). La lista es texto libre, una cosa por línea con su
cantidad ("2 sillas", "1 refrigeradora"); la escriben el cliente o la IA de las
fotos del paso 2.

Cada parte de una línea se busca en un catálogo de volúmenes típicos con sus
sinónimos peruanos. Vale la primera cosa que nombra ("8 sillas de comedor" son
sillas), y entre nombres que empiezan igual, el más largo ("sofá cama" antes
que "sofá"). Lo que trae medidas ("0.85m x 0.50m x 0.50m", "2x2x0.5") o su
volumen ("4 cajas de 1 m3") se calcula con eso por su cantidad, y si el cliente
escribe el total ("28 m3") manda ese. Un número con unidad ("80 litros", "50
mm") es una medida, no una cantidad. Lo que no se reconoce cuenta como una cosa
mediana si parece una cosa, y como nada si es una frase (una nota). A la suma
se le agrega un 25%: las cosas no encajan perfecto en el camión.

Probado con las listas de 178 órdenes de producción (noviembre de 2026): el
catálogo reconoce el 87% de las partes. Las listas se quedan cortas (se escribe
lo grande y no las cajas), así que el total tiende a ser bajo.
"""
import re
import unicodedata

PACKING_FACTOR = 1.25
UNKNOWN_ITEM_M3 = 0.3
# Una parte con más palabras que esto es una nota, no una cosa.
NOTE_WORDS = 6

# clave: (m³ por unidad, nombre, sinónimos)
CATALOG = {
    'refrigeradora_grande': (1.5, 'Refrigeradora grande', [
        'refrigeradora de 2 puertas', 'refrigeradora de dos puertas', 'refri de 2 puertas', 'side by side',
        'refrigeradora grande', 'refrigeradora de 450', 'refrigeradora de 500', 'refrigeradoras de 450']),
    'refrigeradora': (1.0, 'Refrigeradora', [
        'refrigeradora', 'refrigerador', 'refri', 'frigider', 'frigidaire', 'frigorifico', 'nevera', 'heladera',
        'congeladora', 'congelador', 'conservadora', 'camara de conservacion', 'visicooler', 'visiculer',
        'refresquera']),
    'frigobar': (0.3, 'Frigobar', ['frigobar', 'minibar', 'frigobar']),
    'lavadora': (0.5, 'Lavadora', ['lavadora', 'lavaseca', 'lava seca', 'secadora', 'lavavajilla', 'lavavajillas']),
    'cocina': (0.5, 'Cocina', ['cocina', 'cocineta', 'estufa']),
    'electro_chico': (0.15, 'Electrodoméstico chico', [
        'microondas', 'horno', 'freidora', 'hervidor', 'licuadora', 'batidora', 'olla arrocera', 'arrocera',
        'sanguchera', 'cafetera', 'tostadora', 'extractor']),
    'televisor_grande': (0.4, 'Televisor grande', [
        'televisor de 65', 'televisor de 75', 'tv de 65', 'tv de 75', 'televisor grande', 'tv grande']),
    'televisor': (0.25, 'Televisor', ['televisor', 'television', 'tv', 'smart tv', 'tele', 'monitor']),
    'sofa_cama': (1.5, 'Sofá cama', ['sofa cama', 'sofacama', 'futon']),
    'juego_sala': (3.5, 'Juego de sala', [
        'juego de sala', 'juegos de sala', 'juego de muebles', 'juegos de muebles', 'jueglo de muebles',
        'juego de sofa', 'juego de sofas',
        'muebles de sala', 'mueble de sala', 'mueble sala', 'sala completa']),
    'sofa_l': (2.5, 'Sofá en L', ['sofa en l', 'sofa l', 'seccional', 'esquinero', 'mueble en l']),
    'sofa_3': (1.8, 'Sofá de 3 cuerpos', [
        'sofa de 3', 'sofa 3', 'sillon de 3', 'sillon 3', 'mueble de 3', '3 cuerpos', 'tres cuerpos', 'sofa de tres',
        'sillon de tres', 'sofa grande', '3 puestos', 'tres puestos']),
    'sofa_2': (1.2, 'Sofá de 2 cuerpos', [
        'sofa de 2', 'sofa 2', 'sillon de 2', 'mueble de 2', '2 cuerpos', 'dos cuerpos', 'loveseat']),
    'sillon': (0.7, 'Sillón', ['sillon', 'butaca', 'poltrona', 'reclinable', '1 cuerpo', 'un cuerpo']),
    'sofa': (1.5, 'Sofá', ['sofa', 'couch']),
    'cama_king': (2.0, 'Cama king o queen', ['cama king', 'cama queen', 'cama de 2 plazas y media', 'king', 'queen']),
    'cama_2': (1.5, 'Cama de 2 plazas', [
        'cama de 2 plazas', 'cama 2 plazas', 'cama de dos plazas', 'cama matrimonial', 'cama de matrimonio',
        '2 plazas', 'dos plazas']),
    'cama_15': (1.0, 'Cama de plaza y media', [
        'cama de plaza y media', 'cama plaza y media', 'cama de 1.5', 'plaza y media', '1 1/2 plaza']),
    'cama_1': (0.8, 'Cama de 1 plaza', [
        'cama de 1 plaza', 'cama 1 plaza', 'cama de una plaza', 'cama individual', 'cama de nino', 'camarote',
        'camarotes', 'litera']),
    'cama': (1.2, 'Cama', ['cama', 'box spring', 'boxspring', 'tarima', 'base de cama', 'divan']),
    'colchon': (0.5, 'Colchón', ['colchon', 'colchoneta']),
    'cabecera': (0.2, 'Cabecera', ['cabecera', 'respaldar', 'respaldo de cama']),
    'cuna': (0.6, 'Cuna', ['cuna', 'corral']),
    'velador': (0.15, 'Velador', ['velador', 'mesa de noche', 'mesita de noche', 'nochero']),
    'comoda': (0.6, 'Cómoda', ['comoda', 'cajonera', 'chifonier', 'tocador', 'maquillador', 'peinador']),
    'ropero_grande': (1.8, 'Ropero grande', [
        'ropero grande', 'ropero de 3', 'ropero de 4', 'closet grande', 'armario grande', 'ropero de tres',
        'ropero de cuatro']),
    'ropero': (1.2, 'Ropero', [
        'ropero', 'closet', 'armario', 'guardarropa', 'placard', 'placares', 'ordenador de ropa',
        'organizador de ropa']),
    'escritorio': (0.6, 'Escritorio', [
        'escritorio', 'mesa de computadora', 'mueble de computadora', 'modulo de computo', 'mesa de estudio', 'desk']),
    'silla': (0.15, 'Silla', [
        'silla', 'banco', 'banca', 'taburete', 'banqueta', 'puff', 'puf', 'otoman', 'pouf', 'chairs', 'chair']),
    'comedor': (1.5, 'Juego de comedor', ['juego de comedor', 'juegos de comedor', 'comedor completo', 'comedor']),
    'mesa_centro': (0.3, 'Mesa de centro', [
        'mesa de centro', 'mesa centro', 'mesa baja', 'mesa auxiliar', 'mesa lateral', 'mesita', 'mesilla',
        'mesa de arrime', 'mesa plegable']),
    'mesa': (0.6, 'Mesa', ['mesa', 'tablero']),
    'aparador': (0.8, 'Aparador o vitrina', [
        'aparador', 'bufete', 'buffet', 'vitrina', 'cristalero', 'bar', 'barra', 'consola', 'credenza', 'counter']),
    'estante': (0.5, 'Estante', [
        'estante', 'librero', 'repisa', 'biblioteca', 'anaquel', 'estanteria', 'rack', 'racks', 'mueble de tv',
        'mueble de television', 'mueble tv', 'mesa de tv', 'centro de entretenimiento', 'centro de entrenimiento',
        'modular', 'zapatera', 'zapatero', 'perchero', 'portasombreros']),
    'mueble_cocina': (0.8, 'Mueble de cocina', [
        'mueble de cocina', 'repostero', 'alacena', 'despensero', 'gabinete', 'cabinet']),
    'mueble': (0.5, 'Mueble', ['mueble', 'muebles']),
    'caja_grande': (0.12, 'Caja grande', ['caja grande', 'cajas grandes', 'caja de mudanza', 'cajon', 'baul']),
    'caja_chica': (0.04, 'Caja chica', ['caja chica', 'cajas chicas', 'caja pequena', 'cajas pequenas', 'cajita']),
    'caja': (0.07, 'Caja', ['caja', 'caja mediana', 'caja de plastico', 'taper', 'tapers', 'paquete']),
    'bolsa': (0.08, 'Bolsa o maleta', [
        'bolsa', 'bolson', 'costal', 'saco', 'maleta', 'maletin', 'bolso', 'mochila', 'bulto', 'tina', 'balde',
        'canasta', 'cesto', 'cesta', 'lavatorio', 'cubo']),
    'ropa': (0.2, 'Ropa', ['ropa', 'edredones', 'frazadas', 'colchas']),
    'textil': (0.03, 'Cojín o ropa de cama', ['cojin', 'almohada', 'edredon', 'frazada', 'sabanas', 'toalla', 'cortina']),
    'menaje': (0.15, 'Vajilla y cosas de cocina', [
        'vajilla', 'menaje', 'utensilios', 'cosas de cocina', 'ollas y platos', 'copas y vasos', 'tazas y vasos']),
    'menaje_pieza': (0.005, 'Pieza de cocina', [
        'plato', 'taza', 'vaso', 'copa', 'olla', 'sarten', 'cacerola', 'cubiertos', 'cuchara', 'tenedor', 'cuchillo',
        'jarra', 'bandeja', 'recipiente', 'tarro', 'botella', 'envase', 'colador', 'tapa', 'fuente']),
    'libro': (0.003, 'Libro', ['libro']),
    'terma': (0.2, 'Terma', ['terma', 'calentador', 'balon de gas', 'balon']),
    'garrafon': (0.03, 'Bidón de agua', ['garrafon', 'botellon', 'bidon']),
    'deporte': (0.5, 'Bicicleta o máquina de ejercicio', [
        'bicicleta', 'bici', 'scooter', 'patineta', 'triciclo', 'caminadora', 'trotadora', 'eliptica',
        'maquina de ejercicio', 'maquina de ejercicios', 'pesas']),
    'objeto': (0.1, 'Objeto suelto', [
        'espejo', 'cuadro', 'lampara', 'alfombra', 'persiana', 'tabla de planchar', 'planchador', 'ventilador',
        'aspiradora', 'escalera', 'planta', 'maceta', 'tacho', 'dispensador', 'purificador', 'deshumedecedor',
        'deshumedecesor', 'humidificador', 'calefactor', 'guitarra', 'teclado', 'juguetes', 'carrito', 'torre',
        'concentrador de oxigeno', 'aire acondicionado']),
    'adorno': (0.02, 'Adorno', [
        'adorno', 'articulo decorativo', 'objeto decorativo', 'marco de fotos', 'escoba', 'mopa', 'globo',
        'sombrero', 'zapatos']),
    'computadora': (0.1, 'Computadora o impresora', [
        'computadora', 'pc', 'cpu', 'laptop', 'impresora', 'parlante', 'equipo de sonido', 'consola de videojuegos']),
    'piano': (2.0, 'Piano', ['piano']),
    'maquina_coser': (0.3, 'Máquina de coser', ['maquina de coser', 'maquinas de coser', 'maquina de costura',
                                                 'maquinas de costura', 'remalladora']),
    'coche_bebe': (0.3, 'Coche de bebé', ['coche de bebe', 'coche', 'carriola', 'silla de comer']),
}

NUMBER_WORDS = {'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7,
                'ocho': 8, 'nueve': 9, 'diez': 10, 'doce': 12, 'docena': 12, 'par': 2}
_QTY_WORD = '|'.join(NUMBER_WORDS)


def _norm(text):
    text = unicodedata.normalize('NFD', (text or '').lower())
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', text).strip()


_PATTERNS = sorted(
    ((len(syn), re.compile(r'\b' + re.escape(_norm(syn)) + r'(es|s)?\b'), key)
     for key, (_, _, synonyms) in CATALOG.items() for syn in synonyms),
    key=lambda p: -p[0],
)
_NUMBER = r'(\d+(?:[.,]\d+)?)'
_DIM_UNIT = r'\s*(cm|mm|mts?|metros?|m)?'
_DIMS = re.compile(rf'{_NUMBER}{_DIM_UNIT}\s*[x×*]\s*{_NUMBER}{_DIM_UNIT}\s*[x×*]\s*{_NUMBER}{_DIM_UNIT}\b')
_METERS_PER = {'m': 1, 'mt': 1, 'mts': 1, 'metro': 1, 'metros': 1, 'cm': 100, 'mm': 1000}
_STATED = re.compile(rf'{_NUMBER}\s*(m3|m³|metros cubicos)\b')
_SPLIT = re.compile(rf',|;|\s+y\s+(?=(?:\d+|{_QTY_WORD})\b)|\s+\+\s+')
# "mesa con 6 sillas": lo que viene con la cosa y también ocupa. Solo estas: casi
# todo lo demás que sigue a "con" la describe ("cómoda con 5 cajones").
_WITH = re.compile(rf'\s+con\s+(?=(?:\d+|{_QTY_WORD})\b)')
_WITH_KEYS = ('silla', 'colchon', 'velador')
# Un número con unidad es una medida, no una cantidad: "80 litros de capacidad"
# no son 80 cosas.
_MEASURE = re.compile(
    r'^\d+(?:[.,]\d+)?\s*(?:(?:l|lt|lts|litros?|kg|kgs|kilos?|kilogramos?|g|gr|gramos?|tn|ton|toneladas?|mm|cm|m|m2|'
    r'mts?|metros?|pulgadas?)\b|")')
# "4 muebles de sala" es un juego de sala de 4 piezas, no 4 juegos.
_PIECES_OF_A_SET = re.compile(r'\bmuebles? (de )?sala\b')
# Las que tienen variantes por tamaño: "cama de madera queen" es una cama queen.
_FAMILIES = ('cama', 'sofa', 'refrigeradora', 'televisor', 'ropero', 'caja')
# Lo que no es una cosa: pruebas, y negativas de la IA de las fotos de antes de
# que se filtraran (orders.py, recognized_items).
_NOT_AN_ITEM = re.compile(r'^(test|prueba|lo siento|no puedo|no es posible|ninguno)\b')


def _parts(line):
    """Las cosas de una línea: (como se escribió, normalizada para buscarla)."""
    # Lo que va entre paréntesis aclara ("1 cama (colchón + base)"): no es otra cosa.
    line = re.sub(r'\([^)]*\)?', ' ', re.sub(r'\s+', ' ', line.lower()).strip())
    line = re.sub(r'^\s*(\d+[.)-]|[-•*])\s+', '', line)
    result = []
    for part in _SPLIT.split(line):
        part = part.strip(' .:-')
        normalized = _norm(part)
        # "juego de sofá 3,2,1": los números sueltos son parte de la cosa de antes.
        if re.search(r'[a-z]', normalized) and not _NOT_AN_ITEM.match(normalized):
            result.append((part, normalized))
    return result


def _found(text):
    """Lo del catálogo que aparece en el texto, lo primero que se nombra primero:
    [(dónde empieza, -largo del sinónimo, clave)]."""
    return sorted((match.start(), -length, key)
                  for length, pattern, key in _PATTERNS for match in [pattern.search(text)] if match)


def _match(text):
    """La cosa de la que habla el texto: la primera que nombra ("8 sillas de
    comedor" son sillas, no comedores), y entre las que empiezan en el mismo
    lugar el nombre más largo ("sofá cama" antes que "sofá"). Si después dice su
    tamaño ("cama de madera queen"), es esa variante."""
    found = _found(text)
    if not found:
        return None
    head = found[0][2]
    if head in _FAMILIES:
        return next((key for _, _, key in found if key.startswith(head + '_')), head)
    return head


def _quantity(text):
    match = re.match(r'^(\d+)\s*(?!m3|m³|\d)', text) or re.match(r'^x\s*(\d+)\b', text)
    if match:
        return max(int(match.group(1)), 1)
    first = text.split(' ', 1)[0]
    if first == 'par' or text.startswith('un par'):
        return 2
    return NUMBER_WORDS.get(first, 1)


def _dims_m3(match):
    values = [float(match.group(i).replace(',', '.')) for i in (1, 3, 5)]
    units = [match.group(i) for i in (2, 4, 6)]
    # Sin unidad: metros si todo es chico ("2x2x0.5"), centímetros si no ("60x40x40").
    default = next((unit for unit in reversed(units) if unit), None) or ('m' if max(values) <= 5 else 'cm')
    volume = 1.0
    for value, unit in zip(values, units):
        volume *= value / _METERS_PER[unit or default]
    return volume


def _is_total(line, stated):
    """Si los m³ de la línea son el total de la mudanza ("28 m3", "28 m3 de
    muebles") y no el tamaño de una cosa ("4 cajas de 1 m3 c/u"): la cosa se
    nombra antes que su tamaño."""
    found = _found(line)
    return not found or found[0][0] > stated.start()


def _item(text, part):
    """La cosa de una parte de la línea, o None si no es una cosa; y si no se
    reconoció."""
    dims, own_m3 = _DIMS.search(part), _STATED.search(part)
    if dims or own_m3:
        if dims:
            each = _dims_m3(dims)
            # "120 x 50 x 75 cm": el primer número es una medida, no la cantidad.
            qty = 1 if dims.start() == 0 else _quantity(part)
        else:
            each = float(own_m3.group(1).replace(',', '.'))
            # "3 bultos, 2 m3 en total": los m³ ya son de todos.
            qty = 1 if 'total' in part or own_m3.start() == 0 else _quantity(part)
        return {'text': text, 'key': None, 'label': 'Con medidas', 'qty': qty, 'm3': round(each * qty, 3)}, False
    key = _match(part)
    measure = _MEASURE.match(part)
    # "2 plazas", "3 cuerpos": el número es del nombre, no la cantidad.
    named_by_number = part[:1].isdigit() and _found(part)[:1] and _found(part)[0][0] == 0
    pieces = key == 'juego_sala' and _PIECES_OF_A_SET.search(part)
    qty = 1 if measure or named_by_number or pieces else _quantity(part)
    if key:
        each, label, _ = CATALOG[key]
        return {'text': text, 'key': key, 'label': label, 'qty': qty, 'm3': round(each * qty, 3)}, False
    if measure:
        return None, False
    if len(part.split()) <= NOTE_WORDS:
        return {'text': text, 'key': None, 'label': 'Sin reconocer', 'qty': qty,
                'm3': round(UNKNOWN_ITEM_M3 * qty, 3)}, True
    return None, True


# Una lista pegada en el campo de una línea del paso 2 llega amontonada: el
# navegador cambia los saltos de línea por espacios ("Una refrigeradora  Un
# comedor de 4 sillas  Una tele de 65"). Sin cortarla, cada trozo contaba solo
# la primera cosa que nombraba (la orden 343 daba 5.9 m³ en vez de ~13). Se corta
# en dos o más espacios y antes de "Un", "Una", "Unos", "Unas" con mayúscula,
# solo si la lista no tiene ningún salto de línea y quedan 3 trozos o más: en una
# lista ya separada, "2  cajas" o "2 camas  con colchones" son una sola cosa
# escrita con doble espacio. Vue tiene la misma regla para avisarle al cliente
# (frontend/src/utils/splitItems.js).
_CRAMMED = re.compile(r'\s{2,}|\s+(?=(?:Un|Una|Unos|Unas)\b)')
CRAMMED_MIN_PIECES = 3


def split_lines(comments):
    """Las líneas de la lista, cortando la que viene amontonada."""
    comments = comments or ''
    if '\n' not in comments:
        pieces = [piece for piece in _CRAMMED.split(comments) if piece.strip()]
        if len(pieces) >= CRAMMED_MIN_PIECES:
            return pieces
    return comments.split('\n')


def estimate_volume(comments):
    """{'m3': total con el margen, 'items': [...], 'unknown': [...], 'stated': bool}.

    Cada item: el texto, la clave del catálogo (None si se calculó por medidas o
    no se reconoció), su nombre, la cantidad y los m³. `m3` es 0 sin lista.
    """
    items, unknown, stated = [], [], None
    for line in split_lines(comments):
        normalized = _norm(line)
        stated_match = _STATED.search(normalized)
        if stated_match and not _DIMS.search(normalized) and _is_total(normalized, stated_match):
            value = float(stated_match.group(1).replace(',', '.'))
            stated = max(stated or 0, value)
            continue
        for text, part in _parts(line):
            main, *extras = _WITH.split(part)
            item, unrecognized = _item(text, main if extras else part)
            if item:
                items.append(item)
            if unrecognized:
                unknown.append(text)
            for extra in extras:
                key = _match(extra)
                # Un juego de comedor ya cuenta sus sillas.
                if key in _WITH_KEYS and not (key == 'silla' and item and item['key'] == 'comedor'):
                    each, label, _ = CATALOG[key]
                    qty = _quantity(extra)
                    items.append({'text': extra, 'key': key, 'label': label, 'qty': qty, 'm3': round(each * qty, 3)})
    if stated:
        return {'m3': round(stated, 1), 'items': items, 'unknown': unknown, 'stated': True}
    total = sum(item['m3'] for item in items) * PACKING_FACTOR
    return {'m3': round(total, 1), 'items': items, 'unknown': unknown, 'stated': False}
