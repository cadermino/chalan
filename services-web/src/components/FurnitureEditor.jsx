import { FURNITURE_WORKS } from '../config'
import { newItem } from '../context/RequestContext'

// Atajos para armar la lista rápido; el cliente elige después qué hacer con cada uno.
const QUICK_ITEMS = [
  'Ropero', 'Cama', 'Escritorio', 'Cómoda', 'Velador', 'Mueble de TV',
  'Comedor', 'Librero', 'Zapatera', 'Muebles de cocina', 'Cuna',
]

const MAX_ITEMS = 50

function Chip({ checked, onToggle, title, children }) {
  return (
    <label
      title={title}
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-accent ${
        checked ? 'border-accent bg-accentSoft text-inkStrong' : 'border-line text-inkSoft hover:border-lineStrong'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      {checked ? '✓ ' : ''}{children}
    </label>
  )
}

export default function FurnitureEditor({ items, materials, onChange, missingWork }) {
  const update = (key, fields) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...fields } : item)))

  const toggleMaterial = (item, code) => {
    const has = item.materials.includes(code)
    update(item.key, { materials: has ? item.materials.filter((c) => c !== code) : [...item.materials, code] })
  }

  const addQuick = (label) => {
    if (items.length >= MAX_ITEMS) return
    // Si la última fila sigue en blanco se aprovecha en vez de dejarla huérfana.
    const last = items[items.length - 1]
    if (last && !last.description.trim()) {
      update(last.key, { description: label })
      return
    }
    onChange([...items, newItem({ description: label })])
  }

  return (
    <div>
      <p className="mb-2 text-sm text-inkSoft">Toca para agregar rápido:</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {QUICK_ITEMS.map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm text-inkSoft hover:border-accent hover:text-inkStrong"
            onClick={() => addQuick(label)}
          >
            + {label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {items.map((item, index) => {
          const name = item.description || `el mueble ${index + 1}`
          const noWork = missingWork && item.description.trim() && !item.work
          return (
            <li key={item.key} className="rounded-xl border border-line bg-paper2 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="sr-only" htmlFor={`item-${item.key}`}>Mueble {index + 1}</label>
                  <input
                    id={`item-${item.key}`}
                    type="text"
                    className="field"
                    placeholder="Ej. Ropero de 2 puertas (Sodimac)"
                    maxLength={200}
                    value={item.description}
                    onChange={(event) => update(item.key, { description: event.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-0.5" role="group" aria-label={`Cantidad de ${name}`}>
                  <button
                    type="button"
                    aria-label="Menos"
                    className="h-9 w-9 rounded-lg border border-lineStrong text-lg text-inkStrong disabled:opacity-40"
                    disabled={item.quantity <= 1}
                    onClick={() => update(item.key, { quantity: item.quantity - 1 })}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-inkStrong" aria-live="polite">{item.quantity}</span>
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
              </div>

              <fieldset className="mt-3">
                <legend className="mb-2 text-sm font-semibold text-inkStrong">¿Qué hay que hacer?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FURNITURE_WORKS.map((work) => {
                    const checked = item.work === work.code
                    return (
                      <label
                        key={work.code}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-accent ${
                          checked ? 'border-accent bg-accentSoft' : noWork ? 'border-danger' : 'border-line hover:border-lineStrong'
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`work-${item.key}`}
                          checked={checked}
                          onChange={() => update(item.key, { work: work.code })}
                        />
                        <span className="block font-semibold text-inkStrong">{work.label}</span>
                        <span className="block text-xs text-mute">{work.hint}</span>
                      </label>
                    )
                  })}
                </div>
                {noWork && <p role="alert" className="mt-1 text-sm text-danger">Elige qué hacer con este mueble.</p>}
              </fieldset>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip checked={item.pack} onToggle={() => update(item.key, { pack: !item.pack, materials: [] })}>
                  También embalarlo
                </Chip>
                {item.pack && materials.map((m) => (
                  <Chip key={m.code} title={m.description} checked={item.materials.includes(m.code)} onToggle={() => toggleMaterial(item, m.code)}>
                    {m.name}
                  </Chip>
                ))}
              </div>
              {item.pack && (
                <p className="mt-1 text-xs text-mute">Si no sabes con qué, no marques nada y el armador te recomienda.</p>
              )}

              <div className="mt-3 text-right">
                <button
                  type="button"
                  className="text-sm text-mute underline hover:text-danger"
                  onClick={() => onChange(items.filter((i) => i.key !== item.key))}
                >
                  Quitar
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        disabled={items.length >= MAX_ITEMS}
        onClick={() => onChange([...items, newItem()])}
      >
        + Agregar otro mueble
      </button>
    </div>
  )
}
