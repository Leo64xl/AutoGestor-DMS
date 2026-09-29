/**
 * Formateadores y catalogos de presentacion.
 * Viven fuera de ui.jsx para que ese archivo exporte unicamente componentes.
 */

const FORMATO_MONEDA = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const FORMATO_FECHA = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

export const moneda = (valor) => FORMATO_MONEDA.format(Number(valor) || 0);
export const fechaHora = (valor) => (valor ? FORMATO_FECHA.format(new Date(valor)) : "—");
export const soloFecha = (valor) => (valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("es-MX") : "—");

/** Traduce los valores enum del backend a un texto legible y un color de etiqueta. */
export const ESTATUS_VEHICULO = {
  disponible: { texto: "Disponible", tipo: "exito" },
  apartado: { texto: "Apartado", tipo: "aviso" },
  vendido: { texto: "Vendido", tipo: "info" },
  en_transito: { texto: "En transito", tipo: "neutro" },
};

export const ESTATUS_CLIENTE = {
  nuevo: { texto: "Nuevo", tipo: "info" },
  en_seguimiento: { texto: "En seguimiento", tipo: "aviso" },
  cotizando: { texto: "Cotizando", tipo: "aviso" },
  cerrado: { texto: "Cerrado", tipo: "exito" },
  perdido: { texto: "Perdido", tipo: "error" },
  comprador: { texto: "Comprador", tipo: "exito" },
};

export const ORIGEN_CLIENTE = {
  showroom: "Showroom",
  redes_sociales: "Redes sociales",
  referido: "Referido",
  sitio_web: "Sitio web",
};

export const ESTATUS_OPERACION = {
  vigente: { texto: "Vigente", tipo: "exito" },
  apartada: { texto: "Apartada", tipo: "aviso" },
  vendida: { texto: "Vendida", tipo: "info" },
  cancelada: { texto: "Cancelada", tipo: "error" },
  cancelado: { texto: "Cancelado", tipo: "error" },
  vencido: { texto: "Vencido", tipo: "neutro" },
  vendido: { texto: "Vendido", tipo: "info" },
};
