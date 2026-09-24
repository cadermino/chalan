import { QueryClient } from '@tanstack/react-query'

// Cliente único para toda la app. Vive en su propio módulo, fuera del árbol de
// React, para que no se recree en un re-render y se lleve el caché con él.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Media parada de café. Volver a una lista desde un detalle la pinta al
      // instante desde caché en vez de recargarla; pasado ese rato se revalida
      // por detrás, sin vaciar la tabla mientras llega.
      staleTime: 30_000,
      // Los 4xx no se reintentan: el 401 ya lo captura el interceptor de
      // client.js (borra la sesión y manda a login) y un 403/404 no va a
      // cambiar por insistir. Solo se reintenta lo que puede ser un tropiezo
      // de red.
      retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})
