const { Usuario, Rol } = require("../models");

/** Catalogo de permisos del MVP (RF-004). */
const PERMISOS = {
  USUARIOS_GESTIONAR: "usuarios.gestionar",
  VEHICULOS_VER: "vehiculos.ver",
  VEHICULOS_GESTIONAR: "vehiculos.gestionar",
  CLIENTES_VER: "clientes.ver",
  CLIENTES_GESTIONAR: "clientes.gestionar",
  VENTAS_VER: "ventas.ver",
  VENTAS_GESTIONAR: "ventas.gestionar",
  PRUEBAS_VER: "pruebas.ver",
  PRUEBAS_GESTIONAR: "pruebas.gestionar",
  FINANCIAMIENTO_VER: "financiamiento.ver",
  FINANCIAMIENTO_GESTIONAR: "financiamiento.gestionar",
  POSTVENTA_VER: "postventa.ver",
  POSTVENTA_GESTIONAR: "postventa.gestionar",
  REPORTES_VER: "reportes.ver",
  BITACORA_VER: "bitacora.ver",
};

/** RF-001: exige sesion activa. La expiracion por inactividad la aplica express-session (RNF-005). */
async function requiereSesion(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({ error: "Sesion no iniciada o expirada" });
  }
  const usuario = await Usuario.findByPk(req.session.usuarioId, { include: Rol });
  if (!usuario || !usuario.activo) {
    // RF-005: la desactivacion revoca el acceso de inmediato
    req.session.destroy(() => {});
    return res.status(401).json({ error: "La cuenta fue desactivada" });
  }
  req.usuario = usuario;
  next();
}

/** RF-002: mientras la contrasena temporal no se cambie, solo se permite el cambio de contrasena. */
function bloqueaSiRequiereCambio(req, res, next) {
  if (req.usuario.requiereCambioPassword) {
    return res.status(403).json({
      error: "Debes definir una nueva contrasena antes de usar el sistema",
      requiereCambioPassword: true,
    });
  }
  next();
}

/** RF-004: verifica que el perfil del usuario tenga el permiso solicitado. */
function requierePermiso(permiso) {
  return (req, res, next) => {
    const permisos = req.usuario?.rol?.permisos || [];
    if (permisos.includes("*") || permisos.includes(permiso)) return next();
    return res.status(403).json({ error: "No tienes permiso para realizar esta accion" });
  };
}

module.exports = { PERMISOS, requiereSesion, bloqueaSiRequiereCambio, requierePermiso };
