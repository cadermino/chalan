import type { Metadata } from 'next'
import Link from 'next/link'
import { ServiceLanding, soles, type ServiceFaq, type ServicePrice } from '@/components/ServiceLanding'
import { HOME_SERVICES } from '@/lib/homeServices'

// Precios "desde", de mano de obra, por m² y con la comisión de Chalán incluida.
// Se definieron con las tarifas públicas de pintura de las tiendas de
// mejoramiento del hogar y los precios de referencia de pintores en Lima
// (octubre de 2026): techo 15–18, exterior 17–20. El precio de paredes
// interiores incluye el empastado, el sellado y las dos manos. Se ajustan con las cotizaciones reales; la página no
// nombra a ninguna tienda.
const PRICES: ServicePrice[] = [
  {
    id: '01',
    name: 'Paredes interiores',
    includes: 'Con empastado, sellado y dos manos de pintura',
    from: 8,
  },
  {
    id: '02',
    name: 'Techos',
    includes: 'Cielo raso de sala, dormitorios, cocina o baño',
    from: 16.9,
  },
  {
    id: '03',
    name: 'Exteriores y fachadas',
    includes: 'Muros exteriores, patios y fachadas de hasta 3 m de altura',
    from: 19.9,
  },
]

const priceOf = (id: string) => soles(PRICES.find((p) => p.id === id)!.from)
const lowest = soles(Math.min(...PRICES.map((p) => p.from)))
const service = HOME_SERVICES.pintura

export const metadata: Metadata = {
  title: 'Pintores a domicilio en Lima: departamentos y casas | Chalán',
  description:
    `Pintamos y empastamos departamentos y casas en Lima, Callao y Huancayo, desde ${lowest} por m². También para entregar el depa o antes de mudarte.`,
  keywords:
    'pintor a domicilio lima, pintores a domicilio, pintado de departamentos lima, servicio de pintura lima, empastado y pintado, pintar departamento para entregar, pintor huancayo',
  alternates: { canonical: service.path },
  openGraph: {
    title: 'Pintores a domicilio en Lima: departamentos y casas | Chalán',
    description: `Pintado y empastado de departamentos y casas. Lima, Callao y Huancayo. Desde ${lowest} por m².`,
    url: `https://chalan.pe${service.path}`,
  },
}

const link = { color: 'var(--ink)', textDecoration: 'underline' }

const FAQ: ServiceFaq[] = [
  {
    q: '¿Cuánto cobra un pintor por m² en Lima?',
    a: `Depende de la superficie. Paredes interiores desde ${priceOf('01')} por m², techos desde ${priceOf('02')} y exteriores desde ${priceOf('03')}. Es el precio de la mano de obra; el precio final te lo confirmamos al cotizar.`,
    render: (
      <>
        Depende de la superficie. Paredes interiores desde {priceOf('01')} por m², techos desde{' '}
        {priceOf('02')} y exteriores desde {priceOf('03')}. Es el precio de la mano de obra; el precio final te lo confirmamos al
        cotizar. En la guía te explicamos{' '}
        <Link href="/blog/cuanto-cuesta-pintar-un-departamento-lima">cuánto cuesta pintar un departamento</Link>{' '}
        y cómo calcular los metros.
      </>
    ),
  },
  {
    q: '¿La pintura está incluida?',
    a: 'No: los precios son de mano de obra. La pintura y los materiales los compras tú, o te decimos cuántos galones necesitas. Como referencia, un galón de látex rinde entre 25 y 40 m² por mano, según la marca y la línea.',
  },
  {
    q: '¿Cómo calculo los metros a pintar?',
    a: 'Se cotiza por los metros de pared, no por los del departamento. Por cada ambiente, suma el largo de sus paredes, multiplícalo por la altura y resta puertas y ventanas. Si no quieres medir, mándanos fotos y las medidas de cada ambiente por WhatsApp y lo calculamos.',
  },
  {
    q: 'Voy a entregar el departamento, ¿tengo que pintarlo?',
    a: 'Depende de tu contrato. El Código Civil pide devolver el inmueble en el estado en que lo recibiste, salvo el desgaste del uso normal, y muchos contratos piden entregarlo pintado. Resanamos los huecos de clavos y tarugos y pintamos para que lo entregues sin descuentos de la garantía.',
    render: (
      <>
        Depende de tu contrato. El Código Civil pide devolver el inmueble en el estado en que lo
        recibiste, salvo el desgaste del uso normal, y muchos contratos piden entregarlo pintado. Lo
        explicamos en{' '}
        <Link href="/blog/pintar-departamento-al-entregarlo">¿tienes que pintar el departamento al entregarlo?</Link>.
        Resanamos los huecos de clavos y tarugos y pintamos para que lo entregues sin descuentos de
        la garantía.
      </>
    ),
  },
  {
    q: '¿Cuándo hace falta empastar?',
    a: 'Cuando la pared tiene desniveles, fisuras, manchas que vuelven a salir o un tarrajeo nuevo. Si la pared está lisa y solo cambia el color, basta con resanar y pintar.',
    render: (
      <>
        Cuando la pared tiene desniveles, fisuras, manchas que vuelven a salir o un tarrajeo nuevo.
        Si la pared está lisa y solo cambia el color, basta con resanar y pintar. Te lo contamos en{' '}
        <Link href="/blog/empastado-o-solo-pintura">empastado o solo pintura</Link>.
      </>
    ),
  },
  {
    q: '¿En qué zonas trabajan?',
    a: 'En todos los distritos de Lima Metropolitana y el Callao, y en Huancayo.',
  },
]

export default function PintoresADomicilio() {
  return (
    <ServiceLanding
      path={service.path}
      breadcrumbName="Pintores a domicilio"
      eyebrow="Pintura a domicilio · Lima, Callao y Huancayo"
      heroTitle={
        <>
          <span className="line">Pintores</span>
          <span className="line indent"><em>a domicilio</em></span>
          <span className="line">en Lima.</span>
        </>
      }
      heroSub="Departamentos y casas, por dentro y por fuera. Con empastado si hace falta, y también para entregar el depa."
      ctaBody="Mándanos fotos de las paredes y los metros, o las medidas de cada ambiente. Te respondemos con el precio por WhatsApp."
      whatsappText={service.whatsappText}
      prices={PRICES}
      priceUnit="por m²"
      pricesTitle={<>Precios de pintura<br />por metro cuadrado.</>}
      pricesHeader="Superficie y qué incluye"
      pricesNote={
        <>
          <strong>Mano de obra:</strong> la pintura y los materiales van aparte. Los compras tú, o te
          decimos cuántos galones necesitas.
        </>
      }
      pricesFinePrint="* Precios de referencia. El precio final te lo confirmamos al cotizar, según el estado de las paredes y el acceso. Alturas de más de 3 m se cotizan aparte."
      kpis={[
        { num: lowest.replace('S/ ', ''), label: 'Soles por m², desde' },
        { num: 'Lima', label: 'También Callao y Huancayo' },
        { num: <>2<span className="unit">manos</span></>, label: 'De pintura en cada pared' },
        { num: <>S/<span className="unit">0</span></>, label: 'Costo de cotización' },
      ]}
      sections={[
        {
          id: 'entrega',
          num: '02 / Mudanzas',
          title: <>¿Entregas el depa<br />o te mudas?<br /><em>Lo pintamos.</em></>,
          steps: [
            {
              n: '01',
              title: 'Antes de entregar',
              body: 'Resanamos los huecos de clavos y tarugos y pintamos, para que lo entregues como lo recibiste y no te descuenten de la garantía.',
              icon: 'key',
            },
            {
              n: '02',
              title: 'Antes de mudarte',
              body: 'Pintar el nuevo departamento vacío es más rápido y deja todo limpio antes de que lleguen tus muebles.',
              icon: 'home',
            },
            {
              n: '03',
              title: 'Junto con tu mudanza',
              body: 'Si te mudas con Chalán, agendamos la pintura de la casa que dejas para después de sacar los muebles.',
              icon: 'cal',
            },
          ],
          after: (
            <>
              ¿Te mudas?{' '}
              <Link href="/cotizar-mudanza" style={link}>Cotiza tu mudanza con Chalán</Link>
              . Y si tu contrato pide entregarlo pintado, lee{' '}
              <Link href="/blog/pintar-departamento-al-entregarlo" style={link}>
                qué dice la ley sobre pintar al entregar
              </Link>
              .
            </>
          ),
        },
        {
          id: 'empastado',
          num: '03 / Empastado',
          title: <>¿Paredes con<br />imperfecciones?<br /><em>Primero se empastan.</em></>,
          lede: (
            <>
              Una pared con desniveles, fisuras o un tarrajeo nuevo no queda bien solo con pintura: se
              empasta, se lija y recién se pintan las dos manos. Si la pared está lisa, basta con resanar
              los huecos y pintar. Te decimos cuál necesitas al ver las fotos.{' '}
              <Link href="/blog/empastado-o-solo-pintura" style={link}>¿Empastado o solo pintura?</Link>
            </>
          ),
        },
      ]}
      steps={[
        {
          n: '01',
          title: 'Mándanos fotos y medidas',
          body: 'Por WhatsApp: fotos de las paredes y los metros, o las medidas de cada ambiente, y si es interior o exterior.',
          icon: 'chat',
        },
        {
          n: '02',
          title: 'Te cotizamos y agendamos',
          body: 'Te confirmamos el precio, cuánta pintura comprar y coordinamos el día.',
          icon: 'cal',
        },
        {
          n: '03',
          title: 'Pintamos y dejamos limpio',
          body: 'Resanamos, pintamos las dos manos y retiramos lo que usamos.',
          icon: 'brush',
        },
      ]}
      faq={FAQ}
      final={{
        eyebrow: 'Agenda tu pintura',
        title: <>Paredes como nuevas.<br /><em>Cotiza por WhatsApp.</em></>,
        lede: 'Mándanos fotos y medidas. Te respondemos con el precio y agendamos.',
      }}
      service={{
        name: 'Pintores a domicilio',
        serviceType: 'Pintura de interiores y exteriores',
        description:
          'Pintura y empastado de departamentos y casas a domicilio en Lima, Callao y Huancayo, interiores, techos y fachadas.',
      }}
      navLinks={[
        { label: 'Precios', href: '#precios' },
        { label: 'Mudanzas', href: '#entrega' },
        { label: 'Cómo funciona', href: '#como' },
        { label: 'Preguntas', href: '#faq' },
        { label: 'Blog', href: '/blog' },
      ]}
    />
  )
}
