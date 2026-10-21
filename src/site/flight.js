// Cuánto dura un vuelo que cruza `n` estaciones. Lo usan el mundo (para volar)
// y el panel (para entrar cuando la cámara ya está llegando): tienen que dar
// lo mismo. Las primeras estaciones de más alargan el viaje lo justo para
// verlas pasar; desde la tercera, menos, para que ir de punta a punta no
// sea una espera.
export const flightMs = n =>
  n <= 0 ? 0 : 1500 + 900 * Math.min(n - 1, 2) + 450 * Math.max(0, n - 3)

// Con el biplano el viaje se estira: es para verlo.
export const PLANE_STRETCH = 1.6
