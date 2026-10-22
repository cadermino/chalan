// Íconos de estado de las listas (órdenes, solicitudes): el mismo ícono va en
// el botón de filtro y en la columna Estado, así el botón hace de leyenda.
const STATUS_ICON_PATHS = {
  list: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
  clock: ['M12 7v5l3 2', { circle: [12, 12, 9] }],
  truck: ['M1 4h14v12H1z', 'M15 9h4l3 3v4h-7z', { circle: [5.5, 18.5, 2] }, { circle: [18.5, 18.5, 2] }],
  check: ['m8 12 3 3 5-6', { circle: [12, 12, 9] }],
  cross: ['m15 9-6 6M9 9l6 6', { circle: [12, 12, 9] }],
  send: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4z'],
  draft: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z'],
  tag: ['M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', { circle: [7, 7, 1.5] }],
  wallet: ['M3 7h18v12H3z', 'M3 7l2-3h12l2 3', 'M16 13h2'],
}

export default function StatusIcon({ icon, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STATUS_ICON_PATHS[icon].map((p, i) => (typeof p === 'string'
        ? <path key={i} d={p} />
        : <circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} />))}
    </svg>
  )
}
