'use client'

import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'

// Los recibe el API principal (app/api/carrier_documents.py): pide una subida
// firmada, el archivo va directo a S3 y después se registra. Same-origin vía nginx.
const API = '/api/v1/carrier-documents'

type DocType = 'identity' | 'driver_license' | 'vehicle_card'

interface CarrierDocument {
  id: number
  doc_type: DocType
  content_type: string
}

interface Status {
  company_name: string
  documents: CarrierDocument[]
  max_per_type: number
  can_delete: boolean
}

const SECTIONS: { type: DocType; title: string; hint: string }[] = [
  {
    type: 'identity',
    title: 'DNI o carné de extranjería',
    hint: 'Frente y reverso. Que se lean tu nombre, tu foto y el número.',
  },
  {
    type: 'driver_license',
    title: 'Licencia de conducir',
    hint: 'Frente y reverso, vigente, de quien maneja el vehículo.',
  },
  {
    type: 'vehicle_card',
    title: 'Tarjeta de propiedad del vehículo',
    hint: 'La tarjeta de identificación vehicular de SUNARP: una foto de la tarjeta física, o el PDF si es electrónica. Que se lean la placa y los pesos.',
  },
]

// Un documento fotografiado con el celular pesa 4–8 MB; a 2400 px de lado sigue
// leyéndose cada número y sube en segundos con datos móviles.
const MAX_SIDE = 2400
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const WHATSAPP = 'https://wa.me/51972643007'

type Theme = 'dark' | 'light'

const THEME = {
  dark: {
    container: { background: 'var(--paper-2)', border: '1px solid var(--line)' },
    section: { background: 'var(--paper)', border: '1px solid var(--line)' },
    heading: { fontFamily: 'var(--serif)', color: 'var(--ink-strong)' },
    title: { color: 'var(--ink-strong)' },
    body: { color: 'var(--ink-soft)' },
    mute: { color: 'var(--mute)' },
    accent: 'var(--ch-accent)',
  },
  light: {
    container: { background: '#ffffff', border: '1px solid #f3f4f6', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    section: { background: '#f9fafb', border: '1px solid #e5e7eb' },
    heading: { fontFamily: 'inherit', color: '#111827' },
    title: { color: '#111827' },
    body: { color: '#4b5563' },
    mute: { color: '#9ca3af' },
    accent: '#1e1b4b',
  },
} satisfies Record<Theme, Record<string, React.CSSProperties | string>>

/** Foto → JPEG achicado. Un PDF, o una imagen que el navegador no sabe abrir, va tal cual. */
async function prepare(file: File): Promise<Blob> {
  if (file.type === 'application/pdf' || !file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

const isComplete = (documents: CarrierDocument[]) =>
  SECTIONS.every((section) => documents.some((d) => d.doc_type === section.type))

class UploadError extends Error {}

async function upload(token: string, docType: DocType, file: File): Promise<CarrierDocument> {
  const blob = await prepare(file)
  if (!ALLOWED.includes(blob.type)) {
    throw new UploadError('Ese formato no lo podemos abrir. Sube una foto (JPG o PNG) o un PDF.')
  }
  if (blob.size > MAX_BYTES) throw new UploadError('El archivo pesa más de 10 MB.')

  const presign = await fetch(`${API}/${token}/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_type: docType, content_type: blob.type, size_bytes: blob.size }),
  })
  if (!presign.ok) {
    const { message = '' } = await presign.json().catch(() => ({}))
    if (message.includes('at most')) throw new UploadError('Ya subiste el máximo de archivos para este documento.')
    throw new UploadError('No pudimos preparar la subida. Inténtalo de nuevo.')
  }
  const { upload: target, storage_key } = await presign.json()

  // S3 exige que `file` sea el último campo del formulario.
  const form = new FormData()
  Object.entries(target.fields as Record<string, string>).forEach(([name, value]) => form.append(name, value))
  form.append('file', blob)
  const stored = await fetch(target.url, { method: 'POST', body: form })
  if (!stored.ok) throw new UploadError('No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.')

  const registered = await fetch(`${API}/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storage_key }),
  })
  if (!registered.ok) throw new UploadError('No se pudo guardar el archivo. Inténtalo de nuevo.')
  return registered.json()
}

export function CarrierDocumentsUpload({ token, theme = 'dark' }: { token: string; theme?: Theme }) {
  const t = THEME[theme]
  const [status, setStatus] = useState<Status | null>(null)
  const [linkProblem, setLinkProblem] = useState<'expired' | 'invalid' | 'network' | null>(null)

  useEffect(() => {
    fetch(`${API}/${token}`)
      .then(async (res) => {
        if (res.ok) return setStatus(await res.json())
        const { reason } = await res.json().catch(() => ({}))
        setLinkProblem(reason === 'expired' ? 'expired' : 'invalid')
      })
      .catch(() => setLinkProblem('network'))
  }, [token])

  // Solo cuando se completan aquí, no si ya venían completos de antes.
  const wasComplete = useRef<boolean | null>(null)
  useEffect(() => {
    if (!status) return
    const now = isComplete(status.documents)
    if (wasComplete.current === false && now) track('carrier_documents_complete')
    wasComplete.current = now
  }, [status])

  const container: React.CSSProperties = { ...t.container, borderRadius: 14, padding: 28 }

  if (linkProblem) {
    const text = {
      expired: 'Este link ya venció.',
      invalid: 'Este link no es válido.',
      network: 'No pudimos conectar con el servidor.',
    }[linkProblem]
    return (
      <div style={container}>
        <p style={{ ...t.body, fontSize: 15, lineHeight: 1.5 }}>
          {text} Escríbenos por{' '}
          <a href={WHATSAPP} style={{ color: t.accent, textDecoration: 'underline' }}>WhatsApp</a>{' '}
          y te mandamos uno nuevo para subir tus documentos.
        </p>
      </div>
    )
  }

  if (!status) {
    return <div style={container}><p style={{ ...t.mute, fontSize: 14 }}>Cargando…</p></div>
  }

  const byType = (type: DocType) => status.documents.filter((d) => d.doc_type === type)
  const complete = isComplete(status.documents)

  const added = (doc: CarrierDocument) => {
    setStatus((s) => s && { ...s, documents: [...s.documents, doc] })
    track('carrier_document_uploaded', { doc_type: doc.doc_type })
  }
  const removed = (id: number) =>
    setStatus((s) => s && { ...s, documents: s.documents.filter((d) => d.id !== id) })

  return (
    <div style={{ ...container, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h3 style={{ ...t.heading, fontSize: 24, marginBottom: 8 }}>Sube tus documentos</h3>
        <p style={{ ...t.body, fontSize: 14, lineHeight: 1.55 }}>
          Antes de activar una cuenta validamos a cada transportista: así el cliente sabe que quien llega
          a su casa es quien dice ser, que tiene licencia para manejar y que el vehículo está en regla.
        </p>
        <p style={{ ...t.mute, fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>
          🔒 Solo los ve el equipo de Chalán, para validar tu cuenta. No se muestran a clientes ni a otros
          transportistas. Puede ser una foto con el celular o un escaneo.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <DocumentSection
          key={section.type}
          token={token}
          section={section}
          documents={byType(section.type)}
          max={status.max_per_type}
          canDelete={status.can_delete}
          theme={theme}
          onAdded={added}
          onRemoved={removed}
        />
      ))}

      {complete ? (
        <p style={{ ...t.title, fontSize: 14, lineHeight: 1.5 }}>
          ✅ ¡Listo! Recibimos tus documentos. Los revisamos y te avisamos cuando tu cuenta esté activa.
        </p>
      ) : (
        <p style={{ ...t.mute, fontSize: 12.5, lineHeight: 1.5 }}>
          ¿No los tienes a la mano? Te enviamos este mismo link a tu correo: puedes subirlos después desde el celular.
        </p>
      )}
    </div>
  )
}

function DocumentSection({
  token, section, documents, max, canDelete, theme, onAdded, onRemoved,
}: {
  token: string
  section: (typeof SECTIONS)[number]
  documents: CarrierDocument[]
  max: number
  canDelete: boolean
  theme: Theme
  onAdded: (doc: CarrierDocument) => void
  onRemoved: (id: number) => void
}) {
  const t = THEME[theme]
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, max - documents.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    setError('')
    for (const file of files) {
      try {
        onAdded(await upload(token, section.type, file))
      } catch (err) {
        setError(err instanceof UploadError ? err.message : 'No se pudo subir el archivo. Inténtalo de nuevo.')
        break
      }
    }
    setBusy(false)
  }

  const remove = async (id: number) => {
    const res = await fetch(`${API}/${token}/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) onRemoved(id)
    else setError('No se pudo quitar el archivo.')
  }

  const done = documents.length > 0
  return (
    <div style={{ ...t.section, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <p style={{ ...t.title, fontSize: 15, fontWeight: 600 }}>
          {done ? '✅ ' : ''}{section.title}
        </p>
        <p style={{ ...t.body, fontSize: 13, lineHeight: 1.45, marginTop: 2 }}>{section.hint}</p>
      </div>

      {documents.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {documents.map((doc, i) => (
            <li key={doc.id} style={{ ...t.body, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>{doc.content_type === 'application/pdf' ? 'PDF' : 'Foto'} {i + 1} subida</span>
              {canDelete && (
                <button type="button" onClick={() => remove(doc.id)}
                  style={{ ...t.mute, fontSize: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {documents.length < max && (
        <div>
          <input ref={input} type="file" accept="image/*,application/pdf" multiple onChange={pick} hidden />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            style={{
              background: 'transparent', color: t.accent, border: `1px solid ${t.accent}`,
              borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Subiendo…' : done ? 'Agregar otra foto' : 'Subir foto o PDF'}
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: '#ef4444' }}>{error}</p>}
    </div>
  )
}
