const express = require("express");
const { Op } = require("sequelize");
const { Bitacora } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");

const router = express.Router();

/**
 * RF-040 / RNF-012: la bitacora se expone unicamente en modo lectura.
 * No existen rutas PUT, PATCH ni DELETE; cualquier otro metodo se rechaza
 * explicitamente para dejar constancia de la inmutabilidad en la interfaz.
 */
router.get("/", requierePermiso(PERMISOS.BITACORA_VER), async (req, res) => {
  const { usuario, accion, entidad, desde, hasta, limite } = req.query;
  const where = {};

  if (usuario) where.usuarioNombre = { [Op.like]: `%${usuario}%` };
  if (accion) where.accion = { [Op.like]: `%${accion}%` };
  if (entidad) where.entidad = entidad;
  if (desde || hasta) {
    where.createdAt = {};
    if (desde) where.createdAt[Op.gte] = new Date(`${desde}T00:00:00`);
    if (hasta) where.createdAt[Op.lte] = new Date(`${hasta}T23:59:59`);
  }

  const registros = await Bitacora.findAll({
    where,
    order: [["id", "DESC"]],
    limit: Math.min(Number(limite) || 200, 1000),
  });
  res.json(registros);
});

router.all(/.*/, (_req, res) => {
  res.status(405).json({ error: "La bitacora es de solo lectura: no admite modificacion ni eliminacion" });
});

module.exports = router;
