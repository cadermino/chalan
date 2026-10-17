import type { Metadata } from 'next'
import Link from 'next/link'
import { ServiceLanding, soles, type ServiceFaq, type ServicePrice } from '@/components/ServiceLanding'
import { HOME_SERVICES } from '@/lib/homeServices'

// Precios "desde", por m² y con la comisión de Chalán incluida. Referencia de
// Lima (octubre de 2026): colocación S/ 40–50 por m² solo mano de obra, y entre
// S/ 50 y más de S/ 120 a todo costo según capas, malla y sellador. Se ajustan
// con las cotizaciones reales. Es un servicio de aplicación: no vendemos el
// producto.
const PRICES: ServicePrice[] = [
  {
    id: '01',
    name: 'Mano de obra',
    includes: 'Aplicación en pisos o paredes. El material lo compras tú, o te decimos cuál y cuánto',
    from: 49.9,
  },
  {
    id: '02',
    name: 'A todo costo',
    includes: 'Microcemento, imprimante, malla, capas de acabado, sellador y aplicación',
    from: 99.9,
  },
]

const priceOf = (id: string) => soles(PRICES.find((p) => p.id === id)!.from)
const lowest = soles(Math.min(...PRICES.map((p) => p.from)))
const service = HOME_SERVICES.microcemento

export const metadata: Metadata = {
  title: 'Aplicación de microcemento en Lima: baños, pisos y paredes | Chalán',
  description:
    `Aplicamos microcemento en baños, pisos, paredes y cocinas, también sobre mayólica sin romper. Lima, Callao y Huancayo, desde ${lowest} por m².`,
  keywords:
    'aplicación de microcemento lima, aplicador de microcemento, microcemento en baños, microcemento sobre mayólica, microcemento en pisos, mano de obra microcemento m2',
  alternates: { canonical: service.path },
  openGraph: {
    title: 'Aplicación de microcemento en Lima: baños, pisos y paredes | Chalán',
    description: `Baños, pisos y paredes sin juntas, también sobre mayólica. Lima, Callao y Huancayo. Desde ${lowest} por m².`,
    url: `https://chalan.pe${service.path}`,
  },
}

const link = { color: 'var(--ink)', textDecoration: 'underline' }

const FAQ: ServiceFaq[] = [
  {
    q: '¿Cuánto cuesta el microcemento por m² en Lima?',
    a: `La aplicación sola, desde ${priceOf('01')} por m²; a todo costo, con material, malla y sellador, desde ${priceOf('02')} por m². Varía según la superficie, el estado de la base y cuántas capas lleva. El precio final te lo confirmamos al cotizar.`,
    render: (
      <>
        La aplicación sola, desde {priceOf('01')} por m²; a todo costo, con material, malla y
        sellador, desde {priceOf('02')} por m². Varía según la superficie, el estado de la base y
        cuántas capas lleva. Lo detallamos en{' '}
        <Link href="/blog/precio-microcemento-m2-lima">el precio del microcemento por m²</Link>.
      </>
    ),
  },
  {
    q: '¿Se puede poner microcemento sobre mayólica?',
    a: 'Sí, si las piezas están bien pegadas: se revisa que ninguna suene hueca, se limpia, se aplica un imprimante de adherencia, se rellenan las juntas y se coloca una malla antes de las capas. Así no hace falta demoler.',
    render: (
      <>
        Sí, si las piezas están bien pegadas: se revisa que ninguna suene hueca, se limpia, se aplica
        un imprimante de adherencia, se rellenan las juntas y se coloca una malla antes de las capas.
        Así no hace falta demoler. Lo explicamos paso a paso en{' '}
        <Link href="/blog/microcemento-sobre-mayolica">microcemento sobre mayólica</Link>.
      </>
    ),
  },
  {
    q: '¿Es recomendable en baños y duchas?',
    a: 'Sí, con un sellador impermeable adecuado para zonas húmedas. En duchas se le da más capas de sellador y se respeta el tiempo de curado antes de mojarlo.',
  },
  {
    q: '¿Qué desventajas tiene?',
    a: 'Cuesta más que un cerámico, necesita un aplicador con experiencia y puede fisurarse si la base se mueve o no lleva malla. El sellador de la superficie se renueva cada cierto tiempo, según el uso.',
    render: (
      <>
        Cuesta más que un cerámico, necesita un aplicador con experiencia y puede fisurarse si la base
        se mueve o no lleva malla. El sellador de la superficie se renueva cada cierto tiempo, según
        el uso. Las comparamos en{' '}
        <Link href="/blog/microcemento-ventajas-y-desventajas">ventajas y desventajas del microcemento</Link>.
      </>
    ),
  },
  {
    q: '¿Venden microcemento?',
    a: 'No, solo lo aplicamos. Si ya compraste el material, cotiza solo la mano de obra; si no, te lo cotizamos a todo costo.',
  },
  {
    q: '¿En qué zonas trabajan?',
    a: 'En todos los distritos de Lima Metropolitana y el Callao, y en Huancayo.',
  },
]

export default function Microcemento() {
  return (
    <ServiceLanding
      path={service.path}
      breadcrumbName="Aplicación de microcemento"
      eyebrow="Microcemento · Lima, Callao y Huancayo"
      heroTitle={
        <>
          <span className="line">Aplicación de</span>
          <span className="line indent"><em>microcemento</em></span>
          <span className="line">en Lima.</span>
        </>
      }
      heroSub="Baños, pisos, paredes y cocinas sin juntas. También sobre la mayólica que ya tienes, sin romper."
      ctaBody="Mándanos fotos de la superficie, qué material tiene hoy y los metros. Te respondemos con el precio por WhatsApp."
      whatsappText={service.whatsappText}
      prices={PRICES}
      priceUnit="por m²"
      pricesTitle={<>Precios de microcemento<br />por metro cuadrado.</>}
      pricesHeader="Modalidad y qué incluye"
      pricesNote={
        <>
          <strong>Baños y duchas</strong> llevan más capas de sellador impermeable. Escaleras, mesadas
          y fachadas se cotizan al ver la superficie.
        </>
      }
      pricesFinePrint="* Precios de referencia. El precio final te lo confirmamos al cotizar, según la superficie, el estado de la base y el acabado. No incluye demoliciones ni nivelación de pisos."
      kpis={[
        { num: lowest.replace('S/ ', ''), label: 'Soles por m², desde' },
        { num: 'Lima', label: 'También Callao y Huancayo' },
        { num: <>0<span className="unit">juntas</span></>, label: 'Una superficie continua' },
        { num: <>S/<span className="unit">0</span></>, label: 'Costo de cotización' },
      ]}
      sections={[
        {
          id: 'mayolica',
          num: '02 / Sin demoler',
          title: <>¿Mayólica vieja?<br />Se cubre<br /><em>sin romper.</em></>,
          lede: (
            <>
              El microcemento se aplica en capas de pocos milímetros sobre la superficie que ya tienes,
              si está firme: cerámica, mayólica, porcelanato o cemento. Revisamos que ninguna pieza suene
              hueca, rellenamos las juntas, colocamos malla y aplicamos las capas y el sellador. Sin
              escombros ni semanas de obra.{' '}
              <Link href="/blog/microcemento-sobre-mayolica" style={link}>Cómo se hace, paso a paso</Link>
            </>
          ),
        },
        {
          id: 'donde',
          num: '03 / Dónde',
          title: <>Baños, pisos<br />y paredes.</>,
          steps: [
            {
              n: '01',
              title: 'Baños y duchas',
              body: 'Paredes, piso y ducha de una sola pieza, con sellador impermeable para zonas húmedas.',
              icon: 'layers',
            },
            {
              n: '02',
              title: 'Pisos',
              body: 'Sala, dormitorios y cocina, sin juntas y sin levantar el piso que tienes.',
              icon: 'home',
            },
            {
              n: '03',
              title: 'Paredes y cocinas',
              body: 'Muros de sala, cabeceras y salpicaderos de cocina.',
              icon: 'brush',
            },
          ],
          after: (
            <>
              ¿Prefieres un piso de porcelanato o cerámica? También hacemos la{' '}
              <Link href="/instalacion-de-porcelanato" style={link}>instalación de porcelanato</Link>.
            </>
          ),
        },
      ]}
      steps={[
        {
          n: '01',
          title: 'Mándanos fotos y medidas',
          body: 'Por WhatsApp: fotos de la superficie, qué material tiene hoy y los metros.',
          icon: 'chat',
        },
        {
          n: '02',
          title: 'Te cotizamos y agendamos',
          body: 'Te confirmamos el precio, con o sin material, y coordinamos los días de trabajo.',
          icon: 'cal',
        },
        {
          n: '03',
          title: 'Aplicamos y sellamos',
          body: 'Preparamos la base, aplicamos las capas y el sellador, y te decimos desde cuándo puedes usarlo.',
          icon: 'check',
        },
      ]}
      faq={FAQ}
      final={{
        eyebrow: 'Agenda tu microcemento',
        title: <>Sin juntas, sin demoler.<br /><em>Cotiza por WhatsApp.</em></>,
        lede: 'Mándanos fotos de la superficie y los metros. Te respondemos con el precio y agendamos.',
      }}
      service={{
        name: 'Aplicación de microcemento',
        serviceType: 'Aplicación de microcemento',
        description:
          'Aplicación de microcemento a domicilio en Lima, Callao y Huancayo: baños, pisos, paredes y cocinas, también sobre mayólica.',
      }}
      navLinks={[
        { label: 'Precios', href: '#precios' },
        { label: 'Sobre mayólica', href: '#mayolica' },
        { label: 'Cómo funciona', href: '#como' },
        { label: 'Preguntas', href: '#faq' },
        { label: 'Blog', href: '/blog' },
      ]}
    />
  )
}
