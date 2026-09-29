/**
 * Folio legible y unico por documento: PREFIJO-ANIO-00001.
 * El consecutivo es el id del registro, por lo que no requiere un contador aparte.
 */
function folio(prefijo, id) {
  return `${prefijo}-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
}

/** Fecha de hoy en formato YYYY-MM-DD, util para comparar contra columnas DATEONLY. */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const aNumero = (valor) => Number.parseFloat(valor) || 0;

module.exports = { folio, hoy, aNumero };
