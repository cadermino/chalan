import { forwardRef } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { es } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { dateLimits } from '../dates'

registerLocale('es', es)

// El mismo campo que el paso 2 de mudanzas (@vuepic/vue-datepicker en
// frontend/src/views/order/Step-two.vue): "Elige el día", un calendario que se
// cierra al tocar un día y los días que no valen desactivados.
//
// Antes era un <input type="date">: en iPhone, Safari no respeta el min y deja
// elegir hoy (o lo pone al cerrar el calendario). En noviembre de 2026, 3
// personas con iPhone tocaron "Enviar solicitud" 33 veces con un día que el
// formulario rechazaba (una, 29); en Android o computadora pasaba 1 o 2 veces.

// Las fechas del formulario son texto YYYY-MM-DD (ver dates.js); el calendario
// quiere un Date local de ese día.
function toDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return null
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIso(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Solo lectura: en el celular no abre el teclado, solo el calendario.
const DayInput = forwardRef(function DayInput({ invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      readOnly
      inputMode="none"
      className={`field cursor-pointer caret-transparent ${invalid ? 'border-danger' : ''}`}
    />
  )
})

export default function DateField({ id, value, onChange, invalid }) {
  const { min, max } = dateLimits()
  return (
    <DatePicker
      id={id}
      selected={toDate(value)}
      onChange={(date) => onChange(date ? toIso(date) : '')}
      minDate={toDate(min)}
      maxDate={toDate(max)}
      locale="es"
      dateFormat="EEEE d 'de' MMMM"
      placeholderText="Elige el día"
      calendarClassName="chalan-calendar"
      wrapperClassName="block w-full"
      popperPlacement="bottom-start"
      showPopperArrow={false}
      customInput={<DayInput invalid={invalid} />}
    />
  )
}
