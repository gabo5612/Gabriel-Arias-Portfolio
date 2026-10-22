// STUB — lo reemplaza el obrero de crew (_tasks/crew/t01-one-euro.json).
// Existe sólo para que el gate resuelva el módulo y falle por aserción en vez
// de por ERR_MODULE_NOT_FOUND: un precheck que revienta no prueba nada.
export function createOneEuro({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
  let xPrev = null;
  let xHat = null;
  let dxHat = 0;
  let tPrev = null;
  let isFirstSample = true;

  function alpha(cutoff, dt) {
    return 1 / (1 + (1 / (2 * Math.PI * cutoff)) / dt);
  }

  function lowpass(x, a, prev) {
    return a * x + (1 - a) * prev;
  }

  return function filter(value, t) {
    if (!Number.isFinite(value)) {
      return isFirstSample ? value : xHat;
    }
    if (isFirstSample) {
      xPrev = value;
      xHat = value;
      dxHat = 0;
      tPrev = t;
      isFirstSample = false;
      return value;
    }
    const dt = t - tPrev;
    if (dt <= 0) {
      return xHat; // Descartamos muestras con tiempo no creciente
    }
    const dx = (value - xPrev) / dt;
    dxHat = lowpass(dx, alpha(dCutoff, dt), dxHat);
    const cutoff = minCutoff + beta * Math.abs(dxHat);
    xHat = lowpass(value, alpha(cutoff, dt), xHat);
    xPrev = value;
    tPrev = t;
    return xHat;
  };
}
