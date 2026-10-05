import { newItem } from '../context/RequestContext'

// Atajos para armar la lista rápido. Cada uno trae materiales sugeridos ya
// marcados (el cliente los puede cambiar), por `code` del catálogo. Es lo único
// del frontend que conoce codes, y es opcional: un code que ya no esté en el
// catálogo se ignora, y sin esta lista todo funciona igual.
const QUICK_ITEMS = [
  { label: 'Sofá', materials: ['stretch_film', 'carpet'] },
  { label: 'Cama', materials: ['stretch_film', 'carpet'] },
  { label: 'Colchón', materials: ['stretch_film'] },
  { label: 'Refrigeradora', materials: ['stretch_film', 'cardboard_sheet'] },
  { label: 'Lavadora', materials: ['stretch_film', 'cardboard_sheet'] },
  { label: 'TV', materials: ['cardboard_sheet', 'stretch_film'] },
  { label: 'Vajilla', materials: ['cardboard_box'] },
  { label: 'Cuadros/espejos', materials: ['cardboard_sheet', 'wooden_crate'] },
  { label: 'Ropa', materials: ['cardboard_box'] },
  { label: 'Libros', materials: ['cardboard_box'] },
]

const MAX_ITEMS = 50

export default function ItemsEditor({ items, materials, onChange }) {
  const catalogCodes = new Set(materials.map((m) => m.code))

  const update = (key, fields) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...fields } : item)))

  const toggleMaterial = (item, code) => {
    const has = item.materials.includes(code)
    update(item.key, { materials: has ? item.materials.filter((c) => c !== code) : [...item.materials, code] })
  }

  const addQuick = (quick) => {
    if (items.length >= MAX_ITEMS) return
    const suggested = quick.materials.filter((code) => catalogCodes.has(code))
    // Si la última fila sigue en blanco se aprovecha en vez de dejarla huérfana.
    const last = items[items.length - 1]
    if (last && !last.description.trim()) {
      update(last.key, { description: quick.label, materials: suggested })
      return
    }
    onChange([...items, newItem({ description: quick.label, materials: suggested })])
  }

  return (
    <div>
      <details className="mb-4 rounded-lg border border-line bg-paper2 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-inkStrong">¿Para qué sirve cada material?</summary>
        <ul className="mt-2 space-y-1 text-inkSoft">
          {materials.map((m) => (
            <li key={m.code}><span className="text-inkStrong">{m.name}:</span> {m.description}</li>
          ))}
        </ul>
        <p className="mt-2 text-mute">
          Si no sabes qué material necesita, déjalo sin marcar y el transportista te recomienda.
        </p>
      </details>

      <p className="mb-2 text-sm text-inkSoft">Toca para agregar rápido:</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {QUICK_ITEMS.map((quick) => (
          <button
            key={quick.label}
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm text-inkSoft hover:border-accent hover:text-inkStrong"
            onClick={() => addQuick(quick)}
          >
            + {quick.label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={item.key} className="rounded-xl border border-line bg-paper2 p-4 md:flex md:items-start md:gap-4">
            <div className="md:w-72 md:shrink-0">
              <label className="sr-only" htmlFor={`item-${item.key}`}>Cosa a embalar {index + 1}</label>
              <input
                id={`item-${item.key}`}
                type="text"
                className="field"
                placeholder="Ej. Sofá de 3 cuerpos"
                maxLength={200}
                value={item.description}
                onChange={(event) => update(item.key, { description: event.target.value })}
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2" role="group" aria-label="Cantidad">
                  <button
                    type="button"
                    aria-label="Menos"
                    className="h-9 w-9 rounded-lg border border-lineStrong text-lg text-inkStrong disabled:opacity-40"
                    disabled={item.quantity <= 1}
                    onClick={() => update(item.key, { quantity: item.quantity - 1 })}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-inkStrong" aria-live="polite">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Más"
                    className="h-9 w-9 rounded-lg border border-lineStrong text-lg text-inkStrong disabled:opacity-40"
                    disabled={item.quantity >= 999}
                    onClick={() => update(item.key, { quantity: item.quantity + 1 })}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="text-sm text-mute underline hover:text-danger"
                  onClick={() => onChange(items.filter((i) => i.key !== item.key))}
                >
                  Quitar
                </button>
              </div>
            </div>

            {/* Debajo de la descripción en celular; al costado desde md. Cinco chips no caben en 360 px. */}
            <fieldset className="mt-3 md:mt-0 md:flex-1">
              <legend className="sr-only">Materiales para {item.description || `la cosa ${index + 1}`}</legend>
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => {
                  const checked = item.materials.includes(m.code)
                  return (
                    <label
                      key={m.code}
                      title={m.description}
                      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-accent ${
                        checked ? 'border-accent bg-accentSoft text-inkStrong' : 'border-line text-inkSoft hover:border-lineStrong'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleMaterial(item, m.code)}
                      />
                      {checked ? '✓ ' : ''}{m.name}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        disabled={items.length >= MAX_ITEMS}
        onClick={() => onChange([...items, newItem()])}
      >
        + Agregar otra cosa
      </button>
    </div>
  )
}
