const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");

/**
 * RF-011: almacenamiento de las fotografias de cada vehiculo.
 * Los archivos viven fuera de la base de datos, en backend/uploads/vehiculos,
 * y se sirven como estaticos desde /uploads.
 */
const RAIZ = path.join(__dirname, "..", "..", "uploads");
const CARPETA_VEHICULOS = path.join(RAIZ, "vehiculos");
const PREFIJO_PUBLICO = "/uploads/vehiculos";

fs.mkdirSync(CARPETA_VEHICULOS, { recursive: true });

const TIPOS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const almacenamiento = multer.diskStorage({
  destination: (_req, _file, siguiente) => siguiente(null, CARPETA_VEHICULOS),
  filename: (_req, archivo, siguiente) => {
    // Nombre aleatorio: evita colisiones y no expone el nombre original del equipo del usuario.
    siguiente(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${TIPOS[archivo.mimetype]}`);
  },
});

const subirFoto = multer({
  storage: almacenamiento,
  limits: { fileSize: TAMANO_MAXIMO, files: 1 },
  fileFilter: (_req, archivo, siguiente) => {
    if (TIPOS[archivo.mimetype]) return siguiente(null, true);
    siguiente(Object.assign(new Error("Formato no admitido. Usa JPG, PNG, WebP o AVIF."), { status: 400 }));
  },
}).single("foto");

/** Ruta publica que se guarda en el campo `fotos` del vehiculo. */
const rutaPublica = (nombreArchivo) => `${PREFIJO_PUBLICO}/${nombreArchivo}`;

/**
 * Borra del disco una foto subida por el sistema.
 * Solo acepta rutas propias y sin segmentos de escape, para que no se pueda
 * pedir la eliminacion de un archivo arbitrario del servidor.
 */
function eliminarFoto(rutaGuardada) {
  if (typeof rutaGuardada !== "string" || !rutaGuardada.startsWith(`${PREFIJO_PUBLICO}/`)) return false;

  const nombre = path.basename(rutaGuardada);
  const destino = path.join(CARPETA_VEHICULOS, nombre);
  if (path.dirname(destino) !== CARPETA_VEHICULOS) return false;

  try {
    fs.unlinkSync(destino);
    return true;
  } catch {
    return false;
  }
}

module.exports = { subirFoto, rutaPublica, eliminarFoto, RAIZ, TAMANO_MAXIMO };
