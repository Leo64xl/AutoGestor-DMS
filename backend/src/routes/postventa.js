const express = require("express");
const { Op } = require("sequelize");
const { ServicioPostventa, Venta, Vehiculo, Cliente } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { folio } = require("../utils/folio");

const router = express.Router();

const INCLUDE = [
  { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio", "color"] },
  { model: Cliente, attributes: ["id", "nombre", "apellidos", "email", "telefono"] },
  { model: Venta, attributes: ["id", "folio", "fechaVenta"] },
];

router.get("/servicios", requierePermiso(PERMISOS.POSTVENTA_VER), async (req, res) => {
  const where = {};
  if (req.query.estatus) where.estatus = req.query.estatus;
  if (req.query.vehiculoId) where.vehiculoId = Number(req.query.vehiculoId);
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.desde || req.query.hasta) {
    where.fechaCita = {};
    if (req.query.desde) where.fechaCita[Op.gte] = new Date(`${req.query.desde}T00:00:00`);
    if (req.query.hasta) where.fechaCita[Op.lte] = new Date(`${req.query.hasta}T23:59:59`);
  }

  res.json(await ServicioPostventa.findAll({ where, include: INCLUDE, order: [["fechaCita", "DESC"]] }));
});

/** Unidades elegibles para servicio: solo las vendidas por la agencia (RF-035). */
router.get("/vehiculos-elegibles", requierePermiso(PERMISOS.POSTVENTA_VER), async (_req, res) => {
  const ventas = await Venta.findAll({
    where: { estatus: { [Op.ne]: "cancelada" } },
    include: [
      { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio", "color"] },
      { model: Cliente, attributes: ["id", "nombre", "apellidos"] },
    ],
    order: [["id", "DESC"]],
  });

  res.json(
    ventas.map((v) => ({
      ventaId: v.id,
      folioVenta: v.folio,
      fechaVenta: v.fechaVenta,
      vehiculo: v.vehiculo,
      cliente: v.cliente,
    }))
  );
});

/** RF-036 (HU-23): historial de servicios de una unidad. */
router.get("/vehiculos/:vehiculoId/historial", requierePermiso(PERMISOS.POSTVENTA_VER), async (req, res) => {
  const vehiculo = await Vehiculo.findByPk(req.params.vehiculoId);
  if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado" });

  const servicios = await ServicioPostventa.findAll({
    where: { vehiculoId: vehiculo.id },
    include: INCLUDE,
    order: [["fechaCita", "ASC"]],
  });
  res.json({ vehiculo, servicios });
});

/** RF-035: agenda un servicio para un vehiculo vendido por la agencia. */
router.post("/servicios", requierePermiso(PERMISOS.POSTVENTA_GESTIONAR), async (req, res) => {
  const { ventaId, tipo, fechaCita, kilometraje, descripcion } = req.body || {};
  if (!ventaId || !tipo || !fechaCita) {
    return res.status(400).json({ error: "ventaId, tipo y fechaCita son obligatorios" });
  }
  if (!["mantenimiento_menor", "mantenimiento_mayor", "garantia", "revision_general"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo de servicio invalido" });
  }
  if (new Date(fechaCita) <= new Date()) {
    return res.status(400).json({ error: "La cita debe agendarse en una fecha y hora futuras" });
  }

  // El modulo solo atiende unidades vendidas por la agencia.
  const venta = await Venta.findByPk(ventaId);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.estatus === "cancelada") {
    return res.status(409).json({ error: "La venta de esa unidad fue cancelada" });
  }

  const duplicada = await ServicioPostventa.findOne({
    where: { vehiculoId: venta.vehiculoId, estatus: "agendado" },
  });
  if (duplicada) {
    return res.status(409).json({ error: `La unidad ya tiene el servicio ${duplicada.folio} agendado` });
  }

  const servicio = await ServicioPostventa.create({
    folio: "PENDIENTE",
    ventaId: venta.id,
    vehiculoId: venta.vehiculoId,
    clienteId: venta.clienteId,
    tipo,
    fechaCita: new Date(fechaCita),
    kilometraje: kilometraje ? Number(kilometraje) : null,
    descripcion: descripcion || null,
  });
  servicio.folio = folio("SRV", servicio.id);
  await servicio.save();

  await registrar(req, "ALTA_SERVICIO_POSTVENTA", {
    entidad: "servicio_postventa",
    entidadId: servicio.id,
    detalle: `folio=${servicio.folio}, tipo=${tipo}`,
  });
  res.status(201).json(await ServicioPostventa.findByPk(servicio.id, { include: INCLUDE }));
});

/** Cierre del servicio con observaciones y costo del trabajo realizado. */
router.patch("/servicios/:id/realizado", requierePermiso(PERMISOS.POSTVENTA_GESTIONAR), async (req, res) => {
  const servicio = await ServicioPostventa.findByPk(req.params.id);
  if (!servicio) return res.status(404).json({ error: "Servicio no encontrado" });
  if (servicio.estatus !== "agendado") {
    return res.status(409).json({ error: `El servicio ya esta ${servicio.estatus}` });
  }

  const { observaciones, costo, kilometraje } = req.body || {};
  servicio.estatus = "realizado";
  servicio.observaciones = observaciones || null;
  if (costo != null) servicio.costo = Number(costo);
  if (kilometraje != null) servicio.kilometraje = Number(kilometraje);
  await servicio.save();

  await registrar(req, "CIERRE_SERVICIO_POSTVENTA", { entidad: "servicio_postventa", entidadId: servicio.id });
  res.json(await ServicioPostventa.findByPk(servicio.id, { include: INCLUDE }));
});

router.patch("/servicios/:id/cancelar", requierePermiso(PERMISOS.POSTVENTA_GESTIONAR), async (req, res) => {
  const servicio = await ServicioPostventa.findByPk(req.params.id);
  if (!servicio) return res.status(404).json({ error: "Servicio no encontrado" });
  if (servicio.estatus !== "agendado") {
    return res.status(409).json({ error: `El servicio ya esta ${servicio.estatus}` });
  }

  const { motivo } = req.body || {};
  if (!motivo) return res.status(400).json({ error: "Captura el motivo de la cancelacion" });

  servicio.estatus = "cancelado";
  servicio.motivoCancelacion = motivo;
  await servicio.save();

  await registrar(req, "CANCELACION_SERVICIO_POSTVENTA", { entidad: "servicio_postventa", entidadId: servicio.id, detalle: motivo });
  res.json(await ServicioPostventa.findByPk(servicio.id, { include: INCLUDE }));
});

module.exports = router;
