import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createRequest, getRequest, submitRequest, updateRequest } from '../api'
import { SERVICE } from '../config'
import storage from '../storage'
import { tagSession, track } from '../analytics'

// Uno por servicio: un borrador de embalaje no se retoma en el armado.
const STORAGE_KEY = `chalan_${SERVICE}_request`

export const EMPTY_ADDRESS = {
  street: '', interior: '', neighborhood: '', city: '', state: '', country: '', map_url: '',
}
const EMPTY_DRAFT = {
  publicId: null,
  address: EMPTY_ADDRESS,
  items: [],
  // Solo armado: dónde se arman los muebles que se desarman en la dirección.
  destination: null,
  // Solo pintura: qué pintar (description) y las respuestas rápidas.
  details: {},
  media: [],
  preferredDate: '',
  whatsapp: '',
}

// React necesita una key estable por fila; el servidor no devuelve ids de item.
let itemSeq = 0
export function newItem(fields = {}) {
  itemSeq += 1
  return { key: `item-${itemSeq}`, description: '', quantity: 1, materials: [], work: null, pack: false, ...fields }
}

// El servidor manda null en los campos vacíos; los inputs quieren ''.
const toForm = (address) => ({ ...EMPTY_ADDRESS, ...Object.fromEntries(
  Object.entries(address || {}).map(([k, v]) => [k, v || ''])) })

const addressPayload = (address) => ({
  street: address.street, interior: address.interior, neighborhood: address.neighborhood,
  city: address.city, state: address.state, country: address.country, map_url: address.map_url,
})

function fromServer(data) {
  const destination = data.details?.destination
  return {
    publicId: data.public_id,
    address: toForm(data.address),
    items: (data.items || []).map((item) => newItem({ ...item, pack: Boolean(item.pack) })),
    destination: destination ? toForm(destination) : null,
    details: SERVICE === 'painting' ? (data.details || {}) : {},
    media: data.media || [],
    preferredDate: data.preferred_date || '',
    // El servidor guarda +51987654321; el campo muestra solo los 9 dígitos.
    whatsapp: (data.whatsapp || '').replace(/^\+51/, ''),
  }
}

// Si el segundo paso está hecho. Pintura no tiene lista: basta con contar qué
// pintar, o con un video que lo explique (misma regla que check_painting_submit).
export function itemsDone(draft) {
  if (SERVICE === 'painting') {
    return Boolean(draft.details.description) || draft.media.some((m) => m.media_type === 'video')
  }
  return draft.items.length > 0
}

const RequestContext = createContext(null)

export function RequestProvider({ children }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [ready, setReady] = useState(false)
  const resumed = useRef(false)

  // Retoma el borrador de una visita anterior. Si el servidor ya no lo conoce
  // (404) o ya se envió, se descarta y se empieza de cero.
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    const publicId = storage.get(STORAGE_KEY)
    if (!publicId) {
      setReady(true)
      return
    }
    getRequest(publicId)
      .then((data) => {
        if (data.submitted || data.status === 'cancelled') {
          storage.remove(STORAGE_KEY)
          return
        }
        tagSession('service_request_id', data.id)
        setDraft(fromServer(data))
      })
      .catch((err) => {
        // Sin conexión no se borra: el borrador sigue existiendo en el servidor.
        if (err.response) storage.remove(STORAGE_KEY)
      })
      .finally(() => setReady(true))
  }, [])

  const patch = useCallback((fields) => setDraft((current) => ({ ...current, ...fields })), [])

  const saveAddress = useCallback(async (address, website = '') => {
    const payload = addressPayload(address)
    if (draft.publicId) {
      await updateRequest(draft.publicId, { address: payload })
      patch({ address })
      return
    }
    const { id, public_id: publicId } = await createRequest({ service_type: SERVICE, address: payload, website })
    storage.set(STORAGE_KEY, publicId)
    tagSession('service_request_id', id)
    track('service_request_started', { service: SERVICE })
    patch({ publicId, address })
  }, [draft.publicId, patch])

  // `destination` solo lo manda el armado: null la borra, undefined no la toca.
  const saveItems = useCallback(async (items, destination) => {
    const body = {
      items: items.map(({ description, quantity, materials, work, pack }) => (
        SERVICE === 'packing' ? { description, quantity, materials } : { description, quantity, materials, work, pack })),
    }
    if (destination !== undefined) {
      body.details = destination ? { destination: addressPayload(destination) } : {}
    }
    await updateRequest(draft.publicId, body)
    patch(destination === undefined ? { items } : { items, destination })
  }, [draft.publicId, patch])

  const saveDetails = useCallback(async (details) => {
    const saved = await updateRequest(draft.publicId, { details })
    patch({ details: saved.details || {} })
  }, [draft.publicId, patch])

  // Devuelve el public_id: el borrador se vacía, pero la pantalla de enviado
  // lo necesita para el link a las cotizaciones.
  const submit = useCallback(async ({ whatsapp, preferredDate }) => {
    const { publicId } = draft
    await submitRequest(publicId, {
      whatsapp,
      preferred_date: preferredDate,
    })
    storage.remove(STORAGE_KEY)
    track('service_request_submitted', { service: SERVICE, items: draft.items.length, media: draft.media.length })
    setDraft(EMPTY_DRAFT)
    return publicId
  }, [draft])

  const value = useMemo(() => ({
    draft,
    ready,
    setItems: (items) => patch({ items }),
    setPreferredDate: (preferredDate) => patch({ preferredDate }),
    setWhatsapp: (whatsapp) => patch({ whatsapp }),
    addMedia: (media) => setDraft((c) => ({ ...c, media: [...c.media, media] })),
    removeMedia: (id) => setDraft((c) => ({ ...c, media: c.media.filter((m) => m.id !== id) })),
    saveAddress,
    saveItems,
    saveDetails,
    submit,
  }), [draft, ready, patch, saveAddress, saveItems, saveDetails, submit])

  return <RequestContext.Provider value={value}>{children}</RequestContext.Provider>
}

export function useRequest() {
  const value = useContext(RequestContext)
  if (!value) throw new Error('useRequest debe usarse dentro de <RequestProvider>')
  return value
}
