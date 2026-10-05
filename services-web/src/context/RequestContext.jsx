import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createRequest, getRequest, submitRequest, updateRequest } from '../api'
import { SERVICE } from '../config'
import storage from '../storage'
import { track } from '../analytics'

const STORAGE_KEY = 'chalan_packing_request'

const EMPTY_ADDRESS = {
  street: '', interior: '', neighborhood: '', city: '', state: '', country: '', map_url: '',
}
const EMPTY_DRAFT = {
  publicId: null,
  address: EMPTY_ADDRESS,
  items: [],
  media: [],
  preferredDate: '',
  whatsapp: '',
}

// React necesita una key estable por fila; el servidor no devuelve ids de item.
let itemSeq = 0
export function newItem(fields = {}) {
  itemSeq += 1
  return { key: `item-${itemSeq}`, description: '', quantity: 1, materials: [], ...fields }
}

function fromServer(data) {
  return {
    publicId: data.public_id,
    address: { ...EMPTY_ADDRESS, ...Object.fromEntries(
      Object.entries(data.address || {}).map(([k, v]) => [k, v || ''])) },
    items: (data.items || []).map((item) => newItem(item)),
    media: data.media || [],
    preferredDate: data.preferred_date || '',
    // El servidor guarda +51987654321; el campo muestra solo los 9 dígitos.
    whatsapp: (data.whatsapp || '').replace(/^\+51/, ''),
  }
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
        if (data.status !== 'draft') {
          storage.remove(STORAGE_KEY)
          return
        }
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
    const payload = { street: address.street, interior: address.interior, neighborhood: address.neighborhood,
      city: address.city, state: address.state, country: address.country, map_url: address.map_url }
    if (draft.publicId) {
      await updateRequest(draft.publicId, { address: payload })
      patch({ address })
      return
    }
    const { public_id: publicId } = await createRequest({ service_type: SERVICE, address: payload, website })
    storage.set(STORAGE_KEY, publicId)
    track('service_request_started', { service: SERVICE })
    patch({ publicId, address })
  }, [draft.publicId, patch])

  const saveItems = useCallback(async (items) => {
    await updateRequest(draft.publicId, {
      items: items.map(({ description, quantity, materials }) => ({ description, quantity, materials })),
    })
    patch({ items })
  }, [draft.publicId, patch])

  const submit = useCallback(async ({ whatsapp, preferredDate }) => {
    await submitRequest(draft.publicId, {
      whatsapp,
      preferred_date: preferredDate,
    })
    storage.remove(STORAGE_KEY)
    track('service_request_submitted', { service: SERVICE, items: draft.items.length, media: draft.media.length })
    setDraft(EMPTY_DRAFT)
  }, [draft.publicId, draft.items.length, draft.media.length])

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
    submit,
  }), [draft, ready, patch, saveAddress, saveItems, submit])

  return <RequestContext.Provider value={value}>{children}</RequestContext.Provider>
}

export function useRequest() {
  const value = useContext(RequestContext)
  if (!value) throw new Error('useRequest debe usarse dentro de <RequestProvider>')
  return value
}
