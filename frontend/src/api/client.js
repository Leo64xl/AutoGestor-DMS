const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

/**
 * Cliente HTTP unico de la aplicacion.
 * `credentials: "include"` envia la cookie de sesion del backend (RF-001 / RNF-005).
 */
export async function api(ruta, { metodo = "GET", cuerpo, params } = {}) {
  const url = new URL(BASE + ruta, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([clave, valor]) => {
      if (valor !== "" && valor != null) url.searchParams.set(clave, valor);
    });
  }

  const respuesta = await fetch(url, {
    method: metodo,
    credentials: "include",
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;

  if (!respuesta.ok) {
    const error = new Error(datos?.error || `Error ${respuesta.status}`);
    error.status = respuesta.status;
    error.datos = datos;
    throw error;
  }
  return datos;
}

/**
 * RF-041: descarga un archivo generado por la API (.xlsx) respetando los filtros enviados.
 * Se resuelve con fetch para conservar la cookie de sesion y poder leer el error en JSON.
 */
export async function descargar(ruta, { metodo = "GET", cuerpo, params, nombrePorDefecto = "archivo.xlsx" } = {}) {
  const url = new URL(BASE + ruta, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([clave, valor]) => {
      if (valor !== "" && valor != null) url.searchParams.set(clave, valor);
    });
  }

  const respuesta = await fetch(url, {
    method: metodo,
    credentials: "include",
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  if (!respuesta.ok) {
    const texto = await respuesta.text();
    let mensaje = `Error ${respuesta.status}`;
    try {
      mensaje = JSON.parse(texto).error || mensaje;
    } catch {
      /* la respuesta no era JSON */
    }
    const error = new Error(mensaje);
    error.status = respuesta.status;
    throw error;
  }

  const coincidencia = /filename="([^"]+)"/.exec(respuesta.headers.get("Content-Disposition") || "");
  const blob = await respuesta.blob();
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = coincidencia ? coincidencia[1] : nombrePorDefecto;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(enlace.href);
}

/** Origen del backend, para resolver las rutas de los archivos servidos como estaticos. */
const ORIGEN = BASE.replace(/\/api\/?$/, "");

/**
 * Convierte la ruta guardada de una foto (/uploads/...) en una URL absoluta.
 * Si ya viene como URL completa se devuelve tal cual.
 */
export function urlArchivo(ruta) {
  if (!ruta) return "";
  return /^https?:\/\//i.test(ruta) ? ruta : `${ORIGEN}${ruta}`;
}

/**
 * RF-011: sube una imagen del equipo del usuario.
 * No se fija Content-Type a proposito: el navegador debe generar el boundary
 * del multipart, y ponerlo a mano rompe la peticion.
 */
export async function subirImagen(ruta, archivo, campo = "foto") {
  const cuerpo = new FormData();
  cuerpo.append(campo, archivo);

  const respuesta = await fetch(new URL(BASE + ruta, window.location.origin), {
    method: "POST",
    credentials: "include",
    body: cuerpo,
  });

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    const error = new Error(datos?.error || `Error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

/** Abre un documento HTML de la API (contrato, factura) en una pestania nueva. */
export function abrirDocumento(ruta) {
  window.open(BASE + ruta, "_blank", "noopener");
}

export const get = (ruta, params) => api(ruta, { params });
export const eliminar = (ruta, cuerpo) => api(ruta, { metodo: "DELETE", cuerpo });
export const post = (ruta, cuerpo) => api(ruta, { metodo: "POST", cuerpo });
export const put = (ruta, cuerpo) => api(ruta, { metodo: "PUT", cuerpo });
export const patch = (ruta, cuerpo) => api(ruta, { metodo: "PATCH", cuerpo });
