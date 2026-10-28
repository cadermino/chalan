// Etiquetas de lo que pide el cliente en los formularios de servicios, para la
// página que se comparte con quien va a cotizar (app/v/[token]). Los codes los
// valida el API principal (app/api/service_request/types.py); las mismas
// etiquetas están en services-web config.js y en el backoffice
// (ServiceRequestView.jsx): si cambia una, cambian las tres.

export const WORK_LABELS: Record<string, string> = {
  assemble: 'Armar',
  disassemble: 'Desarmar',
  both: 'Desarmar y armar en otro lugar',
}

const PAINTING: Record<string, Record<string, string>> = {
  area: { interior: 'Interior', exterior: 'Exterior o fachada', both: 'Interior y exterior' },
  size: { detail: 'Una pared o un detalle', one_room: '1 ambiente', few_rooms: '2 a 3 ambientes', whole: 'Depa o casa completa' },
  paint_by: { customer: 'La compra el cliente', painter: 'La incluye el pintor', unsure: 'El cliente no sabe aún' },
  wall_issues: { humidity: 'Humedad', cracks: 'Rajaduras', putty: 'Necesitan empaste' },
}

const TILING: Record<string, Record<string, string>> = {
  material: { porcelain: 'Porcelanato', ceramic: 'Cerámica', unsure: 'Aún no sabe' },
  surface: { floor: 'Piso', wall: 'Pared', both: 'Piso y pared' },
  rooms: {
    living: 'Sala y comedor', bedrooms: 'Dormitorios', kitchen: 'Cocina', bathrooms: 'Baños',
    terrace: 'Terraza o patio', stairs: 'Escaleras',
  },
  tile_size: { '60x60': '60×60 o más chico', '60x120': '60×120 o más grande', other: 'Otro o no sabe' },
  remove_old: { yes: 'Sí', no: 'No, el piso está libre' },
  screed: { yes: 'Sí', no: 'No', unsure: 'No sabe' },
  tiles_by: { customer: 'Lo compra el cliente', installer: 'Lo incluye el instalador', unsure: 'El cliente no sabe aún' },
}

type Details = Record<string, unknown>

const one = (labels: Record<string, string>, value: unknown) => (typeof value === 'string' ? labels[value] : undefined)
const many = (labels: Record<string, string>, value: unknown) =>
  (Array.isArray(value) ? value.map((v) => labels[v]).filter(Boolean).join(', ') : '') || undefined
const m2 = (value: unknown) => (typeof value === 'number' ? `${value} m²` : undefined)

// Las respuestas opcionales de pintura y porcelanato, como [etiqueta, valor].
export function serviceFacts(code: string | null, details: Details): [string, string][] {
  const facts: [string, string | undefined][] = code === 'masonry'
    ? [
      ['Material', one(TILING.material, details.material)],
      ['Dónde', one(TILING.surface, details.surface)],
      ['Ambientes', many(TILING.rooms, details.rooms)],
      ['Metros', m2(details.area_m2)],
      ['Formato', one(TILING.tile_size, details.tile_size)],
      ['Sacar el piso actual', one(TILING.remove_old, details.remove_old)],
      ['Contrapiso o nivelar', one(TILING.screed, details.screed)],
      ['Quién compra el material', one(TILING.tiles_by, details.tiles_by)],
    ]
    : code === 'painting'
      ? [
        ['Dónde', one(PAINTING.area, details.area)],
        ['Cuánto', one(PAINTING.size, details.size)],
        ['Metros de pared', m2(details.area_m2)],
        ['Pintura', one(PAINTING.paint_by, details.paint_by)],
        ['Paredes', many(PAINTING.wall_issues, details.wall_issues)],
      ]
      : []
  return facts.filter((f): f is [string, string] => Boolean(f[1]))
}
