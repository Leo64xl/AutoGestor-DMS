/**
 * Catalogo de modulos del sistema: unica fuente de verdad para el menu lateral,
 * la guarda de navegacion y el tablero de inicio.
 *
 * `ver` es el permiso minimo para entrar al modulo; sin el, el modulo no aparece
 * en el menu y la vista no se dibuja aunque se navegue a ella por estado.
 * `gestionar` habilita las acciones de escritura dentro de la pagina.
 */
export const MODULOS = [
  { vista: "inicio", texto: "Inicio", icono: "inicio", grupo: null, ver: null },

  { vista: "vehiculos", texto: "Inventario", icono: "auto", grupo: "Piso de venta", ver: "vehiculos.ver", gestionar: "vehiculos.gestionar" },
  { vista: "clientes", texto: "Clientes", icono: "personas", grupo: "Piso de venta", ver: "clientes.ver", gestionar: "clientes.gestionar" },
  { vista: "pruebas", texto: "Pruebas de manejo", icono: "volante", grupo: "Piso de venta", ver: "pruebas.ver", gestionar: "pruebas.gestionar" },

  { vista: "ventas", texto: "Cotizaciones y apartados", icono: "etiqueta", grupo: "Proceso de venta", ver: "ventas.ver", gestionar: "ventas.gestionar" },
  { vista: "operaciones", texto: "Ventas y documentacion", icono: "documento", grupo: "Proceso de venta", ver: "ventas.ver", gestionar: "ventas.gestionar" },
  { vista: "financiamiento", texto: "Financiamiento y pagos", icono: "tarjeta", grupo: "Proceso de venta", ver: "financiamiento.ver", gestionar: "financiamiento.gestionar" },

  { vista: "postventa", texto: "Servicios postventa", icono: "llave", grupo: "Taller", ver: "postventa.ver", gestionar: "postventa.gestionar" },

  { vista: "reportes", texto: "Reportes", icono: "grafica", grupo: "Direccion", ver: "reportes.ver" },
  { vista: "usuarios", texto: "Usuarios y permisos", icono: "escudo", grupo: "Direccion", ver: "usuarios.gestionar", gestionar: "usuarios.gestionar" },
  { vista: "bitacora", texto: "Bitacora de eventos", icono: "historial", grupo: "Direccion", ver: "bitacora.ver" },
];

/** Vistas que no son modulos del menu pero heredan el permiso de uno. */
const VISTAS_DERIVADAS = { cliente: "clientes" };

/** Modulo al que pertenece una vista, incluyendo las vistas de detalle. */
export function moduloDe(vista) {
  const objetivo = VISTAS_DERIVADAS[vista] || vista;
  return MODULOS.find((m) => m.vista === objetivo) || null;
}

/** Entrada del menu que debe quedar resaltada para la vista actual. */
export function vistaDelMenu(vista) {
  return VISTAS_DERIVADAS[vista] || vista;
}

const concede = (permisos, permiso) => !permiso || permisos.includes("*") || permisos.includes(permiso);

/** Modulos visibles para un conjunto de permisos. */
export function modulosPermitidos(permisos = []) {
  return MODULOS.filter((m) => concede(permisos, m.ver));
}

/**
 * Modulos visibles agrupados por area de la agencia, en el orden declarado.
 * Un grupo que se queda sin modulos no se dibuja.
 */
export function gruposPermitidos(permisos = []) {
  const grupos = [];
  for (const modulo of modulosPermitidos(permisos)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === modulo.grupo) ultimo.modulos.push(modulo);
    else grupos.push({ titulo: modulo.grupo, modulos: [modulo] });
  }
  return grupos;
}

/** Indica si esos permisos alcanzan para entrar a la vista. */
export function puedeVerVista(permisos = [], vista) {
  const modulo = moduloDe(vista);
  return modulo ? concede(permisos, modulo.ver) : false;
}
