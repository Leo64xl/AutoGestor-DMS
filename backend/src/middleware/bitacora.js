const { Bitacora } = require("../models");

/**
 * RF-006: registra automaticamente cada accion relevante.
 * Nunca interrumpe la operacion de negocio: si el registro falla solo se advierte en consola.
 */
async function registrar(req, accion, { entidad, entidadId, detalle } = {}) {
  try {
    await Bitacora.create({
      usuarioId: req.usuario?.id ?? req.session?.usuarioId ?? null,
      usuarioNombre: req.usuario?.username ?? req.body?.username ?? null,
      accion,
      entidad: entidad ?? null,
      entidadId: entidadId != null ? String(entidadId) : null,
      detalle: detalle ?? null,
      ip: req.ip,
    });
  } catch (err) {
    console.error("No se pudo escribir en la bitacora:", err.message);
  }
}

module.exports = { registrar };
