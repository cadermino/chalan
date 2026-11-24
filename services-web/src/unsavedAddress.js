import { useCallback, useState } from 'react'
import storage from './storage'
import { SERVICE } from './config'

// La dirección se guarda en el servidor recién con "Siguiente". Hasta entonces
// vivía solo en la pantalla, y recargar borraba lo escrito, la sugerencia
// elegida y el pin. El flujo de mudanzas guarda su borrador en localStorage con
// cada cambio; esto hace lo mismo con la dirección que se está editando.
//
// Va atada al pedido (publicId, o null antes de crearlo) para no volcar la de
// otro pedido, y vence en un día.
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function read(key, publicId) {
  try {
    const stored = JSON.parse(storage.get(key) || 'null')
    if (!stored || stored.publicId !== (publicId || null) || Date.now() - stored.at > MAX_AGE_MS) return null
    return stored.address
  } catch (e) {
    return null
  }
}

export default function useUnsavedAddress(name, saved, publicId) {
  const key = `chalan_${SERVICE}_${name}_unsaved`
  const [address, setAddressState] = useState(() => read(key, publicId) || saved)

  const setAddress = useCallback((next) => {
    setAddressState(next)
    storage.set(key, JSON.stringify({ publicId: publicId || null, at: Date.now(), address: next }))
  }, [key, publicId])

  // Ya guardada en el servidor: el borrador local sobra.
  const forget = useCallback(() => storage.remove(key), [key])

  return [address, setAddress, forget]
}
