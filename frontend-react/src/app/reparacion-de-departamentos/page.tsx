import type { Metadata } from 'next'
import Link from 'next/link'
import { ServiceLanding, type ServiceFaq } from '@/components/ServiceLanding'
import { HOME_SERVICES } from '@/lib/homeServices'

// Servicio integral para departamentos en alquiler: cuando se va el inquilino,
// el propietario tiene que llamar a un pintor, un gasfitero, un electricista, un
// carpintero y a quien lave las cortinas. Aquí se hace todo con un solo contacto.
// Cada departamento queda distinto, así que no hay tabla de precios: se agenda
// una visita técnica sin costo y ahí se da la cotización exacta. Las SERPs de
// Lima (octubre de 2026) más débiles son las de "servicio integral de reparación
// de departamentos"; las de "quién paga las reparaciones" tienen resumen de IA.

const service = HOME_SERVICES.departamentos

export const metadata: Metadata = {
  title: 'Reparación de departamentos en alquiler en Lima | Chalán',
  description:
    'Pintura, gasfitería, electricidad y reparaciones en un solo servicio para dejar tu departamento listo para alquilar. Visita técnica sin costo en Lima y Callao.',
  keywords:
    'servicio integral de reparación de departamentos lima, mantenimiento de departamentos en alquiler, reparación de departamento para alquilar, dejar departamento listo para alquilar, remodelación de departamento para alquilar, mantenimiento de inmuebles lima',
  alternates: { canonical: service.path },
  openGraph: {
    title: 'Reparación de departamentos en alquiler en Lima | Chalán',
    description:
      'Deja tu departamento listo para el nuevo inquilino, con un solo contacto. Visita técnica sin costo en Lima y Callao.',
    url: `https://chalan.pe${service.path}`,
  },
}

const link = { color: 'var(--ink)', textDecoration: 'underline' }

const FAQ: ServiceFaq[] = [
  {
    q: '¿Cuánto cuesta la visita técnica?',
    a: 'No tiene costo. Vamos al departamento, vemos qué hay que reparar y te damos una cotización exacta, sin compromiso.',
  },
  {
    q: '¿Cuánto cuesta dejar listo un departamento para alquilar?',
    a: 'Depende de lo que haya que hacer: pintura, reparaciones, gasfitería, electricidad. Por eso no damos un precio sin ver el departamento: la visita técnica es gratis y la cotización sale exacta.',
  },
  {
    q: '¿Qué trabajos hacen?',
    a: 'Pintura y resanes, gasfitería, electricidad, reparación y cambio de piezas de melamina, puertas y bisagras, piso, vidrios, y lavado de cortinas y alfombras. Si hay algo que no hacemos, te lo decimos en la visita.',
    render: (
      <>
        Pintura y resanes, gasfitería, electricidad, reparación y cambio de piezas de melamina, puertas
        y bisagras, piso, vidrios, y lavado de cortinas y alfombras. Si hay algo que no hacemos, te lo
        decimos en la visita. Si solo necesitas pintura, mira los{' '}
        <Link href="/pintores-a-domicilio">pintores a domicilio</Link>.
      </>
    ),
  },
  {
    q: '¿Sirve si tengo varios departamentos?',
    a: 'Sí. Si tienes o administras varios departamentos en alquiler, coordinamos con una sola persona cada vez que uno se desocupa.',
  },
  {
    q: '¿Qué necesito para agendar la visita?',
    a: 'Escríbenos por WhatsApp con el distrito y unas fotos del departamento, y coordinamos un día para ir a verlo.',
  },
  {
    q: '¿En qué zonas trabajan?',
    a: 'En Lima Metropolitana y el Callao.',
  },
]

export default function ReparacionDeDepartamentos() {
  return (
    <ServiceLanding
      path={service.path}
      breadcrumbName="Reparación de departamentos"
      eyebrow="Reparación de departamentos en alquiler · Lima y Callao"
      heroTitle={
        <>
          <span className="line">Tu departamento</span>
          <span className="line indent"><em>listo para</em></span>
          <span className="line">el nuevo inquilino.</span>
        </>
      }
      heroSub="Pintura, gasfitería, electricidad y reparaciones, con un solo contacto."
      ctaBody="Coordinamos una visita técnica sin costo para ver el departamento y darte una cotización exacta. Escríbenos con el distrito y unas fotos."
      whatsappText={service.whatsappText}
      cta={{
        eyebrow: 'Agenda tu visita',
        label: 'Agendar visita técnica',
        note: 'Visita técnica sin costo · Lima y Callao',
      }}
      areas={['Lima', 'Callao']}
      kpis={[
        { num: <>S/<span className="unit">0</span></>, label: 'Costo de la visita técnica' },
        { num: <>1<span className="unit">contacto</span></>, label: 'Para todos los oficios' },
        { num: 'Lima', label: 'Y el Callao' },
        { num: <>Exacta</>, label: 'Cotización después de ver el depa' },
      ]}
      sections={[
        {
          id: 'trabajos',
          num: '01 / Qué hacemos',
          title: <>Todo lo que queda<br />después del inquilino.</>,
          lede: 'Cuando el inquilino se va, el departamento suele quedar con varias cosas por arreglar a la vez. En vez de llamar a un pintor, un gasfitero, un electricista y a quien lave las cortinas, nos lo cuentas una vez y lo resolvemos todo.',
          steps: [
            {
              n: '01',
              title: 'Pintura y resanes',
              body: 'Pintado general, resane de huecos de cableado, clavos y tarugos, y pintura de puertas y marcos.',
              icon: 'brush',
            },
            {
              n: '02',
              title: 'Gasfitería y electricidad',
              body: 'Inodoros, tapas y filtraciones, lavaderos, focos, tomacorrientes e interruptores.',
              icon: 'layers',
            },
            {
              n: '03',
              title: 'Muebles, pisos y limpieza',
              body: 'Piezas de melamina, puertas y bisagras, piso dañado, vidrios rotos, y lavado de cortinas y alfombras.',
              icon: 'home',
            },
          ],
          after: (
            <>
              ¿Solo necesitas pintura? Mira los{' '}
              <Link href="/pintores-a-domicilio" style={link}>pintores a domicilio</Link>.
            </>
          ),
        },
        {
          id: 'visita',
          num: '02 / Visita técnica',
          title: <>Primero vemos<br />el departamento.</>,
          lede: 'Cada departamento queda distinto, por eso no cotizamos a ciegas. Agendamos una visita técnica, vemos qué hay que reparar y te damos una cotización exacta. La visita no tiene costo.',
        },
        {
          id: 'propietarios',
          num: '03 / Para propietarios',
          title: <>Un dueño, un contacto,<br />cero llamadas.</>,
          lede: 'Si tienes uno o varios departamentos en alquiler, nos encargamos entre un inquilino y el siguiente: coordinas con una sola persona y recibes el departamento listo para alquilarlo de nuevo.',
          after: (
            <>
              ¿Estás por entregar un departamento que alquilas? Lee{' '}
              <Link href="/blog/pintar-departamento-al-entregarlo" style={link}>
                qué dice la ley sobre pintar al entregar
              </Link>
              .
            </>
          ),
        },
      ]}
      steps={[
        {
          n: '01',
          title: 'Escríbenos por WhatsApp',
          body: 'Dinos el distrito y mándanos unas fotos del departamento.',
          icon: 'chat',
        },
        {
          n: '02',
          title: 'Visita técnica sin costo',
          body: 'Vamos a ver el departamento y te damos la cotización exacta.',
          icon: 'cal',
        },
        {
          n: '03',
          title: 'Lo dejamos listo',
          body: 'Coordinamos los trabajos y te entregamos el departamento listo para el nuevo inquilino.',
          icon: 'check',
        },
      ]}
      faq={FAQ}
      final={{
        eyebrow: 'Agenda tu visita',
        title: <>Departamento listo,<br /><em>sin tantas llamadas.</em></>,
        lede: 'Escríbenos con el distrito y unas fotos, y agendamos la visita técnica sin costo.',
      }}
      service={{
        name: 'Reparación y mantenimiento de departamentos en alquiler',
        serviceType: 'Reparación y mantenimiento de inmuebles',
        description:
          'Servicio integral de reparación de departamentos en alquiler en Lima y Callao: pintura, gasfitería, electricidad, melamina y limpieza, con un solo contacto y visita técnica sin costo.',
      }}
      navLinks={[
        { label: 'Qué hacemos', href: '#trabajos' },
        { label: 'Visita técnica', href: '#visita' },
        { label: 'Cómo funciona', href: '#como' },
        { label: 'Preguntas', href: '#faq' },
        { label: 'Blog', href: '/blog' },
      ]}
    />
  )
}
