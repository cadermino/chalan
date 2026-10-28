// Las preguntas rápidas de los servicios que se cuentan con palabras (pintura,
// porcelanato).

// Una opción de las preguntas rápidas. `multiple`: casilla; si no, se elige una
// y tocarla otra vez la desmarca (todas son opcionales).
export function Chip({ checked, onToggle, multiple, name, children }) {
  return (
    <label
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-accent ${
        checked ? 'border-accent bg-accentSoft text-inkStrong' : 'border-line text-inkSoft hover:border-lineStrong'
      }`}
    >
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        className="sr-only"
        checked={checked}
        onChange={() => {}}
        onClick={onToggle}
      />
      {checked ? '✓ ' : ''}{children}
    </label>
  )
}

export function Question({ title, children }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-inkStrong">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}
