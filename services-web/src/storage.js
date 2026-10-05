// localStorage puede lanzar (o ser null) con "bloquear cookies" de Safari y en
// algunos navegadores embebidos de apps. El formulario tiene que funcionar igual,
// solo que sin retomar el borrador al recargar.
const memory = {}

function backend() {
  try {
    const key = '__chalan_storage_test__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch (e) {
    return null
  }
}

const storage = {
  get(key) {
    const store = backend()
    if (!store) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null
    try {
      return store.getItem(key)
    } catch (e) {
      return null
    }
  },
  set(key, value) {
    const store = backend()
    if (!store) {
      memory[key] = String(value)
      return
    }
    try {
      store.setItem(key, value)
    } catch (e) {
      memory[key] = String(value)
    }
  },
  remove(key) {
    delete memory[key]
    const store = backend()
    if (!store) return
    try {
      store.removeItem(key)
    } catch (e) {
      // nada que hacer
    }
  },
}

export default storage
