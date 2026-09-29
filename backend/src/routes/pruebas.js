const express = require("express");
const { Op } = require("sequelize");
const { PruebaManejo, Vehiculo, Cliente, Usuario } = require("../models");
const { PERMISOS, requierePermiso } = require("../middleware/auth");
const { registrar } = require("../middleware/bitacora");
const { folio } = require("../utils/folio");

const router = express.Router();

/** Duracion estimada de una prueba de manejo; define la ventana que se considera ocupada. */
const DURACION_MINUTOS = 60;

const INCLUDE = [
  { model: Cliente, attributes: ["id", "nombre", "apellidos", "email", "telefono"] },
  { model: Vehiculo, attributes: ["id", "vin", "marca", "modelo", "anio", "color", "estatus"] },
  { model: Usuario, attributes: ["id", "nombre", "username"] },
];

/** UC-04, paso 2: una unidad no puede tener dos pruebas traslapadas. */
async function horarioOcupado(vehiculoId, fechaHora, excluirId = null) {
  const inicio = new Date(new Date(fechaHora).getTime() - DURACION_MINUTOS * 60000);
  const fin = new Date(new Date(fechaHora).getTime() + DURACION_MINUTOS * 60000);
  const where = {
    vehiculoId,
    estatus: "agendada",
    fechaHora: { [Op.gt]: inicio, [Op.lt]: fin },
  };
  if (excluirId) where.id = { [Op.ne]: excluirId };
  return Boolean(await PruebaManejo.findOne({ where }));
}

router.get("/", requierePermiso(PERMISOS.PRUEBAS_VER), async (req, res) => {
  const where = {};
  if (req.query.estatus) where.estatus = req.query.estatus;
  if (req.query.clienteId) where.clienteId = Number(req.query.clienteId);
  if (req.query.vehiculoId) where.vehiculoId = Number(req.query.vehiculoId);
  if (req.query.desde || req.query.hasta) {
    where.fechaHora = {};
    if (req.query.desde) where.fechaHora[Op.gte] = new Date(`${req.query.desde}T00:00:00`);
    if (req.query.hasta) where.fechaHora[Op.lte] = new Date(`${req.query.hasta}T23:59:59`);
  }

  res.json(await PruebaManejo.findAll({ where, include: INCLUDE, order: [["fechaHora", "DESC"]] }));
});

/** UC-04, flujo alterno 2a: horarios libres sugeridos para una unidad en un dia. */
router.get("/disponibilidad", requierePermiso(PERMISOS.PRUEBAS_VER), async (req, res) => {
  const { vehiculoId, fecha } = req.query;
  if (!vehiculoId || !fecha) {
    return res.status(400).json({ error: "vehiculoId y fecha son obligatorios" });
  }

  const agendadas = await PruebaManejo.findAll({
    where: {
      vehiculoId: Number(vehiculoId),
      estatus: "agendada",
      fechaHora: { [Op.gte]: new Date(`${fecha}T00:00:00`), [Op.lte]: new Date(`${fecha}T23:59:59`) },
    },
  });

  // Horario comercial declarado en el RNF-002: 8:00 a 20:00 h.
  const ocupadas = agendadas.map((p) => new Date(p.fechaHora).getHours());
  const horarios = [];
  for (let hora = 8; hora < 20; hora += 1) {
    horarios.push({ hora: `${String(hora).padStart(2, "0")}:00`, disponible: !ocupadas.includes(hora) });
  }
  res.json(horarios);
});

/** RF-023 (UC-04): agenda la prueba y deja al vendedor asignado como responsable. */
router.post("/", requierePermiso(PERMISOS.PRUEBAS_GESTIONAR), async (req, res) => {
  const { clienteId, vehiculoId, fechaHora } = req.body || {};
  if (!clienteId || !vehiculoId || !fechaHora) {
    return res.status(400).json({ error: "clienteId, vehiculoId y fechaHora son obligatorios" });
  }
  if (new Date(fechaHora) <= new Date()) {
    return res.status(400).json({ error: "La cita debe agendarse en una fecha y hora futuras" });
  }

  if (!(await Cliente.findByPk(clienteId))) return res.status(404).json({ error: "Cliente no encontrado" });

  const vehiculo = await Vehiculo.findByPk(vehiculoId);
  if (!vehiculo || !vehiculo.activo) {
    return res.status(404).json({ error: "Vehiculo no encontrado en el catalogo activo" });
  }
  if (vehiculo.estatus === "vendido") {
    return res.status(409).json({ error: "El vehiculo ya fue vendido y no esta disponible para pruebas" });
  }
  if (await horarioOcupado(vehiculoId, fechaHora)) {
    return res.status(409).json({ error: "Ya existe una prueba agendada para esa unidad en ese horario" });
  }

  const prueba = await PruebaManejo.create({
    folio: "PENDIENTE",
    clienteId,
    vehiculoId,
    usuarioId: req.usuario.id,
    fechaHora: new Date(fechaHora),
  });
  prueba.folio = folio("PM", prueba.id);
  await prueba.save();

  await registrar(req, "ALTA_PRUEBA_MANEJO", {
    entidad: "prueba_manejo",
    entidadId: prueba.id,
    detalle: `folio=${prueba.folio}, vehiculo=${vehiculo.vin}`,
  });
  res.status(201).json(await PruebaManejo.findByPk(prueba.id, { include: INCLUDE }));
});

/** RF-024 (UC-04, paso 4): identificacion y licencia del cliente antes de la prueba. */
router.patch("/:id/identificacion", requierePermiso(PERMISOS.PRUEBAS_GESTIONAR), async (req, res) => {
  const prueba = await PruebaManejo.findByPk(req.params.id);
  if (!prueba) return res.status(404).json({ error: "Prueba de manejo no encontrada" });
  if (prueba.estatus !== "agendada") {
    return res.status(409).json({ error: `La prueba ya esta ${prueba.estatus}` });
  }

  const { identificacionTipo, identificacionNumero, licenciaNumero, licenciaVigencia } = req.body || {};
  if (!identificacionTipo || !identificacionNumero || !licenciaNumero || !licenciaVigencia) {
    return res.status(400).json({ error: "Tipo y numero de identificacion, numero de licencia y vigencia son obligatorios" });
  }
  // UC-04, flujo alterno 4a: sin licencia vigente no puede realizarse la prueba.
  if (licenciaVigencia < new Date().toISOString().slice(0, 10)) {
    return res.status(409).json({ error: "La licencia de conducir esta vencida; cancela la prueba indicando el motivo" });
  }

  Object.assign(prueba, { identificacionTipo, identificacionNumero, licenciaNumero, licenciaVigencia });
  await prueba.save();

  await registrar(req, "REGISTRO_IDENTIFICACION_PRUEBA", { entidad: "prueba_manejo", entidadId: prueba.id });
  res.json(await PruebaManejo.findByPk(prueba.id, { include: INCLUDE }));
});

/** RF-025 (UC-04, paso 5): resultado y observaciones al finalizar la prueba. */
router.patch("/:id/resultado", requierePermiso(PERMISOS.PRUEBAS_GESTIONAR), async (req, res) => {
  const prueba = await PruebaManejo.findByPk(req.params.id);
  if (!prueba) return res.status(404).json({ error: "Prueba de manejo no encontrada" });
  if (prueba.estatus !== "agendada") {
    return res.status(409).json({ error: `La prueba ya esta ${prueba.estatus}` });
  }
  if (!prueba.licenciaNumero) {
    return res.status(409).json({ error: "Primero registra la identificacion y la licencia del cliente" });
  }

  const { resultado, observaciones } = req.body || {};
  if (!["interesado", "no_interesado", "requiere_otra_unidad"].includes(resultado)) {
    return res.status(400).json({ error: "Resultado invalido" });
  }

  prueba.resultado = resultado;
  prueba.observaciones = observaciones || null;
  prueba.estatus = "realizada";
  await prueba.save();

  await registrar(req, "RESULTADO_PRUEBA_MANEJO", { entidad: "prueba_manejo", entidadId: prueba.id, detalle: `resultado=${resultado}` });
  res.json(await PruebaManejo.findByPk(prueba.id, { include: INCLUDE }));
});

router.patch("/:id/cancelar", requierePermiso(PERMISOS.PRUEBAS_GESTIONAR), async (req, res) => {
  const prueba = await PruebaManejo.findByPk(req.params.id);
  if (!prueba) return res.status(404).json({ error: "Prueba de manejo no encontrada" });
  if (prueba.estatus !== "agendada") {
    return res.status(409).json({ error: `La prueba ya esta ${prueba.estatus}` });
  }

  const { motivo } = req.body || {};
  if (!motivo) return res.status(400).json({ error: "Captura el motivo de la cancelacion" });

  prueba.estatus = "cancelada";
  prueba.motivoCancelacion = motivo;
  await prueba.save();

  await registrar(req, "CANCELACION_PRUEBA_MANEJO", { entidad: "prueba_manejo", entidadId: prueba.id, detalle: motivo });
  res.json(await PruebaManejo.findByPk(prueba.id, { include: INCLUDE }));
});

module.exports = router;
