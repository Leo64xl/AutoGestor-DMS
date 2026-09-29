const crypto = require("node:crypto");

/**
 * Cliente de la API de Facturama para el timbrado de CFDI 4.0 (RF-028).
 *
 * Autenticacion HTTP Basic con las mismas credenciales del portal.
 * Documentacion: https://facturama.mx/docs/es/api-web/crear-cfdi
 */

const HOSTS = {
  sandbox: "https://apisandbox.facturama.mx",
  produccion: "https://api.facturama.mx",
};

const entorno = () => (process.env.FACTURAMA_ENTORNO === "produccion" ? "produccion" : "sandbox");

/**
 * Sin credenciales el sistema entra en modo simulado: arma el CFDI igual que
 * siempre y devuelve un folio fiscal ficticio, de modo que el proyecto se puede
 * ejecutar y demostrar sin una cuenta de Facturama. Nunca se activa solo en
 * produccion, para que un despliegue mal configurado falle de forma visible.
 */
function estaSimulado() {
  if (process.env.FACTURAMA_SIMULADO === "true") return true;
  if (entorno() === "produccion") return false;
  return !process.env.FACTURAMA_USUARIO || !process.env.FACTURAMA_PASSWORD;
}

function encabezados() {
  const credenciales = Buffer.from(`${process.env.FACTURAMA_USUARIO}:${process.env.FACTURAMA_PASSWORD}`).toString("base64");
  return { Authorization: `Basic ${credenciales}`, "Content-Type": "application/json" };
}

/** Traduce la respuesta de error de Facturama a un mensaje legible. */
function mensajeDeError(datos, estado) {
  if (typeof datos === "string" && datos.trim()) return datos.slice(0, 400);
  if (datos?.Message) {
    // Facturama devuelve el detalle de validacion en ModelState.
    const detalles = Object.values(datos.ModelState || {}).flat().filter(Boolean);
    return detalles.length ? `${datos.Message}: ${detalles.join(" | ")}` : datos.Message;
  }
  return `Facturama respondio ${estado}`;
}

async function pedir(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${HOSTS[entorno()]}${ruta}`, {
    method: metodo,
    headers: encabezados(),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }

  if (!respuesta.ok) {
    const error = new Error(mensajeDeError(datos, respuesta.status));
    error.status = respuesta.status === 401 ? 502 : 502;
    error.origen = "facturama";
    error.detalle = datos;
    throw error;
  }
  return datos;
}

/** Timbra el comprobante. Devuelve el identificador de Facturama y el folio fiscal (UUID). */
async function timbrar(comprobante) {
  if (estaSimulado()) {
    return {
      Id: `sim-${crypto.randomUUID()}`,
      Uuid: crypto.randomUUID().toUpperCase(),
      Status: "active",
      simulado: true,
    };
  }
  return pedir("POST", "/3/cfdis", comprobante);
}

/**
 * Descarga el comprobante ya timbrado.
 * La API responde el archivo codificado en base64 dentro de `Content`.
 */
async function descargar(formato, id) {
  if (!["pdf", "xml", "html"].includes(formato)) {
    throw Object.assign(new Error("Formato no admitido"), { status: 400 });
  }
  if (estaSimulado()) {
    throw Object.assign(new Error("El CFDI se genero en modo simulado: no hay archivo del SAT que descargar"), { status: 409 });
  }

  const respuesta = await pedir("GET", `/api/Cfdi/${formato}/issued/${id}`);
  return Buffer.from(respuesta.Content, "base64");
}

/** Cancela un comprobante timbrado ante el SAT. */
async function cancelar(id, motivo = "02", folioSustitucion = "") {
  if (estaSimulado()) return { Status: "canceled", simulado: true };

  const sustitucion = folioSustitucion ? `&uuidReplacement=${folioSustitucion}` : "";
  return pedir("DELETE", `/api/cfdi/${id}?motive=${motivo}&type=issued${sustitucion}`);
}

/** Resumen de la configuracion, para diagnosticar desde la interfaz. */
function estado() {
  return {
    entorno: entorno(),
    simulado: estaSimulado(),
    emisorConfigurado: Boolean(process.env.FACTURAMA_EMISOR_CP),
  };
}

module.exports = { timbrar, descargar, cancelar, estado, estaSimulado, entorno };
