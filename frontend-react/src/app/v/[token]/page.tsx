import type { Metadata } from 'next'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { getApiBase } from '@/lib/api'
import { whatsappUrl } from '@/lib/homeServices'

// Las fotos y videos de un servicio, para mandarlos por WhatsApp a quien va a
// cotizar (el backoffice copia este link). Sin la dirección, sin datos del
// cliente y sin el public_id: el token es otro, y vence a los 30 días. El API
// es GET /api/v1/service-media/<token> (app/api/service_request/media_share.py).

type SharedMedia = {
  service: string | null
  district: string | null
  preferred_date: string | null
  media: { url: string; media_type: 'image' | 'video'; content_type: string | null }[]
}

type Result = { status: 'ok'; data: SharedMedia } | { status: 'expired' | 'missing' }

const FALLBACK_IMAGE = 'https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png'

async function getShared(token: string): Promise<Result> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/service-media/${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (res.status === 410) return { status: 'expired' }
    if (!res.ok) return { status: 'missing' }
    return { status: 'ok', data: await res.json() }
  } catch {
    return { status: 'missing' }
  }
}

// 'YYYY-MM-DD' -> 'sábado 20 de octubre', sin correrse un día por la zona horaria.
function formatDay(isoDate: string | null) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-PE', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  })
}

function headline(data: SharedMedia) {
  const service = (data.service || 'Un servicio').toLowerCase()
  return `${service.charAt(0).toUpperCase()}${service.slice(1)}${data.district ? ` en ${data.district}` : ''}`
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const result = await getShared(token)
  if (result.status !== 'ok') {
    return { title: 'Fotos y videos | Chalán', robots: { index: false, follow: false } }
  }
  const { data } = result
  const firstPhoto = data.media.find((m) => m.media_type === 'image')?.url
  const count = data.media.length
  const description = `${count} ${count === 1 ? 'foto o video' : 'fotos y videos'} para cotizar${
    formatDay(data.preferred_date) ? `, para el ${formatDay(data.preferred_date)}` : ''}.`
  return {
    title: `${headline(data)} | Chalán`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${headline(data)}: fotos y videos`,
      description,
      siteName: 'Chalán',
      type: 'website',
      images: [firstPhoto || FALLBACK_IMAGE],
    },
  }
}

export default async function SharedServiceMedia({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await getShared(token)

  return (
    <>
      <LandingNav />
      <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
          {result.status !== 'ok' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {result.status === 'expired' ? 'Este link ya venció' : 'No encontramos estas fotos'}
              </h1>
              <p className="mt-2 text-gray-600">Escríbenos por WhatsApp y te las volvemos a mandar.</p>
              <a
                href={whatsappUrl('Hola, el link de las fotos del pedido no me abre')}
                className="mt-6 inline-flex rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700"
              >
                Escribir por WhatsApp
              </a>
            </div>
          ) : (
            <SharedBody data={result.data} />
          )}
        </div>
      </main>
      <LandingFooter />
    </>
  )
}

function SharedBody({ data }: { data: SharedMedia }) {
  const day = formatDay(data.preferred_date)
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Fotos y videos del pedido</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{headline(data)}</h1>
      {day && <p className="mt-1 text-gray-600 first-letter:uppercase">{day}</p>}

      {data.media.length === 0 ? (
        <p className="mt-8 text-gray-600">Este pedido no tiene fotos ni videos.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.media.map((m) => (
            <li key={m.url} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {m.media_type === 'video' ? (
                <>
                  <video src={m.url} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
                  {/* Un .mov de iPhone (HEVC) no se reproduce en todos los navegadores. */}
                  <a href={m.url} target="_blank" rel="noreferrer" className="block px-3 py-2 text-sm text-indigo-600 hover:underline">
                    Abrir video
                  </a>
                </>
              ) : (
                <a href={m.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="Foto del pedido" loading="lazy" className="aspect-square w-full object-cover" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6">
        <p className="font-semibold text-gray-900">¿Puedes hacerlo?</p>
        <p className="mt-1 text-sm text-gray-600">Respóndenos por WhatsApp con tu precio y coordinamos.</p>
        <a
          href={whatsappUrl(`Hola, vi las fotos del pedido de ${(data.service || 'servicio').toLowerCase()}${
            data.district ? ` en ${data.district}` : ''} y quiero cotizar`)}
          className="mt-4 inline-flex rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700"
        >
          Responder por WhatsApp
        </a>
      </div>
    </>
  )
}
