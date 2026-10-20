#!/usr/bin/env python3
"""Arma app/resources/carrier_prospects.json con los transportistas de Google Maps.

Los datos salen del repo automajob-contacts (Apify -> data/raw/*.json). Se reusa
su propia normalización (`leads.construir`: cierra los negocios cerrados, quita
categorías que no son transporte, deja solo celulares, deduplica por placeId y
rankea por ciudad) y se le agregan las coordenadas, que esa tabla no guarda.

Se corre con el Python del venv de ese repo (necesita PyYAML y phonenumbers):

    ~/Sites/automajob-contacts/.venv/bin/python backoffice-api/scripts/build_carrier_prospects.py \
        --source ~/Sites/automajob-contacts

Solo entra la vertical `transporte`. El resultado va al repo: es información
pública de Google Maps, y así el backoffice no depende de ningún servicio externo.
"""
import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone

# Código de departamento (los dos primeros dígitos del código postal peruano,
# que coinciden con el ubigeo) de cada `ciudad` que usa config.yaml.
DEPARTMENT_BY_CITY = {
    'lima': '15', 'callao': '07', 'arequipa': '04', 'trujillo': '13', 'chiclayo': '14',
    'piura': '20', 'cusco': '08', 'huancayo': '12', 'iquitos': '16', 'pucallpa': '25',
    'tacna': '23', 'ica': '11', 'cajamarca': '06', 'ayacucho': '05', 'huanuco': '10',
    'puno': '21', 'huaraz': '02', 'tumbes': '24', 'puerto-maldonado': '17',
    'moquegua': '18', 'moyobamba': '22', 'abancay': '03', 'huancavelica': '09',
    'cerro-de-pasco': '19', 'chachapoyas': '01', 'juliaca': '21', 'tarapoto': '22',
    'chimbote': '02',
}

VERTICAL = 'transporte'


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--source', required=True, help='carpeta del repo automajob-contacts')
    parser.add_argument('--out', default=str(pathlib.Path(__file__).resolve().parents[1]
                                              / 'app' / 'resources' / 'carrier_prospects.json'))
    args = parser.parse_args()

    source = pathlib.Path(args.source).expanduser().resolve()
    sys.path.insert(0, str(source))
    import leads  # noqa: E402  (vive en el repo de origen)
    import yaml  # noqa: E402

    config = yaml.safe_load((source / 'config.yaml').read_text(encoding='utf-8'))
    raw_dir = source / 'data' / 'raw'
    por_vertical, descartados, _ = leads.construir(raw_dir, config)
    filas = por_vertical.get(VERTICAL, [])

    # leads.py no guarda coordenadas ni la URL del lugar: se leen del crudo.
    coords = {}
    for archivo in sorted(raw_dir.glob(f'{VERTICAL}__*.json')):
        bloque = json.loads(archivo.read_text(encoding='utf-8'))
        for ficha in bloque.get('fichas', []):
            loc = ficha.get('location') or {}
            if ficha.get('placeId') and loc.get('lat') is not None and loc.get('lng') is not None:
                coords[ficha['placeId']] = (loc['lat'], loc['lng'])

    prospects, sin_departamento = [], 0
    for f in filas:
        department = DEPARTMENT_BY_CITY.get(f['ciudad'])
        if department is None:
            sin_departamento += 1
            continue
        lat, lng = coords.get(f['id'], (None, None))
        prospects.append({
            'id': f['id'],
            'name': f['nombre'],
            'city': f['ciudad'],
            'department': department,
            'address': f['direccion'],
            'lat': lat,
            'lng': lng,
            'category': f['categoria'],
            'type': f['tipo'],
            'phone': f['telefono_e164'],
            'rating': float(f['rating']) if f['rating'] != '' else None,
            'reviews': int(f['num_resenas']) if f['num_resenas'] != '' else 0,
            'score': f['score'] if f['score'] != '' else None,
            'maps_url': f"https://www.google.com/maps/place/?q=place_id:{f['id']}" if f['id'].startswith('ChIJ') else None,
        })

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'prospects': prospects,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    por_ciudad = {}
    for p in prospects:
        por_ciudad[p['city']] = por_ciudad.get(p['city'], 0) + 1
    print(f'{len(prospects)} transportistas -> {out}')
    print('por ciudad:', dict(sorted(por_ciudad.items())))
    print('descartados al normalizar:', descartados, '| sin departamento:', sin_departamento)


if __name__ == '__main__':
    main()
