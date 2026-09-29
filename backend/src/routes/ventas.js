const express = require("express");
const { Op } = require("sequelize");
const {
  sequelize,
  Vehiculo,
  Cliente,
  Usuario,
  Accesorio,
  Cotizacion,
  CotizacionAccesorio,
  Apartado,
} = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");

const router = express.Router();

const INCLUDE_COTIZACION = [
  { model: Cliente, attributes: ["id", "nombre", "apellidos", "email", "telefono", "estatus"] },
  { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio", "color", "precio", "estatus"] },
  { model: Usuario, attributes: ["id", "nombre", "username"] },
  { model: CotizacionAccesorio, as: "detalleAccesorios", include: [Accesorio] },
];

const INCLUDE_APARTADO = [
  { model: Cliente, attributes: ["id", "nombre", "apellidos", "email", "telefono"] },
  { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio", "color", "precio", "estatus"] },
  { model: Usuario, attributes: ["id", "nombre", "username"] },
  { model: Cotizacion, attributes: ["id", "folio", "total"] },
];

const { folio, aNumero } = require("../utils/folio");

/**
 * RF-021 / UC-02 flujo alterno 4a: libera los apartados cuya fecha limite ya paso
 * y devuelve el vehiculo a "disponible". Se ejecuta antes de cada consulta del modulo.
 */
async function liberarApartadosVencidos() {
  const hoy = new Date().toISOString().slice(0, 10);
  const vencidos = await Apartado.findAll({ where: { estatus: "vigente", fechaLimite: { [Op.lt]: hoy } } });

  for (const apartado of vencidos) {
    await sequelize.transaction(async (t) => {
      apartado.estatus = "vencido";
      await apartado.save({ transaction: t });

      const vehiculo = await Vehiculo.findByPk(apartado.vehiculoId, { transaction: t });
      if (vehiculo && vehiculo.estatus === "apartado") {
        vehiculo.estatus = "disponible";
        await vehiculo.save({ transaction: t });
      }
      if (apartado.cotizacionId) {
        await Cotizacion.update({ estatus: "vigente" }, { where: { id: apartado.cotizacionId, estatus: "apartada" }, transaction: t });
      }
    });
  }
  return vencidos.length;
}

/* ------------------------------- Accesorios ------------------------------- */

router.get("/accesorios", requierePermiso(PERMISOS.VENTAS_VER), async (_req, res) => {
  res.json(await Accesorio.findAll({ where: { activo: true }, order: [["nombre", "ASC"]] }));
});

/* ------------------------------ Cotizaciones ------------------------------ */

router.get("/cotizaciones", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const where = {};
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.estatus) where.estatus = req.query.estatus;

  res.json(await Cotizacion.findAll({ where, include: INCLUDE_COTIZACION, order: [["id", "DESC"]] }));
});

router.get("/cotizaciones/:id", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  const cotizacion = await Cotizacion.findByPk(req.params.id, { include: INCLUDE_COTIZACION });
  if (!cotizacion) return res.status(404).json({ error: "Cotizacion no encontrada" });
  res.json(cotizacion);
});

/**
 * RF-018 / RF-019 (UC-01): genera la cotizacion con folio y monto total.
 * El precio del vehiculo y de los accesorios se congela al momento de cotizar.
 */
router.post("/cotizaciones", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const { clienteId, vehiculoId, accesorios = [], formaPago = "contado", diasVigencia = 15 } = req.body || {};
  if (!clienteId || !vehiculoId) {
    return res.status(400).json({ error: "clienteId y vehiculoId son obligatorios" });
  }
  if (!["contado", "financiamiento"].includes(formaPago)) {
    return res.status(400).json({ error: "Forma de pago invalida" });
  }

  const cliente = await Cliente.findByPk(clienteId);
  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  const vehiculo = await Vehiculo.findByPk(vehiculoId);
  if (!vehiculo || !vehiculo.activo) return res.status(404).json({ error: "Vehiculo no encontrado en el catalogo activo" });
  // UC-01 flujo alterno 3a
  if (vehiculo.estatus !== "disponible") {
    return res.status(409).json({ error: `El vehiculo no esta disponible (estatus actual: ${vehiculo.estatus})` });
  }

  const ids = accesorios.map((a) => Number(a.accesorioId));
  const catalogo = ids.length ? await Accesorio.findAll({ where: { id: ids, activo: true } }) : [];
  if (catalogo.length !== new Set(ids).size) {
    return res.status(400).json({ error: "Uno o mas accesorios no existen o estan inactivos" });
  }

  const precioVehiculo = aNumero(vehiculo.precio);
  const lineas = accesorios.map((a) => {
    const accesorio = catalogo.find((c) => c.id === Number(a.accesorioId));
    const cantidad = Math.max(1, Number(a.cantidad) || 1);
    return { accesorioId: accesorio.id, cantidad, precioUnitario: aNumero(accesorio.precio) };
  });
  const totalAccesorios = lineas.reduce((suma, l) => suma + l.precioUnitario * l.cantidad, 0);

  const vigenciaHasta = new Date();
  vigenciaHasta.setDate(vigenciaHasta.getDate() + Number(diasVigencia));

  const cotizacion = await sequelize.transaction(async (t) => {
    const creada = await Cotizacion.create(
      {
        folio: "PENDIENTE",
        clienteId: cliente.id,
        vehiculoId: vehiculo.id,
        usuarioId: req.usuario.id,
        precioVehiculo,
        totalAccesorios,
        total: precioVehiculo + totalAccesorios,
        formaPago,
        vigenciaHasta: vigenciaHasta.toISOString().slice(0, 10),
      },
      { transaction: t }
    );
    creada.folio = folio("COT", creada.id);
    await creada.save({ transaction: t });

    if (lineas.length) {
      await CotizacionAccesorio.bulkCreate(
        lineas.map((l) => ({ ...l, cotizacionId: creada.id })),
        { transaction: t }
      );
    }
    // HU-09: cotizar mueve al prospecto en el embudo comercial.
    if (["nuevo", "en_seguimiento"].includes(cliente.estatus)) {
      cliente.estatus = "cotizando";
      await cliente.save({ transaction: t });
    }
    return creada;
  });

  await registrar(req, "ALTA_COTIZACION", { entidad: "cotizacion", entidadId: cotizacion.id, detalle: `folio=${cotizacion.folio}, total=${cotizacion.total}` });
  res.status(201).json(await Cotizacion.findByPk(cotizacion.id, { include: INCLUDE_COTIZACION }));
});

router.patch("/cotizaciones/:id/cancelar", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const cotizacion = await Cotizacion.findByPk(req.params.id);
  if (!cotizacion) return res.status(404).json({ error: "Cotizacion no encontrada" });
  if (cotizacion.estatus !== "vigente") {
    return res.status(409).json({ error: `Solo se puede cancelar una cotizacion vigente (estatus actual: ${cotizacion.estatus})` });
  }

  cotizacion.estatus = "cancelada";
  await cotizacion.save();

  await registrar(req, "CANCELACION_COTIZACION", { entidad: "cotizacion", entidadId: cotizacion.id });
  res.json(cotizacion);
});

/* -------------------------------- Apartados ------------------------------- */

router.get("/apartados", requierePermiso(PERMISOS.VENTAS_VER), async (req, res) => {
  await liberarApartadosVencidos();

  const where = {};
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.estatus) where.estatus = req.query.estatus;

  res.json(await Apartado.findAll({ where, include: INCLUDE_APARTADO, order: [["id", "DESC"]] }));
});

/**
 * RF-020 / RF-021 (UC-02): aparta el vehiculo con anticipo y fecha limite.
 * La transaccion bloquea la fila del vehiculo (SELECT ... FOR UPDATE) para que dos
 * vendedores simultaneos no puedan apartar la misma unidad (UC-02 flujo alterno 3a).
 */
router.post("/apartados", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const { cotizacionId, vehiculoId, clienteId, anticipo, fechaLimite } = req.body || {};
  if (anticipo == null || Number(anticipo) <= 0) {
    return res.status(400).json({ error: "El anticipo debe ser mayor a cero" });
  }
  if (!fechaLimite) return res.status(400).json({ error: "La fecha limite del apartado es obligatoria" });
  if (fechaLimite <= new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: "La fecha limite debe ser posterior al dia de hoy" });
  }

  let cotizacion = null;
  let vehiculoObjetivo = vehiculoId;
  let clienteObjetivo = clienteId;

  if (cotizacionId) {
    cotizacion = await Cotizacion.findByPk(cotizacionId);
    if (!cotizacion) return res.status(404).json({ error: "Cotizacion no encontrada" });
    if (cotizacion.estatus !== "vigente") {
      return res.status(409).json({ error: `La cotizacion no esta vigente (estatus actual: ${cotizacion.estatus})` });
    }
    vehiculoObjetivo = cotizacion.vehiculoId;
    clienteObjetivo = cotizacion.clienteId;
  }

  if (!vehiculoObjetivo || !clienteObjetivo) {
    return res.status(400).json({ error: "Indica una cotizacion, o bien vehiculoId y clienteId" });
  }
  if (!(await Cliente.findByPk(clienteObjetivo))) {
    return res.status(404).json({ error: "Cliente no encontrado" });
  }

  try {
    const apartado = await sequelize.transaction(async (t) => {
      const vehiculo = await Vehiculo.findByPk(vehiculoObjetivo, { transaction: t, lock: t.LOCK.UPDATE });
      if (!vehiculo || !vehiculo.activo) {
        throw Object.assign(new Error("Vehiculo no encontrado en el catalogo activo"), { status: 404 });
      }
      if (vehiculo.estatus !== "disponible") {
        throw Object.assign(new Error(`El vehiculo ya no esta disponible (estatus actual: ${vehiculo.estatus})`), { status: 409 });
      }

      const creado = await Apartado.create(
        {
          folio: "PENDIENTE",
          cotizacionId: cotizacion ? cotizacion.id : null,
          vehiculoId: vehiculo.id,
          clienteId: clienteObjetivo,
          usuarioId: req.usuario.id,
          anticipo: Number(anticipo),
          fechaLimite,
        },
        { transaction: t }
      );
      creado.folio = folio("APA", creado.id);
      await creado.save({ transaction: t });

      vehiculo.estatus = "apartado";
      await vehiculo.save({ transaction: t });

      if (cotizacion) {
        cotizacion.estatus = "apartada";
        await cotizacion.save({ transaction: t });
      }
      return creado;
    });

    await registrar(req, "ALTA_APARTADO", { entidad: "apartado", entidadId: apartado.id, detalle: `folio=${apartado.folio}, anticipo=${apartado.anticipo}` });
    res.status(201).json(await Apartado.findByPk(apartado.id, { include: INCLUDE_APARTADO }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

/** RF-022 / HU-19: cancela el apartado y regresa el vehiculo a "disponible". */
router.patch("/apartados/:id/cancelar", requierePermiso(PERMISOS.VENTAS_GESTIONAR), async (req, res) => {
  const apartado = await Apartado.findByPk(req.params.id);
  if (!apartado) return res.status(404).json({ error: "Apartado no encontrado" });
  if (apartado.estatus !== "vigente") {
    return res.status(409).json({ error: `Solo se puede cancelar un apartado vigente (estatus actual: ${apartado.estatus})` });
  }

  await sequelize.transaction(async (t) => {
    apartado.estatus = "cancelado";
    apartado.motivoCancelacion = req.body?.motivo || null;
    await apartado.save({ transaction: t });

    const vehiculo = await Vehiculo.findByPk(apartado.vehiculoId, { transaction: t, lock: t.LOCK.UPDATE });
    if (vehiculo && vehiculo.estatus === "apartado") {
      vehiculo.estatus = "disponible";
      await vehiculo.save({ transaction: t });
    }
    if (apartado.cotizacionId) {
      await Cotizacion.update({ estatus: "vigente" }, { where: { id: apartado.cotizacionId, estatus: "apartada" }, transaction: t });
    }
  });

  await registrar(req, "CANCELACION_APARTADO", { entidad: "apartado", entidadId: apartado.id, detalle: req.body?.motivo || null });
  res.json(await Apartado.findByPk(apartado.id, { include: INCLUDE_APARTADO }));
});

module.exports = { router, liberarApartadosVencidos };
