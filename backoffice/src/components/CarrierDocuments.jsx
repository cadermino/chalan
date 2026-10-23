import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
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

// Espejo de app/api/carrier_documents.py: el servidor es quien manda, esto
// solo evita subir un archivo para enterarse de que no se podía.
export const MAX_FILES = 4
const MAX_BYTES = 10 * 1024 * 1024
const CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export function useCarrierDocuments(companyId, enabled = true) {
  const [state, setState] = useState({ documents: null, uploadUrl: '', error: false })

  const load = useCallback(() => {
    if (!enabled || !companyId) return
    client.get(`/api/carrier-companies/${companyId}/documents`)
      .then(({ data }) => setState({
        documents: data.documents,
        uploadUrl: `${window.location.origin}/transportistas/documentos/${data.upload_token}`,
        error: false,
      }))
      .catch(() => setState({ documents: [], uploadUrl: '', error: true }))
  }, [companyId, enabled])

  useEffect(load, [load])

  return { ...state, reload: load }
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
export function DocumentFile({ document, index, onDelete }) {
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
        <span className="flex items-center gap-3">
          {onDelete && <DeleteDocumentButton onDelete={onDelete} />}
          <a href={document.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Abrir</a>
        </span>
      </figcaption>
    </figure>
  )
}

// Segundo clic en vez de un confirm() del navegador, como DeleteVehicleButton.
function DeleteDocumentButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!confirming) {
    return <button type="button" onClick={() => setConfirming(true)} className="text-red-600 hover:underline">Borrar</button>
  }
  const remove = async () => {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }
  return (
    <span className="flex items-center gap-2">
      <span>¿Borrar?</span>
      <button type="button" onClick={remove} disabled={deleting} className="font-medium text-red-600 disabled:opacity-50">
        {deleting ? 'Borrando…' : 'Sí'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={deleting} className="hover:text-gray-600">No</button>
    </span>
  )
}

export function deleteDocument(companyId, documentId) {
  return client.delete(`/api/carrier-companies/${companyId}/documents/${documentId}`)
}

function fileProblem(file) {
  if (!CONTENT_TYPES.includes(file.type)) return `${file.name}: solo fotos JPG, PNG o WEBP, o PDF.`
  if (file.size > MAX_BYTES) return `${file.name}: pesa más de 10 MB.`
  return null
}

// Firma, sube directo a S3 (sin pasar por el backoffice-api) y registra.
async function uploadVehicleCard(companyId, vehicleId, file) {
  const base = `/api/carrier-companies/${companyId}/vehicles/${vehicleId}/card`
  const { data: signed } = await client.post(`${base}/presign`, { content_type: file.type, size_bytes: file.size })
  // axios pelado: sin baseURL ni el token del backoffice, que S3 rechazaría.
  // S3 exige que `file` sea el último campo del formulario.
  const form = new FormData()
  Object.entries(signed.upload.fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', file)
  await axios.post(signed.upload.url, form)
  await client.post(base, { storage_key: signed.storage_key })
}

// Frente y reverso, de a uno. Avisa con onDone para recargar la lista (las
// URLs para verlos las firma el API al listar).
export function VehicleCardUpload({ companyId, vehicleId, count, onDone }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const left = MAX_FILES - count

  const upload = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, left)
    e.target.value = ''
    const problems = files.map(fileProblem).filter(Boolean)
    if (problems.length) {
      setError(problems.join(' '))
      return
    }
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await uploadVehicleCard(companyId, vehicleId, file)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo subir la tarjeta.')
    } finally {
      setUploading(false)
      onDone()
    }
  }

  if (left <= 0) return <p className="text-xs text-gray-400">Ya tiene {MAX_FILES} archivos: borra uno para subir otro.</p>
  return (
    <div>
      <label className={`inline-block cursor-pointer rounded-lg border border-teal-600 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
        {uploading ? 'Subiendo…' : '+ Subir tarjeta de propiedad'}
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={upload} disabled={uploading} />
      </label>
      <p className="mt-1 text-xs text-gray-400">Foto o PDF, frente y reverso. Hasta {MAX_FILES} archivos, 10 MB cada uno.</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function vehicleLabel(vehicle) {
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
  return [vehicle.plates || 'Sin placa', name].filter(Boolean).join(' · ')
}

// La tarjeta de la empresa: DNI y licencia, la tarjeta de propiedad de cada
// vehículo y el link para pedírselos al transportista.
export default function CarrierDocumentsCard({ companyId }) {
  const { documents, uploadUrl, error } = useCarrierDocuments(companyId)
  const [vehicles, setVehicles] = useState(null)

  useEffect(() => {
    client.get(`/api/carrier-companies/${companyId}/vehicles`)
      .then(({ data }) => setVehicles([...data.vehicles].sort((a, b) => a.id - b.id)))
      .catch(() => setVehicles([]))
  }, [companyId])

  const files = (type) => (documents || []).filter((d) => d.doc_type === type)
  const cards = files('vehicle_card')
  // Una tarjeta sin vehículo: se borró el suyo.
  const orphans = vehicles ? cards.filter((d) => !vehicles.some((v) => v.id === d.vehicle_id)) : []

  return (
    <Card title="Documentos para validar">
      {documents === null && <p className="text-sm text-gray-400">Cargando…</p>}
      {error && <p className="text-sm text-red-600">No se pudieron cargar los documentos.</p>}
      {documents && !error && (
        <div className="space-y-5">
          {['identity', 'driver_license'].map((type) => (
            <DocumentGroup key={type} label={DOC_LABELS[type]} files={files(type)} />
          ))}
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">
              {DOC_LABELS.vehicle_card} {cards.length === 0 && <span className="font-normal text-amber-600">· no la subió</span>}
            </p>
            {(vehicles || []).map((v) => {
              const own = cards.filter((d) => d.vehicle_id === v.id)
              return (
                <div key={v.id} className="border-l-2 border-gray-100 pl-3">
                  <p className="mb-2 flex justify-between text-sm text-gray-700">
                    <span>
                      {vehicleLabel(v)} {own.length === 0 && <span className="text-amber-600">· sin tarjeta</span>}
                    </span>
                    <Link to={`/carrier-companies/${companyId}/vehicles/${v.id}/edit`} className="text-xs text-teal-600 hover:underline">
                      {own.length === 0 ? 'Subirla' : 'Ver vehículo'}
                    </Link>
                  </p>
                  <FileGrid files={own} />
                </div>
              )
            })}
            {orphans.length > 0 && (
              <div className="border-l-2 border-gray-100 pl-3">
                <p className="mb-2 text-sm text-gray-700">Sin vehículo <span className="text-gray-400">(se borró el suyo)</span></p>
                <FileGrid files={orphans} />
              </div>
            )}
          </div>
          <UploadLinkRow url={uploadUrl} />
        </div>
      )}
    </Card>
  )
}

function DocumentGroup({ label, files }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-900">
        {label} {files.length === 0 && <span className="font-normal text-amber-600">· no lo subió</span>}
      </p>
      <FileGrid files={files} />
    </div>
  )
}

function FileGrid({ files }) {
  if (files.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {files.map((d, i) => <DocumentFile key={d.id} document={d} index={i} />)}
    </div>
  )
}
