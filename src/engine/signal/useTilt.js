import { useCallback, useEffect, useState } from 'react'

// Encender y apagar el giroscopio desde la UI. La fuente en sí vive en
// useDepthSignal (activateGyro); esto sólo decide si ofrecerla — en pantallas
// táctiles con DeviceOrientationEvent — y lleva el estado del botón.
export function useTilt({ activateGyro, deactivate, source, reduced }) {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const touch = window.matchMedia?.('(pointer: coarse)').matches
    setAvailable(!reduced && touch && typeof DeviceOrientationEvent !== 'undefined')
  }, [reduced])
  const on = source === 'gyro'
  const toggle = useCallback(async () => {
    if (on) { deactivate(); return }
    await activateGyro()
  }, [on, activateGyro, deactivate])
  return { available, on, toggle }
}
