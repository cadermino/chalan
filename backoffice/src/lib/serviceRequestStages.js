// En qué va cada solicitud. La calcula el backoffice-api (`_stage` en
// app/api/service_requests.py) a partir de las cotizaciones y los pagos: estas
// son sus claves. Las clases van completas porque Tailwind solo genera las que
// encuentra literales en el código.
export const STAGES = {
  active: {
    label: 'Activas', icon: 'clock',
    active: 'bg-gray-700 border-gray-700 text-white',
    idle: 'border-gray-300 text-gray-700 hover:bg-gray-50',
  },
  waiting: {
    label: 'Esperando cotizaciones', icon: 'send', color: 'text-blue-600', badge: 'bg-blue-50 text-blue-700',
    active: 'bg-blue-600 border-blue-600 text-white',
    idle: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  quoted: {
    label: 'Con cotizaciones', icon: 'tag', color: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700',
    active: 'bg-indigo-600 border-indigo-600 text-white',
    idle: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
  },
  deposit_pending: {
    label: 'Adelanto pendiente', icon: 'wallet', color: 'text-orange-500', badge: 'bg-orange-50 text-orange-700',
    active: 'bg-orange-500 border-orange-500 text-white',
    idle: 'border-orange-300 text-orange-700 hover:bg-orange-50',
  },
  in_progress: {
    label: 'En proceso', icon: 'truck', color: 'text-teal-600', badge: 'bg-teal-50 text-teal-700',
    active: 'bg-teal-600 border-teal-600 text-white',
    idle: 'border-teal-300 text-teal-700 hover:bg-teal-50',
  },
  completed: {
    label: 'Completadas', single: 'Completada', icon: 'check', color: 'text-green-600', badge: 'bg-green-50 text-green-700',
    active: 'bg-green-600 border-green-600 text-white',
    idle: 'border-green-300 text-green-700 hover:bg-green-50',
  },
  draft: {
    label: 'Incompletas', single: 'Incompleta', icon: 'draft', color: 'text-amber-500', badge: 'bg-amber-50 text-amber-700',
    active: 'bg-amber-500 border-amber-500 text-white',
    idle: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  cancelled: {
    label: 'Canceladas', single: 'Cancelada', icon: 'cross', color: 'text-red-500', badge: 'bg-red-50 text-red-700',
    active: 'bg-red-500 border-red-500 text-white',
    idle: 'border-red-300 text-red-700 hover:bg-red-50',
  },
  all: {
    label: 'Todas', icon: 'list',
    active: 'bg-gray-700 border-gray-700 text-white',
    idle: 'border-gray-300 text-gray-600 hover:bg-gray-50',
  },
}

export const stageLabel = (key) => STAGES[key]?.single || STAGES[key]?.label || key
