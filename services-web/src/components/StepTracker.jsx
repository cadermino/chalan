const STEPS = ['Dirección', 'Qué embalamos', 'Fecha y contacto']

export default function StepTracker({ current }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Pasos">
      {STEPS.map((label, index) => {
        const number = index + 1
        const done = number < current
        const active = number === current
        return (
          <li key={label} className="text-center" aria-current={active ? 'step' : undefined}>
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                active ? 'border-accent bg-accent text-white'
                  : done ? 'border-accent bg-accentSoft text-accent'
                    : 'border-line text-mute'
              }`}
            >
              {done ? '✓' : number}
            </div>
            <div className={`mt-1 text-xs ${active ? 'text-inkStrong' : 'text-mute'}`}>{label}</div>
          </li>
        )
      })}
    </ol>
  )
}
