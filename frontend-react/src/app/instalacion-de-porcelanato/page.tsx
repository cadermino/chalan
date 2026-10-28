import type { Metadata } from 'next'
import Link from 'next/link'
import { ServiceLanding, soles, type ServiceFaq, type ServicePrice } from '@/components/ServiceLanding'
import { HOME_SERVICES } from '@/lib/homeServices'

// Precios "desde", de mano de obra, por m² y con la comisión de Chalán incluida.
// Referencia de Lima (octubre de 2026): instalación simple de cerámico o
// porcelanato en tiendas de mejoramiento del hogar desde S/ 27.90 por m², y
// precios de referencia de albañiles de S/ 28–40 (formatos hasta 60×60) y
// S/ 45–55 (formatos grandes). El precio "desde" de Chalán es S/ 25 por m² en
// formato 60×60 (cerámico o porcelanato); los formatos mayores se cotizan
// aparte. Se ajustan con las cotizaciones reales. Es la parte acotada de
// albañilería: una landing por trabajo concreto, no una de "albañilería".
const PRICES: ServicePrice[] = [
  {
    id: '01',
    name: 'Porcelanato y cerámica en pisos, formato 60×60',
    includes: 'Interiores, sobre contrapiso nivelado, con zócalo y fragua',
    from: 25,
  },
]

const priceOf = (id: string) => soles(PRICES.find((p) => p.id === id)!.from)
const lowest = soles(Math.min(...PRICES.map((p) => p.from)))
const service = HOME_SERVICES.porcelanato

export const metadata: Metadata = {
  title: 'Instalación de porcelanato y cerámica en Lima | Chalán',
  description:
    `Instalamos porcelanato y cerámica en pisos de departamentos y casas en Lima, Callao y Huancayo, desde ${lowest} por m². También contrapiso y albañilería.`,
  keywords:
    'instalación de porcelanato lima, instalación de cerámica, colocación de porcelanato precio m2, enchape de pisos, maestro albañil lima, instalación de pisos huancayo',
  alternates: { canonical: service.path },
  openGraph: {
    title: 'Instalación de porcelanato y cerámica en Lima | Chalán',
    description: `Pisos de porcelanato y cerámica, con zócalo y fragua. Lima, Callao y Huancayo. Desde ${lowest} por m².`,
    url: `https://chalan.pe${service.path}`,
  },
}

const link = { color: 'var(--ink)', textDecoration: 'underline' }

const FAQ: ServiceFaq[] = [
  {
    q: '¿Cuánto cuesta instalar porcelanato por m² en Lima?',
    a: `La instalación de porcelanato o cerámica en pisos, en formato 60×60, desde ${priceOf('01')} por m². Es la mano de obra; sube con formatos más grandes, cortes en diagonal o si hay que nivelar. El precio final te lo confirmamos al cotizar.`,
    render: (
      <>
        La instalación de porcelanato o cerámica en pisos, en formato 60×60, desde {priceOf('01')} por m².
        Es la mano de obra; sube con formatos más grandes, cortes en diagonal o si hay que nivelar. Lo
        detallamos en{' '}
        <Link href="/blog/precio-instalacion-porcelanato-m2">el precio de instalar porcelanato por m²</Link>.
      </>
    ),
  },
  {
    q: '¿El material está incluido?',
    a: 'No: los precios son de mano de obra. El porcelanato o la cerámica, el pegamento y la fragua los compras tú, o te decimos cuánto comprar. Conviene llevar entre 5 y 10% más de piezas por los cortes.',
  },
  {
    q: '¿Por qué sube el precio con formatos grandes?',
    a: 'Las piezas de más de 60×60 cm pesan más, se cortan con disco, necesitan un pegamento especial y una base muy nivelada, y se pegan con doble encolado para que no queden huecas. Se cotizan aparte.',
  },
  {
    q: '¿Se puede instalar sobre el piso que ya tengo?',
    a: 'A veces, si el piso actual está firme y nivelado y se usa un pegamento adecuado. Si no, se retira y se rehace el contrapiso, que se cotiza aparte. Otra opción para no romper es el microcemento.',
    render: (
      <>
        A veces, si el piso actual está firme y nivelado y se usa un pegamento adecuado. Si no, se
        retira y se rehace el contrapiso, que se cotiza aparte. Otra opción para no romper es el{' '}
        <Link href="/microcemento">microcemento</Link>.
      </>
    ),
  },
  {
    q: '¿Hacen otros trabajos de albañilería?',
    a: 'Sí: contrapiso, tarrajeo, enchape de baños y cocinas y resanes. Mándanos fotos por WhatsApp y te los cotizamos.',
  },
  {
    q: '¿En qué zonas trabajan?',
    a: 'En todos los distritos de Lima Metropolitana y el Callao, y en Huancayo.',
  },
]

export default function InstalacionDePorcelanato() {
  return (
    <ServiceLanding
      path={service.path}
      breadcrumbName="Instalación de porcelanato"
      eyebrow="Porcelanato y cerámica · Lima, Callao y Huancayo"
      heroTitle={
        <>
          <span className="line">Instalación de</span>
          <span className="line indent"><em>porcelanato</em></span>
          <span className="line">y cerámica.</span>
        </>
      }
      heroSub="Pisos de departamentos y casas, con zócalo y fragua. Y si hace falta, contrapiso y albañilería."
      ctaBody="Cuéntanos qué hay que instalar, o súbenos un video del ambiente. Los instaladores te cotizan y eliges."
      whatsappText={service.whatsappText}
      formUrl={service.formUrl}
      prices={PRICES}
      priceUnit="por m²"
      pricesTitle={<>Precios de instalación<br />por metro cuadrado.</>}
      pricesHeader="Trabajo y qué incluye"
      pricesNote={
        <>
          <strong>Mano de obra:</strong> el material, el pegamento y la fragua van aparte. Retirar el
          piso anterior, rehacer el contrapiso y enchapar paredes se cotizan al ver el ambiente.
        </>
      }
      pricesFinePrint="* Precios de referencia, para formato 60×60. El precio final te lo confirmamos al cotizar. Formatos de más de 60×60 cm, colocación en diagonal, escaleras y exteriores se cotizan aparte."
      kpis={[
        { num: lowest.replace('S/ ', ''), label: 'Soles por m², desde' },
        { num: 'Lima', label: 'También Callao y Huancayo' },
        { num: <>2<span className="unit">en 1</span></>, label: 'Zócalo y fragua incluidos' },
        { num: <>S/<span className="unit">0</span></>, label: 'Costo de cotización' },
      ]}
      sections={[
        {
          id: 'incluye',
          num: '02 / Qué incluye',
          title: <>Del contrapiso<br />al zócalo.</>,
          steps: [
            {
              n: '01',
              title: 'Revisamos la base',
              body: 'Que el contrapiso esté firme y nivelado. Si no lo está, te decimos qué hace falta antes de instalar.',
              icon: 'ruler',
            },
            {
              n: '02',
              title: 'Instalamos',
              body: 'Con nivel, crucetas y el pegamento que pide cada pieza, y los cortes junto a las paredes.',
              icon: 'layers',
            },
            {
              n: '03',
              title: 'Zócalo y fragua',
              body: 'Colocamos el zócalo, fraguamos las juntas y dejamos limpio el ambiente.',
              icon: 'check',
            },
          ],
          after: (
            <>
              ¿Quieres renovar el piso sin romper el que tienes? Mira la{' '}
              <Link href="/microcemento" style={link}>aplicación de microcemento</Link>.
            </>
          ),
        },
        {
          id: 'albanileria',
          num: '03 / Albañilería',
          title: <>¿Hace falta más<br />que el piso?</>,
          lede: 'También hacemos contrapiso, tarrajeo, enchape de baños y cocinas y resanes. Mándanos fotos del trabajo por WhatsApp y te lo cotizamos.',
        },
      ]}
      steps={[
        {
          n: '01',
          title: 'Cuéntanos qué instalar',
          body: 'En el formulario: escríbelo o sube un video del ambiente. Si sabes los metros, el formato de las piezas o si hay que sacar el piso actual, mejor.',
          icon: 'chat',
        },
        {
          n: '02',
          title: 'Comparas y agendas',
          body: 'Te llegan las cotizaciones por WhatsApp, eliges una y reservas con Yape. El resto se paga al terminar.',
          icon: 'cal',
        },
        {
          n: '03',
          title: 'Instalamos y dejamos limpio',
          body: 'Instalamos, colocamos zócalo y fragua, y te decimos desde cuándo se puede pisar.',
          icon: 'check',
        },
      ]}
      faq={FAQ}
      final={{
        eyebrow: 'Agenda tu instalación',
        title: <>Pisos nuevos, bien nivelados.<br /><em>Cotiza en 2 minutos.</em></>,
        lede: 'Cuéntanos qué instalar o súbenos un video. Te llegan las cotizaciones y eliges.',
      }}
      service={{
        name: 'Instalación de porcelanato y cerámica',
        serviceType: 'Instalación de pisos',
        description:
          'Instalación de porcelanato y cerámica a domicilio en Lima, Callao y Huancayo, con zócalo y fragua. También contrapiso y albañilería.',
      }}
      navLinks={[
        { label: 'Precios', href: '#precios' },
        { label: 'Qué incluye', href: '#incluye' },
        { label: 'Cómo funciona', href: '#como' },
        { label: 'Preguntas', href: '#faq' },
        { label: 'Blog', href: '/blog' },
      ]}
    />
  )
}
