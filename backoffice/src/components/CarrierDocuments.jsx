import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from './Card'
import { CopyRow } from './CopyButton'

// Documentos que el transportista sube desde la landing para que lo validemos
// (DNI/CE, licencia, tarjeta de propiedad). Solo admins: las URLs son firmadas
// y vencen en una hora: a diferencia de las fotos de las órdenes, estos
// archivos no son públicos.
export const DOC_LABELS = {
  identity: 'DNI o carné de extranjería',
  driver_license: 'Licencia de conducir',
  vehicle_card: 'Tarjeta de propiedad',
}

export function useCarrierDocuments(companyId, enabled = true) {
  const [state, setState] = useState({ documents: null, uploadUrl: '', error: false })

  useEffect(() => {
    if (!enabled || !companyId) return
    client.get(`/api/carrier-companies/${companyId}/documents`)
      .then(({ data }) => setState({
        documents: data.documents,
        uploadUrl: `${window.location.origin}/transportistas/documentos/${data.upload_token}`,
        error: false,
      }))
      .catch(() => setState({ documents: [], uploadUrl: '', error: true }))
  }, [companyId, enabled])

  return state
}

export function UploadLinkRow({ url }) {
  if (!url) return null
  return (
    <CopyRow
      title="Link para subir documentos"
      hint="Mándaselo por WhatsApp si no los subió al registrarse. Sirve 30 días."
      text={url}
    />
  )
}

// Una foto se abre en grande en otra pestaña para leer los números chicos.
export function DocumentFile({ document, index }) {
  const isPdf = document.content_type === 'application/pdf'
  return (
    <figure className="space-y-1">
      {isPdf ? (
        <iframe src={document.url} title={`Documento ${index + 1}`} className="h-[480px] w-full rounded-lg border" />
      ) : (
        <a href={document.url} target="_blank" rel="noreferrer">
          <img src={document.url} alt={`Documento ${index + 1}`} className="w-full rounded-lg border" />
        </a>
      )}
      <figcaption className="flex justify-between text-xs text-gray-400">
        <span>{isPdf ? 'PDF' : 'Foto'} {index + 1} · {new Date(document.created_date).toLocaleDateString('es-PE')}</span>
        <a href={document.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Abrir</a>
      </figcaption>
    </figure>
  )
}

// La tarjeta de la empresa: los tres documentos y el link para pedirlos.
export default function CarrierDocumentsCard({ companyId }) {
  const { documents, uploadUrl, error } = useCarrierDocuments(companyId)

  return (
    <Card title="Documentos para validar">
      {documents === null && <p className="text-sm text-gray-400">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudieron cargar los documentos.</p>}
      {documents && !error && (
        <div className="space-y-5">
          {Object.entries(DOC_LABELS).map(([type, label]) => {
            const files = documents.filter((d) => d.doc_type === type)
            return (
              <div key={type}>
                <p className="mb-2 text-sm font-medium text-gray-900">
                  {label} {files.length === 0 && <span className="font-normal text-amber-600">· no lo subió</span>}
                </p>
                {files.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {files.map((d, i) => <DocumentFile key={d.id} document={d} index={i} />)}
                  </div>
                )}
              </div>
            )
          })}
          <UploadLinkRow url={uploadUrl} />
        </div>
      )}
    </Card>
  )
}
