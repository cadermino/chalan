// Las landings para que un profesional de servicios se dé de alta en Chalán
// (/profesionales/<slug>). `service` es el código de lu_service_types: el alta
// crea la empresa con solo ese servicio (backoffice-api /auth/register,
// `service_code`), así le llegan esos pedidos y no mudanzas. Tiene que ser uno
// que se pide con formulario (`requestable`).
//
// Son para quien busca clientes, no para el cliente: no compiten con las
// landings de servicio (/pintores-a-domicilio...), que enlazan aquí.

export interface Professional {
  slug: string
  service: 'painting' | 'microcement' | 'masonry' | 'furniture_assembly' | 'packing'
  /** "pintores", para el menú y los títulos. */
  plural: string
  /** "pintor", para "¿Eres pintor?". */
  singular: string
  /** La landing del servicio para clientes. */
  customerPath: string
  title: string
  description: string
  keywords: string
  heroLines: [string, string]
  lede: string
  /** Qué trae cada pedido, en el aviso que le llega. */
  requestBrings: string
  /** Trabajos que piden los clientes, para que sepa si es lo suyo. */
  jobs: string[]
  /** Preguntas propias del oficio, antes de las comunes. */
  faq: { q: string; a: string }[]
}

export const PROFESSIONALS: Professional[] = [
  {
    slug: 'pintores',
    service: 'painting',
    plural: 'pintores',
    singular: 'pintor',
    customerPath: '/pintores-a-domicilio',
    title: 'Trabajo para pintores en Lima: recibe pedidos de pintura | Chalán',
    description:
      'Si eres pintor y trabajas por tu cuenta, regístrate gratis en Chalán y recibe por WhatsApp pedidos de pintura de departamentos y casas en Lima, con m² y fotos. Sin cuota ni comisión a tu precio.',
    keywords: 'trabajo para pintores lima, clientes para pintores, pintores independientes lima, conseguir obras de pintura',
    heroLines: ['Más obras', 'de pintura.'],
    lede: 'Clientes de Lima que quieren pintar su departamento o su casa te llegan por WhatsApp con los m² y fotos. Tú pones tu precio.',
    requestBrings: 'el distrito, la fecha, los m² de pared, qué hay que pintar y las fotos o el video del cliente',
    jobs: [
      'Pintar un departamento antes de alquilarlo o al entregarlo',
      'Interiores de casas: salas, dormitorios, techos',
      'Empastado y lijado antes de pintar',
      'Paredes con humedad, salitre o rajaduras',
    ],
    faq: [
      { q: '¿Tengo que poner la pintura?', a: 'Depende del pedido: el cliente dice si la compra él o si la pones tú. Tú cotizas según eso, y lo puedes aclarar en el comentario de tu cotización.' },
    ],
  },
  {
    slug: 'aplicadores-de-microcemento',
    service: 'microcement',
    plural: 'aplicadores de microcemento',
    singular: 'aplicador de microcemento',
    customerPath: '/microcemento',
    title: 'Aplicadores de microcemento: consigue clientes en Lima | Chalán',
    description:
      'Si aplicas microcemento, regístrate gratis en Chalán y recibe pedidos de baños, pisos y cocinas en Lima, con m², fotos y la base que hay. Sin cuota ni comisión a tu precio.',
    keywords: 'aplicadores de microcemento lima, clientes microcemento, trabajo aplicador microcemento, obras de microcemento',
    heroLines: ['Más obras', 'de microcemento.'],
    lede: 'Clientes de Lima que quieren microcemento en el baño, el piso o la cocina te llegan por WhatsApp con los m² y fotos. Tú pones tu precio.',
    requestBrings: 'el distrito, la fecha, los m², la superficie, qué hay debajo (mayólica, cemento) y las fotos o el video del cliente',
    jobs: [
      'Baños sobre mayólica, sin romper',
      'Pisos de sala y dormitorios',
      'Cocinas: paredes y tableros',
      'Solo mano de obra, o a todo costo',
    ],
    faq: [
      { q: '¿El cliente sabe que un trabajo chico cuesta más por m²?', a: 'Te conviene decirlo en el comentario de tu cotización (por ejemplo, un mínimo por obra). El cliente ve tu comentario junto al precio.' },
    ],
  },
  {
    slug: 'instaladores-de-porcelanato',
    service: 'masonry',
    plural: 'instaladores de porcelanato',
    singular: 'instalador de porcelanato',
    customerPath: '/instalacion-de-porcelanato',
    title: 'Trabajo para instaladores de porcelanato en Lima | Chalán',
    description:
      'Si instalas porcelanato o cerámica, regístrate gratis en Chalán y recibe pedidos de pisos y paredes en Lima, con m², formato y fotos. Sin cuota ni comisión a tu precio.',
    keywords: 'trabajo instalador de porcelanato lima, clientes para maestros de obra, instaladores de cerámica lima, colocar porcelanato trabajo',
    heroLines: ['Más obras', 'de porcelanato.'],
    lede: 'Clientes de Lima que quieren instalar porcelanato o cerámica te llegan por WhatsApp con los m², el formato y fotos. Tú pones tu precio.',
    requestBrings: 'el distrito, la fecha, los m², el formato de la pieza, si hay que retirar el piso anterior o hacer contrapiso, y las fotos o el video del cliente',
    jobs: [
      'Pisos de departamentos y casas',
      'Baños y cocinas: piso y pared',
      'Formatos grandes (60×120 y más)',
      'Retirar el piso anterior y nivelar',
    ],
    faq: [
      { q: '¿Quién compra el porcelanato?', a: 'El cliente dice si ya lo tiene o si lo pones tú. Si cotizas solo la mano de obra, acláralo en el comentario de tu cotización.' },
    ],
  },
  {
    slug: 'armadores-de-muebles',
    service: 'furniture_assembly',
    plural: 'armadores de muebles',
    singular: 'armador de muebles',
    customerPath: '/armado-de-muebles',
    title: 'Trabajo para armadores de muebles en Lima | Chalán',
    description:
      'Si armas muebles de melamina, regístrate gratis en Chalán y recibe pedidos de armado y desarmado en Lima, con la lista de muebles y fotos. Sin cuota ni comisión a tu precio.',
    keywords: 'trabajo armador de muebles lima, armado de muebles a domicilio trabajo, clientes armado de melamina, armador independiente',
    heroLines: ['Más pedidos', 'de armado.'],
    lede: 'Clientes de Lima que compraron un ropero, una cama o un escritorio, o que se mudan, te llegan por WhatsApp con la lista de muebles. Tú pones tu precio.',
    requestBrings: 'el distrito, la fecha y la lista de muebles, cada uno con si hay que armarlo, desarmarlo o las dos cosas, y fotos',
    jobs: [
      'Roperos, camas y cómodas de melamina',
      'Escritorios, reposteros y muebles de TV',
      'Desarmar antes de una mudanza y armar en la casa nueva',
      'Muebles recién comprados, en caja',
    ],
    faq: [
      { q: '¿Cotizo por mueble o por todo?', a: 'Por todo el pedido: el cliente ve un solo precio. Si cobras distinto por mueble, puedes detallarlo en el comentario de tu cotización.' },
    ],
  },
  {
    slug: 'embaladores',
    service: 'packing',
    plural: 'embaladores',
    singular: 'embalador',
    customerPath: '/embalaje-profesional',
    title: 'Trabajo de embalaje para mudanzas en Lima | Chalán',
    description:
      'Si embalas muebles y objetos frágiles para mudanzas, regístrate gratis en Chalán y recibe pedidos de embalaje en Lima, con la lista de cosas y los materiales. Sin cuota ni comisión a tu precio.',
    keywords: 'trabajo de embalaje lima, embaladores para mudanzas, clientes embalaje, servicio de embalaje independiente',
    heroLines: ['Más pedidos', 'de embalaje.'],
    lede: 'Clientes de Lima que se mudan y quieren sus cosas bien embaladas te llegan por WhatsApp con la lista y los materiales. Tú pones tu precio.',
    requestBrings: 'el distrito, la fecha, la lista de cosas a embalar con los materiales que pide el cliente, y fotos',
    jobs: [
      'Muebles: sofás, mesas, roperos',
      'Vajilla, vidrios y cuadros',
      'Televisores y electrodomésticos',
      'Cajas y materiales: stretch film, burbupack, cartón',
    ],
    faq: [
      { q: '¿Pongo yo los materiales?', a: 'El pedido dice qué materiales necesita cada cosa. Cotizas con ellos incluidos, o lo aclaras en el comentario de tu cotización.' },
    ],
  },
]

export const professionalBySlug = (slug: string) => PROFESSIONALS.find((p) => p.slug === slug)

export const professionalByService = (service: string) => PROFESSIONALS.find((p) => p.service === service)

/** Lo que vale para todos los oficios. */
export const COMMON_FAQ = [
  { q: '¿Cuánto cuesta registrarse?', a: 'Nada. No hay cuota de afiliación ni mensualidad.' },
  { q: '¿Cuánto se queda Chalán de mi precio?', a: 'Nada de tu precio. El cliente paga la comisión de Chalán encima de lo que cotizas, como una reserva, y a ti te paga tu precio completo en el lugar, el día del trabajo.' },
  { q: '¿Cuántos pedidos voy a recibir?', a: 'Depende de cuántos clientes pidan tu oficio en tu zona ese mes: no te prometemos un número. Te avisamos de cada pedido que te sirva, y tú decides cuáles cotizar.' },
  { q: '¿Es un empleo?', a: 'No. Es para quien trabaja por su cuenta o tiene su empresa: tú pones tus precios y tus horarios, y no hay sueldo.' },
  { q: '¿Qué documentos me piden?', a: 'Tu DNI o carné de extranjería y fotos de 3 a 8 trabajos tuyos. Los usamos para validar tu cuenta y ver cómo trabajas. Solo los ve el equipo de Chalán.' },
  { q: '¿En qué zonas?', a: 'Por ahora, la mayoría de pedidos son de Lima y Callao, y algunos de Huancayo. Te avisamos de los de la zona donde trabajas.' },
]

/** Del registro al primer cobro. */
export const PRO_STEPS = [
  { n: '01', title: 'Regístrate', body: 'Con tu DNI y fotos de trabajos tuyos. Revisamos tu cuenta y la activamos.' },
  { n: '02', title: 'Te llega el pedido', body: 'Por WhatsApp, con un link al pedido. Sin visita previa para cotizar.' },
  { n: '03', title: 'Cotizas tu precio', body: 'Desde el link, con un comentario para el cliente. Si no te sirve, lo rechazas.' },
  { n: '04', title: 'Haces el trabajo', body: 'Si te elige, recibes su WhatsApp y su dirección, y cobras tu precio completo en el lugar.' },
]
