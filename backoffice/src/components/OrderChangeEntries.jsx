// Lo que cambió entre dos versiones de una orden, como un diff. Las entradas
// llegan con su etiqueta y sus valores ya escritos (diff_snapshots en
// app/api/order/versions.py del API principal): aquí solo se pintan.

// Más de 6 líneas iguales seguidas: se dejan 2 de cada lado.
const CONTEXT = 2
const MAX_SAME = 6

function collapse(lines) {
  const out = []
  let run = []
  const flush = () => {
    if (run.length > MAX_SAME) {
      out.push(...run.slice(0, CONTEXT), { op: '…' }, ...run.slice(-CONTEXT))
    } else {
      out.push(...run)
    }
    run = []
  }
  for (const line of lines) {
    if (line.op === '=') {
      run.push(line)
    } else {
      flush()
      out.push(line)
    }
  }
  flush()
  return out
}

const LINE_STYLE = {
  '-': 'bg-red-50 text-red-800',
  '+': 'bg-green-50 text-green-800',
  '=': 'text-gray-500',
  '…': 'text-gray-400',
}
const LINE_SIGN = { '-': '−', '+': '+', '=': ' ', '…': ' ' }

function Lines({ lines }) {
  return (
    <div className="mt-1 overflow-x-auto rounded border border-gray-200 font-mono text-xs">
      {collapse(lines).map((line, i) => (
        <div key={i} className={`whitespace-pre-wrap px-2 py-0.5 ${LINE_STYLE[line.op]}`}>
          <span className="mr-2 select-none">{LINE_SIGN[line.op]}</span>
          {line.op === '…' ? '…' : line.text}
        </div>
      ))}
    </div>
  )
}

function Entry({ entry }) {
  if (entry.kind === 'lines') {
    return (
      <>
        <dt className="text-xs font-medium text-gray-500">{entry.label}</dt>
        <dd><Lines lines={entry.lines} /></dd>
      </>
    )
  }
  if (entry.kind === 'list') {
    return (
      <>
        <dt className="text-xs font-medium text-gray-500">{entry.label}</dt>
        <dd className="text-sm">
          {entry.added.map((name) => <p key={`+${name}`} className="text-green-700">+ {name}</p>)}
          {entry.removed.map((name) => <p key={`-${name}`} className="text-red-700">− {name}</p>)}
        </dd>
      </>
    )
  }
  return (
    <>
      <dt className="text-xs font-medium text-gray-500">{entry.label}</dt>
      <dd className="text-sm">
        {entry.before != null && (
          <>
            <span className="text-red-700 line-through">{entry.before}</span>
            <span className="mx-1.5 text-gray-400">→</span>
          </>
        )}
        <span className="text-green-700">{entry.after}</span>
      </dd>
    </>
  )
}

export default function OrderChangeEntries({ entries }) {
  return (
    <dl className="space-y-1.5">
      {entries.map((entry) => <div key={entry.field}><Entry entry={entry} /></div>)}
    </dl>
  )
}
