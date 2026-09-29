const express = require("express");
const { SolicitudFinanciamiento, Pago, Venta, Cliente, Vehiculo, Usuario } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { folio, aNumero } = require("../utils/folio");

const router = express.Router();

const INCLUDE_SOLICITUD = [
  {
    model: Venta,
    attributes: ["id", "folio", "total", "formaPago", "estatus"],
    include: [
      { model: Cliente, attributes: ["id", "nombre", "apellidos"] },
      { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio"] },
    ],
  },
  { model: Usuario, attributes: ["id", "nombre", "username"] },
];

/* ----------------------------- Financiamiento ----------------------------- */

router.get("/solicitudes", requierePermiso(PERMISOS.FINANCIAMIENTO_VER), async (req, res) => {
  const where = {};
  if (req.query.estatus) where.estatus = req.query.estatus;
  if (req.query.ventaId) where.ventaId = Number(req.query.ventaId);

  res.json(await SolicitudFinanciamiento.findAll({ where, include: INCLUDE_SOLICITUD, order: [["id", "DESC"]] }));
});

/** RF-031: solicitud de financiamiento asociada a una venta. */
router.post("/solicitudes", requierePermiso(PERMISOS.FINANCIAMIENTO_GESTIONAR), async (req, res) => {
  const { ventaId, entidadFinanciera, montoSolicitado, observaciones } = req.body || {};
  if (!ventaId || !entidadFinanciera || montoSolicitado == null) {
    return res.status(400).json({ error: "ventaId, entidadFinanciera y montoSolicitado son obligatorios" });
  }

  const venta = await Venta.findByPk(ventaId);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.formaPago !== "financiamiento") {
    return res.status(409).json({ error: "La venta se registro como pago de contado" });
  }
  if (await SolicitudFinanciamiento.findOne({ where: { ventaId } })) {
    return res.status(409).json({ error: "Esta venta ya tiene una solicitud de financiamiento" });
  }
  if (aNumero(montoSolicitado) <= 0 || aNumero(montoSolicitado) > aNumero(venta.total)) {
    return res.status(400).json({ error: "El monto solicitado debe ser mayor a cero y no exceder el total de la venta" });
  }

  const solicitud = await SolicitudFinanciamiento.create({
    folio: "PENDIENTE",
    ventaId,
    usuarioId: req.usuario.id,
    entidadFinanciera,
    montoSolicitado: aNumero(montoSolicitado),
    observaciones: observaciones || null,
  });
  solicitud.folio = folio("SOL", solicitud.id);
  await solicitud.save();

  await registrar(req, "ALTA_SOLICITUD_FINANCIAMIENTO", {
    entidad: "solicitud_financiamiento",
    entidadId: solicitud.id,
    detalle: `folio=${solicitud.folio}, entidad=${entidadFinanciera}`,
  });
  res.status(201).json(await SolicitudFinanciamiento.findByPk(solicitud.id, { include: INCLUDE_SOLICITUD }));
});

/** RF-032 (primera parte): envio de la solicitud a la entidad financiera. */
router.patch("/solicitudes/:id/enviar", requierePermiso(PERMISOS.FINANCIAMIENTO_GESTIONAR), async (req, res) => {
  const solicitud = await SolicitudFinanciamiento.findByPk(req.params.id);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (solicitud.estatus !== "capturada") {
    return res.status(409).json({ error: `La solicitud ya fue ${solicitud.estatus}` });
  }

  solicitud.estatus = "enviada";
  solicitud.fechaEnvio = new Date();
  await solicitud.save();

  await registrar(req, "ENVIO_SOLICITUD_FINANCIAMIENTO", { entidad: "solicitud_financiamiento", entidadId: solicitud.id });
  res.json(await SolicitudFinanciamiento.findByPk(solicitud.id, { include: INCLUDE_SOLICITUD }));
});

/**
 * RF-032 (segunda parte) y RF-033: registro de la respuesta de la entidad financiera.
 * Si el credito se aprueba, las condiciones (enganche, plazo y tasa) son obligatorias.
 */
router.patch("/solicitudes/:id/respuesta", requierePermiso(PERMISOS.FINANCIAMIENTO_GESTIONAR), async (req, res) => {
  const solicitud = await SolicitudFinanciamiento.findByPk(req.params.id);
  if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
  if (solicitud.estatus !== "enviada") {
    return res.status(409).json({ error: "Solo puede registrarse la respuesta de una solicitud enviada" });
  }

  const { estatus, enganche, plazoMeses, tasaAnual, observaciones } = req.body || {};
  if (!["aprobada", "rechazada"].includes(estatus)) {
    return res.status(400).json({ error: "La respuesta debe ser 'aprobada' o 'rechazada'" });
  }

  if (estatus === "aprobada") {
    if (enganche == null || !plazoMeses || tasaAnual == null) {
      return res.status(400).json({ error: "Un credito aprobado requiere enganche, plazo y tasa" });
    }
    if (aNumero(enganche) < 0 || Number(plazoMeses) <= 0 || aNumero(tasaAnual) < 0) {
      return res.status(400).json({ error: "Enganche, plazo y tasa deben ser valores positivos" });
    }
    solicitud.enganche = aNumero(enganche);
    solicitud.plazoMeses = Number(plazoMeses);
    solicitud.tasaAnual = aNumero(tasaAnual);
  }

  solicitud.estatus = estatus;
  solicitud.fechaRespuesta = new Date();
  if (observaciones !== undefined) solicitud.observaciones = observaciones || null;
  await solicitud.save();

  await registrar(req, `RESPUESTA_FINANCIAMIENTO_${estatus.toUpperCase()}`, {
    entidad: "solicitud_financiamiento",
    entidadId: solicitud.id,
    detalle: estatus === "aprobada" ? `enganche=${solicitud.enganche}, plazo=${solicitud.plazoMeses}, tasa=${solicitud.tasaAnual}` : null,
  });
  res.json(await SolicitudFinanciamiento.findByPk(solicitud.id, { include: INCLUDE_SOLICITUD }));
});

/* ---------------------------------- Pagos --------------------------------- */

router.get("/pagos", requierePermiso(PERMISOS.FINANCIAMIENTO_VER), async (req, res) => {
  const where = {};
  if (req.query.ventaId) where.ventaId = Number(req.query.ventaId);

  res.json(
    await Pago.findAll({
      where,
      include: [
        {
          model: Venta,
          attributes: ["id", "folio", "total"],
          include: [{ model: Cliente, attributes: ["id", "nombre", "apellidos"] }],
        },
        { model: Usuario, attributes: ["id", "nombre", "username"] },
      ],
      order: [["id", "DESC"]],
    })
  );
});

/** RF-034: registro de pagos de contado o en abonos, validando contra el saldo pendiente. */
router.post("/pagos", requierePermiso(PERMISOS.FINANCIAMIENTO_GESTIONAR), async (req, res) => {
  const { ventaId, tipo, metodo, monto, referencia, fecha } = req.body || {};
  if (!ventaId || !tipo || !metodo || monto == null) {
    return res.status(400).json({ error: "ventaId, tipo, metodo y monto son obligatorios" });
  }
  if (!["contado", "enganche", "abono"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo de pago invalido" });
  }
  if (!["efectivo", "transferencia", "tarjeta", "cheque"].includes(metodo)) {
    return res.status(400).json({ error: "Metodo de pago invalido" });
  }
  if (aNumero(monto) <= 0) return res.status(400).json({ error: "El monto debe ser mayor a cero" });

  const venta = await Venta.findByPk(ventaId, { include: [{ model: Pago, as: "pagos" }] });
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });
  if (venta.estatus === "cancelada") return res.status(409).json({ error: "La venta esta cancelada" });

  const pagado = (venta.pagos || []).reduce((suma, p) => suma + aNumero(p.monto), 0);
  const pendiente = aNumero(venta.total) - pagado;
  if (aNumero(monto) > pendiente + 0.009) {
    return res.status(409).json({ error: `El monto excede el saldo pendiente (${pendiente.toFixed(2)})` });
  }

  const pago = await Pago.create({
    folio: "PENDIENTE",
    ventaId,
    usuarioId: req.usuario.id,
    tipo,
    metodo,
    monto: aNumero(monto),
    referencia: referencia || null,
    fecha: fecha ? new Date(fecha) : new Date(),
  });
  pago.folio = folio("PAG", pago.id);
  await pago.save();

  await registrar(req, "REGISTRO_PAGO", {
    entidad: "venta",
    entidadId: ventaId,
    detalle: `folio=${pago.folio}, tipo=${tipo}, monto=${pago.monto}`,
  });
  res.status(201).json({ pago, pagado: pagado + aNumero(monto), pendiente: pendiente - aNumero(monto) });
});

module.exports = router;
