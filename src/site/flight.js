// Cuánto dura un vuelo que cruza `n` estaciones. Lo usan el mundo (para volar)
// y el panel (para entrar cuando la cámara ya está llegando): tienen que dar
// lo mismo. Las primeras estaciones de más alargan el viaje lo justo para
// verlas pasar; desde la tercera, menos, para que ir de punta a punta no
// sea una espera.
export const flightMs = n =>
  n <= 0 ? 0 : 1500 + 900 * Math.min(n - 1, 2) + 450 * Math.max(0, n - 3)

// El biplano dura 10 s de punta a punta, desde el clic hasta que la formación
// lo absorbe: PLANE_ARM_MS armándose y el resto volando, sea cual sea la
// distancia.
export const PLANE_TOTAL_MS = 10000
export const PLANE_ARM_MS = 1000
export const PLANE_FLIGHT_MS = PLANE_TOTAL_MS - PLANE_ARM_MS
